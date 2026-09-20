import { load as parseYaml } from 'js-yaml'
import { z } from 'zod'
import { configSchema, type AppConfig } from './configSchema'

/**
 * Config loading is split into a pure `parseConfig` (used by the app, the tests
 * and the `npm run validate` CLI) and a thin browser fetch wrapper, so the exact
 * same validation runs everywhere.
 */

export interface ConfigIssue {
  /** Dotted path into config.yaml, e.g. `games.quiz.answer_seconds`. */
  path: string
  message: string
  /** Present when the value had to be one of a fixed set. */
  allowed?: string[]
  received?: unknown
}

export type ConfigResult =
  | { ok: true; config: AppConfig; warnings: ConfigIssue[] }
  | { ok: false; issues: ConfigIssue[] }

const formatPath = (path: PropertyKey[]): string =>
  path.length === 0 ? '(root)' : path.map(String).join('.')

/**
 * zod's raw messages are aimed at developers. The person editing config.yaml is
 * not necessarily one, so we surface the key, what we got, and what is allowed.
 */
function valueAtPath(root: unknown, path: PropertyKey[]): unknown {
  let node = root
  for (const key of path) {
    if (typeof node !== 'object' || node === null) return undefined
    node = (node as Record<PropertyKey, unknown>)[key]
  }
  return node
}

export function describeIssues(issues: z.core.$ZodIssue[], root?: unknown): ConfigIssue[] {
  return issues.map((issue) => {
    const path = issue.path as PropertyKey[]
    const out: ConfigIssue = { path: formatPath(path), message: issue.message }

    if ('values' in issue && Array.isArray(issue.values)) {
      out.allowed = issue.values.map(String)
    }

    // zod v4 only attaches `input` to some issue kinds, so fall back to reading
    // the value straight out of the document the user actually wrote.
    const received = 'input' in issue ? issue.input : valueAtPath(root, path)
    if (received !== undefined) out.received = received

    return out
  })
}

export function parseConfig(rawYaml: string): ConfigResult {
  // js-yaml v5 throws on an empty document rather than returning undefined, but
  // a blank or comment-only config is legitimate: every key has a default.
  const hasContent = rawYaml.split('\n').some((line) => {
    const trimmed = line.trim()
    return trimmed !== '' && !trimmed.startsWith('#')
  })
  if (!hasContent) return finish({})

  let data: unknown
  try {
    data = parseYaml(rawYaml)
  } catch (err) {
    return {
      ok: false,
      issues: [
        {
          path: '(root)',
          message: `config.yaml is not valid YAML: ${(err as Error).message}`,
        },
      ],
    }
  }

  // An empty file is legitimate: every key has a default.
  if (data === null || data === undefined) data = {}

  if (typeof data !== 'object' || Array.isArray(data)) {
    return {
      ok: false,
      issues: [{ path: '(root)', message: 'config.yaml must contain a mapping of keys to values' }],
    }
  }

  return finish(data)
}

function finish(data: unknown): ConfigResult {
  const parsed = configSchema.safeParse(data)
  if (!parsed.success) return { ok: false, issues: describeIssues(parsed.error.issues, data) }
  return { ok: true, config: parsed.data, warnings: crossFieldWarnings(parsed.data) }
}

/**
 * Things that are structurally valid but will not play well. These are warnings
 * rather than errors so a half-edited config still boots.
 */
function crossFieldWarnings(config: AppConfig): ConfigIssue[] {
  const warnings: ConfigIssue[] = []

  if (config.mode === 'teams') {
    if (config.teams.length < 2) {
      warnings.push({
        path: 'teams',
        message: 'mode is "teams" but fewer than 2 teams are defined; falling back to solo play',
      })
    }
    const teamNames = new Set(config.teams.map((t) => t.name))
    for (const player of config.players) {
      if (player.team && !teamNames.has(player.team)) {
        warnings.push({
          path: `players.${player.name}.team`,
          message: `player "${player.name}" is on team "${player.team}", which is not listed under teams:`,
        })
      }
    }
  }

  const duplicates = config.players
    .map((p) => p.name.trim().toLowerCase())
    .filter((name, i, all) => all.indexOf(name) !== i)
  for (const name of new Set(duplicates)) {
    warnings.push({ path: 'players', message: `more than one player is called "${name}"` })
  }

  if (Array.isArray(config.party_mode.order) && config.party_mode.order.length < config.party_mode.games) {
    warnings.push({
      path: 'party_mode.order',
      message: `party_mode.games is ${config.party_mode.games} but only ${config.party_mode.order.length} games are listed in party_mode.order`,
    })
  }

  return warnings
}

/** Browser entry point. `data/config.yaml` is served at `/config.yaml`. */
export async function loadConfig(url = '/config.yaml'): Promise<ConfigResult> {
  let response: Response
  try {
    response = await fetch(`${url}?t=${Date.now()}`)
  } catch (err) {
    return {
      ok: false,
      issues: [{ path: '(root)', message: `could not read config.yaml: ${(err as Error).message}` }],
    }
  }
  if (!response.ok) {
    return {
      ok: false,
      issues: [
        {
          path: '(root)',
          message: `could not read config.yaml (HTTP ${response.status}). It should live at data/config.yaml.`,
        },
      ],
    }
  }
  return parseConfig(await response.text())
}

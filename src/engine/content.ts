import { load as parseYaml } from 'js-yaml'
import type { z } from 'zod'
import type { AppConfig, Lang } from './configSchema'
import {
  manifestSchema,
  packHeaderSchema,
  type BaseItem,
  type ManifestEntry,
} from './contentSchema'
import { describeIssues, type ConfigIssue } from './config'

/**
 * Loads the content packs listed in `data/content/manifest.yaml` for the active
 * language, validates every item against the owning game's schema, and applies
 * the filters from `config.content.filters`.
 *
 * Item schemas are passed in rather than imported so this module stays unaware
 * of the game registry (which imports the engine).
 */

export interface LoadedPack {
  entry: ManifestEntry
  items: BaseItem[]
  /** Items the pack declared that failed validation and were skipped. */
  rejected: number
}

export interface ContentIndex {
  /** Filtered, ready-to-play items keyed by game id. */
  byGame: Map<string, BaseItem[]>
  packs: LoadedPack[]
  issues: ConfigIssue[]
  /** Counts before filtering, for the "why is my pack empty" case. */
  rawCounts: Map<string, number>
}

export type ItemSchemas = Record<string, z.ZodType<any>>

const filesFor = (config: AppConfig, manifest: ManifestEntry[], lang: Lang): ManifestEntry[] => {
  const wanted = config.content.packs
  const forLang = manifest.filter((p) => p.lang === lang)
  if (wanted.length === 1 && wanted[0] === 'auto') return forLang.filter((p) => p.auto)
  const ids = new Set(wanted)
  return forLang.filter((p) => ids.has(p.id))
}

/**
 * Audience and tag filters only. Difficulty is deliberately NOT applied here:
 * it is chosen per game and can change between games without reloading the
 * bank, so it is applied when a game's picker is built instead.
 */
export function passesFilters(item: BaseItem, config: AppConfig): boolean {
  const f = config.content.filters
  if (!f.audience.includes(item.audience)) return false
  if (item.tags.some((tag) => f.exclude_tags.includes(tag))) return false
  if (f.include_tags.length > 0 && !item.tags.some((tag) => f.include_tags.includes(tag))) {
    return false
  }
  return true
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(`${url}?t=${Date.now()}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

export function parsePack(
  raw: string,
  entry: ManifestEntry,
  schemas: ItemSchemas,
): { items: BaseItem[]; rejected: number; issues: ConfigIssue[] } {
  const issues: ConfigIssue[] = []
  let data: unknown
  try {
    data = parseYaml(raw)
  } catch (err) {
    return {
      items: [],
      rejected: 0,
      issues: [{ path: entry.file, message: `not valid YAML: ${(err as Error).message}` }],
    }
  }

  const header = packHeaderSchema.safeParse(data)
  if (!header.success) {
    return {
      items: [],
      rejected: 0,
      issues: describeIssues(header.error.issues, data).map((i) => ({
        ...i,
        path: `${entry.file}: ${i.path}`,
      })),
    }
  }

  if (header.data.game !== entry.game) {
    issues.push({
      path: entry.file,
      message: `manifest says this pack is for "${entry.game}" but the file declares "${header.data.game}"`,
    })
  }

  const schema = schemas[entry.game]
  if (!schema) {
    return {
      items: [],
      rejected: 0,
      issues: [
        { path: entry.file, message: `no game registered with the id "${entry.game}"` },
      ],
    }
  }

  const items: BaseItem[] = []
  const seenIds = new Set<string>()
  let rejected = 0

  header.data.items.forEach((rawItem, index) => {
    const parsed = schema.safeParse(rawItem)
    if (!parsed.success) {
      rejected++
      // Report the first couple per pack; a broken template would otherwise
      // produce hundreds of identical lines.
      if (rejected <= 3) {
        for (const issue of describeIssues(parsed.error.issues)) {
          issues.push({ ...issue, path: `${entry.file}[${index}].${issue.path}` })
        }
      }
      return
    }
    const item = parsed.data as BaseItem
    if (seenIds.has(item.id)) {
      issues.push({ path: `${entry.file}[${index}]`, message: `duplicate item id "${item.id}"` })
      rejected++
      return
    }
    seenIds.add(item.id)
    items.push(item)
  })

  return { items, rejected, issues }
}

export async function loadContent(
  config: AppConfig,
  schemas: ItemSchemas,
  baseUrl = '/content',
): Promise<ContentIndex> {
  const issues: ConfigIssue[] = []
  const byGame = new Map<string, BaseItem[]>()
  const rawCounts = new Map<string, number>()
  const packs: LoadedPack[] = []

  let manifestRaw: string
  try {
    manifestRaw = await fetchText(`${baseUrl}/manifest.yaml`)
  } catch (err) {
    return {
      byGame,
      packs,
      rawCounts,
      issues: [
        {
          path: 'content/manifest.yaml',
          message: `could not be read (${(err as Error).message}). It should list every content pack.`,
        },
      ],
    }
  }

  const manifestParsed = manifestSchema.safeParse(parseYaml(manifestRaw) ?? {})
  if (!manifestParsed.success) {
    return {
      byGame,
      packs,
      rawCounts,
      issues: describeIssues(manifestParsed.error.issues).map((i) => ({
        ...i,
        path: `content/manifest.yaml: ${i.path}`,
      })),
    }
  }

  const entries = filesFor(config, manifestParsed.data.packs, config.language)
  if (entries.length === 0) {
    issues.push({
      path: 'content.packs',
      message: `no content packs matched language "${config.language}". Check content/manifest.yaml.`,
    })
  }

  const loaded = await Promise.all(
    entries.map(async (entry) => {
      try {
        return { entry, raw: await fetchText(`${baseUrl}/${entry.file}`) }
      } catch (err) {
        issues.push({ path: entry.file, message: `could not be read (${(err as Error).message})` })
        return null
      }
    }),
  )

  for (const loadedPack of loaded) {
    if (!loadedPack) continue
    const { entry, raw } = loadedPack
    const { items, rejected, issues: packIssues } = parsePack(raw, entry, schemas)
    issues.push(...packIssues)

    rawCounts.set(entry.game, (rawCounts.get(entry.game) ?? 0) + items.length)
    const usable = items.filter((item) => passesFilters(item, config))
    byGame.set(entry.game, [...(byGame.get(entry.game) ?? []), ...usable])
    packs.push({ entry, items: usable, rejected })
  }

  return { byGame, packs, rawCounts, issues }
}

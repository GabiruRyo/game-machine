#!/usr/bin/env tsx
/**
 * `npm run validate` -- schema-checks config.yaml and every content pack, then
 * prints how much content each game actually has. Run it after editing anything
 * under data/.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { load as parseYaml } from 'js-yaml'
import { parseConfig } from '../src/engine/config'
import { passesFilters } from '../src/engine/content'
import { parsePack } from '../src/engine/content'
import { manifestSchema, packHeaderSchema } from '../src/engine/contentSchema'
import { ITEM_SCHEMAS } from '../src/games/schemas'

const DATA = 'data'
const CONTENT = join(DATA, 'content')

const c = {
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
}

let errors = 0
let warnings = 0

const fail = (msg: string) => { errors++; console.log(`  ${c.red('✗')} ${msg}`) }
const warn = (msg: string) => { warnings++; console.log(`  ${c.yellow('!')} ${msg}`) }
const ok = (msg: string) => console.log(`  ${c.green('✓')} ${msg}`)

// ─── config.yaml ─────────────────────────────────────────────────────────────
console.log(c.bold('\nconfig.yaml'))
const configPath = join(DATA, 'config.yaml')
if (!existsSync(configPath)) {
  fail(`${configPath} is missing`)
  process.exit(1)
}
const configResult = parseConfig(readFileSync(configPath, 'utf8'))
if (!configResult.ok) {
  for (const issue of configResult.issues) {
    fail(`${issue.path}: ${issue.message}${issue.allowed ? ` (allowed: ${issue.allowed.join(' | ')})` : ''}`)
  }
  process.exit(1)
}
const config = configResult.config
ok(`valid — language ${config.language}, ${config.players.length} players, ${Object.keys(config.games).length} game blocks`)
for (const issue of configResult.warnings) warn(`${issue.path}: ${issue.message}`)

// Game blocks that no registered game will ever read are almost always typos.
for (const gameId of Object.keys(config.games)) {
  if (!ITEM_SCHEMAS[gameId]) warn(`games.${gameId}: no game with that id is registered (typo?)`)
}

// ─── manifest ────────────────────────────────────────────────────────────────
console.log(c.bold('\ncontent/manifest.yaml'))
const manifestPath = join(CONTENT, 'manifest.yaml')
if (!existsSync(manifestPath)) {
  fail('content/manifest.yaml is missing')
  process.exit(1)
}
const manifestParsed = manifestSchema.safeParse(parseYaml(readFileSync(manifestPath, 'utf8')) ?? {})
if (!manifestParsed.success) {
  for (const issue of manifestParsed.error.issues) fail(`${issue.path.join('.')}: ${issue.message}`)
  process.exit(1)
}
const entries = manifestParsed.data.packs
ok(`${entries.length} packs listed`)

const manifestIds = new Set<string>()
for (const entry of entries) {
  if (manifestIds.has(entry.id)) fail(`duplicate manifest pack id "${entry.id}"`)
  manifestIds.add(entry.id)
  if (!ITEM_SCHEMAS[entry.game]) fail(`pack "${entry.id}" targets unknown game "${entry.game}"`)
}

// ─── packs ───────────────────────────────────────────────────────────────────
console.log(c.bold('\ncontent packs'))

interface Loaded {
  headerId: string
  game: string
  lang: string
  ids: string[]
  usable: number
}
const loaded: Loaded[] = []

for (const entry of entries) {
  const file = join(CONTENT, entry.file)
  if (!existsSync(file)) {
    fail(`${entry.file} — listed in the manifest but not on disk`)
    continue
  }
  const raw = readFileSync(file, 'utf8')
  const { items, rejected, issues } = parsePack(raw, entry, ITEM_SCHEMAS)
  for (const issue of issues) fail(`${issue.path}: ${issue.message}`)

  const usable = items.filter((item) => passesFilters(item, config)).length
  const header = packHeaderSchema.safeParse(parseYaml(raw))
  loaded.push({
    headerId: header.success ? header.data.id : entry.id,
    game: entry.game,
    lang: entry.lang,
    ids: items.map((i) => i.id),
    usable,
  })

  const filteredOut = items.length - usable
  const suffix = [
    rejected > 0 ? c.red(`${rejected} rejected`) : '',
    filteredOut > 0 ? c.dim(`${filteredOut} filtered out by config`) : '',
  ].filter(Boolean).join(', ')
  console.log(`  ${rejected > 0 ? c.red('✗') : c.green('✓')} ${entry.file.padEnd(28)} ${String(items.length).padStart(4)} items${suffix ? `  ${suffix}` : ''}`)
}

// ─── bilingual parity ────────────────────────────────────────────────────────
console.log(c.bold('\nbilingual parity'))
const byHeaderId = new Map<string, Loaded[]>()
for (const pack of loaded) {
  byHeaderId.set(pack.headerId, [...(byHeaderId.get(pack.headerId) ?? []), pack])
}

let checked = 0
for (const [headerId, group] of byHeaderId) {
  if (group.length < 2) continue // a language-native pack, by design
  checked++
  const [first, ...rest] = group
  if (!first) continue
  for (const other of rest) {
    const missingHere = first.ids.filter((id) => !other.ids.includes(id))
    const missingThere = other.ids.filter((id) => !first.ids.includes(id))
    if (missingHere.length === 0 && missingThere.length === 0) {
      ok(`${headerId}: ${first.lang} and ${other.lang} both carry all ${first.ids.length} items`)
    } else {
      if (missingHere.length) warn(`${headerId}: ${other.lang} is missing ${missingHere.length} item(s): ${missingHere.slice(0, 5).join(', ')}${missingHere.length > 5 ? '…' : ''}`)
      if (missingThere.length) warn(`${headerId}: ${first.lang} is missing ${missingThere.length} item(s): ${missingThere.slice(0, 5).join(', ')}${missingThere.length > 5 ? '…' : ''}`)
    }
  }
}
if (checked === 0) console.log(c.dim('  no bilingual pairs found (all packs are language-native)'))

// ─── coverage ────────────────────────────────────────────────────────────────
console.log(c.bold('\nplayable content per game'))
const langs = [...new Set(entries.map((e) => e.lang))].sort()
console.log(c.dim(`  ${'game'.padEnd(14)}${langs.map((l) => l.padStart(10)).join('')}`))

for (const gameId of Object.keys(ITEM_SCHEMAS)) {
  const cells = langs.map((lang) => {
    const total = loaded
      .filter((p) => p.game === gameId && p.lang === lang)
      .reduce((sum, p) => sum + p.usable, 0)
    return (total === 0 ? c.red('0') : String(total)).padStart(total === 0 ? 19 : 10)
  })
  console.log(`  ${gameId.padEnd(14)}${cells.join('')}`)
  for (const lang of langs) {
    const total = loaded.filter((p) => p.game === gameId && p.lang === lang).reduce((s, p) => s + p.usable, 0)
    if (total === 0) fail(`${gameId} has no playable content in ${lang} (check content.filters in config.yaml)`)
  }
}

// ─── summary ─────────────────────────────────────────────────────────────────
console.log('')
if (errors > 0) {
  console.log(c.red(c.bold(`${errors} error(s)`)) + (warnings ? c.yellow(`, ${warnings} warning(s)`) : ''))
  process.exit(1)
}
console.log(c.green(c.bold('all good')) + (warnings ? c.yellow(`, ${warnings} warning(s)`) : ''))

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { load as parseYaml } from 'js-yaml'
import { GAME_IDS } from '../games/schemas'

type Node = { [key: string]: unknown }

const dict = (lang: string) => parseYaml(readFileSync(`src/i18n/${lang}.yaml`, 'utf8')) as Node

/** Every leaf path, so a key in one language but not the other is visible. */
function paths(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null || Array.isArray(node)) return [prefix]
  return Object.entries(node as Node).flatMap(([key, value]) =>
    paths(value, prefix ? `${prefix}.${key}` : key),
  )
}

const en = dict('en')
const pt = dict('pt-BR')

describe('i18n', () => {
  it('has the same key structure in both languages', () => {
    const inEn = new Set(paths(en))
    const inPt = new Set(paths(pt))
    expect([...inEn].filter((k) => !inPt.has(k))).toEqual([])
    expect([...inPt].filter((k) => !inEn.has(k))).toEqual([])
  })

  it('puts the host banter under host, not somewhere that merely matched', () => {
    // A naive insert once landed `correctHard` inside `common:`, which showed
    // the raw key on screen. Assert the section, not just the presence.
    for (const [name, d] of [['en', en], ['pt-BR', pt]] as const) {
      const host = d.host as Node
      expect(Object.keys(host), name).toEqual(
        expect.arrayContaining(['correct', 'correctHard', 'wrong', 'wrongHard', 'timeout']),
      )
      expect(d.common as Node, name).not.toHaveProperty('correctHard')
    }
  })

  it('gives every host banter key at least one variant', () => {
    for (const [name, d] of [['en', en], ['pt-BR', pt]] as const) {
      for (const [key, value] of Object.entries(d.host as Node)) {
        expect(Array.isArray(value) && value.length > 0, `${name}.host.${key}`).toBe(true)
      }
    }
  })

  it('names and rules every registered game in both languages', () => {
    for (const [name, d] of [['en', en], ['pt-BR', pt]] as const) {
      const games = d.games as Node
      for (const id of GAME_IDS) {
        expect(games[id], `${name}.games.${id}`).toBeDefined()
        const entry = games[id] as Node
        expect(typeof entry.name, `${name}.games.${id}.name`).toBe('string')
        expect(typeof entry.rules, `${name}.games.${id}.rules`).toBe('string')
      }
    }
  })

  it('ships exactly the language files the app knows about', () => {
    const files = readdirSync('src/i18n').filter((f) => f.endsWith('.yaml')).sort()
    expect(files).toEqual(['en.yaml', 'pt-BR.yaml'])
  })
})

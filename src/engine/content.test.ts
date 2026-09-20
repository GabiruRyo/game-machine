import { describe, expect, it } from 'vitest'
import { passesFilters } from './content'
import { parseConfig } from './config'
import type { AppConfig } from './configSchema'
import type { BaseItem } from './contentSchema'

const configWith = (yaml: string): AppConfig => {
  const result = parseConfig(yaml)
  if (!result.ok) throw new Error(JSON.stringify(result.issues))
  return result.config
}

const item = (over: Partial<BaseItem> = {}): BaseItem => ({
  id: 'x',
  category: 'geral',
  difficulty: 3,
  audience: 'family',
  tags: [],
  ...over,
})

describe('passesFilters', () => {
  const expertOnly = configWith('content: { filters: { difficulty: [4, 5] } }')

  it('drops items outside the difficulty slice', () => {
    expect(passesFilters(item({ difficulty: 2 }), expertOnly)).toBe(false)
    expect(passesFilters(item({ difficulty: 5 }), expertOnly)).toBe(true)
  })

  it('ignores difficulty for games where it carries no meaning', () => {
    // A social prompt has no hard variant; narrowing to Expert must not empty it.
    expect(passesFilters(item({ difficulty: 1 }), expertOnly, false)).toBe(true)
  })

  it('still applies audience and tag filters when difficulty is exempt', () => {
    const family = configWith('content: { filters: { audience: [family] } }')
    expect(passesFilters(item({ audience: 'adult' }), family, false)).toBe(false)
  })

  it('excludes tagged items and honours an include list', () => {
    const excluded = configWith('content: { filters: { exclude_tags: [politica] } }')
    expect(passesFilters(item({ tags: ['politica'] }), excluded)).toBe(false)

    const onlyMusic = configWith('content: { filters: { include_tags: [musica] } }')
    expect(passesFilters(item({ tags: ['musica'] }), onlyMusic)).toBe(true)
    expect(passesFilters(item({ tags: ['cinema'] }), onlyMusic)).toBe(false)
  })

  it('ships excluding adult content by default', () => {
    expect(passesFilters(item({ audience: 'adult' }), configWith(''))).toBe(false)
    expect(passesFilters(item({ audience: 'teen' }), configWith(''))).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { buildPartyQueue } from './party'
import { parseConfig } from './config'
import { createRng } from './rng'
import type { AppConfig } from './configSchema'

const configWith = (yaml: string): AppConfig => {
  const result = parseConfig(yaml)
  if (!result.ok) throw new Error(JSON.stringify(result.issues))
  return result.config
}

const ALL = ['quiz', 'ordem', 'lorota', 'quemdiria', 'proibida', 'tribunal', 'historias', 'legendas']

describe('buildPartyQueue', () => {
  it('queues the requested number of legs, ending on the finale', () => {
    const legs = buildPartyQueue({
      config: configWith('party_mode: { games: 5, finale: { game: quiz, multiplier: 2 } }'),
      playable: ALL,
      rng: createRng(1),
    })
    expect(legs).toHaveLength(5)
    expect(legs[4]).toEqual({ gameId: 'quiz', multiplier: 2, isFinale: true })
    expect(legs.slice(0, 4).every((leg) => leg.multiplier === 1)).toBe(true)
  })

  it('never queues the finale game twice', () => {
    const legs = buildPartyQueue({
      config: configWith('party_mode: { games: 5, finale: { game: quiz, multiplier: 2 } }'),
      playable: ALL,
      rng: createRng(2),
    })
    expect(legs.filter((leg) => leg.gameId === 'quiz')).toHaveLength(1)
  })

  it('honours an explicit order', () => {
    const legs = buildPartyQueue({
      config: configWith(
        'party_mode: { games: 3, order: [tribunal, proibida], finale: { game: quiz, multiplier: 2 } }',
      ),
      playable: ALL,
      rng: createRng(3),
    })
    expect(legs.map((l) => l.gameId)).toEqual(['tribunal', 'proibida', 'quiz'])
  })

  it('only ever queues playable games', () => {
    const legs = buildPartyQueue({
      config: configWith(
        'party_mode: { games: 4, order: [tribunal, legendas], finale: { game: quiz, multiplier: 2 } }',
      ),
      playable: ['tribunal', 'ordem'],
      rng: createRng(4),
    })
    expect(legs.every((leg) => ['tribunal', 'ordem'].includes(leg.gameId))).toBe(true)
    expect(legs.some((leg) => leg.gameId === 'legendas')).toBe(false)
  })

  it('drops the finale leg when the finale game is unplayable', () => {
    const legs = buildPartyQueue({
      config: configWith('party_mode: { games: 2, finale: { game: quiz, multiplier: 2 } }'),
      playable: ['ordem', 'tribunal'],
      rng: createRng(5),
    })
    expect(legs).toHaveLength(2)
    expect(legs.some((leg) => leg.isFinale)).toBe(false)
  })

  it('repeats games rather than stopping short when asked for more legs than games', () => {
    const legs = buildPartyQueue({
      config: configWith('party_mode: { games: 4, finale: { game: quiz, multiplier: 3 } }'),
      playable: ['quiz', 'ordem'],
      rng: createRng(6),
    })
    expect(legs).toHaveLength(4)
    expect(legs[3]?.isFinale).toBe(true)
  })

  it('returns nothing when no game can be played', () => {
    expect(buildPartyQueue({ config: configWith(''), playable: [], rng: createRng(7) })).toEqual([])
  })
})

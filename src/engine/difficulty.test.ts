import { describe, expect, it } from 'vitest'
import { difficultyForRound, difficultyMultiplier, presetFor, DIFFICULTY_PRESETS } from './difficulty'

describe('difficultyForRound', () => {
  it('returns no target on a flat curve, so the picker draws anywhere in range', () => {
    expect(difficultyForRound(0, 8, [1, 2, 3], 'flat')).toBeUndefined()
  })

  it('climbs from the easiest to the hardest allowed tier across a game', () => {
    const allowed = [1, 2, 3, 4, 5]
    const walk = Array.from({ length: 5 }, (_, r) => difficultyForRound(r, 5, allowed, 'ramp'))
    expect(walk).toEqual([1, 2, 3, 4, 5])
  })

  it('ends on the hardest tier even when there are more rounds than tiers', () => {
    const walk = Array.from({ length: 8 }, (_, r) => difficultyForRound(r, 8, [1, 3, 5], 'ramp'))
    expect(walk[0]).toBe(1)
    expect(walk[7]).toBe(5)
    // Never goes backwards.
    expect(walk).toEqual([...walk].sort((a, b) => (a ?? 0) - (b ?? 0)))
  })

  it('respects a narrowed range rather than reaching for absent tiers', () => {
    const walk = Array.from({ length: 6 }, (_, r) => difficultyForRound(r, 6, [4, 5], 'ramp'))
    expect(new Set(walk)).toEqual(new Set([4, 5]))
  })

  it('copes with a single tier and with a one-round game', () => {
    expect(difficultyForRound(0, 6, [3], 'ramp')).toBe(3)
    expect(difficultyForRound(0, 1, [1, 5], 'ramp')).toBe(1)
  })

  it('clamps a round index past the end instead of overflowing', () => {
    expect(difficultyForRound(99, 5, [1, 2, 3], 'ramp')).toBe(3)
  })
})

describe('difficultyMultiplier', () => {
  it('leaves level 1 unscaled and pays more for harder items', () => {
    expect(difficultyMultiplier(1, 0.25)).toBe(1)
    expect(difficultyMultiplier(5, 0.25)).toBe(2)
  })

  it('is a no-op when the bonus is switched off', () => {
    expect(difficultyMultiplier(5, 0)).toBe(1)
  })
})

describe('presetFor', () => {
  it('recognises each preset slice regardless of order', () => {
    expect(presetFor([5, 4])).toBe('expert')
    expect(presetFor([...DIFFICULTY_PRESETS.all])).toBe('all')
  })

  it('returns null for a custom slice', () => {
    expect(presetFor([1, 5])).toBeNull()
  })
})

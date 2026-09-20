import { describe, expect, it } from 'vitest'
import { applyDeltas, emptyBoard, mergeBoards, ranked, speedBonus } from './scoring'
import type { Player } from './players'

const players: Player[] = [
  { id: 'a', name: 'Ana', color: '#fff' },
  { id: 'b', name: 'Bruno', color: '#000' },
  { id: 'c', name: 'Carla', color: '#f00' },
]

describe('scoring', () => {
  it('starts everyone at zero', () => {
    expect(emptyBoard(players)).toEqual({ a: 0, b: 0, c: 0 })
  })

  it('adds deltas without mutating the previous board', () => {
    const before = emptyBoard(players)
    const after = applyDeltas(before, [{ playerId: 'a', points: 100 }])
    expect(after.a).toBe(100)
    expect(before.a).toBe(0)
  })

  it('applies the finale multiplier', () => {
    const board = applyDeltas(emptyBoard(players), [{ playerId: 'a', points: 350 }], 2)
    expect(board.a).toBe(700)
  })

  it('rounds multiplied points rather than leaking fractions', () => {
    const board = applyDeltas(emptyBoard(players), [{ playerId: 'a', points: 333 }], 1.5)
    expect(Number.isInteger(board.a)).toBe(true)
    expect(board.a).toBe(500)
  })

  it('merges two boards for the cumulative party scoreboard', () => {
    expect(mergeBoards({ a: 10, b: 5 }, { a: 7, c: 3 })).toEqual({ a: 17, b: 5, c: 3 })
  })

  it('ranks by score and shares a rank on a tie', () => {
    const rows = ranked(players, { a: 100, b: 100, c: 50 })
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3])
    expect(rows[2]?.player.id).toBe('c')
  })

  it('awards the full speed bonus instantly and none at the buzzer', () => {
    expect(speedBonus(20000, 20000, 500)).toBe(500)
    expect(speedBonus(0, 20000, 500)).toBe(0)
    expect(speedBonus(10000, 20000, 500)).toBe(250)
  })

  it('never returns a negative or over-cap speed bonus', () => {
    expect(speedBonus(-5000, 20000, 500)).toBe(0)
    expect(speedBonus(99999, 20000, 500)).toBe(500)
    expect(speedBonus(1000, 0, 500)).toBe(0)
  })
})

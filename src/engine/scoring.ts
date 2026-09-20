import type { Player } from './players'

export interface ScoreDelta {
  playerId: string
  points: number
  /** i18n key explaining the award, shown on the reveal screen. */
  reason?: string
}

export type Scoreboard = Record<string, number>

export const emptyBoard = (players: Player[]): Scoreboard =>
  Object.fromEntries(players.map((p) => [p.id, 0]))

export function applyDeltas(
  board: Scoreboard,
  deltas: readonly ScoreDelta[],
  multiplier = 1,
): Scoreboard {
  const next: Scoreboard = { ...board }
  for (const delta of deltas) {
    next[delta.playerId] = (next[delta.playerId] ?? 0) + Math.round(delta.points * multiplier)
  }
  return next
}

export function mergeBoards(a: Scoreboard, b: Scoreboard): Scoreboard {
  const out: Scoreboard = { ...a }
  for (const [id, points] of Object.entries(b)) out[id] = (out[id] ?? 0) + points
  return out
}

export interface RankedEntry {
  player: Player
  score: number
  /** 1-based, sharing a rank on a tie. */
  rank: number
}

export function ranked(players: Player[], board: Scoreboard): RankedEntry[] {
  const sorted = [...players].sort((a, b) => (board[b.id] ?? 0) - (board[a.id] ?? 0))
  let lastScore: number | null = null
  let lastRank = 0
  return sorted.map((player, index) => {
    const score = board[player.id] ?? 0
    const rank = score === lastScore ? lastRank : index + 1
    lastScore = score
    lastRank = rank
    return { player, score, rank }
  })
}

/**
 * Speed bonus that decays linearly over the answer window. Answering instantly
 * earns the full bonus; answering as the timer dies earns none.
 */
export function speedBonus(msRemaining: number, msTotal: number, maxBonus: number): number {
  if (msTotal <= 0 || maxBonus <= 0) return 0
  const ratio = Math.max(0, Math.min(1, msRemaining / msTotal))
  return Math.round(ratio * maxBonus)
}

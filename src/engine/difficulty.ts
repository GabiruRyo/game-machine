/**
 * Difficulty has two jobs: choosing which slice of the content bank is in play,
 * and shaping how a single game unfolds. A flat curve draws anywhere in the
 * allowed range; a ramp starts at the easy end and climbs, so a game opens
 * gently and ends on the hard questions.
 */

export const DIFFICULTIES = [1, 2, 3, 4, 5] as const

export type DifficultyCurve = 'flat' | 'ramp'

/** Named slices of the 1-5 scale, cycled from the menu. */
export const DIFFICULTY_PRESETS = {
  all: [1, 2, 3, 4, 5],
  easy: [1, 2],
  medium: [2, 3],
  hard: [3, 4],
  expert: [4, 5],
} as const

export type DifficultyPreset = keyof typeof DIFFICULTY_PRESETS

export const PRESET_ORDER: DifficultyPreset[] = ['all', 'easy', 'medium', 'hard', 'expert']

/** The preset whose slice matches this list exactly, if any. */
export function presetFor(allowed: readonly number[]): DifficultyPreset | null {
  const key = [...allowed].sort().join(',')
  for (const [name, values] of Object.entries(DIFFICULTY_PRESETS)) {
    if ([...values].sort().join(',') === key) return name as DifficultyPreset
  }
  return null
}

/**
 * Target difficulty for a given round. On a ramp this walks the allowed range
 * from its easiest to its hardest value across the game; on a flat curve there
 * is no target and the picker draws anywhere in range.
 */
export function difficultyForRound(
  round: number,
  totalRounds: number,
  allowed: readonly number[],
  curve: DifficultyCurve,
): number | undefined {
  if (curve === 'flat') return undefined

  const sorted = [...new Set(allowed)].sort((a, b) => a - b)
  if (sorted.length === 0) return undefined
  if (sorted.length === 1 || totalRounds <= 1) return sorted[0]

  // Spread the rounds evenly across the available tiers.
  const position = Math.min(round, totalRounds - 1) / (totalRounds - 1)
  const index = Math.round(position * (sorted.length - 1))
  return sorted[index]
}

/**
 * Points multiplier for an item's difficulty. A level-5 question is worth
 * meaningfully more than a level-1, which is what stops a hard bank from
 * feeling like a punishment.
 */
export function difficultyMultiplier(difficulty: number, bonusPerLevel: number): number {
  return 1 + Math.max(0, difficulty - 1) * bonusPerLevel
}

/**
 * The items a game may draw from. Difficulty-free games ignore the slice
 * entirely: there is no hard version of "who would lose their phone".
 */
export function itemsAtDifficulty<T extends { difficulty: number }>(
  items: readonly T[],
  allowed: readonly number[],
  usesDifficulty: boolean,
): T[] {
  if (!usesDifficulty) return [...items]
  return items.filter((item) => allowed.includes(item.difficulty))
}

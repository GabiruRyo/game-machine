import type { AppConfig } from './configSchema'
import { createRng, type Rng } from './rng'

/**
 * Party Mode strings several games together behind one cumulative scoreboard,
 * the way a Jackbox pack runs an evening. The last game is the finale and its
 * points are multiplied, so the evening can still turn around at the end.
 */

export interface PartyLeg {
  gameId: string
  /** 1 for a normal leg, `party_mode.finale.multiplier` for the finale. */
  multiplier: number
  isFinale: boolean
}

export interface PartyQueueInput {
  config: AppConfig
  /** Games that are registered, enabled, have content, and have enough players. */
  playable: string[]
  rng?: Rng
}

/**
 * Builds the evening's line-up. Only playable games are ever queued, so a game
 * disabled in config.yaml or short of content cannot strand the party half way
 * through.
 */
export function buildPartyQueue({ config, playable, rng = createRng() }: PartyQueueInput): PartyLeg[] {
  if (playable.length === 0) return []

  const { games: wanted, order, finale } = config.party_mode
  const finaleId = playable.includes(finale.game) ? finale.game : null

  // The finale is placed last, so it is drawn from the pool separately.
  const pool = finaleId ? playable.filter((id) => id !== finaleId) : [...playable]

  let lineup: string[]
  if (order === 'random') {
    lineup = rng.shuffle(pool)
  } else {
    const requested = order.filter((id) => pool.includes(id))
    // Anything the list missed still backfills, so a short list is not fatal.
    lineup = [...requested, ...rng.shuffle(pool.filter((id) => !requested.includes(id)))]
  }

  const legCount = Math.max(1, wanted)
  const bodyCount = finaleId ? legCount - 1 : legCount
  const body: string[] = []

  // Repeat the pool rather than stopping short when more legs than games are asked for.
  for (let i = 0; i < bodyCount && lineup.length > 0; i++) {
    body.push(lineup[i % lineup.length] as string)
  }

  const legs: PartyLeg[] = body.map((gameId) => ({ gameId, multiplier: 1, isFinale: false }))
  if (finaleId) {
    legs.push({ gameId: finaleId, multiplier: finale.multiplier, isFinale: true })
  }

  return legs
}

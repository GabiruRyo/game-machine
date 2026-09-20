import type { ReactElement } from 'react'
import type { z } from 'zod'
import type { AppConfig } from '../engine/configSchema'
import type { DifficultyCurve } from '../engine/difficulty'
import type { BaseItem } from '../engine/contentSchema'
import type { Picker } from '../engine/picker'
import type { Player } from '../engine/players'
import type { Scoreboard } from '../engine/scoring'

/**
 * Everything a game needs, handed to it by the host. A game owns its own round
 * loop and reports back a scoreboard; the host owns players, content, scoring
 * across games and the way in and out.
 */
export interface GameContext<Item extends BaseItem, Settings> {
  config: AppConfig
  /** The validated `games.<id>` block from config.yaml. */
  settings: Settings
  players: Player[]
  picker: Picker<Item>
  /** Party Mode's finale doubling; 1 for a normal game. */
  multiplier: number
  /**
   * The difficulty slice in play and how to move through it. Knowledge games
   * use this to target draws per round and to pay more for harder items.
   */
  difficulty: { allowed: number[]; curve: DifficultyCurve }
  onFinish: (earned: Scoreboard) => void
  onExit: () => void
}

export interface GameModule<Item extends BaseItem = BaseItem, Settings = unknown> {
  id: string
  minPlayers: number
  /** Validates every item in this game's content packs. */
  itemSchema: z.ZodType<Item>
  /** Validates and defaults this game's block in config.yaml. */
  settingsSchema: z.ZodType<Settings>
  Component: (ctx: GameContext<Item, Settings>) => ReactElement
}

export type AnyGameModule = GameModule<any, any>

/** Preserves the Item/Settings inference that the bare object literal loses. */
export function defineGame<Item extends BaseItem, Settings>(
  module: GameModule<Item, Settings>,
): GameModule<Item, Settings> {
  return module
}

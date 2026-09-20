import type { ItemSchemas } from '../engine/content'
import { historiasGame } from './historias'
import { legendasGame } from './legendas'
import { lorotaGame } from './lorota'
import { ordemGame } from './ordem'
import { proibidaGame } from './proibida'
import { quemdiriaGame } from './quemdiria'
import { quizGame } from './quiz'
import { tribunalGame } from './tribunal'
import { ITEM_SCHEMAS } from './schemas'
import type { AnyGameModule } from './types'

/**
 * The pack. Adding a game means writing its module, listing it here, and adding
 * its content packs to data/content/manifest.yaml -- nothing else in the engine
 * needs to know about it.
 */
export const GAMES: AnyGameModule[] = [
  quizGame,
  ordemGame,
  lorotaGame,
  quemdiriaGame,
  proibidaGame,
  tribunalGame,
  historiasGame,
  legendasGame,
]

export const getGame = (id: string): AnyGameModule | undefined =>
  GAMES.find((game) => game.id === id)

/** Item schemas keyed by game id, for the content loader to validate packs. */
export const itemSchemas = (): ItemSchemas => ITEM_SCHEMAS

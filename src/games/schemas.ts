import type { ItemSchemas } from '../engine/content'
import { historiasItemSchema } from './historias/schema'
import { legendasItemSchema } from './legendas/schema'
import { lorotaItemSchema } from './lorota/schema'
import { ordemItemSchema } from './ordem/schema'
import { proibidaItemSchema } from './proibida/schema'
import { quemdiriaItemSchema } from './quemdiria/schema'
import { quizItemSchema } from './quiz/schema'
import { tribunalItemSchema } from './tribunal/schema'

/**
 * Game content schemas, importable from plain Node. `registry.ts` pulls in the
 * React components as well; the validate CLI must not.
 */
export const ITEM_SCHEMAS: ItemSchemas = {
  quiz: quizItemSchema,
  ordem: ordemItemSchema,
  lorota: lorotaItemSchema,
  quemdiria: quemdiriaItemSchema,
  proibida: proibidaItemSchema,
  tribunal: tribunalItemSchema,
  historias: historiasItemSchema,
  legendas: legendasItemSchema,
}

export const GAME_IDS = Object.keys(ITEM_SCHEMAS)

/**
 * Games where an item has no meaningful difficulty: there is no "hard" version
 * of "who is most likely to lose their phone". The difficulty filter is skipped
 * for these, so choosing Expert narrows the knowledge games without emptying
 * half the pack.
 */
export const DIFFICULTY_FREE_GAMES: ReadonlySet<string> = new Set([
  'quemdiria',
  'tribunal',
  'historias',
  'legendas',
])

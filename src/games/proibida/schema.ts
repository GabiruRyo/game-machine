import { z } from 'zod'
import { baseItemSchema } from '../../engine/contentSchema'

/**
 * Inverted Taboo: the card is shown to the whole room and the guesser turns
 * their back, so nothing has to be hidden by the app.
 */
export const proibidaItemSchema = baseItemSchema.extend({
  word: z.string().min(1),
  forbidden: z.array(z.string().min(1)).min(1).max(6),
})

export const proibidaSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  /** One round per guesser. */
  rounds: z.number().int().min(1).max(20).default(4),
  round_seconds: z.number().min(10).max(600).default(60),
  skips_allowed: z.number().int().min(0).max(20).default(2),
  points_per_hit: z.number().min(0).default(100),
})

export type ProibidaItem = z.infer<typeof proibidaItemSchema>
export type ProibidaSettings = z.infer<typeof proibidaSettingsSchema>

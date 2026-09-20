import { z } from 'zod'
import { baseItemSchema } from '../../engine/contentSchema'

/**
 * One invented statement hiding among true ones. `truths` may hold more than a
 * round needs -- the game draws as many as `statements` calls for, so the same
 * item plays differently next time.
 */
const statement = z.object({
  text: z.string().min(1),
  /** Shown on the reveal. The payoff is usually in the note. */
  note: z.string().optional(),
})

export const lorotaItemSchema = baseItemSchema.extend({
  topic: z.string().min(1),
  lie: statement,
  truths: z.array(statement).min(2),
})

export const lorotaSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  /** Extra fraction of the points per difficulty level above 1. 0 disables it. */
  difficulty_bonus: z.number().min(0).max(2).default(0.25),
  rounds: z.number().int().min(1).max(50).default(6),
  statements: z.number().int().min(2).max(6).default(3),
  decide_seconds: z.number().min(5).max(300).default(45),
  points_correct: z.number().min(0).default(800),
  points_heckler: z.number().min(0).default(200),
})

export type LorotaItem = z.infer<typeof lorotaItemSchema>
export type LorotaSettings = z.infer<typeof lorotaSettingsSchema>

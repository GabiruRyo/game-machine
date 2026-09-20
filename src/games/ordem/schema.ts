import { z } from 'zod'
import { baseItemSchema } from '../../engine/contentSchema'

/**
 * `entries` are written in the CORRECT order in the pack file; the game shuffles
 * them for display. `detail` is the value that justifies the position (a year, a
 * height, a population) and is revealed during scoring.
 */
export const ordemItemSchema = baseItemSchema.extend({
  prompt: z.string().min(1),
  entries: z
    .array(
      z.object({
        label: z.string().min(1),
        detail: z.string().optional(),
      }),
    )
    .min(3)
    .max(6),
})

export const ordemSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  /** Overrides content.filters.difficulty for this game alone. */
  difficulty: z.array(z.number().int().min(1).max(5)).min(1).optional(),
  /** Extra fraction of the points per difficulty level above 1. 0 disables it. */
  difficulty_bonus: z.number().min(0).max(2).default(0.25),
  rounds: z.number().int().min(1).max(50).default(5),
  arrange_seconds: z.number().min(10).max(600).default(60),
  points_per_correct_slot: z.number().min(0).default(200),
  points_all_correct_bonus: z.number().min(0).default(400),
})

export type OrdemItem = z.infer<typeof ordemItemSchema>
export type OrdemSettings = z.infer<typeof ordemSettingsSchema>

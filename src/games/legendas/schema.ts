import { z } from 'zod'
import { baseItemSchema } from '../../engine/contentSchema'

/** An absurd setup that everyone writes a caption for. */
export const legendasItemSchema = baseItemSchema.extend({
  prompt: z.string().min(1),
})

export const legendasSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  rounds: z.number().int().min(1).max(20).default(4),
  caption_seconds: z.number().min(10).max(600).default(60),
  points_per_vote: z.number().min(0).default(300),
  points_unanimous_bonus: z.number().min(0).default(300),
})

export type LegendasItem = z.infer<typeof legendasItemSchema>
export type LegendasSettings = z.infer<typeof legendasSettingsSchema>

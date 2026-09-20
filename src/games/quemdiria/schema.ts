import { z } from 'zod'
import { baseItemSchema } from '../../engine/contentSchema'

/** Prompts are about the people in the room, so the content is just the line. */
export const quemdiriaItemSchema = baseItemSchema.extend({
  prompt: z.string().min(1),
})

export const quemdiriaSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  rounds: z.number().int().min(1).max(50).default(6),
  predict_seconds: z.number().min(5).max(300).default(30),
  points_correct: z.number().min(0).default(700),
})

export type QuemdiriaItem = z.infer<typeof quemdiriaItemSchema>
export type QuemdiriaSettings = z.infer<typeof quemdiriaSettingsSchema>

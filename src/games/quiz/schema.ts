import { z } from 'zod'
import { baseItemSchema } from '../../engine/contentSchema'

/**
 * Kept apart from the component so the `npm run validate` CLI can import game
 * schemas in plain Node, without dragging React or Vite-only imports along.
 */
export const quizItemSchema = baseItemSchema
  .extend({
    question: z.string().min(1),
    options: z.array(z.string().min(1)).min(2).max(6),
    /** Zero-based index into `options`. */
    answer: z.number().int().min(0),
    /** Optional trivia shown on the reveal screen. */
    note: z.string().optional(),
  })
  .refine((item) => item.answer < item.options.length, {
    message: 'answer must be an index into options',
    path: ['answer'],
  })

export const quizSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  /** Overrides content.filters.difficulty for this game alone. */
  difficulty: z.array(z.number().int().min(1).max(5)).min(1).optional(),
  /** Extra fraction of the points per difficulty level above 1. 0 disables it. */
  difficulty_bonus: z.number().min(0).max(2).default(0.25),
  rounds: z.number().int().min(1).max(50).default(8),
  answer_seconds: z.number().min(3).max(300).default(20),
  base_points: z.number().min(0).default(1000),
  speed_bonus_max: z.number().min(0).default(500),
  steal: z
    .object({
      enabled: z.boolean().default(true),
      points: z.number().min(0).default(500),
    })
    .prefault({}),
})

export type QuizItem = z.infer<typeof quizItemSchema>
export type QuizSettings = z.infer<typeof quizSettingsSchema>

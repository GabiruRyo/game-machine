import { z } from 'zod'
import { baseItemSchema } from '../../engine/contentSchema'

/**
 * One pack holds both the motions and the mid-argument curveballs, separated by
 * `kind`, so a new twist can be added without touching the registry.
 */
export const tribunalItemSchema = baseItemSchema.extend({
  kind: z.enum(['motion', 'curveball']).default('motion'),
  text: z.string().min(1),
})

export const tribunalSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  rounds: z.number().int().min(1).max(50).default(4),
  argument_seconds: z.number().min(10).max(600).default(45),
  curveballs: z
    .object({
      enabled: z.boolean().default(true),
      /** Probability that any single argument gets a twist thrown at it. */
      chance: z.number().min(0).max(1).default(0.5),
    })
    .prefault({}),
  points_win: z.number().min(0).default(600),
  points_participation: z.number().min(0).default(150),
  /** winner-entry: one press settles it. count-entry: the audience votes in turn. */
  vote: z.enum(['winner-entry', 'count-entry']).default('winner-entry'),
})

export type TribunalItem = z.infer<typeof tribunalItemSchema>
export type TribunalSettings = z.infer<typeof tribunalSettingsSchema>

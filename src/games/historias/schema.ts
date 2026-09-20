import { z } from 'zod'
import { baseItemSchema } from '../../engine/contentSchema'

/**
 * The app is the only one who has seen the story. Players are asked for stray
 * words with no context, so the secret belongs to the machine rather than to
 * any player -- no privacy mechanism required.
 *
 * `template` refers to slots as {1}, {2}, ... matching `slots` by position.
 */
export const historiasItemSchema = baseItemSchema
  .extend({
    title: z.string().min(1),
    template: z.string().min(1),
    slots: z.array(z.object({ prompt: z.string().min(1) })).min(2).max(12),
  })
  .refine(
    (item) =>
      item.slots.every((_, index) => item.template.includes(`{${index + 1}}`)),
    { message: 'template must contain a {n} placeholder for every slot', path: ['template'] },
  )

export const historiasSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  rounds: z.number().int().min(1).max(20).default(3),
  points_per_word: z.number().min(0).default(100),
  points_favourite: z.number().min(0).default(400),
})

export type HistoriasItem = z.infer<typeof historiasItemSchema>
export type HistoriasSettings = z.infer<typeof historiasSettingsSchema>

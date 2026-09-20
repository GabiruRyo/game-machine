import { z } from 'zod'
import { AUDIENCES } from './configSchema'

/**
 * Every content item in every pack carries these fields, which is what makes
 * `config.content.filters` work uniformly across games. Game modules extend this
 * with their own fields via `baseItemSchema.extend({ ... })`.
 */
export const baseItemSchema = z.object({
  id: z.string().min(1),
  category: z.string().default('geral'),
  difficulty: z.number().int().min(1).max(5).default(3),
  audience: z.enum(AUDIENCES).default('family'),
  tags: z.array(z.string()).default([]),
})

export type BaseItem = z.infer<typeof baseItemSchema>

export const packHeaderSchema = z.object({
  id: z.string().min(1),
  game: z.string().min(1),
  lang: z.string().min(2),
  title: z.string().default(''),
  version: z.number().int().min(1).default(1),
  items: z.array(z.unknown()).default([]),
})

export const manifestEntrySchema = z.object({
  id: z.string().min(1),
  game: z.string().min(1),
  lang: z.enum(['en', 'pt-BR']),
  file: z.string().min(1),
  title: z.string().default(''),
  /** Loaded when config.content.packs is ['auto']. */
  auto: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
})

export const manifestSchema = z.object({
  packs: z.array(manifestEntrySchema).default([]),
})

export type ManifestEntry = z.infer<typeof manifestEntrySchema>
export type Manifest = z.infer<typeof manifestSchema>

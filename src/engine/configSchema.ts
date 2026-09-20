import { z } from 'zod'

/**
 * The schema for `data/config.yaml`. Every number that appears in a game's rules
 * is a key here, so the whole pack can be re-tuned without touching code.
 *
 * Per-game blocks under `games:` are deliberately loose at this level: each game
 * module owns a `configSchema` and validates its own slice (see games/registry.ts),
 * which keeps this file from having to know about every game in the pack.
 */

export const LANGS = ['en', 'pt-BR'] as const
export const AUDIENCES = ['family', 'teen', 'adult'] as const
export const REPEAT_POLICIES = ['avoid-until-exhausted', 'never-repeat', 'random'] as const

export type Lang = (typeof LANGS)[number]
export type Audience = (typeof AUDIENCES)[number]
export type RepeatPolicy = (typeof REPEAT_POLICIES)[number]

const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'must be a hex colour like "#ff6b35"')

export const playerSchema = z.object({
  name: z.string().min(1).max(24),
  color: hexColor.optional(),
  team: z.string().min(1).optional(),
})

export const teamSchema = z.object({
  name: z.string().min(1).max(24),
  color: hexColor.optional(),
})

export const configSchema = z.object({
  language: z.enum(LANGS).default('pt-BR'),
  mode: z.enum(['solo', 'teams']).default('solo'),

  players: z.array(playerSchema).max(12).default([]),
  teams: z.array(teamSchema).max(6).default([]),

  audio: z
    .object({
      enabled: z.boolean().default(true),
      volume: z.number().min(0).max(1).default(0.6),
    })
    .prefault({}),

  display: z
    .object({
      fullscreen_hint: z.boolean().default(true),
      big_text: z.boolean().default(false),
      show_key_hints: z.boolean().default(true),
    })
    .prefault({}),

  content: z
    .object({
      // ['auto'] loads every pack the manifest marks auto-loadable for the
      // active language; an explicit list of pack ids overrides that.
      packs: z.array(z.string()).min(1).default(['auto']),
      filters: z
        .object({
          audience: z.array(z.enum(AUDIENCES)).min(1).default(['family', 'teen']),
          difficulty: z.array(z.number().int().min(1).max(5)).min(1).default([1, 2, 3, 4, 5]),
          include_tags: z.array(z.string()).default([]),
          exclude_tags: z.array(z.string()).default([]),
        })
        .prefault({}),
      repeat: z.enum(REPEAT_POLICIES).default('avoid-until-exhausted'),
    })
    .prefault({}),

  party_mode: z
    .object({
      games: z.number().int().min(1).max(20).default(5),
      order: z.union([z.literal('random'), z.array(z.string()).min(1)]).default('random'),
      finale: z
        .object({
          game: z.string().default('quiz'),
          multiplier: z.number().min(1).max(10).default(2),
        })
        .prefault({}),
    })
    .prefault({}),

  games: z.record(z.string(), z.record(z.string(), z.unknown())).prefault({}),
})

export type AppConfig = z.infer<typeof configSchema>
export type PlayerConfig = z.infer<typeof playerSchema>

/** Shared by every game block, validated again inside each game module. */
export const baseGameConfigSchema = z.object({
  enabled: z.boolean().default(true),
  rounds: z.number().int().min(1).max(50).default(6),
})

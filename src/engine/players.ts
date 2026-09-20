import type { AppConfig, PlayerConfig } from './configSchema'

export interface Player {
  id: string
  name: string
  color: string
  team?: string
}

export interface Team {
  name: string
  color: string
  memberIds: string[]
}

/** Chosen to stay distinguishable on a TV across the room, and in both themes. */
export const PLAYER_PALETTE = [
  '#ff6b35',
  '#4ecdc4',
  '#ffd166',
  '#a78bfa',
  '#06d6a0',
  '#ef476f',
  '#118ab2',
  '#f78c6b',
  '#c77dff',
  '#8ac926',
  '#ff8fab',
  '#5bc0eb',
] as const

const slug = (name: string, index: number): string =>
  `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'player'}-${index}`

export function toPlayers(configured: PlayerConfig[]): Player[] {
  return configured.map((player, index) => ({
    id: slug(player.name, index),
    name: player.name.trim(),
    color: player.color ?? PLAYER_PALETTE[index % PLAYER_PALETTE.length],
    ...(player.team ? { team: player.team } : {}),
  }))
}

export function playersFromConfig(config: AppConfig): Player[] {
  return toPlayers(config.players)
}

/**
 * Teams only apply when the config asks for them AND enough teams exist; the
 * loader warns about the mismatch rather than refusing to start.
 */
export function teamsFromConfig(config: AppConfig, players: Player[]): Team[] | null {
  if (config.mode !== 'teams' || config.teams.length < 2) return null
  return config.teams.map((team, index) => ({
    name: team.name,
    color: team.color ?? PLAYER_PALETTE[index % PLAYER_PALETTE.length],
    memberIds: players.filter((p) => p.team === team.name).map((p) => p.id),
  }))
}

/** Rotates the active player. Turn order is simply roster order. */
export function nextIndex(current: number, total: number): number {
  if (total <= 0) return 0
  return (current + 1) % total
}

/**
 * Everyone except the active player -- "the room". Used by the inverted-Taboo
 * guesser rotation and by Tribunal's audience vote.
 */
export function others(players: Player[], activeId: string): Player[] {
  return players.filter((p) => p.id !== activeId)
}

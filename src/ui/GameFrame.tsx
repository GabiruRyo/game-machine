import type { ReactNode } from 'react'
import type { Player } from '../engine/players'
import type { Scoreboard } from '../engine/scoring'
import { useI18n } from '../i18n'
import { KeyHints, PlayerBadge, Screen } from './components'

/**
 * The chrome around every game: which game, which round, who is up, and what
 * the keyboard does right now. Games render only their own middle.
 */
export function GameFrame({
  gameId,
  round,
  totalRounds,
  players,
  board,
  activeId,
  hints,
  children,
}: {
  gameId: string
  round: number
  totalRounds: number
  players: Player[]
  board: Scoreboard
  activeId?: string
  hints: string[]
  children: ReactNode
}) {
  const { t } = useI18n()

  return (
    <Screen
      top={
        <>
          <div>
            <div className="eyebrow">{t(`games.${gameId}.name`)}</div>
            <div className="dim">{t('common.round', { current: round, total: totalRounds })}</div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            {players.map((player) => (
              <PlayerBadge
                key={player.id}
                player={player}
                score={board[player.id] ?? 0}
                active={player.id === activeId}
              />
            ))}
          </div>
        </>
      }
      bottom={<KeyHints hints={hints} />}
    >
      {children}
    </Screen>
  )
}

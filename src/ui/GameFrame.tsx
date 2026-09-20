import type { ReactNode } from 'react'
import type { Player } from '../engine/players'
import type { Scoreboard } from '../engine/scoring'
import { useI18n } from '../i18n'
import { KeyHints, PlayerBadge, Screen } from './components'

/** Five pips, filled to the item's tier. */
function DifficultyPips({ level }: { level: number }) {
  const { t } = useI18n()
  return (
    <span className="pips" title={t('common.difficultyLevel', { level })} aria-label={t('common.difficultyLevel', { level })}>
      {[1, 2, 3, 4, 5].map((tier) => (
        <span key={tier} className="pips__dot" data-on={tier <= level} />
      ))}
    </span>
  )
}

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
  difficulty,
  hints,
  children,
}: {
  gameId: string
  round: number
  totalRounds: number
  players: Player[]
  board: Scoreboard
  activeId?: string
  /** 1-5. Rendered as pips so a ramping game visibly gets harder. */
  difficulty?: number
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
            <div className="dim row" style={{ gap: 10 }}>
              <span>{t('common.round', { current: round, total: totalRounds })}</span>
              {difficulty ? <DifficultyPips level={difficulty} /> : null}
            </div>
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

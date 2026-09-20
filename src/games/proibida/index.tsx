import { useCallback, useState } from 'react'
import { play } from '../../engine/audio'
import { useKeyboard, type Action } from '../../engine/input'
import { applyDeltas, emptyBoard, type Scoreboard } from '../../engine/scoring'
import { useCountdown } from '../../engine/timer'
import { useI18n } from '../../i18n'
import { TimerBar } from '../../ui/components'
import { GameFrame } from '../../ui/GameFrame'
import { defineGame, type GameContext } from '../types'
import { proibidaItemSchema, proibidaSettingsSchema, type ProibidaItem, type ProibidaSettings } from './schema'

/**
 * The word is on screen for everyone; one player turns their back and guesses
 * while the room describes it. That inversion is what lets a party game keep a
 * secret on a single shared screen without any privacy mechanism.
 */
type Phase = 'prepare' | 'playing' | 'summary'

function ProibidaGame({ settings, players, picker, multiplier, onFinish, onExit }: GameContext<ProibidaItem, ProibidaSettings>) {
  const { t } = useI18n()

  const [round, setRound] = useState(0)
  const [board, setBoard] = useState<Scoreboard>(() => emptyBoard(players))
  const [phase, setPhase] = useState<Phase>('prepare')
  const [card, setCard] = useState<ProibidaItem | null>(null)
  const [hits, setHits] = useState(0)
  const [skipsLeft, setSkipsLeft] = useState(settings.skips_allowed)

  const guesser = players[round % players.length]

  const endRound = useCallback(
    (finalHits: number) => {
      if (!guesser) return
      play('buzz')
      setBoard((current) =>
        applyDeltas(current, [{ playerId: guesser.id, points: finalHits * settings.points_per_hit }], multiplier),
      )
      setPhase('summary')
    },
    [guesser, settings.points_per_hit, multiplier],
  )

  const timer = useCountdown({
    seconds: settings.round_seconds,
    running: phase === 'playing',
    onExpire: () => endRound(hits),
  })

  const nextCard = useCallback(() => {
    const drawn = picker.draw()
    setCard(drawn)
    return drawn
  }, [picker])

  const handle = useCallback(
    (action: Action) => {
      if (action.type === 'pause') return onExit()

      if (phase === 'prepare' && action.type === 'advance') {
        setHits(0)
        setSkipsLeft(settings.skips_allowed)
        nextCard()
        setPhase('playing')
        timer.reset()
        play('reveal')
        return
      }

      if (phase === 'playing') {
        if (action.type === 'advance') {
          play('correct')
          setHits((current) => current + 1)
          if (!nextCard()) endRound(hits + 1)
          return
        }
        if (action.type === 'skip' && skipsLeft > 0) {
          play('move')
          setSkipsLeft((current) => current - 1)
          if (!nextCard()) endRound(hits)
        }
        return
      }

      if (phase === 'summary' && action.type === 'advance') {
        if (round + 1 >= settings.rounds) {
          play('fanfare')
          onFinish(board)
          return
        }
        setRound((r) => r + 1)
        setPhase('prepare')
      }
    },
    [phase, settings, nextCard, timer, hits, skipsLeft, endRound, round, board, onFinish, onExit],
  )

  useKeyboard(handle)

  if (!guesser) return <div />

  const frame = (children: React.ReactNode, hints: string[]) => (
    <GameFrame
      gameId="proibida"
      round={round + 1}
      totalRounds={settings.rounds}
      players={players}
      board={board}
      activeId={guesser.id}
      hints={hints}
    >
      {children}
    </GameFrame>
  )

  if (phase === 'prepare') {
    return frame(
      <div className="center stack" style={{ alignItems: 'center' }}>
        <div className="eyebrow">{t('games.proibida.guesserIs')}</div>
        <h1 className="title title--huge" style={{ color: guesser.color }}>{guesser.name}</h1>
        <p className="subtitle" style={{ maxWidth: '40ch' }}>{t('games.proibida.turnAround', { name: guesser.name })}</p>
        <p className="faint" style={{ maxWidth: '52ch' }}>{t('games.proibida.roomDescribes')}</p>
      </div>,
      [t('keys.advance'), t('keys.pause')],
    )
  }

  if (phase === 'summary') {
    return frame(
      <div className="center stack" style={{ alignItems: 'center' }}>
        <div className="title">{t('common.timeUp')}</div>
        <div className="title title--huge" style={{ color: guesser.color }}>{hits}</div>
        <p className="subtitle">
          {guesser.name} +{Math.round(hits * settings.points_per_hit * multiplier)} {t('common.points')}
        </p>
      </div>,
      [t('keys.advance'), t('keys.pause')],
    )
  }

  return frame(
    <>
      <TimerBar ratio={timer.ratio} secondsRemaining={timer.secondsRemaining} />

      <div className="card taboo">
        <div className="eyebrow center">{t('games.proibida.dontSay')}</div>
        <h1 className="taboo__word">{card?.word ?? '—'}</h1>
        <ul className="taboo__list">
          {(card?.forbidden ?? []).map((word) => (
            <li key={word}>{word}</li>
          ))}
        </ul>
      </div>

      <div className="row row--center">
        <span className="tag">{t('games.proibida.hits')}: {hits}</span>
        <span className="tag">{t('games.proibida.skipsLeft')}: {skipsLeft}</span>
      </div>
    </>,
    [t('games.proibida.keyHit'), skipsLeft > 0 ? t('keys.skip') : '', t('keys.pause')].filter(Boolean),
  )
}

export const proibidaGame = defineGame({
  id: 'proibida',
  minPlayers: 2,
  itemSchema: proibidaItemSchema,
  settingsSchema: proibidaSettingsSchema,
  Component: ProibidaGame,
})

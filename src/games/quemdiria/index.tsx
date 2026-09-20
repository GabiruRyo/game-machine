import { useCallback, useMemo, useState } from 'react'
import { play } from '../../engine/audio'
import { useKeyboard, type Action } from '../../engine/input'
import { applyDeltas, emptyBoard, type Scoreboard } from '../../engine/scoring'
import { useCountdown } from '../../engine/timer'
import { useI18n } from '../../i18n'
import { OptionGrid, PromptCard, TimerBar, type OptionItem } from '../../ui/components'
import { GameFrame } from '../../ui/GameFrame'
import { defineGame, type GameContext } from '../types'
import { quemdiriaItemSchema, quemdiriaSettingsSchema, type QuemdiriaItem, type QuemdiriaSettings } from './schema'

/**
 * Two inputs per round and neither of them is private: the turn player predicts
 * out loud who the room will choose, then the room votes with a show of hands
 * and whoever holds the keyboard enters the result.
 */
type Phase =
  | { kind: 'predicting' }
  | { kind: 'voting'; predicted: number | null }
  | { kind: 'reveal'; predicted: number | null; actual: number }

function QuemdiriaGame({ settings, players, picker, multiplier, onFinish, onExit }: GameContext<QuemdiriaItem, QuemdiriaSettings>) {
  const { t, tRandom } = useI18n()

  const [round, setRound] = useState(0)
  const [board, setBoard] = useState<Scoreboard>(() => emptyBoard(players))
  const [item, setItem] = useState<QuemdiriaItem | null>(() => picker.draw())
  const [phase, setPhase] = useState<Phase>({ kind: 'predicting' })

  const activePlayer = players[round % players.length]

  const timer = useCountdown({
    seconds: settings.predict_seconds,
    running: phase.kind === 'predicting',
    onExpire: () => setPhase({ kind: 'voting', predicted: null }),
  })

  const advance = useCallback(() => {
    if (round + 1 >= settings.rounds) {
      play('fanfare')
      onFinish(board)
      return
    }
    const next = picker.draw()
    if (!next) return onFinish(board)
    setItem(next)
    setRound((r) => r + 1)
    setPhase({ kind: 'predicting' })
    timer.reset()
    play('reveal')
  }, [round, settings.rounds, board, picker, onFinish, timer])

  const handle = useCallback(
    (action: Action) => {
      if (action.type === 'pause') return onExit()

      if (phase.kind === 'predicting' && action.type === 'select' && action.index < players.length) {
        play('move')
        setPhase({ kind: 'voting', predicted: action.index })
        return
      }

      if (phase.kind === 'voting' && action.type === 'select' && action.index < players.length) {
        const right = phase.predicted === action.index
        play(right ? 'correct' : 'wrong')
        if (right && activePlayer) {
          setBoard((current) =>
            applyDeltas(current, [{ playerId: activePlayer.id, points: settings.points_correct }], multiplier),
          )
        }
        setPhase({ kind: 'reveal', predicted: phase.predicted, actual: action.index })
        return
      }

      if (phase.kind === 'reveal' && action.type === 'advance') advance()
    },
    [phase, players.length, activePlayer, settings.points_correct, multiplier, advance, onExit],
  )

  useKeyboard(handle)

  const hostLine = useMemo(
    () => (phase.kind === 'reveal' ? tRandom(phase.predicted === phase.actual ? 'host.correct' : 'host.wrong') : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase.kind, round],
  )

  if (!item || !activePlayer) {
    return (
      <GameFrame gameId="quemdiria" round={round + 1} totalRounds={settings.rounds} players={players} board={board} hints={[t('keys.pause')]}>
        <p className="subtitle">{t('errors.noContent')}</p>
      </GameFrame>
    )
  }

  const options: OptionItem[] = players.map((player, index): OptionItem => {
    if (phase.kind !== 'reveal') return { text: player.name, state: 'idle' }
    if (index === phase.actual) return { text: player.name, state: 'correct' }
    if (index === phase.predicted) return { text: player.name, state: 'wrong' }
    return { text: player.name, state: 'muted' }
  })

  const eyebrow =
    phase.kind === 'predicting'
      ? t('games.quemdiria.predictTurn', { name: activePlayer.name })
      : phase.kind === 'voting'
        ? t('games.quemdiria.roomVotes')
        : t('common.turnOf', { name: activePlayer.name })

  return (
    <GameFrame
      gameId="quemdiria"
      round={round + 1}
      totalRounds={settings.rounds}
      players={players}
      board={board}
      activeId={activePlayer.id}
      hints={phase.kind === 'reveal' ? [t('keys.advance'), t('keys.pause')] : [t('keys.select'), t('keys.pause')]}
    >
      <PromptCard eyebrow={eyebrow}>{item.prompt}</PromptCard>

      {phase.kind === 'predicting' ? (
        <>
          <p className="dim center" style={{ marginTop: -12 }}>{t('games.quemdiria.predictHint')}</p>
          <TimerBar ratio={timer.ratio} secondsRemaining={timer.secondsRemaining} />
        </>
      ) : null}

      {phase.kind === 'voting' ? (
        <p className="subtitle center" style={{ maxWidth: '52ch' }}>{t('games.quemdiria.enterResult')}</p>
      ) : null}

      <OptionGrid options={options} onSelect={phase.kind === 'reveal' ? undefined : (i) => handle({ type: 'select', index: i })} />

      {phase.kind === 'reveal' ? (
        <div className="center stack" style={{ alignItems: 'center' }}>
          <div className="title" style={{ fontSize: 'var(--step-2)' }}>{hostLine}</div>
          <p className="dim">
            {t('games.quemdiria.predicted')}: {phase.predicted === null ? t('common.nobody') : players[phase.predicted]?.name}
            {' · '}
            {t('games.quemdiria.roomChose')}: {players[phase.actual]?.name}
          </p>
          {phase.predicted === phase.actual ? (
            <div style={{ color: activePlayer.color, fontWeight: 800 }}>
              {activePlayer.name} +{Math.round(settings.points_correct * multiplier)}
            </div>
          ) : null}
        </div>
      ) : null}
    </GameFrame>
  )
}

export const quemdiriaGame = defineGame({
  id: 'quemdiria',
  minPlayers: 3,
  itemSchema: quemdiriaItemSchema,
  settingsSchema: quemdiriaSettingsSchema,
  Component: QuemdiriaGame,
})

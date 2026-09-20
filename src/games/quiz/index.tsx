import { useCallback, useMemo, useState } from 'react'
import { play } from '../../engine/audio'
import { difficultyForRound, difficultyMultiplier } from '../../engine/difficulty'
import { useKeyboard, type Action } from '../../engine/input'
import { nextIndex } from '../../engine/players'
import { applyDeltas, emptyBoard, speedBonus, type Scoreboard } from '../../engine/scoring'
import { useCountdown } from '../../engine/timer'
import { useI18n } from '../../i18n'
import { OptionGrid, PromptCard, TimerBar, type OptionItem } from '../../ui/components'
import { GameFrame } from '../../ui/GameFrame'
import { defineGame, type GameContext } from '../types'
import { quizItemSchema, quizSettingsSchema, type QuizItem, type QuizSettings } from './schema'

type Phase =
  | { kind: 'answering' }
  | { kind: 'stealing'; missed: number }
  | { kind: 'reveal'; chosen: number | null; stolenBy: string | null }

function QuizGame({ settings, players, picker, multiplier, difficulty, onFinish, onExit }: GameContext<QuizItem, QuizSettings>) {
  const { t, tRandom } = useI18n()

  // The tier this round is aiming for; undefined on a flat curve.
  const targetFor = useCallback(
    (roundIndex: number) =>
      difficultyForRound(roundIndex, settings.rounds, difficulty.allowed, difficulty.curve),
    [settings.rounds, difficulty],
  )

  const [round, setRound] = useState(0)
  const [board, setBoard] = useState<Scoreboard>(() => emptyBoard(players))
  const [deltas, setDeltas] = useState<Record<string, number>>({})
  const [phase, setPhase] = useState<Phase>({ kind: 'answering' })
  const [item, setItem] = useState<QuizItem | null>(() =>
    picker.draw({ difficulty: targetFor(0) }),
  )

  const activeIdx = round % players.length
  const activePlayer = players[activeIdx]
  const stealer = players[nextIndex(activeIdx, players.length)]
  const totalMs = settings.answer_seconds * 1000

  const award = useCallback(
    (playerId: string, points: number) => {
      const rounded = Math.round(points)
      setBoard((current) => applyDeltas(current, [{ playerId, points: rounded }], multiplier))
      setDeltas({ [playerId]: Math.round(rounded * multiplier) })
    },
    [multiplier],
  )

  const resolve = useCallback(
    (chosen: number | null, msRemaining: number) => {
      if (!item || !activePlayer) return
      const correct = chosen !== null && chosen === item.answer

      if (correct) {
        play('correct')
        // A level-5 question pays more than a level-1, so a hard bank rewards
        // rather than punishes.
        const worth = difficultyMultiplier(item.difficulty, settings.difficulty_bonus)
        award(
          activePlayer.id,
          (settings.base_points + speedBonus(msRemaining, totalMs, settings.speed_bonus_max)) * worth,
        )
        setPhase({ kind: 'reveal', chosen, stolenBy: null })
        return
      }

      play('wrong')
      // A miss hands the question to the next player -- keeps everyone watching
      // even when it is not their turn.
      if (settings.steal.enabled && players.length > 1 && chosen !== null) {
        setPhase({ kind: 'stealing', missed: chosen })
        return
      }
      setDeltas({})
      setPhase({ kind: 'reveal', chosen, stolenBy: null })
    },
    [item, activePlayer, players.length, settings, totalMs, award],
  )

  const timer = useCountdown({
    seconds: settings.answer_seconds,
    running: phase.kind === 'answering' || phase.kind === 'stealing',
    onExpire: () => {
      if (phase.kind === 'answering') resolve(null, 0)
      else if (phase.kind === 'stealing') {
        setDeltas({})
        setPhase({ kind: 'reveal', chosen: phase.missed, stolenBy: null })
      }
    },
  })

  const advance = useCallback(() => {
    const isLast = round + 1 >= settings.rounds
    if (isLast) {
      play('fanfare')
      onFinish(board)
      return
    }
    const next = picker.draw({ difficulty: targetFor(round + 1) })
    if (!next) {
      onFinish(board)
      return
    }
    setItem(next)
    setRound((r) => r + 1)
    setDeltas({})
    setPhase({ kind: 'answering' })
    timer.reset()
    play('reveal')
  }, [round, settings.rounds, board, picker, onFinish, timer, targetFor])

  const handle = useCallback(
    (action: Action) => {
      if (action.type === 'pause') {
        onExit()
        return
      }
      if (!item) return

      if (phase.kind === 'answering' && action.type === 'select' && action.index < item.options.length) {
        resolve(action.index, timer.msRemaining)
        return
      }

      if (phase.kind === 'stealing' && action.type === 'select' && action.index < item.options.length) {
        if (action.index === phase.missed) return
        if (action.index === item.answer && stealer) {
          play('correct')
          award(stealer.id, settings.steal.points * difficultyMultiplier(item.difficulty, settings.difficulty_bonus))
          setPhase({ kind: 'reveal', chosen: action.index, stolenBy: stealer.id })
        } else {
          play('wrong')
          setDeltas({})
          setPhase({ kind: 'reveal', chosen: action.index, stolenBy: null })
        }
        return
      }

      if (phase.kind === 'reveal' && action.type === 'advance') advance()
    },
    [phase, item, timer.msRemaining, resolve, advance, onExit, stealer, settings, award],
  )

  useKeyboard(handle)

  // Drawn once per reveal. Calling tRandom inline would reroll the line on any
  // re-render, so the host would appear to change their mind mid-sentence.
  const hostLine = useMemo(() => {
    if (phase.kind !== 'reveal' || !item) return ''
    // "That was an easy one" lands badly on a level-5 question.
    const hard = item.difficulty >= 4
    if (phase.chosen === item.answer) return tRandom(hard ? 'host.correctHard' : 'host.correct')
    if (phase.chosen === null) return tRandom('host.timeout')
    return tRandom(hard ? 'host.wrongHard' : 'host.wrong')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, phase.kind, phase.kind === 'reveal' ? phase.chosen : null, item])

  const options = useMemo((): OptionItem[] => {
    if (!item) return []
    return item.options.map((text, index): OptionItem => {
      if (phase.kind === 'reveal') {
        if (index === item.answer) return { text, state: 'correct' }
        if (index === phase.chosen) return { text, state: 'wrong' }
        return { text, state: 'muted' }
      }
      if (phase.kind === 'stealing' && index === phase.missed) return { text, state: 'wrong' }
      return { text, state: 'idle' }
    })
  }, [item, phase])

  if (!item || !activePlayer) {
    return (
      <GameFrame gameId="quiz" round={round + 1} totalRounds={settings.rounds} players={players} board={board} hints={[t('keys.pause')]}>
        <p className="subtitle">{t('errors.noContent')}</p>
      </GameFrame>
    )
  }

  const whoseTurn =
    phase.kind === 'stealing' && stealer
      ? t('games.quiz.stealTurn', { name: stealer.name })
      : t('common.turnOf', { name: activePlayer.name })

  const hints =
    phase.kind === 'reveal'
      ? [t('keys.advance'), t('keys.pause')]
      : [t('keys.select'), t('keys.pause')]

  return (
    <GameFrame
      gameId="quiz"
      round={round + 1}
      totalRounds={settings.rounds}
      players={players}
      board={board}
      activeId={phase.kind === 'stealing' ? stealer?.id : activePlayer.id}
      difficulty={item.difficulty}
      hints={hints}
    >
      <PromptCard eyebrow={whoseTurn}>{item.question}</PromptCard>

      {phase.kind === 'reveal' ? null : (
        <TimerBar ratio={timer.ratio} secondsRemaining={timer.secondsRemaining} />
      )}

      <OptionGrid options={options} onSelect={phase.kind === 'reveal' ? undefined : (i) => handle({ type: 'select', index: i })} />

      {phase.kind === 'reveal' ? (
        <div className="center stack" style={{ alignItems: 'center' }}>
          <div className="title" style={{ fontSize: 'var(--step-2)' }}>{hostLine}</div>
          {Object.entries(deltas).map(([playerId, points]) => {
            const player = players.find((p) => p.id === playerId)
            return player ? (
              <div key={playerId} style={{ color: player.color, fontWeight: 800, fontSize: 'var(--step-1)' }}>
                {player.name} +{points} {t('common.points')}
              </div>
            ) : null
          })}
          {item.note ? <p className="dim" style={{ maxWidth: '60ch' }}>{item.note}</p> : null}
        </div>
      ) : null}
    </GameFrame>
  )
}

export const quizGame = defineGame({
  id: 'quiz',
  minPlayers: 1,
  itemSchema: quizItemSchema,
  settingsSchema: quizSettingsSchema,
  Component: QuizGame,
})

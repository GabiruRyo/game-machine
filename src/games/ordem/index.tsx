import { useCallback, useMemo, useState, type CSSProperties } from 'react'
import { play } from '../../engine/audio'
import { difficultyForRound, difficultyMultiplier } from '../../engine/difficulty'
import { useKeyboard, type Action } from '../../engine/input'
import { rng } from '../../engine/rng'
import { applyDeltas, emptyBoard, type Scoreboard } from '../../engine/scoring'
import { useCountdown } from '../../engine/timer'
import { useI18n } from '../../i18n'
import { columnsFor, PromptCard, TimerBar } from '../../ui/components'
import { GameFrame } from '../../ui/GameFrame'
import { defineGame, type GameContext } from '../types'
import { ordemItemSchema, ordemSettingsSchema, type OrdemItem, type OrdemSettings } from './schema'

/**
 * Collective input: the room argues, and one person types the order by pressing
 * the item numbers in sequence. No dragging, so it works with the same keys as
 * everything else in the pack.
 */
type Phase = 'arranging' | 'reveal'

interface Shuffled {
  label: string
  detail?: string
  /** Index of this entry in the correct order. */
  correctIndex: number
}

function OrdemGame({ settings, players, picker, multiplier, difficulty, onFinish, onExit }: GameContext<OrdemItem, OrdemSettings>) {
  const { t, tRandom } = useI18n()

  const targetFor = useCallback(
    (roundIndex: number) =>
      difficultyForRound(roundIndex, settings.rounds, difficulty.allowed, difficulty.curve),
    [settings.rounds, difficulty],
  )

  const [round, setRound] = useState(0)
  const [board, setBoard] = useState<Scoreboard>(() => emptyBoard(players))
  const [item, setItem] = useState<OrdemItem | null>(() =>
    picker.draw({ difficulty: targetFor(0) }),
  )
  const [phase, setPhase] = useState<Phase>('arranging')
  /** Indices into `shuffled`, in the order the room placed them. */
  const [placed, setPlaced] = useState<number[]>([])
  const [earned, setEarned] = useState(0)

  const shuffled = useMemo((): Shuffled[] => {
    if (!item) return []
    const withIndex = item.entries.map((entry, correctIndex) => ({ ...entry, correctIndex }))
    return rng.shuffle(withIndex)
  }, [item])

  const lockIn = useCallback(
    (order: number[]) => {
      if (!item) return
      // A slot scores when the entry sitting in it belongs there.
      const correctSlots = order.filter(
        (shuffledIndex, slot) => shuffled[shuffledIndex]?.correctIndex === slot,
      ).length
      const perfect = correctSlots === item.entries.length
      const points =
        (correctSlots * settings.points_per_correct_slot +
          (perfect ? settings.points_all_correct_bonus : 0)) *
        difficultyMultiplier(item.difficulty, settings.difficulty_bonus)

      play(perfect ? 'fanfare' : correctSlots > 0 ? 'correct' : 'wrong')
      setEarned(Math.round(points * multiplier))
      // Collective game: the whole room shares the result.
      setBoard((current) =>
        applyDeltas(current, players.map((p) => ({ playerId: p.id, points })), multiplier),
      )
      setPhase('reveal')
    },
    [item, shuffled, settings, players, multiplier],
  )

  const timer = useCountdown({
    seconds: settings.arrange_seconds,
    running: phase === 'arranging',
    onExpire: () => lockIn(placed),
  })

  const advance = useCallback(() => {
    if (round + 1 >= settings.rounds) {
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
    setPlaced([])
    setEarned(0)
    setPhase('arranging')
    timer.reset()
    play('reveal')
  }, [round, settings.rounds, board, picker, onFinish, timer, targetFor])

  const handle = useCallback(
    (action: Action) => {
      if (action.type === 'pause') return onExit()
      if (!item) return

      if (phase === 'reveal') {
        if (action.type === 'advance') advance()
        return
      }

      if (action.type === 'select') {
        if (action.index >= shuffled.length || placed.includes(action.index)) return
        const next = [...placed, action.index]
        setPlaced(next)
        play('move')
        // Placing the last entry locks the answer in; no separate confirm key.
        if (next.length === shuffled.length) lockIn(next)
        return
      }

      if (action.type === 'skip' && placed.length > 0) {
        setPlaced(placed.slice(0, -1))
        play('move')
      }
    },
    [phase, item, shuffled.length, placed, lockIn, advance, onExit],
  )

  useKeyboard(handle)

  const hostLine = useMemo(
    () => {
      if (phase !== 'reveal') return ''
      const hard = (item?.difficulty ?? 1) >= 4
      if (earned > 0) return tRandom(hard ? 'host.correctHard' : 'host.correct')
      return tRandom(hard ? 'host.wrongHard' : 'host.wrong')
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase, round],
  )

  if (!item) {
    return (
      <GameFrame gameId="ordem" round={round + 1} totalRounds={settings.rounds} players={players} board={board} hints={[t('keys.pause')]}>
        <p className="subtitle">{t('errors.noContent')}</p>
      </GameFrame>
    )
  }

  const remaining = shuffled.map((_, index) => index).filter((index) => !placed.includes(index))

  return (
    <GameFrame
      gameId="ordem"
      round={round + 1}
      totalRounds={settings.rounds}
      players={players}
      board={board}
      hints={phase === 'reveal' ? [t('keys.advance'), t('keys.pause')] : [t('keys.select'), t('keys.skip'), t('keys.pause')]}
    >
      <PromptCard>{item.prompt}</PromptCard>

      {phase === 'arranging' ? <TimerBar ratio={timer.ratio} secondsRemaining={timer.secondsRemaining} /> : null}

      {/* The answer being built, slot by slot. */}
      <div className="slots">
        {shuffled.map((_, slot) => {
          const shuffledIndex = placed[slot]
          const entry = shuffledIndex === undefined ? null : shuffled[shuffledIndex]
          const right = phase === 'reveal' && entry?.correctIndex === slot
          return (
            <div key={slot} className="slot" data-state={phase === 'reveal' ? (right ? 'correct' : 'wrong') : entry ? 'filled' : 'empty'}>
              <span className="slot__num">{slot + 1}º</span>
              <span className="slot__label">{entry?.label ?? '—'}</span>
              {phase === 'reveal' && entry?.detail ? <span className="slot__detail">{entry.detail}</span> : null}
            </div>
          )
        })}
      </div>

      {phase === 'arranging' ? (
        <div className="options" style={{ '--cols': columnsFor(remaining.length) } as CSSProperties}>
          {remaining.map((index) => (
            <button key={index} type="button" className="option" onClick={() => handle({ type: 'select', index })}>
              <span className="option__key">{index + 1}</span>
              <span>{shuffled[index]?.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="center stack" style={{ alignItems: 'center' }}>
          <div className="title" style={{ fontSize: 'var(--step-2)' }}>{hostLine}</div>
          <div style={{ fontWeight: 800, fontSize: 'var(--step-1)', color: 'var(--good)' }}>
            +{earned} {t('common.points')}
          </div>
          <p className="dim">{t('games.ordem.correctOrder')}: {item.entries.map((e) => e.label).join(' → ')}</p>
        </div>
      )}
    </GameFrame>
  )
}

export const ordemGame = defineGame({
  id: 'ordem',
  minPlayers: 1,
  itemSchema: ordemItemSchema,
  settingsSchema: ordemSettingsSchema,
  Component: OrdemGame,
})

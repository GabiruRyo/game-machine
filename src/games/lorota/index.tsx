import { useCallback, useMemo, useState } from 'react'
import { play } from '../../engine/audio'
import { difficultyForRound, difficultyMultiplier } from '../../engine/difficulty'
import { useKeyboard, type Action } from '../../engine/input'
import { others } from '../../engine/players'
import { applyDeltas, emptyBoard, type ScoreDelta, type Scoreboard } from '../../engine/scoring'
import { rng } from '../../engine/rng'
import { useCountdown } from '../../engine/timer'
import { useI18n } from '../../i18n'
import { OptionGrid, PromptCard, TimerBar, type OptionItem } from '../../ui/components'
import { GameFrame } from '../../ui/GameFrame'
import { defineGame, type GameContext } from '../types'
import { lorotaItemSchema, lorotaSettingsSchema, type LorotaItem, type LorotaSettings } from './schema'

/**
 * The turn player decides alone, but out loud -- and the rest of the room is
 * explicitly encouraged to talk them into the wrong answer. Hence the heckler
 * points: the room is scored for a successful con.
 */
type Phase = { kind: 'deciding' } | { kind: 'reveal'; chosen: number | null }

interface Line {
  text: string
  note?: string
  isLie: boolean
}

function LorotaGame({ settings, players, picker, multiplier, difficulty, onFinish, onExit }: GameContext<LorotaItem, LorotaSettings>) {
  const { t, tRandom } = useI18n()

  const targetFor = useCallback(
    (roundIndex: number) =>
      difficultyForRound(roundIndex, settings.rounds, difficulty.allowed, difficulty.curve),
    [settings.rounds, difficulty],
  )

  const [round, setRound] = useState(0)
  const [board, setBoard] = useState<Scoreboard>(() => emptyBoard(players))
  const [deltas, setDeltas] = useState<Record<string, number>>({})
  const [item, setItem] = useState<LorotaItem | null>(() =>
    picker.draw({ difficulty: targetFor(0) }),
  )
  const [phase, setPhase] = useState<Phase>({ kind: 'deciding' })

  const activePlayer = players[round % players.length]

  const lines = useMemo((): Line[] => {
    if (!item) return []
    const truths = rng.shuffle(item.truths).slice(0, Math.max(1, settings.statements - 1))
    return rng.shuffle([
      { ...item.lie, isLie: true },
      ...truths.map((truth) => ({ ...truth, isLie: false })),
    ])
  }, [item, settings.statements])

  const resolve = useCallback(
    (chosen: number | null) => {
      if (!activePlayer) return
      const foundIt = chosen !== null && lines[chosen]?.isLie === true

      let awarded: ScoreDelta[]
      const worth = item ? difficultyMultiplier(item.difficulty, settings.difficulty_bonus) : 1

      if (foundIt) {
        play('correct')
        awarded = [{ playerId: activePlayer.id, points: settings.points_correct * worth }]
      } else {
        play('wrong')
        // The room talked them out of it (or the clock did): everyone else scores.
        awarded = others(players, activePlayer.id).map((player) => ({
          playerId: player.id,
          points: settings.points_heckler * worth,
        }))
      }

      setBoard((current) => applyDeltas(current, awarded, multiplier))
      setDeltas(Object.fromEntries(awarded.map((d) => [d.playerId, Math.round(d.points * multiplier)])))
      setPhase({ kind: 'reveal', chosen })
    },
    [activePlayer, lines, players, settings, multiplier, item],
  )

  const timer = useCountdown({
    seconds: settings.decide_seconds,
    running: phase.kind === 'deciding',
    onExpire: () => resolve(null),
  })

  const advance = useCallback(() => {
    if (round + 1 >= settings.rounds) {
      play('fanfare')
      onFinish(board)
      return
    }
    const next = picker.draw({ difficulty: targetFor(round + 1) })
    if (!next) return onFinish(board)
    setItem(next)
    setRound((r) => r + 1)
    setDeltas({})
    setPhase({ kind: 'deciding' })
    timer.reset()
    play('reveal')
  }, [round, settings.rounds, board, picker, onFinish, timer, targetFor])

  const handle = useCallback(
    (action: Action) => {
      if (action.type === 'pause') return onExit()
      if (phase.kind === 'deciding' && action.type === 'select' && action.index < lines.length) {
        resolve(action.index)
        return
      }
      if (phase.kind === 'reveal' && action.type === 'advance') advance()
    },
    [phase, lines.length, resolve, advance, onExit],
  )

  useKeyboard(handle)

  const hostLine = useMemo(() => {
    if (phase.kind !== 'reveal') return ''
    if (phase.chosen === null) return tRandom('host.timeout')
    const hard = (item?.difficulty ?? 1) >= 4
    return lines[phase.chosen]?.isLie
      ? tRandom(hard ? 'host.correctHard' : 'host.correct')
      : tRandom(hard ? 'host.wrongHard' : 'host.wrong')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.kind, round])

  if (!item || !activePlayer) {
    return (
      <GameFrame gameId="lorota" round={round + 1} totalRounds={settings.rounds} players={players} board={board} hints={[t('keys.pause')]}>
        <p className="subtitle">{t('errors.noContent')}</p>
      </GameFrame>
    )
  }

  const options: OptionItem[] = lines.map((line, index): OptionItem => {
    if (phase.kind !== 'reveal') return { text: line.text, state: 'idle' }
    if (line.isLie) return { text: line.text, state: 'correct' }
    if (index === phase.chosen) return { text: line.text, state: 'wrong' }
    return { text: line.text, state: 'muted' }
  })

  return (
    <GameFrame
      gameId="lorota"
      round={round + 1}
      totalRounds={settings.rounds}
      players={players}
      board={board}
      activeId={activePlayer.id}
      difficulty={item.difficulty}
      hints={phase.kind === 'reveal' ? [t('keys.advance'), t('keys.pause')] : [t('keys.select'), t('keys.pause')]}
    >
      <PromptCard eyebrow={t('common.turnOf', { name: activePlayer.name })}>{item.topic}</PromptCard>
      <p className="dim center" style={{ marginTop: -12 }}>{t('games.lorota.findTheLie')}</p>

      {phase.kind === 'deciding' ? <TimerBar ratio={timer.ratio} secondsRemaining={timer.secondsRemaining} /> : null}

      <OptionGrid options={options} onSelect={phase.kind === 'reveal' ? undefined : (i) => handle({ type: 'select', index: i })} />

      {phase.kind === 'reveal' ? (
        <div className="center stack" style={{ alignItems: 'center' }}>
          <div className="title" style={{ fontSize: 'var(--step-2)' }}>{hostLine}</div>
          {lines.find((line) => line.isLie)?.note ? (
            <p className="dim" style={{ maxWidth: '62ch' }}>{lines.find((line) => line.isLie)?.note}</p>
          ) : null}
          <div className="row row--center">
            {Object.entries(deltas).map(([playerId, points]) => {
              const player = players.find((p) => p.id === playerId)
              return player ? (
                <span key={playerId} style={{ color: player.color, fontWeight: 800 }}>
                  {player.name} +{points}
                </span>
              ) : null
            })}
          </div>
        </div>
      ) : null}
    </GameFrame>
  )
}

export const lorotaGame = defineGame({
  id: 'lorota',
  minPlayers: 2,
  itemSchema: lorotaItemSchema,
  settingsSchema: lorotaSettingsSchema,
  Component: LorotaGame,
})

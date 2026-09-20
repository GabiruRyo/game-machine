import { useCallback, useMemo, useState } from 'react'
import { play } from '../../engine/audio'
import { useKeyboard, type Action } from '../../engine/input'
import { rng } from '../../engine/rng'
import { applyDeltas, emptyBoard, type ScoreDelta, type Scoreboard } from '../../engine/scoring'
import { useCountdown } from '../../engine/timer'
import { useI18n } from '../../i18n'
import { OptionGrid, PromptCard, TimerBar, type OptionItem } from '../../ui/components'
import { GameFrame } from '../../ui/GameFrame'
import { defineGame, type GameContext } from '../types'
import { tribunalItemSchema, tribunalSettingsSchema, type TribunalItem, type TribunalSettings } from './schema'

/**
 * The purest shared-screen game in the pack: while people argue, the app is
 * doing nothing but keeping time and occasionally making their life harder.
 */
type Phase =
  | { kind: 'assign' }
  | { kind: 'arguing'; side: 0 | 1; curveball: string | null }
  | { kind: 'verdict'; voterIndex: number; tally: [number, number] }
  | { kind: 'reveal'; winner: 0 | 1 }

function TribunalGame({ settings, players, picker, multiplier, onFinish, onExit }: GameContext<TribunalItem, TribunalSettings>) {
  const { t, tRandom } = useI18n()

  const [round, setRound] = useState(0)
  const [board, setBoard] = useState<Scoreboard>(() => emptyBoard(players))
  const [motion, setMotion] = useState<TribunalItem | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: 'assign' })

  // Pairs rotate so the same two people are not always in the dock.
  const debaters = useMemo(() => {
    const first = players[(round * 2) % players.length]
    const second = players[(round * 2 + 1) % players.length]
    return [first, second === first ? players[(round * 2 + 2) % players.length] : second] as const
  }, [round, players])

  const audience = useMemo(
    () => players.filter((p) => p.id !== debaters[0]?.id && p.id !== debaters[1]?.id),
    [players, debaters],
  )

  // The picker holds both kinds; motions are drawn, curveballs are sampled.
  const drawMotion = useCallback((): TribunalItem | null => {
    for (let attempt = 0; attempt < 12; attempt++) {
      const drawn = picker.draw()
      if (!drawn) return null
      if (drawn.kind === 'motion') return drawn
    }
    return null
  }, [picker])

  const [firstMotion] = useState(() => drawMotion())
  const current = motion ?? firstMotion

  const rollCurveball = useCallback((): string | null => {
    if (!settings.curveballs.enabled) return null
    if (rng.next() > settings.curveballs.chance) return null
    for (let attempt = 0; attempt < 12; attempt++) {
      const drawn = picker.draw()
      if (!drawn) return null
      if (drawn.kind === 'curveball') return drawn.text
    }
    return null
  }, [picker, settings.curveballs])

  const startVerdict = useCallback(() => {
    play('buzz')
    setPhase(
      settings.vote === 'count-entry' && audience.length > 0
        ? { kind: 'verdict', voterIndex: 0, tally: [0, 0] }
        : { kind: 'verdict', voterIndex: -1, tally: [0, 0] },
    )
  }, [settings.vote, audience.length])

  const timer = useCountdown({
    seconds: settings.argument_seconds,
    running: phase.kind === 'arguing',
    onExpire: () => {
      if (phase.kind !== 'arguing') return
      if (phase.side === 0) {
        play('reveal')
        setPhase({ kind: 'arguing', side: 1, curveball: rollCurveball() })
        timer.reset()
      } else {
        startVerdict()
      }
    },
  })

  const settle = useCallback(
    (winner: 0 | 1) => {
      play('fanfare')
      const champion = debaters[winner]
      const loser = debaters[winner === 0 ? 1 : 0]
      const awarded: ScoreDelta[] = []
      if (champion) awarded.push({ playerId: champion.id, points: settings.points_win })
      if (loser) awarded.push({ playerId: loser.id, points: settings.points_participation })
      setBoard((currentBoard) => applyDeltas(currentBoard, awarded, multiplier))
      setPhase({ kind: 'reveal', winner })
    },
    [debaters, settings, multiplier],
  )

  const advance = useCallback(() => {
    if (round + 1 >= settings.rounds) {
      play('fanfare')
      onFinish(board)
      return
    }
    const next = drawMotion()
    if (!next) return onFinish(board)
    setMotion(next)
    setRound((r) => r + 1)
    setPhase({ kind: 'assign' })
    timer.reset()
  }, [round, settings.rounds, board, drawMotion, onFinish, timer])

  const handle = useCallback(
    (action: Action) => {
      if (action.type === 'pause') return onExit()

      if (phase.kind === 'assign' && action.type === 'advance') {
        play('reveal')
        setPhase({ kind: 'arguing', side: 0, curveball: rollCurveball() })
        timer.reset()
        return
      }

      if (phase.kind === 'arguing' && action.type === 'advance') {
        if (phase.side === 0) {
          play('reveal')
          setPhase({ kind: 'arguing', side: 1, curveball: rollCurveball() })
          timer.reset()
        } else {
          startVerdict()
        }
        return
      }

      if (phase.kind === 'verdict' && action.type === 'select' && action.index < 2) {
        const side = action.index as 0 | 1
        // winner-entry settles immediately; count-entry walks the audience.
        if (phase.voterIndex < 0) return settle(side)

        play('move')
        const tally: [number, number] = [...phase.tally]
        tally[side] += 1
        const nextVoter = phase.voterIndex + 1
        if (nextVoter >= audience.length) {
          settle(tally[0] >= tally[1] ? 0 : 1)
        } else {
          setPhase({ kind: 'verdict', voterIndex: nextVoter, tally })
        }
        return
      }

      if (phase.kind === 'reveal' && action.type === 'advance') advance()
    },
    [phase, rollCurveball, timer, startVerdict, settle, audience.length, advance, onExit],
  )

  useKeyboard(handle)

  const hostLine = useMemo(
    () => (phase.kind === 'reveal' ? tRandom('host.gameEnd') : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase.kind, round],
  )

  if (!current || !debaters[0] || !debaters[1]) {
    return (
      <GameFrame gameId="tribunal" round={round + 1} totalRounds={settings.rounds} players={players} board={board} hints={[t('keys.pause')]}>
        <p className="subtitle">{t('errors.noContent')}</p>
      </GameFrame>
    )
  }

  const sideLabels = [
    t('games.tribunal.for', { name: debaters[0].name }),
    t('games.tribunal.against', { name: debaters[1].name }),
  ]

  const frame = (children: React.ReactNode, hints: string[], activeId?: string) => (
    <GameFrame gameId="tribunal" round={round + 1} totalRounds={settings.rounds} players={players} board={board} activeId={activeId} hints={hints}>
      <PromptCard eyebrow={t('games.tribunal.theMotion')}>{current.text}</PromptCard>
      {children}
    </GameFrame>
  )

  if (phase.kind === 'assign') {
    return frame(
      <div className="row row--center" style={{ gap: 32 }}>
        {debaters.map((player, side) => (
          <div key={player.id} className="card" style={{ maxWidth: 380, textAlign: 'center', borderColor: player.color }}>
            <div className="eyebrow">{side === 0 ? t('games.tribunal.sideFor') : t('games.tribunal.sideAgainst')}</div>
            <div className="title" style={{ fontSize: 'var(--step-3)', color: player.color }}>{player.name}</div>
          </div>
        ))}
      </div>,
      [t('keys.advance'), t('keys.pause')],
    )
  }

  if (phase.kind === 'arguing') {
    const speaker = debaters[phase.side]
    return frame(
      <>
        <div className="eyebrow center">{phase.side === 0 ? t('games.tribunal.sideFor') : t('games.tribunal.sideAgainst')}</div>
        <h1 className="title title--huge" style={{ color: speaker?.color }}>{speaker?.name}</h1>
        <TimerBar ratio={timer.ratio} secondsRemaining={timer.secondsRemaining} />
        {phase.curveball && timer.ratio < 0.6 ? (
          <div className="card curveball">
            <div className="eyebrow">{t('games.tribunal.curveball')}</div>
            <div style={{ fontSize: 'var(--step-2)', fontWeight: 800 }}>{phase.curveball}</div>
          </div>
        ) : null}
      </>,
      [t('games.tribunal.keyDone'), t('keys.pause')],
      speaker?.id,
    )
  }

  if (phase.kind === 'verdict') {
    const voter = phase.voterIndex >= 0 ? audience[phase.voterIndex] : null
    return frame(
      <>
        <p className="subtitle center">
          {voter ? t('games.tribunal.voterTurn', { name: voter.name }) : t('games.tribunal.roomVerdict')}
        </p>
        <OptionGrid
          options={sideLabels.map((text): OptionItem => ({ text, state: 'idle' }))}
          onSelect={(i) => handle({ type: 'select', index: i })}
        />
        {phase.voterIndex >= 0 ? (
          <p className="faint">{phase.tally[0]} — {phase.tally[1]}</p>
        ) : null}
      </>,
      [t('keys.select'), t('keys.pause')],
      voter?.id,
    )
  }

  const champion = debaters[phase.winner]
  return frame(
    <div className="center stack" style={{ alignItems: 'center' }}>
      <div className="eyebrow">{t('common.winner')}</div>
      <h1 className="title title--huge" style={{ color: champion?.color }}>{champion?.name}</h1>
      <p className="subtitle">{hostLine}</p>
    </div>,
    [t('keys.advance'), t('keys.pause')],
    champion?.id,
  )
}

export const tribunalGame = defineGame({
  id: 'tribunal',
  minPlayers: 2,
  itemSchema: tribunalItemSchema,
  settingsSchema: tribunalSettingsSchema,
  Component: TribunalGame,
})

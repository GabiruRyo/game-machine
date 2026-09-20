import { useCallback, useMemo, useState } from 'react'
import { play } from '../../engine/audio'
import { useKeyboard, type Action } from '../../engine/input'
import { rng } from '../../engine/rng'
import { applyDeltas, emptyBoard, type ScoreDelta, type Scoreboard } from '../../engine/scoring'
import { useI18n } from '../../i18n'
import { OptionGrid, PromptCard, type OptionItem } from '../../ui/components'
import { GameFrame } from '../../ui/GameFrame'
import { TextEntry } from '../../ui/TextEntry'
import { defineGame, type GameContext } from '../types'
import { legendasItemSchema, legendasSettingsSchema, type LegendasItem, type LegendasSettings } from './schema'

/**
 * Everyone writes in turn, in plain sight, then votes in turn. Seeing a caption
 * typed costs a little surprise and buys a game that needs no second device.
 */
type Phase =
  | { kind: 'writing'; playerIndex: number }
  | { kind: 'voting'; voterIndex: number; votes: number[] }
  | { kind: 'reveal'; votes: number[] }

interface Caption {
  text: string
  playerId: string
}

function LegendasGame({ settings, players, picker, multiplier, onFinish, onExit }: GameContext<LegendasItem, LegendasSettings>) {
  const { t, tRandom } = useI18n()

  const [round, setRound] = useState(0)
  const [board, setBoard] = useState<Scoreboard>(() => emptyBoard(players))
  const [item, setItem] = useState<LegendasItem | null>(() => picker.draw())
  const [captions, setCaptions] = useState<Caption[]>([])
  const [phase, setPhase] = useState<Phase>({ kind: 'writing', playerIndex: 0 })

  const submitCaption = useCallback(
    (text: string) => {
      if (phase.kind !== 'writing') return
      const author = players[phase.playerIndex]
      if (!author) return

      const next = [...captions, { text, playerId: author.id }]
      setCaptions(next)
      play('move')

      if (next.length >= players.length) {
        // Shuffle so the reading order does not give the authors away.
        setCaptions(rng.shuffle(next))
        play('reveal')
        setPhase({ kind: 'voting', voterIndex: 0, votes: [] })
      } else {
        setPhase({ kind: 'writing', playerIndex: phase.playerIndex + 1 })
      }
    },
    [phase, players, captions],
  )

  const tally = useCallback(
    (votes: number[]) => {
      const counts = new Map<string, number>()
      for (const vote of votes) {
        const caption = captions[vote]
        if (caption) counts.set(caption.playerId, (counts.get(caption.playerId) ?? 0) + 1)
      }

      const awarded: ScoreDelta[] = []
      for (const [playerId, count] of counts) {
        const unanimous = count === votes.length && votes.length > 1
        awarded.push({
          playerId,
          points: count * settings.points_per_vote + (unanimous ? settings.points_unanimous_bonus : 0),
        })
      }

      play('fanfare')
      setBoard((current) => applyDeltas(current, awarded, multiplier))
      setPhase({ kind: 'reveal', votes })
    },
    [captions, settings, multiplier],
  )

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
    setCaptions([])
    setPhase({ kind: 'writing', playerIndex: 0 })
    play('reveal')
  }, [round, settings.rounds, board, picker, onFinish])

  const handle = useCallback(
    (action: Action) => {
      if (action.type === 'pause') return onExit()

      if (phase.kind === 'voting' && action.type === 'select' && action.index < captions.length) {
        const voter = players[phase.voterIndex]
        // You may not vote for your own caption.
        if (!voter || captions[action.index]?.playerId === voter.id) return play('wrong')

        const votes = [...phase.votes, action.index]
        play('move')
        if (phase.voterIndex + 1 >= players.length) tally(votes)
        else setPhase({ kind: 'voting', voterIndex: phase.voterIndex + 1, votes })
        return
      }

      if (phase.kind === 'reveal' && action.type === 'advance') advance()
    },
    [phase, captions, players, tally, advance, onExit],
  )

  useKeyboard(handle)

  const hostLine = useMemo(
    () => (phase.kind === 'reveal' ? tRandom('host.gameEnd') : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase.kind, round],
  )

  if (!item) {
    return (
      <GameFrame gameId="legendas" round={round + 1} totalRounds={settings.rounds} players={players} board={board} hints={[t('keys.pause')]}>
        <p className="subtitle">{t('errors.noContent')}</p>
      </GameFrame>
    )
  }

  if (phase.kind === 'writing') {
    const author = players[phase.playerIndex]
    if (!author) return <div />
    return (
      <GameFrame
        gameId="legendas"
        round={round + 1}
        totalRounds={settings.rounds}
        players={players}
        board={board}
        activeId={author.id}
        hints={[t('keys.type'), t('keys.pause')]}
      >
        <PromptCard eyebrow={t('games.legendas.setup')}>{item.prompt}</PromptCard>
        <TextEntry
          key={`${round}-${phase.playerIndex}`}
          player={author}
          label={t('games.legendas.yourCaption')}
          placeholder={t('games.legendas.placeholder')}
          maxLength={120}
          onSubmit={submitCaption}
        />
      </GameFrame>
    )
  }

  const voteCounts = phase.kind === 'reveal'
    ? captions.map((_, index) => phase.votes.filter((vote) => vote === index).length)
    : []

  const options: OptionItem[] = captions.map((caption, index): OptionItem => {
    if (phase.kind !== 'reveal') {
      const voter = players[phase.voterIndex]
      return {
        text: caption.text,
        state: voter && caption.playerId === voter.id ? 'muted' : 'idle',
      }
    }
    const best = Math.max(0, ...voteCounts)
    const author = players.find((p) => p.id === caption.playerId)
    return {
      text: `${caption.text}  —  ${author?.name ?? ''} (${voteCounts[index] ?? 0})`,
      state: (voteCounts[index] ?? 0) === best && best > 0 ? 'correct' : 'muted',
    }
  })

  const voter = phase.kind === 'voting' ? players[phase.voterIndex] : undefined

  return (
    <GameFrame
      gameId="legendas"
      round={round + 1}
      totalRounds={settings.rounds}
      players={players}
      board={board}
      activeId={voter?.id}
      hints={phase.kind === 'reveal' ? [t('keys.advance'), t('keys.pause')] : [t('keys.select'), t('keys.pause')]}
    >
      <PromptCard eyebrow={t('games.legendas.setup')}>{item.prompt}</PromptCard>

      {phase.kind === 'voting' && voter ? (
        <p className="subtitle center">{t('games.legendas.voteTurn', { name: voter.name })}</p>
      ) : null}

      <OptionGrid options={options} onSelect={phase.kind === 'reveal' ? undefined : (i) => handle({ type: 'select', index: i })} />

      {phase.kind === 'reveal' ? (
        <div className="title center" style={{ fontSize: 'var(--step-2)' }}>{hostLine}</div>
      ) : null}
    </GameFrame>
  )
}

export const legendasGame = defineGame({
  id: 'legendas',
  minPlayers: 3,
  itemSchema: legendasItemSchema,
  settingsSchema: legendasSettingsSchema,
  Component: LegendasGame,
})

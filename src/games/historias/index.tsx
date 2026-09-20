import { useCallback, useMemo, useState } from 'react'
import { play } from '../../engine/audio'
import { useKeyboard, type Action } from '../../engine/input'
import { applyDeltas, emptyBoard, type ScoreDelta, type Scoreboard } from '../../engine/scoring'
import { useI18n } from '../../i18n'
import { OptionGrid, PromptCard, type OptionItem } from '../../ui/components'
import { GameFrame } from '../../ui/GameFrame'
import { TextEntry } from '../../ui/TextEntry'
import { defineGame, type GameContext } from '../types'
import { historiasItemSchema, historiasSettingsSchema, type HistoriasItem, type HistoriasSettings } from './schema'

type Phase =
  | { kind: 'collecting'; slot: number }
  | { kind: 'reveal' }
  | { kind: 'favourite' }
  | { kind: 'done'; favourite: number }

interface Filled {
  word: string
  playerId: string
}

function HistoriasGame({ settings, players, picker, multiplier, onFinish, onExit }: GameContext<HistoriasItem, HistoriasSettings>) {
  const { t, tRandom } = useI18n()

  const [round, setRound] = useState(0)
  const [board, setBoard] = useState<Scoreboard>(() => emptyBoard(players))
  const [item, setItem] = useState<HistoriasItem | null>(() => picker.draw())
  const [filled, setFilled] = useState<Filled[]>([])
  const [phase, setPhase] = useState<Phase>({ kind: 'collecting', slot: 0 })

  const submitWord = useCallback(
    (word: string) => {
      if (!item || phase.kind !== 'collecting') return
      const author = players[phase.slot % players.length]
      if (!author) return

      const next = [...filled, { word, playerId: author.id }]
      setFilled(next)
      setBoard((current) =>
        applyDeltas(current, [{ playerId: author.id, points: settings.points_per_word }], multiplier),
      )
      play('move')

      if (next.length >= item.slots.length) {
        play('reveal')
        setPhase({ kind: 'reveal' })
      } else {
        setPhase({ kind: 'collecting', slot: phase.slot + 1 })
      }
    },
    [item, phase, players, filled, settings.points_per_word, multiplier],
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
    setFilled([])
    setPhase({ kind: 'collecting', slot: 0 })
    play('reveal')
  }, [round, settings.rounds, board, picker, onFinish])

  const handle = useCallback(
    (action: Action) => {
      if (action.type === 'pause') return onExit()

      if (phase.kind === 'reveal' && action.type === 'advance') {
        setPhase(settings.points_favourite > 0 ? { kind: 'favourite' } : { kind: 'done', favourite: -1 })
        return
      }

      if (phase.kind === 'favourite' && action.type === 'select' && action.index < filled.length) {
        const chosen = filled[action.index]
        if (chosen) {
          play('fanfare')
          const award: ScoreDelta[] = [{ playerId: chosen.playerId, points: settings.points_favourite }]
          setBoard((current) => applyDeltas(current, award, multiplier))
        }
        setPhase({ kind: 'done', favourite: action.index })
        return
      }

      if (phase.kind === 'done' && action.type === 'advance') advance()
    },
    [phase, filled, settings.points_favourite, multiplier, advance, onExit],
  )

  useKeyboard(handle)

  /** The story with every filled slot highlighted in its author's colour. */
  const story = useMemo(() => {
    if (!item) return null
    const parts = item.template.split(/(\{\d+\})/g)
    return parts.map((part, index) => {
      const match = /^\{(\d+)\}$/.exec(part)
      if (!match) return <span key={index}>{part}</span>
      const slotIndex = Number(match[1]) - 1
      const entry = filled[slotIndex]
      const author = players.find((p) => p.id === entry?.playerId)
      return (
        <strong key={index} className="story__word" style={{ color: author?.color }}>
          {entry?.word ?? '…'}
        </strong>
      )
    })
  }, [item, filled, players])

  const hostLine = useMemo(
    () => (phase.kind === 'done' ? tRandom('host.gameEnd') : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase.kind, round],
  )

  if (!item) {
    return (
      <GameFrame gameId="historias" round={round + 1} totalRounds={settings.rounds} players={players} board={board} hints={[t('keys.pause')]}>
        <p className="subtitle">{t('errors.noContent')}</p>
      </GameFrame>
    )
  }

  if (phase.kind === 'collecting') {
    const author = players[phase.slot % players.length]
    const slot = item.slots[phase.slot]
    if (!author || !slot) return <div />
    return (
      <GameFrame
        gameId="historias"
        round={round + 1}
        totalRounds={settings.rounds}
        players={players}
        board={board}
        activeId={author.id}
        hints={[t('keys.type'), t('keys.pause')]}
      >
        <div className="eyebrow">
          {t('games.historias.wordCount', { current: phase.slot + 1, total: item.slots.length })}
        </div>
        <TextEntry key={`${round}-${phase.slot}`} player={author} label={slot.prompt} onSubmit={submitWord} />
        <p className="faint center" style={{ maxWidth: '52ch' }}>{t('games.historias.noPeeking')}</p>
      </GameFrame>
    )
  }

  return (
    <GameFrame
      gameId="historias"
      round={round + 1}
      totalRounds={settings.rounds}
      players={players}
      board={board}
      hints={phase.kind === 'favourite' ? [t('keys.select'), t('keys.pause')] : [t('keys.advance'), t('keys.pause')]}
    >
      <PromptCard eyebrow={t('games.historias.theStory')}>{item.title}</PromptCard>
      <div className="card story">{story}</div>

      {phase.kind === 'favourite' ? (
        <>
          <p className="subtitle center">{t('games.historias.pickFavourite')}</p>
          <OptionGrid
            options={filled.map((entry): OptionItem => ({ text: entry.word, state: 'idle' }))}
            onSelect={(i) => handle({ type: 'select', index: i })}
          />
        </>
      ) : null}

      {phase.kind === 'done' ? (
        <div className="center stack" style={{ alignItems: 'center' }}>
          <div className="title" style={{ fontSize: 'var(--step-2)' }}>{hostLine}</div>
          {phase.favourite >= 0 ? (
            <p className="subtitle">
              {t('games.historias.favouriteWas')}: <strong>{filled[phase.favourite]?.word}</strong>
            </p>
          ) : null}
        </div>
      ) : null}
    </GameFrame>
  )
}

export const historiasGame = defineGame({
  id: 'historias',
  minPlayers: 2,
  itemSchema: historiasItemSchema,
  settingsSchema: historiasSettingsSchema,
  Component: HistoriasGame,
})

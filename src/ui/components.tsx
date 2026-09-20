import type { CSSProperties, ReactNode } from 'react'
import type { Player } from '../engine/players'
import { ranked, type Scoreboard } from '../engine/scoring'

/** The three-band layout every screen in the pack uses. */
export function Screen({
  top,
  bottom,
  children,
}: {
  top?: ReactNode
  bottom?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="screen">
      <div className="screen__top">{top}</div>
      <div className="screen__stage">{children}</div>
      <div className="screen__bottom">{bottom}</div>
    </div>
  )
}

export function PromptCard({ eyebrow, children }: { eyebrow?: string; children: ReactNode }) {
  return (
    <div className="card">
      {eyebrow ? <div className="eyebrow center" style={{ marginBottom: 12 }}>{eyebrow}</div> : null}
      <p className="card__prompt">{children}</p>
    </div>
  )
}

export type OptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'muted'

export interface OptionItem {
  text: string
  state?: OptionState
  /** Overrides the default 1/2/3/4 key label. */
  keyLabel?: string
}

/** 4 options read far better as a 2x2 block than as auto-fit's 3-then-1. */
export const columnsFor = (count: number): number => {
  if (count <= 2) return count
  if (count === 4) return 2
  return 3
}

export function OptionGrid({
  options,
  onSelect,
  disabled = false,
}: {
  options: OptionItem[]
  onSelect?: (index: number) => void
  disabled?: boolean
}) {
  return (
    <div className="options" style={{ '--cols': columnsFor(options.length) } as CSSProperties}>
      {options.map((option, index) => (
        <button
          key={`${index}-${option.text}`}
          type="button"
          className="option"
          data-state={option.state ?? 'idle'}
          disabled={disabled || !onSelect}
          onClick={() => onSelect?.(index)}
        >
          <span className="option__key">{option.keyLabel ?? index + 1}</span>
          <span>{option.text}</span>
        </button>
      ))}
    </div>
  )
}

export function TimerBar({
  ratio,
  secondsRemaining,
  urgentBelow = 5,
}: {
  ratio: number
  secondsRemaining: number
  urgentBelow?: number
}) {
  const urgent = secondsRemaining <= urgentBelow
  return (
    <div className={`timer${urgent ? ' timer--urgent' : ''}`}>
      <div className="timer__track">
        <div className="timer__fill" style={{ width: `${Math.max(0, ratio) * 100}%` }} />
      </div>
      <div className="timer__value">{Math.max(0, secondsRemaining)}</div>
    </div>
  )
}

export function PlayerBadge({
  player,
  score,
  active = false,
}: {
  player: Player
  score?: number
  active?: boolean
}) {
  return (
    <span className={`badge${active ? ' badge--active' : ''}`} style={{ color: player.color }}>
      <span className="badge__dot" />
      <span className="badge__name">{player.name}</span>
      {score === undefined ? null : <span className="badge__score">{score}</span>}
    </span>
  )
}

export function Scoreboard({
  players,
  board,
  deltas,
  activeId,
}: {
  players: Player[]
  board: Scoreboard
  /** Points just won this round, shown as a green +N next to the total. */
  deltas?: Record<string, number>
  activeId?: string
}) {
  return (
    <div className="scores">
      {ranked(players, board).map(({ player, score, rank }) => (
        <div
          key={player.id}
          className="scores__row"
          style={activeId === player.id ? { borderColor: player.color } : undefined}
        >
          <span className="scores__rank">{rank}</span>
          <span className="scores__name">
            <span className="badge__dot" style={{ color: player.color }} />
            {player.name}
          </span>
          <span className="scores__value">
            {score}
            {deltas?.[player.id] ? <span className="scores__delta">+{deltas[player.id]}</span> : null}
          </span>
        </div>
      ))}
    </div>
  )
}

export function KeyHints({ hints }: { hints: string[] }) {
  if (hints.length === 0) return null
  return (
    <div className="hints">
      {hints.map((hint) => (
        <span className="hints__item" key={hint}>
          {hint}
        </span>
      ))}
    </div>
  )
}

export interface MenuEntry {
  id: string
  label: string
  meta?: string
  disabled?: boolean
}

export function MenuList({
  entries,
  activeIndex,
  onSelect,
}: {
  entries: MenuEntry[]
  activeIndex: number
  onSelect: (id: string, index: number) => void
}) {
  return (
    <div className="menu">
      {entries.map((entry, index) => (
        <button
          key={entry.id}
          type="button"
          className="menu__item"
          data-active={index === activeIndex}
          disabled={entry.disabled}
          onClick={() => onSelect(entry.id, index)}
        >
          <span>{entry.label}</span>
          {entry.meta ? <span className="menu__meta">{entry.meta}</span> : null}
        </button>
      ))}
    </div>
  )
}

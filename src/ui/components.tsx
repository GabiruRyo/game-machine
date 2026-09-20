import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
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

/**
 * Rolls a number up to its new value instead of snapping. Purely cosmetic, but
 * it is what makes a score change read as an event rather than a redraw.
 */
function useCountUp(value: number, ms = 550): number {
  const [shown, setShown] = useState(value)
  const fromRef = useRef(value)

  useEffect(() => {
    const from = fromRef.current
    if (from === value) return
    const start = performance.now()
    let frame = 0

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      // easeOutCubic: fast first, settles gently on the final figure.
      const eased = 1 - Math.pow(1 - t, 3)
      setShown(Math.round(from + (value - from) * eased))
      if (t < 1) frame = requestAnimationFrame(step)
      else fromRef.current = value
    }

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value, ms])

  return shown
}

export function PromptCard({ eyebrow, children }: { eyebrow?: string; children: ReactNode }) {
  return (
    <motion.div
      className="card"
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.34, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {eyebrow ? <div className="eyebrow center" style={{ marginBottom: 12 }}>{eyebrow}</div> : null}
      <p className="card__prompt">{children}</p>
    </motion.div>
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
  const interactive = !disabled && Boolean(onSelect)
  return (
    <div className="options" style={{ '--cols': columnsFor(options.length) } as CSSProperties}>
      {options.map((option, index) => (
        <motion.button
          key={`${index}-${option.text}`}
          type="button"
          className="option"
          data-state={option.state ?? 'idle'}
          disabled={disabled || !onSelect}
          onClick={() => onSelect?.(index)}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={interactive ? { y: -3 } : undefined}
          whileTap={interactive ? { scale: 0.99 } : undefined}
          // Staggered so the room's eye is led down the list in order.
          transition={{ duration: 0.26, delay: index * 0.045, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <span className="option__key">{option.keyLabel ?? index + 1}</span>
          <span>{option.text}</span>
        </motion.button>
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
  const shown = useCountUp(score ?? 0)
  return (
    <motion.span
      className={`badge${active ? ' badge--active' : ''}`}
      style={{ color: player.color }}
      animate={active ? { scale: 1.04 } : { scale: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
    >
      <span className="badge__dot" />
      <span className="badge__name">{player.name}</span>
      {score === undefined ? null : <span className="badge__score">{shown}</span>}
    </motion.span>
  )
}

function ScoreRow({
  player,
  score,
  rank,
  delta,
  highlight,
}: {
  player: Player
  score: number
  rank: number
  delta?: number
  highlight: boolean
}) {
  const shown = useCountUp(score)
  return (
    <motion.div
      layout
      className="scores__row"
      data-rank={rank}
      style={highlight ? { borderColor: player.color } : undefined}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
    >
      <span className="scores__rank">{rank}</span>
      <span className="scores__name">
        <span className="badge__dot" style={{ color: player.color }} />
        {player.name}
      </span>
      <span className="scores__value">
        {shown}
        <AnimatePresence>
          {delta ? (
            <motion.span
              className="scores__delta"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              +{delta}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </span>
    </motion.div>
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
      {/* `layout` on each row means overtaking someone animates the swap. */}
      {ranked(players, board).map(({ player, score, rank }) => (
        <ScoreRow
          key={player.id}
          player={player}
          score={score}
          rank={rank}
          delta={deltas?.[player.id]}
          highlight={activeId === player.id}
        />
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
        <motion.button
          key={entry.id}
          type="button"
          className="menu__item"
          data-active={index === activeIndex}
          disabled={entry.disabled}
          onClick={() => onSelect(entry.id, index)}
          initial={{ opacity: 0, x: -14 }}
          // The active row slides out to the right; the accent bar is CSS.
          animate={{ opacity: 1, x: index === activeIndex ? 8 : 0 }}
          whileHover={entry.disabled ? undefined : { x: index === activeIndex ? 10 : 3 }}
          transition={{ duration: 0.28, delay: index * 0.05, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <span>{entry.label}</span>
          {entry.meta ? <span className="menu__meta">{entry.meta}</span> : null}
        </motion.button>
      ))}
    </div>
  )
}

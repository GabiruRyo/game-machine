import { useCallback, useEffect, useState } from 'react'
import { play } from '../engine/audio'
import { useKeyboard, type Action } from '../engine/input'

/**
 * Arrow-key navigation over a list. Shared by the main menu, the game picker and
 * player setup so the keyboard behaves identically everywhere.
 */
export function useMenuNav<T extends { disabled?: boolean }>(
  entries: T[],
  onChoose: (index: number) => void,
  options: { enabled?: boolean; onBack?: () => void } = {},
) {
  const { enabled = true, onBack } = options
  const [index, setIndex] = useState(0)

  // Keep the cursor in range when the list shrinks (e.g. removing a player).
  useEffect(() => {
    setIndex((current) => (entries.length === 0 ? 0 : Math.min(current, entries.length - 1)))
  }, [entries.length])

  const move = useCallback(
    (delta: number) => {
      if (entries.length === 0) return
      setIndex((current) => {
        let next = current
        // Skip over disabled rows rather than letting the cursor stick on them.
        for (let step = 0; step < entries.length; step++) {
          next = (next + delta + entries.length) % entries.length
          if (!entries[next]?.disabled) break
        }
        return next
      })
      play('move')
    },
    [entries],
  )

  const handle = useCallback(
    (action: Action) => {
      switch (action.type) {
        case 'adjust':
          move(action.delta)
          break
        case 'advance':
          if (!entries[index]?.disabled) onChoose(index)
          break
        case 'select':
          if (action.index < entries.length && !entries[action.index]?.disabled) {
            setIndex(action.index)
            onChoose(action.index)
          }
          break
        case 'pause':
          onBack?.()
          break
        default:
          break
      }
    },
    [entries, index, move, onChoose, onBack],
  )

  useKeyboard(handle, { enabled })

  return { index, setIndex }
}

import { useEffect, useRef } from 'react'

/**
 * One keyboard handler for the whole app, translating keys into the small set of
 * semantic actions every phase speaks. Because the controls never change between
 * games, anyone in the room can pick up the keyboard and drive.
 */

export type Action =
  | { type: 'advance' }
  | { type: 'back' }
  | { type: 'select'; index: number }
  /** Vertical: move through a list. */
  | { type: 'navigate'; delta: number }
  /** Horizontal: change the value of whatever is highlighted. */
  | { type: 'adjust'; delta: number }
  | { type: 'judge'; value: boolean }
  | { type: 'skip' }
  | { type: 'pause' }
  | { type: 'fullscreen' }

export type ActionHandler = (action: Action, event: KeyboardEvent) => void

const SELECT_KEYS: Record<string, number> = {
  Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5,
  Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3, Numpad5: 4, Numpad6: 5,
}

export function keyToAction(event: KeyboardEvent): Action | null {
  switch (event.code) {
    case 'Space':
    case 'Enter':
    case 'NumpadEnter':
      return { type: 'advance' }
    case 'Backspace':
      return { type: 'skip' }
    case 'Escape':
      return { type: 'pause' }
    case 'ArrowUp':
      return { type: 'navigate', delta: -1 }
    case 'ArrowDown':
      return { type: 'navigate', delta: 1 }
    case 'ArrowLeft':
      return { type: 'adjust', delta: -1 }
    case 'ArrowRight':
      return { type: 'adjust', delta: 1 }
    case 'KeyY':
      return { type: 'judge', value: true }
    case 'KeyN':
      return { type: 'judge', value: false }
    default:
      break
  }

  // F toggles fullscreen, but only when it is not also a select key in context.
  if (event.code === 'KeyF' && !event.repeat && (event.shiftKey || event.altKey)) {
    return { type: 'fullscreen' }
  }

  const index = SELECT_KEYS[event.code]
  return index === undefined ? null : { type: 'select', index }
}

/** True when the user is typing into a field and the global map must stand down. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export interface KeyboardOptions {
  enabled?: boolean
  /** Let Escape and fullscreen through even while a text field has focus. */
  allowWhileTyping?: ReadonlyArray<Action['type']>
}

/**
 * Module-level so the default never changes identity between renders.
 *
 * Only `pause` is allowed through while a text field has focus, and only because
 * Escape is not a printable character. Fullscreen must NOT be here: its binding
 * is Shift+F, which is exactly what the keyboard sends for a capital F, so
 * letting it through swallowed the F in words like "Fecha" or "Friday".
 */
const DEFAULT_ALLOW_WHILE_TYPING: ReadonlyArray<Action['type']> = ['pause']

export function useKeyboard(handler: ActionHandler, options: KeyboardOptions = {}): void {
  const { enabled = true, allowWhileTyping = DEFAULT_ALLOW_WHILE_TYPING } = options
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey) return
      const action = keyToAction(event)
      if (!action) return
      if (isTyping(event.target) && !allowWhileTyping.includes(action.type)) return
      event.preventDefault()
      handlerRef.current(action, event)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled, allowWhileTyping])
}

export async function toggleFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await document.documentElement.requestFullscreen()
  } catch {
    /* denied or unsupported: harmless */
  }
}

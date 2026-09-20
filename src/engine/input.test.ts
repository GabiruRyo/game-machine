import { describe, expect, it } from 'vitest'
import { keyToAction } from './input'

/** Minimal stand-in for the fields keyToAction reads. */
const key = (code: string, mods: Partial<KeyboardEvent> = {}) =>
  ({ code, repeat: false, shiftKey: false, altKey: false, ...mods }) as KeyboardEvent

describe('keyToAction', () => {
  it('maps the universal controls', () => {
    expect(keyToAction(key('Space'))).toEqual({ type: 'advance' })
    expect(keyToAction(key('Enter'))).toEqual({ type: 'advance' })
    expect(keyToAction(key('Backspace'))).toEqual({ type: 'skip' })
    expect(keyToAction(key('Escape'))).toEqual({ type: 'pause' })
    expect(keyToAction(key('KeyY'))).toEqual({ type: 'judge', value: true })
    expect(keyToAction(key('KeyN'))).toEqual({ type: 'judge', value: false })
  })

  it('maps number and numpad keys to option indices', () => {
    expect(keyToAction(key('Digit1'))).toEqual({ type: 'select', index: 0 })
    expect(keyToAction(key('Digit6'))).toEqual({ type: 'select', index: 5 })
    expect(keyToAction(key('Numpad3'))).toEqual({ type: 'select', index: 2 })
  })

  it('does not bind plain letter keys to options', () => {
    // Letters would collide with typing in the caption and mad-libs games, and
    // the on-screen hint only ever advertises the number keys.
    for (const code of ['KeyA', 'KeyB', 'KeyC', 'KeyD', 'KeyE']) {
      expect(keyToAction(key(code)), code).toBeNull()
    }
  })

  it('treats arrows as adjustments in both axes', () => {
    expect(keyToAction(key('ArrowLeft'))).toEqual({ type: 'adjust', delta: -1 })
    expect(keyToAction(key('ArrowRight'))).toEqual({ type: 'adjust', delta: 1 })
  })

  it('only reads F as fullscreen with a modifier', () => {
    expect(keyToAction(key('KeyF'))).toBeNull()
    expect(keyToAction(key('KeyF', { shiftKey: true }))).toEqual({ type: 'fullscreen' })
  })
})

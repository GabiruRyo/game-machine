import { describe, expect, it } from 'vitest'
import { createPicker, memoryStore } from './picker'
import type { BaseItem } from './contentSchema'

const bank = (n: number): BaseItem[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `i${i}`,
    category: 'geral',
    difficulty: 3,
    audience: 'family' as const,
    tags: [],
  }))

describe('picker', () => {
  it('never repeats while the bank still has unseen items', () => {
    const picker = createPicker('t', bank(50), { seed: 1, store: memoryStore() })
    const drawn = Array.from({ length: 50 }, () => picker.draw()?.id)
    expect(new Set(drawn).size).toBe(50)
    expect(drawn.includes(undefined)).toBe(false)
  })

  it('recycles gracefully once exhausted under avoid-until-exhausted', () => {
    const picker = createPicker('t', bank(5), { seed: 2, store: memoryStore() })
    const drawn = Array.from({ length: 12 }, () => picker.draw())
    expect(drawn.every((d) => d !== null)).toBe(true)
    expect(picker.remaining()).toBeGreaterThanOrEqual(0)
  })

  it('stops dead once exhausted under never-repeat', () => {
    const picker = createPicker('t', bank(4), {
      seed: 3,
      policy: 'never-repeat',
      store: memoryStore(),
    })
    expect(picker.drawMany(4)).toHaveLength(4)
    expect(picker.draw()).toBeNull()
  })

  it('remembers what was seen across sessions via the store', () => {
    const store = memoryStore()
    const first = createPicker('shared', bank(10), { seed: 4, store })
    const seenFirst = first.drawMany(6).map((i) => i.id)

    const second = createPicker('shared', bank(10), { seed: 99, store })
    const seenSecond = second.drawMany(4).map((i) => i.id)

    expect(seenSecond.some((id) => seenFirst.includes(id))).toBe(false)
  })

  it('reset clears persisted history', () => {
    const store = memoryStore()
    const picker = createPicker('r', bank(6), { seed: 5, store })
    picker.drawMany(6)
    expect(picker.remaining()).toBe(0)
    picker.reset()
    expect(picker.remaining()).toBe(6)
  })

  it('drawMany returns distinct items', () => {
    const picker = createPicker('d', bank(30), { seed: 6, store: memoryStore() })
    const three = picker.drawMany(3).map((i) => i.id)
    expect(new Set(three).size).toBe(3)
  })

  it('never hands back null while items exist under random policy', () => {
    const picker = createPicker('x', bank(3), { seed: 7, policy: 'random', store: memoryStore() })
    expect(Array.from({ length: 20 }, () => picker.draw()).every((d) => d !== null)).toBe(true)
  })

  it('copes with an empty bank instead of throwing', () => {
    const picker = createPicker('empty', [], { seed: 8, store: memoryStore() })
    expect(picker.draw()).toBeNull()
    expect(picker.drawMany(3)).toEqual([])
  })
})

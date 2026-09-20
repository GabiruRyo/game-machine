import type { RepeatPolicy } from './configSchema'
import type { BaseItem } from './contentSchema'
import { createRng, type Rng } from './rng'

/**
 * Draws content without boring the room. The `seen` set is persisted, so the
 * same questions do not come back next game night either -- which is the whole
 * point of the large content banks.
 */

export interface PickerStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** Used in tests and whenever localStorage is unavailable (private mode, SSR). */
export function memoryStore(): PickerStore {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  }
}

export function browserStore(): PickerStore {
  try {
    const probe = '__gm__'
    window.localStorage.setItem(probe, probe)
    window.localStorage.removeItem(probe)
    return window.localStorage
  } catch {
    return memoryStore()
  }
}

export interface PickerOptions {
  policy?: RepeatPolicy
  store?: PickerStore
  rng?: Rng
  seed?: number
}

export interface Picker<T extends BaseItem> {
  /** Draw one item, or null when the policy forbids recycling and it is spent. */
  draw(): T | null
  /** Draw several distinct items in one go (e.g. the 3 statements of a round). */
  drawMany(count: number): T[]
  /** Items not yet used, under the current policy. */
  remaining(): number
  /** Forget history for this game. Exposed in the menu as "reset content". */
  reset(): void
  readonly total: number
}

const storeKey = (namespace: string) => `gm:seen:${namespace}`

export function createPicker<T extends BaseItem>(
  namespace: string,
  items: readonly T[],
  options: PickerOptions = {},
): Picker<T> {
  const policy: RepeatPolicy = options.policy ?? 'avoid-until-exhausted'
  const store = options.store ?? memoryStore()
  const random = options.rng ?? createRng(options.seed)
  const key = storeKey(namespace)

  const readSeen = (): Set<string> => {
    if (policy === 'random') return new Set()
    try {
      const raw = store.getItem(key)
      if (!raw) return new Set()
      const parsed: unknown = JSON.parse(raw)
      return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set()
    } catch {
      return new Set()
    }
  }

  let seen = readSeen()
  // Guards against the same item appearing twice inside one draw batch, and
  // against a recycle handing back what we drew moments ago.
  let drawnThisSession = new Set<string>()

  const persist = () => {
    if (policy === 'random') return
    try {
      store.setItem(key, JSON.stringify([...seen]))
    } catch {
      /* storage full or blocked: in-memory behaviour still holds for the session */
    }
  }

  const available = (): T[] => items.filter((item) => !seen.has(item.id) && !drawnThisSession.has(item.id))

  const takeOne = (): T | null => {
    if (items.length === 0) return null

    if (policy === 'random') {
      const pool = items.filter((i) => !drawnThisSession.has(i.id))
      return (pool.length > 0 ? random.pick(pool) : random.pick(items)) ?? null
    }

    let pool = available()

    if (pool.length === 0) {
      if (policy === 'never-repeat') return null
      // avoid-until-exhausted: the bank is spent, so start a fresh cycle. Items
      // drawn in this session stay excluded so the recycle is not immediately obvious.
      seen = new Set()
      pool = available()
      if (pool.length === 0) {
        drawnThisSession = new Set()
        pool = items.slice()
      }
    }

    const chosen = random.pick(pool)
    if (!chosen) return null
    seen.add(chosen.id)
    drawnThisSession.add(chosen.id)
    persist()
    return chosen
  }

  return {
    total: items.length,
    draw: takeOne,
    drawMany(count) {
      const out: T[] = []
      for (let i = 0; i < count; i++) {
        const item = takeOne()
        if (!item) break
        out.push(item)
      }
      return out
    },
    remaining: () => (policy === 'random' ? items.length : available().length),
    reset() {
      seen = new Set()
      drawnThisSession = new Set()
      persist()
    },
  }
}

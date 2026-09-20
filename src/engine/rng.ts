/**
 * A small seedable PRNG. Games use the shared unseeded instance; tests pass a
 * seed so that "does the picker ever repeat" is a deterministic question.
 */
export interface Rng {
  next(): number
  int(maxExclusive: number): number
  pick<T>(items: readonly T[]): T
  shuffle<T>(items: readonly T[]): T[]
}

export function createRng(seed?: number): Rng {
  let state = (seed ?? Math.floor(Math.random() * 2 ** 32)) >>> 0

  const next = (): number => {
    // mulberry32
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const int = (maxExclusive: number): number => Math.floor(next() * maxExclusive)

  return {
    next,
    int,
    pick: <T,>(items: readonly T[]): T => items[int(items.length)] as T,
    shuffle<T>(items: readonly T[]): T[] {
      const out = [...items]
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(i + 1)
        ;[out[i], out[j]] = [out[j] as T, out[i] as T]
      }
      return out
    },
  }
}

export const rng = createRng()

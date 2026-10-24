// Seeded random numbers so a run can be replayed exactly ("Same seed").
//
// The generator's internal state is a single 32-bit integer stored in
// PlayerState.rngState. The reducer builds an Rng from it, lets card and
// event effects draw from it, then saves the new state back. Same state in,
// same numbers out, so the reducer stays a pure function.

export type Rng = {
  /** Uniform float in [0, 1). */
  next: () => number
  /** Current internal state, to be saved back into PlayerState. */
  readonly state: number
}

/** mulberry32: tiny, fast and good enough for a card game. */
export function createRng(initialState: number): Rng {
  let a = initialState | 0
  return {
    next() {
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
    },
    get state() {
      return a
    },
  }
}

export function chance(rng: Rng, probability: number): boolean {
  return rng.next() < probability
}

/** Fisher–Yates shuffle. Returns a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function pickWeighted<T>(items: readonly T[], weight: (item: T) => number, rng: Rng): T {
  const total = items.reduce((sum, item) => sum + weight(item), 0)
  let roll = rng.next() * total
  for (const item of items) {
    roll -= weight(item)
    if (roll < 0) return item
  }
  return items[items.length - 1]
}

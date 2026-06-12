/**
 * RandomService — seeded, injectable pseudo-random number generator.
 *
 * Determinism is the core invariant of the engine: given the same seed, every
 * stream of random values must be reproducible bit-for-bit on any platform
 * (Node/V8, Chrome/Android WebView, Safari/iOS JavaScriptCore). This service
 * is the single source of randomness for the simulation — `Math.random()` is
 * banned in `src/` (enforced by ESLint) because it is unseedable.
 *
 * Implementation: mulberry32 — a 32-bit generator with excellent distribution
 * for game use, using only operations that are bit-identical across JS engines
 * (`Math.imul`, integer XOR/shift). No dependencies.
 */

const UINT32 = 4294967296 // 2^32

/**
 * Hash an arbitrary string into a 32-bit integer via FNV-1a.
 * Used to derive child-stream seeds from stream identifiers.
 */
function fnv1a32(str: string): number {
  let hash = 0x811c9dc5 // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    // hash *= FNV prime (16777619), kept in 32-bit space via Math.imul
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/**
 * splitmix32 — used to mix a seed with a stream hash so that forked streams
 * are well-separated even for similar inputs.
 */
function splitmix32(seed: number): number {
  let z = (seed + 0x9e3779b9) | 0
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad)
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97)
  return (z ^ (z >>> 15)) >>> 0
}

export class RandomService {
  /** The seed this service was constructed with (used to derive forks). */
  private readonly seed: number
  /** Internal 32-bit state advanced by every draw. */
  private state: number
  /** Memoized child streams so `fork(id)` is stable within a service. */
  private forks: Map<string, RandomService> = new Map()

  constructor(seed: number) {
    // Normalize to a 32-bit unsigned integer so non-integer / negative seeds
    // behave consistently across platforms.
    this.seed = seed >>> 0
    this.state = this.seed
  }

  /**
   * Core draw: a float in [0, 1) — mulberry32.
   */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / UINT32
  }

  /**
   * Integer in [min, max] inclusive.
   */
  nextInt(min: number, max: number): number {
    if (max < min) {
      throw new Error(`nextInt: max (${max}) < min (${min})`)
    }
    return min + Math.floor(this.next() * (max - min + 1))
  }

  /**
   * Float in [min, max).
   */
  nextRange(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  /**
   * Returns true with probability `p` (clamped to [0, 1]).
   */
  chance(p: number): boolean {
    return this.next() < p
  }

  /**
   * Picks one element uniformly from a non-empty array.
   */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('pick: cannot pick from an empty array')
    }
    return items[Math.floor(this.next() * items.length)]
  }

  /**
   * Deterministic Fisher-Yates shuffle. Returns a new array; the input is
   * left untouched.
   */
  shuffle<T>(items: readonly T[]): T[] {
    const result = items.slice()
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1))
      const tmp = result[i]
      result[i] = result[j]
      result[j] = tmp
    }
    return result
  }

  /**
   * Derives an independent child stream keyed by `streamId`. Repeated calls
   * with the same id return the same memoized instance, so consumption order
   * within one domain never shifts another domain's sequence.
   *
   * Recommended streams: 'spawn', 'combat', 'loot', 'skills', 'ai'.
   */
  fork(streamId: string): RandomService {
    const existing = this.forks.get(streamId)
    if (existing) {
      return existing
    }
    const childSeed = splitmix32(this.seed ^ fnv1a32(streamId))
    const child = new RandomService(childSeed)
    this.forks.set(streamId, child)
    return child
  }

  /**
   * Serializes the internal state for snapshots. Pairs with `setState`.
   */
  getState(): number {
    return this.state
  }

  /**
   * Restores internal state previously captured by `getState`.
   */
  setState(state: number): void {
    this.state = state | 0
  }
}

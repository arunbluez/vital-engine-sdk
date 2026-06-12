/**
 * StateHasher — canonical, cheap world-state fingerprinting.
 *
 * Produces a 64-bit FNV-1a hash (hex string) of the simulation-relevant state.
 * Used for replay verification and desync detection: two runs that diverge by
 * even a single ULP in any numeric field produce different hashes.
 *
 * Numeric fields are hashed as their exact float64 bit patterns (read through
 * a typed-array view) rather than via `JSON.stringify`, which has
 * float-formatting ambiguity.
 * Object keys are visited in sorted order so the hash is independent of
 * property-insertion order.
 */

/** Structural view of what the hasher needs from a world. */
export interface HashableEntity {
  readonly id: number
  getComponents(): Array<{ type: string; serialize(): Record<string, unknown> }>
}

export interface HashableWorld {
  getActiveEntities(): HashableEntity[]
}

const FNV_OFFSET_HI = 0xcbf29ce4
const FNV_OFFSET_LO = 0x84222325
const FNV_PRIME_HI = 0x00000100
const FNV_PRIME_LO = 0x000001b3

/**
 * Incremental 64-bit FNV-1a maintained as two 32-bit lanes (hi/lo) so we never
 * leave exact-integer arithmetic. 64-bit multiply uses 16-bit chunking.
 */
class Fnv1a64 {
  private hi = FNV_OFFSET_HI
  private lo = FNV_OFFSET_LO
  // Reused buffers for reading the exact bit pattern of a float64 as two
  // 32-bit words. All target platforms are little-endian, so the word order is
  // consistent across engines.
  private readonly f64 = new Float64Array(1)
  private readonly u32 = new Uint32Array(this.f64.buffer)

  /**
   * Folds a 32-bit word into the hash. We XOR a whole word (rather than one
   * byte) into the low lane before each multiply: this is not byte-canonical
   * FNV-1a, but it is deterministic and well-distributed, and ~4x faster.
   */
  private mix(word: number): void {
    this.lo = (this.lo ^ (word >>> 0)) >>> 0
    this.multiplyPrime()
  }

  updateByte(byte: number): void {
    this.mix(byte & 0xff)
  }

  updateFloat64(value: number): void {
    // Normalize -0 to 0 so the two never produce different hashes.
    this.f64[0] = value === 0 ? 0 : value
    this.mix(this.u32[0])
    this.mix(this.u32[1])
  }

  updateUint32(value: number): void {
    this.mix(value)
  }

  updateString(str: string): void {
    for (let i = 0; i < str.length; i++) {
      this.mix(str.charCodeAt(i))
    }
  }

  private multiplyPrime(): void {
    const a48 = this.hi >>> 16
    const a32 = this.hi & 0xffff
    const a16 = this.lo >>> 16
    const a00 = this.lo & 0xffff

    const b48 = FNV_PRIME_HI >>> 16
    const b32 = FNV_PRIME_HI & 0xffff
    const b16 = FNV_PRIME_LO >>> 16
    const b00 = FNV_PRIME_LO & 0xffff

    let c00 = a00 * b00
    let c16 = c00 >>> 16
    c00 &= 0xffff

    c16 += a16 * b00
    let c32 = c16 >>> 16
    c16 &= 0xffff
    c16 += a00 * b16
    c32 += c16 >>> 16
    c16 &= 0xffff

    c32 += a32 * b00
    let c48 = c32 >>> 16
    c32 &= 0xffff
    c32 += a16 * b16
    c48 += c32 >>> 16
    c32 &= 0xffff
    c32 += a00 * b32
    c48 += c32 >>> 16
    c32 &= 0xffff

    c48 += a48 * b00 + a32 * b16 + a16 * b32 + a00 * b48
    c48 &= 0xffff

    this.hi = ((c48 << 16) | c32) >>> 0
    this.lo = ((c16 << 16) | c00) >>> 0
  }

  digest(): string {
    return (
      this.hi.toString(16).padStart(8, '0') +
      this.lo.toString(16).padStart(8, '0')
    )
  }
}

/**
 * Recursively folds a serialized value into the hash in a canonical order.
 * Tagged by kind so that e.g. the number 0, false, and "" never collide.
 */
function hashValue(h: Fnv1a64, value: unknown): void {
  if (value === null || value === undefined) {
    h.updateByte(0)
    return
  }
  switch (typeof value) {
    case 'number':
      h.updateByte(1)
      h.updateFloat64(value)
      return
    case 'boolean':
      h.updateByte(2)
      h.updateByte(value ? 1 : 0)
      return
    case 'string':
      h.updateByte(3)
      h.updateUint32(value.length)
      h.updateString(value)
      return
    default:
      break
  }
  if (Array.isArray(value)) {
    h.updateByte(4)
    h.updateUint32(value.length)
    for (const item of value) {
      hashValue(h, item)
    }
    return
  }
  if (typeof value === 'object') {
    h.updateByte(5)
    const keys = Object.keys(value as Record<string, unknown>).sort()
    h.updateUint32(keys.length)
    for (const key of keys) {
      h.updateString(key)
      hashValue(h, (value as Record<string, unknown>)[key])
    }
    return
  }
  // Functions / symbols are not simulation state — ignore.
  h.updateByte(6)
}

export class StateHasher {
  /**
   * Canonical 64-bit hash of the world's simulation state. Entities are
   * sorted by id and each entity's components by type, so the hash is
   * independent of internal storage/iteration order.
   *
   * @param randomStates Optional PRNG stream states to fold in — catches
   *   "same world, divergent future" bugs where geometry matches but the
   *   random sequence has drifted.
   */
  static hash(world: HashableWorld, randomStates?: readonly number[]): string {
    const h = new Fnv1a64()

    const entities = world.getActiveEntities().slice()
    entities.sort((a, b) => a.id - b.id)

    h.updateUint32(entities.length)
    for (const entity of entities) {
      h.updateUint32(entity.id >>> 0)
      const components = entity.getComponents().slice()
      components.sort((a, b) =>
        a.type < b.type ? -1 : a.type > b.type ? 1 : 0
      )
      h.updateUint32(components.length)
      for (const component of components) {
        h.updateString(component.type)
        hashValue(h, component.serialize())
      }
    }

    if (randomStates) {
      h.updateUint32(randomStates.length)
      for (const state of randomStates) {
        h.updateUint32(state >>> 0)
      }
    }

    return h.digest()
  }
}

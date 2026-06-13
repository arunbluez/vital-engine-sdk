import { INPUT_QUANTIZATION, type InputCommand } from '../input/InputCommand'
import type { ReplayData } from './ReplayData'

/**
 * Compact binary serialization for replays, suitable for URL encoding.
 *
 * Layout (then base64url):
 *   u8   format version
 *   u32  seed
 *   u16  tickRate
 *   var  durationTicks
 *   str  engineVersion        (var length + utf8 bytes)
 *   str  configVersion
 *   8B   finalStateHash        (16 hex chars -> 8 bytes)
 *   var  command count
 *   for each command (sorted by tick):
 *     var  tick delta from previous command
 *     u8   type code (MOVE=0, SKILL_PICK=1, PAUSE=2, RESUME=3)
 *     payload: MOVE -> i8 dx*127, i8 dy*127; SKILL_PICK -> u8 index; else none
 *   u8   hasMetadata
 *   str  metadata JSON         (only if hasMetadata)
 *
 * A 90s run with ~2 direction changes/sec (~180 MOVE commands) encodes to well
 * under 1KB.
 */

const TYPE_CODES: Record<InputCommand['type'], number> = {
  MOVE: 0,
  SKILL_PICK: 1,
  PAUSE: 2,
  RESUME: 3,
}
const TYPE_NAMES = ['MOVE', 'SKILL_PICK', 'PAUSE', 'RESUME'] as const

const utf8Encoder = new TextEncoder()
const utf8Decoder = new TextDecoder()

class ByteWriter {
  private bytes: number[] = []

  u8(value: number): void {
    this.bytes.push(value & 0xff)
  }

  i8(value: number): void {
    this.bytes.push(value & 0xff)
  }

  u16(value: number): void {
    this.bytes.push((value >>> 8) & 0xff, value & 0xff)
  }

  u32(value: number): void {
    this.bytes.push(
      (value >>> 24) & 0xff,
      (value >>> 16) & 0xff,
      (value >>> 8) & 0xff,
      value & 0xff
    )
  }

  /** Unsigned LEB128 varint. */
  varint(value: number): void {
    let v = value >>> 0
    while (v >= 0x80) {
      this.bytes.push((v & 0x7f) | 0x80)
      v >>>= 7
    }
    this.bytes.push(v)
  }

  str(value: string): void {
    const encoded = utf8Encoder.encode(value)
    this.varint(encoded.length)
    for (const b of encoded) {
      this.bytes.push(b)
    }
  }

  hash64(hex: string): void {
    for (let i = 0; i < 16; i += 2) {
      this.bytes.push(parseInt(hex.substr(i, 2), 16))
    }
  }

  toUint8Array(): Uint8Array {
    return Uint8Array.from(this.bytes)
  }
}

class ByteReader {
  private offset = 0
  constructor(private readonly bytes: Uint8Array) {}

  u8(): number {
    return this.bytes[this.offset++]
  }

  i8(): number {
    const v = this.bytes[this.offset++]
    return v < 128 ? v : v - 256
  }

  u16(): number {
    return (this.bytes[this.offset++] << 8) | this.bytes[this.offset++]
  }

  u32(): number {
    return (
      ((this.bytes[this.offset++] << 24) |
        (this.bytes[this.offset++] << 16) |
        (this.bytes[this.offset++] << 8) |
        this.bytes[this.offset++]) >>>
      0
    )
  }

  varint(): number {
    let result = 0
    let shift = 0
    let byte: number
    do {
      byte = this.bytes[this.offset++]
      result |= (byte & 0x7f) << shift
      shift += 7
    } while (byte & 0x80)
    return result >>> 0
  }

  str(): string {
    const length = this.varint()
    const slice = this.bytes.subarray(this.offset, this.offset + length)
    this.offset += length
    return utf8Decoder.decode(slice)
  }

  hash64(): string {
    let hex = ''
    for (let i = 0; i < 8; i++) {
      hex += this.bytes[this.offset++].toString(16).padStart(2, '0')
    }
    return hex
  }

  hasMore(): boolean {
    return this.offset < this.bytes.length
  }
}

// --- base64url (no padding), portable over Uint8Array ---

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
const B64_LOOKUP = ((): Int16Array => {
  const table = new Int16Array(128).fill(-1)
  for (let i = 0; i < B64.length; i++) {
    table[B64.charCodeAt(i)] = i
  }
  return table
})()

function toBase64Url(bytes: Uint8Array): string {
  let out = ''
  let i = 0
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]
    out += B64[(n >>> 18) & 63] + B64[(n >>> 12) & 63]
    out += B64[(n >>> 6) & 63] + B64[n & 63]
  }
  const rem = bytes.length - i
  if (rem === 1) {
    const n = bytes[i] << 16
    out += B64[(n >>> 18) & 63] + B64[(n >>> 12) & 63]
  } else if (rem === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8)
    out += B64[(n >>> 18) & 63] + B64[(n >>> 12) & 63] + B64[(n >>> 6) & 63]
  }
  return out
}

function fromBase64Url(str: string): Uint8Array {
  const bytes: number[] = []
  let buffer = 0
  let bits = 0
  for (let i = 0; i < str.length; i++) {
    const value = B64_LOOKUP[str.charCodeAt(i)]
    if (value < 0) {
      continue
    }
    buffer = (buffer << 6) | value
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((buffer >>> bits) & 0xff)
    }
  }
  return Uint8Array.from(bytes)
}

export class ReplaySerializer {
  /** Encodes a replay to a compact, URL-safe base64url string. */
  static encode(replay: ReplayData): string {
    const w = new ByteWriter()
    w.u8(replay.version)
    w.u32(replay.seed)
    w.u16(replay.tickRate)
    w.varint(replay.durationTicks)
    w.str(replay.engineVersion)
    w.str(replay.configVersion)
    w.hash64(replay.finalStateHash)

    const sorted = replay.commands.slice().sort((a, b) => a.tick - b.tick)
    w.varint(sorted.length)
    let prevTick = 0
    for (const cmd of sorted) {
      w.varint(cmd.tick - prevTick)
      prevTick = cmd.tick
      w.u8(TYPE_CODES[cmd.type])
      if (cmd.type === 'MOVE') {
        w.i8(Math.round(cmd.dx * INPUT_QUANTIZATION))
        w.i8(Math.round(cmd.dy * INPUT_QUANTIZATION))
      } else if (cmd.type === 'SKILL_PICK') {
        w.u8(cmd.optionIndex)
      }
    }

    if (replay.metadata !== undefined) {
      w.u8(1)
      w.str(JSON.stringify(replay.metadata))
    } else {
      w.u8(0)
    }

    return toBase64Url(w.toUint8Array())
  }

  /** Decodes a base64url string back into a replay. */
  static decode(encoded: string): ReplayData {
    const r = new ByteReader(fromBase64Url(encoded))
    const version = r.u8()
    const seed = r.u32()
    const tickRate = r.u16()
    const durationTicks = r.varint()
    const engineVersion = r.str()
    const configVersion = r.str()
    const finalStateHash = r.hash64()

    const commandCount = r.varint()
    const commands: InputCommand[] = []
    let tick = 0
    for (let i = 0; i < commandCount; i++) {
      tick += r.varint()
      const type = TYPE_NAMES[r.u8()]
      if (type === 'MOVE') {
        const dx = r.i8() / INPUT_QUANTIZATION
        const dy = r.i8() / INPUT_QUANTIZATION
        commands.push({ tick, type, dx, dy })
      } else if (type === 'SKILL_PICK') {
        const optionIndex = r.u8() as 0 | 1 | 2
        commands.push({ tick, type, optionIndex })
      } else {
        commands.push({ tick, type })
      }
    }

    const replay: ReplayData = {
      version,
      engineVersion,
      configVersion,
      seed,
      tickRate,
      durationTicks,
      commands,
      finalStateHash,
    }

    if (r.hasMore() && r.u8() === 1) {
      replay.metadata = JSON.parse(r.str()) as Record<string, unknown>
    }

    return replay
  }
}

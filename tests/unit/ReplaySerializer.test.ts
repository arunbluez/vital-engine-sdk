import { ReplaySerializer } from '../../src/replay/ReplaySerializer'
import type { ReplayData } from '../../src/replay/ReplayData'
import { quantizeAxis, type InputCommand } from '../../src/input/InputCommand'
import { ENGINE_VERSION, REPLAY_FORMAT_VERSION } from '../../src/version'

function baseReplay(commands: InputCommand[]): ReplayData {
  return {
    version: REPLAY_FORMAT_VERSION,
    engineVersion: ENGINE_VERSION,
    configVersion: '1.0.0',
    seed: 20260613,
    tickRate: 30,
    durationTicks: 2700,
    commands,
    finalStateHash: 'a1b2c3d4e5f60718',
  }
}

describe('ReplaySerializer', () => {
  it('round-trips an empty command log', () => {
    const replay = baseReplay([])
    const decoded = ReplaySerializer.decode(ReplaySerializer.encode(replay))
    expect(decoded).toEqual(replay)
  })

  it('round-trips all command types', () => {
    const commands: InputCommand[] = [
      { tick: 0, type: 'MOVE', dx: quantizeAxis(0.5), dy: quantizeAxis(-0.25) },
      { tick: 5, type: 'SKILL_PICK', optionIndex: 2 },
      { tick: 9, type: 'PAUSE' },
      { tick: 12, type: 'RESUME' },
      { tick: 30, type: 'MOVE', dx: quantizeAxis(-1), dy: quantizeAxis(1) },
    ]
    const replay = baseReplay(commands)
    const decoded = ReplaySerializer.decode(ReplaySerializer.encode(replay))
    expect(decoded).toEqual(replay)
  })

  it('preserves quantized MOVE values exactly', () => {
    const dx = quantizeAxis(0.6789)
    const dy = quantizeAxis(-0.4321)
    const replay = baseReplay([{ tick: 100, type: 'MOVE', dx, dy }])
    const decoded = ReplaySerializer.decode(ReplaySerializer.encode(replay))
    const move = decoded.commands[0]
    expect(move.type).toBe('MOVE')
    if (move.type === 'MOVE') {
      expect(move.dx).toBe(dx)
      expect(move.dy).toBe(dy)
    }
  })

  it('round-trips metadata but it is decoupled from the rest', () => {
    const replay = baseReplay([{ tick: 0, type: 'PAUSE' }])
    replay.metadata = { score: 12345, kills: 67 }
    const decoded = ReplaySerializer.decode(ReplaySerializer.encode(replay))
    expect(decoded.metadata).toEqual({ score: 12345, kills: 67 })
  })

  it('encodes a representative 90s run in under 2KB', () => {
    // ~2 direction changes per second over 90s at 30tps.
    const commands: InputCommand[] = []
    for (let i = 0; i < 180; i++) {
      commands.push({
        tick: i * 15,
        type: 'MOVE',
        dx: quantizeAxis(Math.cos(i)),
        dy: quantizeAxis(Math.sin(i)),
      })
    }
    const encoded = ReplaySerializer.encode(baseReplay(commands))
    expect(encoded.length).toBeLessThan(2048)
    // sanity: it still decodes back to the same commands
    expect(ReplaySerializer.decode(encoded).commands).toHaveLength(180)
  })

  it('produces URL-safe output (no +, /, or =)', () => {
    const commands: InputCommand[] = []
    for (let i = 0; i < 50; i++) {
      commands.push({ tick: i, type: 'MOVE', dx: quantizeAxis(0.9), dy: 0 })
    }
    const encoded = ReplaySerializer.encode(baseReplay(commands))
    expect(encoded).toMatch(/^[A-Za-z0-9_-]*$/)
  })

  it('preserves the final state hash exactly', () => {
    const replay = baseReplay([])
    replay.finalStateHash = 'ffeeddccbbaa9988'
    const decoded = ReplaySerializer.decode(ReplaySerializer.encode(replay))
    expect(decoded.finalStateHash).toBe('ffeeddccbbaa9988')
  })
})

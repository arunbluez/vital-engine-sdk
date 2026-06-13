import {
  Engine,
  World,
  TransformComponent,
  MovementComponent,
  PlayerControllerComponent,
  PlayerControllerSystem,
  MovementSystem,
  ReplayRecorder,
  ReplayPlayer,
  ReplaySerializer,
  REPLAY_MISMATCH_EVENT,
  StateHasher,
} from '@/index'

/** Builds an engine with a single player-controlled, moving entity. */
function buildEngine(seed: number, configVersion = '1.0.0'): Engine {
  const engine = new Engine({
    engine: { seed, tickRate: 30, fixedTimeStep: true, configVersion },
  })
  const world = engine.getWorld()
  world.addSystem(new PlayerControllerSystem())
  world.addSystem(new MovementSystem(engine.getEvents()))

  const player = world.createEntity()
  player.addComponent(new TransformComponent(0, 0))
  player.addComponent(new MovementComponent(200, 0.8))
  player.addComponent(new PlayerControllerComponent(200))
  return engine
}

/** A deterministic, scripted gesture: a MOVE every 15 ticks. */
const SCRIPT: Array<{ tick: number; dx: number; dy: number }> = []
for (let i = 0; i < 18; i++) {
  SCRIPT.push({ tick: i * 15, dx: Math.cos(i), dy: Math.sin(i) })
}
const DURATION = 270

function driveAndRecord(seed: number): {
  engine: Engine
  replay: ReturnType<ReplayRecorder['stop']>
} {
  const engine = buildEngine(seed)
  const recorder = new ReplayRecorder(engine)
  recorder.start()
  for (let t = 0; t < DURATION; t++) {
    const move = SCRIPT.find((s) => s.tick === t)
    if (move) {
      engine.enqueueInput({ type: 'MOVE', dx: move.dx, dy: move.dy })
    }
    engine.step()
  }
  const replay = recorder.stop({ score: 4242 })
  return { engine, replay }
}

describe('Replay system', () => {
  it('records, serializes, deserializes, and verifies a run', () => {
    const { replay } = driveAndRecord(20260613)

    const encoded = ReplaySerializer.encode(replay)
    const decoded = ReplaySerializer.decode(encoded)

    const player = new ReplayPlayer(buildEngine(20260613), decoded)
    const result = player.runToEnd()

    expect(result.verified).toBe(true)
    expect(result.stateHash).toBe(replay.finalStateHash)
  })

  it('encodes a representative run to a URL-safe string under 2KB', () => {
    const { replay } = driveAndRecord(7)
    const encoded = ReplaySerializer.encode(replay)
    expect(encoded.length).toBeLessThan(2048)
    expect(encoded).toMatch(/^[A-Za-z0-9_-]*$/)
  })

  it('verifies state honestly even when metadata is tampered', () => {
    const { replay } = driveAndRecord(99)
    // Tamper the display-only score; it is not part of the simulation.
    const tampered = { ...replay, metadata: { score: 999999999 } }

    const player = new ReplayPlayer(buildEngine(99), tampered)
    const result = player.runToEnd()
    expect(result.verified).toBe(true)
  })

  it('refuses to verify against a mismatched configVersion', () => {
    const { replay } = driveAndRecord(5)
    const engine = buildEngine(5, '2.0.0') // different balance version
    let mismatchEmitted = false
    engine.getEvents().on(REPLAY_MISMATCH_EVENT, () => {
      mismatchEmitted = true
    })

    const player = new ReplayPlayer(engine, replay)
    expect(player.isCompatible()).toBe(false)
    expect(mismatchEmitted).toBe(true)
    expect(player.runToEnd().verified).toBe(false)
  })

  it('supports forward scrubbing equivalent to a straight run', () => {
    const { replay } = driveAndRecord(31)

    const scrubbedEngine = buildEngine(31)
    const scrubbed = new ReplayPlayer(scrubbedEngine, replay)
    scrubbed.stepTo(80)
    scrubbed.stepTo(200)

    const straightEngine = buildEngine(31)
    const straight = new ReplayPlayer(straightEngine, replay)
    straight.stepTo(200)

    expect(scrubbedEngine.computeStateHash()).toBe(
      straightEngine.computeStateHash()
    )
  })
})

describe('Headless stepping determinism', () => {
  function buildWorld(): World {
    const world = new World(30)
    world.addSystem(new MovementSystem())
    const e = world.createEntity()
    e.addComponent(new TransformComponent(0, 0))
    e.addComponent(new MovementComponent(500, 0.9, 37, -21))
    return world
  }

  it('world.stepN(2700) is reproducible across fresh worlds', () => {
    const a = buildWorld()
    a.stepN(2700)
    const b = buildWorld()
    b.stepN(2700)
    expect(StateHasher.hash(a)).toBe(StateHasher.hash(b))
  })

  it('stepN runs headlessly without any browser APIs', () => {
    const world = buildWorld()
    expect(() => world.stepN(900)).not.toThrow()
    expect(world.getClock().tick).toBe(900)
  })
})

describe('Hash trace divergence localization', () => {
  function run(divergeAt: number | null): Map<number, string> {
    const engine = buildEngine(123)
    const trace = new Map<number, string>()
    engine.getEvents().on('STATE_HASH', (event) => {
      const { tick, hash } = (event as { data: { tick: number; hash: string } })
        .data
      trace.set(tick, hash)
    })
    engine.enableHashTrace(10)

    for (let t = 0; t < DURATION; t++) {
      const move = SCRIPT.find((s) => s.tick === t)
      if (move) {
        // Inject a divergent input at exactly one tick in the diverged run.
        if (divergeAt !== null && t === divergeAt) {
          engine.enqueueInput({ type: 'MOVE', dx: -move.dx, dy: -move.dy })
        } else {
          engine.enqueueInput({ type: 'MOVE', dx: move.dx, dy: move.dy })
        }
      }
      engine.step()
    }
    return trace
  }

  it('pinpoints an injected divergence to the correct tick window', () => {
    // Tick 45 is a scripted MOVE; we invert it in the diverged run.
    const baseline = run(null)
    const diverged = run(45)

    let firstDiff: number | null = null
    for (const tick of [...baseline.keys()].sort((a, b) => a - b)) {
      if (baseline.get(tick) !== diverged.get(tick)) {
        firstDiff = tick
        break
      }
    }
    // Divergence applied during tick 45's step shows up at the next trace
    // boundary (post-step tick 50).
    expect(firstDiff).toBe(50)
  })
})

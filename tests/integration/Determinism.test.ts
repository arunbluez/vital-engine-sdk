import {
  Engine,
  TransformComponent,
  HealthComponent,
  CombatComponent,
  CombatSystem,
  StateHasher,
} from '@/index'

/**
 * Builds a fresh engine with a deterministic combat scenario for the given
 * seed. Several attackers periodically attack high-health targets; critical
 * hits are the only source of randomness, drawn from the seeded 'combat'
 * stream. Identical seeds must therefore produce bit-identical world state.
 */
function buildScenario(seed: number): {
  engine: Engine
  hash: () => string
} {
  const engine = new Engine({
    engine: { seed, fixedTimeStep: false, targetFPS: 60 },
  })
  const world = engine.getWorld()
  const combatRandom = engine.getRandom('combat')

  const combatSystem = new CombatSystem(
    engine.getEvents(),
    world,
    combatRandom
  )
  world.addSystem(combatSystem)

  // Three attackers, each near a high-health target.
  for (let i = 0; i < 3; i++) {
    const attacker = world.createEntity()
    attacker.addComponent(new TransformComponent(i * 10, 0))
    attacker.addComponent(
      new CombatComponent({
        damage: 20,
        range: 1000,
        attackSpeed: 1,
        criticalChance: 0.5,
        criticalMultiplier: 2.0,
      })
    )

    const target = world.createEntity()
    target.addComponent(new TransformComponent(i * 10 + 5, 0))
    target.addComponent(new HealthComponent(1_000_000))
  }

  engine.start()

  const hash = (): string =>
    StateHasher.hash(world, [combatRandom.getState()])

  return { engine, hash }
}

/**
 * Steps a scenario, recording a hash every `traceEvery` ticks plus the final
 * hash.
 */
function run(
  seed: number,
  ticks: number,
  traceEvery: number
): { trace: string[]; final: string } {
  const { engine, hash } = buildScenario(seed)
  const dt = 1000 / 30
  const trace: string[] = []
  for (let t = 1; t <= ticks; t++) {
    engine.update(dt)
    if (t % traceEvery === 0) {
      trace.push(hash())
    }
  }
  const final = hash()
  engine.destroy()
  return { trace, final }
}

describe('Determinism', () => {
  it('two runs with the same seed produce identical final hashes', () => {
    const a = run(20260613, 300, 100)
    const b = run(20260613, 300, 100)
    expect(a.final).toBe(b.final)
  })

  it('two runs with the same seed produce identical hash traces', () => {
    const a = run(42, 300, 50)
    const b = run(42, 300, 50)
    expect(a.trace).toEqual(b.trace)
    expect(a.trace.length).toBeGreaterThan(0)
  })

  it('different seeds diverge (randomness actually matters)', () => {
    const a = run(1, 300, 100)
    const b = run(2, 300, 100)
    expect(a.final).not.toBe(b.final)
  })

  it('the engine PRNG reproduces sequences across fresh engines', () => {
    const e1 = new Engine({ engine: { seed: 7 } })
    const e2 = new Engine({ engine: { seed: 7 } })
    const s1: number[] = []
    const s2: number[] = []
    for (let i = 0; i < 1000; i++) {
      s1.push(e1.getRandom().next())
      s2.push(e2.getRandom().next())
    }
    expect(s1).toEqual(s2)
    e1.destroy()
    e2.destroy()
  })

  it('named streams are reproducible and independent of the root stream', () => {
    const e1 = new Engine({ engine: { seed: 7 } })
    const e2 = new Engine({ engine: { seed: 7 } })
    // Drain the root stream of e2 first; the named fork must be unaffected.
    for (let i = 0; i < 500; i++) e2.getRandom().next()

    const a = e1.getRandom('spawn')
    const b = e2.getRandom('spawn')
    const seqA: number[] = []
    const seqB: number[] = []
    for (let i = 0; i < 100; i++) {
      seqA.push(a.next())
      seqB.push(b.next())
    }
    expect(seqA).toEqual(seqB)
    e1.destroy()
    e2.destroy()
  })
})

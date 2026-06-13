import {
  Engine,
  RandomService,
  TransformComponent,
  MovementComponent,
  PlayerControllerComponent,
  PlayerControllerSystem,
  MovementSystem,
  CombatSystem,
  CombatComponent,
  HealthComponent,
} from '@/index'
import type { Engine as EngineType } from '@/index'

/**
 * Builds an engine with a player and a few combatant pairs, exercising both
 * input-driven movement and RNG-driven combat crits.
 */
function buildEngine(seed: number): EngineType {
  const engine = new Engine({ engine: { seed, tickRate: 30, fixedTimeStep: true } })
  const world = engine.getWorld()
  world.addSystem(new PlayerControllerSystem())
  world.addSystem(new MovementSystem(engine.getEvents()))
  world.addSystem(
    new CombatSystem(engine.getEvents(), world, engine.getRandom('combat'))
  )

  const player = world.createEntity()
  player.addComponent(new TransformComponent(0, 0))
  player.addComponent(new MovementComponent(200, 0.85))
  player.addComponent(new PlayerControllerComponent(200))

  for (let i = 0; i < 4; i++) {
    const attacker = world.createEntity()
    attacker.addComponent(new TransformComponent(i * 8, 0))
    attacker.addComponent(
      new CombatComponent({
        damage: 15,
        range: 1000,
        attackSpeed: 2,
        criticalChance: 0.4,
        criticalMultiplier: 2,
      })
    )
    const target = world.createEntity()
    target.addComponent(new TransformComponent(i * 8 + 4, 0))
    target.addComponent(new HealthComponent(1_000_000))
  }
  return engine
}

/** Generates a deterministic pseudo-random input log for a run. */
function generateInputs(rng: RandomService, ticks: number): Array<{
  tick: number
  dx: number
  dy: number
}> {
  const inputs: Array<{ tick: number; dx: number; dy: number }> = []
  for (let t = 0; t < ticks; t++) {
    // Change direction ~10% of ticks.
    if (rng.chance(0.1)) {
      inputs.push({
        tick: t,
        dx: rng.nextRange(-1, 1),
        dy: rng.nextRange(-1, 1),
      })
    }
  }
  return inputs
}

function runOnce(
  seed: number,
  inputs: Array<{ tick: number; dx: number; dy: number }>,
  ticks: number
): string {
  const engine = buildEngine(seed)
  let cursor = 0
  for (let t = 0; t < ticks; t++) {
    while (cursor < inputs.length && inputs[cursor].tick === t) {
      const inp = inputs[cursor++]
      engine.enqueueInput({ type: 'MOVE', dx: inp.dx, dy: inp.dy })
    }
    engine.step()
  }
  const hash = engine.computeStateHash()
  engine.destroy()
  return hash
}

describe('Determinism fuzz harness', () => {
  it('50 random (seed, inputLog) pairs each reproduce identically', () => {
    const meta = new RandomService(0xc0ffee)
    const TICKS = 200
    const failures: Array<{ seed: number; a: string; b: string }> = []

    for (let i = 0; i < 50; i++) {
      const seed = meta.nextInt(1, 2_000_000_000)
      const inputs = generateInputs(new RandomService(seed ^ 0x5bd1e995), TICKS)
      const a = runOnce(seed, inputs, TICKS)
      const b = runOnce(seed, inputs, TICKS)
      if (a !== b) {
        failures.push({ seed, a, b })
      }
    }

    // On failure, the seed is reported for reproduction.
    expect(failures).toEqual([])
  })

  it('different seeds generally diverge', () => {
    const inputsA = generateInputs(new RandomService(111), 200)
    const inputsB = generateInputs(new RandomService(222), 200)
    expect(runOnce(111, inputsA, 200)).not.toBe(runOnce(222, inputsB, 200))
  })
})

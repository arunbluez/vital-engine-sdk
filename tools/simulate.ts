/* eslint-disable no-console */
/**
 * Headless seed-validation tool.
 *
 *   npm run simulate -- --seed 42 --ticks 2700 --bot random
 *
 * Builds a representative simulation, drives it with a deterministic bot, and
 * prints the final world stats plus the canonical state hash. Running this with
 * the same arguments on any machine, any OS, any JS engine, any number of
 * times prints the same hash — that is the determinism guarantee.
 */
import {
  Engine,
  RandomService,
  Vector2Math,
  TransformComponent,
  MovementComponent,
  PlayerControllerComponent,
  PlayerControllerSystem,
  MovementSystem,
  CombatSystem,
  CombatComponent,
  HealthComponent,
} from '../src/index'
import type { Engine as EngineType } from '../src/index'

type BotKind = 'random' | 'kiter'

interface Args {
  seed: number
  ticks: number
  bot: BotKind
}

function parseArgs(argv: string[]): Args {
  const args: Args = { seed: 42, ticks: 2700, bot: 'random' }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = argv[i + 1]
    if (arg === '--seed') args.seed = parseInt(next, 10)
    else if (arg === '--ticks') args.ticks = parseInt(next, 10)
    else if (arg === '--bot') args.bot = next as BotKind
    else if (arg.startsWith('--seed=')) args.seed = parseInt(arg.slice(7), 10)
    else if (arg.startsWith('--ticks=')) args.ticks = parseInt(arg.slice(8), 10)
    else if (arg.startsWith('--bot=')) args.bot = arg.slice(6) as BotKind
  }
  return args
}

function buildEngine(seed: number): EngineType {
  const engine = new Engine({
    engine: { seed, tickRate: 30, fixedTimeStep: true },
  })
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

  // A ring of attackers around the player.
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2
    const attacker = world.createEntity()
    attacker.addComponent(
      new TransformComponent(Math.cos(angle) * 120, Math.sin(angle) * 120)
    )
    attacker.addComponent(
      new CombatComponent({
        damage: 12,
        range: 1000,
        attackSpeed: 1.5,
        criticalChance: 0.3,
        criticalMultiplier: 2,
      })
    )
    attacker.addComponent(new HealthComponent(500))
  }
  return engine
}

/** Returns the player's transform position. */
function playerPosition(engine: EngineType): { x: number; y: number } {
  for (const entity of engine.getWorld().getActiveEntities()) {
    if (entity.hasComponent('playerController')) {
      const t = entity.getComponent('transform') as TransformComponent
      return { x: t.position.x, y: t.position.y }
    }
  }
  return { x: 0, y: 0 }
}

function nearestEnemyDir(engine: EngineType): { x: number; y: number } | null {
  const player = playerPosition(engine)
  let nearest: { x: number; y: number } | null = null
  let bestDistSq = Infinity
  for (const entity of engine.getWorld().getActiveEntities()) {
    if (
      entity.hasComponent('health') &&
      !entity.hasComponent('playerController')
    ) {
      const t = entity.getComponent('transform') as TransformComponent
      const dSq = Vector2Math.distanceSquared(player, t.position)
      if (dSq < bestDistSq) {
        bestDistSq = dSq
        nearest = { x: t.position.x, y: t.position.y }
      }
    }
  }
  if (!nearest) return null
  return Vector2Math.normalize(Vector2Math.subtract(nearest, player))
}

function main(): void {
  const { seed, ticks, bot } = parseArgs(process.argv.slice(2))
  const engine = buildEngine(seed)
  const botRng = new RandomService(seed).fork('bot')

  let dir = { x: 1, y: 0 }
  for (let t = 0; t < ticks; t++) {
    if (bot === 'random') {
      if (botRng.chance(0.1)) {
        dir = { x: botRng.nextRange(-1, 1), y: botRng.nextRange(-1, 1) }
      }
    } else {
      // Kiter: flee from the nearest enemy.
      const toEnemy = nearestEnemyDir(engine)
      if (toEnemy) dir = { x: -toEnemy.x, y: -toEnemy.y }
    }
    engine.enqueueInput({ type: 'MOVE', dx: dir.x, dy: dir.y })
    engine.step()
  }

  const stats = engine.getStats().worldStats
  const hash = engine.computeStateHash()
  const pos = playerPosition(engine)

  console.log('vital-engine simulate')
  console.log(`  seed:        ${seed}`)
  console.log(`  ticks:       ${ticks}`)
  console.log(`  bot:         ${bot}`)
  console.log(`  entities:    ${stats.entityCount}`)
  console.log(`  components:  ${stats.componentCount}`)
  console.log(`  player pos:  (${pos.x.toFixed(4)}, ${pos.y.toFixed(4)})`)
  console.log(`  state hash:  ${hash}`)
}

main()

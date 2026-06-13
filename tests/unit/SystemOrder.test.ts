import { World } from '../../src/core/ECS/World'
import { System } from '../../src/core/ECS/System'
import type {
  EntityQuery,
  SystemUpdateContext,
  ComponentType,
} from '../../src/types/CoreTypes'

/** A system that records the order in which it was updated. */
class RecordingSystem extends System {
  readonly requiredComponents: ComponentType[] = []
  constructor(
    readonly name: string,
    private readonly sink: string[]
  ) {
    super()
  }
  update(_context: SystemUpdateContext, _entities: EntityQuery[]): void {
    this.sink.push(this.name)
  }
}

const CANONICAL_ORDER = [
  'playerController',
  'ai',
  'movement',
  'combat',
  'collection',
  'progression',
  'economy',
  'difficulty',
  'spawner',
  'cleanup',
]

describe('System execution order', () => {
  it('executes systems in insertion order, deterministically', () => {
    const build = (): string[] => {
      const sink: string[] = []
      const world = new World(30)
      for (const name of CANONICAL_ORDER) {
        world.addSystem(new RecordingSystem(name, sink))
      }
      world.step()
      return sink
    }

    const first = build()
    expect(first).toEqual(CANONICAL_ORDER)
    // Stable across runs.
    expect(build()).toEqual(first)
  })

  it('order is independent of how many ticks have run', () => {
    const sink: string[] = []
    const world = new World(30)
    for (const name of CANONICAL_ORDER) {
      world.addSystem(new RecordingSystem(name, sink))
    }
    world.stepN(3)
    // Three full passes, each in canonical order.
    expect(sink).toEqual([
      ...CANONICAL_ORDER,
      ...CANONICAL_ORDER,
      ...CANONICAL_ORDER,
    ])
  })
})

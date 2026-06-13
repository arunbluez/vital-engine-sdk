import {
  TransformComponent,
  HealthComponent,
  MovementComponent,
  PlayerControllerComponent,
  CombatComponent,
  ExperienceComponent,
  InventoryComponent,
  SkillsComponent,
  AIComponent,
  EnemyAIComponent,
  CollectibleComponent,
  CollectibleType,
  MagnetComponent,
  DifficultyComponent,
  SpawnerComponent,
} from '@/index'
import type { Component } from '@/index'

/**
 * serialize -> deserialize -> serialize must be a fixed point for every
 * component, otherwise snapshots and state hashing are lossy.
 */
function expectRoundTrip(component: Component): void {
  const data = component.serialize()
  const copy = component.clone()
  // Deep-copy the data so deserialize cannot alias the original.
  copy.deserialize(JSON.parse(JSON.stringify(data)) as Record<string, unknown>)
  expect(copy.serialize()).toEqual(data)
}

describe('Component serialize/deserialize round-trips', () => {
  it('TransformComponent', () => {
    expectRoundTrip(new TransformComponent(12.5, -7.25, 1.2, 1.5, 0.5))
  })

  it('HealthComponent', () => {
    const h = new HealthComponent(120, 80, 2)
    expectRoundTrip(h)
  })

  it('MovementComponent', () => {
    expectRoundTrip(new MovementComponent(150, 0.7, 3, -4))
  })

  it('PlayerControllerComponent', () => {
    expectRoundTrip(new PlayerControllerComponent(175))
  })

  it('CombatComponent', () => {
    expectRoundTrip(
      new CombatComponent({
        damage: 25,
        range: 60,
        attackSpeed: 1.5,
        criticalChance: 0.2,
        criticalMultiplier: 2.5,
      })
    )
  })

  it('ExperienceComponent', () => {
    expectRoundTrip(new ExperienceComponent(5))
  })

  it('InventoryComponent', () => {
    const inv = new InventoryComponent(16)
    inv.addResource('gold', 50)
    expectRoundTrip(inv)
  })

  it('SkillsComponent', () => {
    expectRoundTrip(new SkillsComponent(3))
  })

  it('AIComponent', () => {
    expectRoundTrip(new AIComponent())
  })

  it('EnemyAIComponent', () => {
    expectRoundTrip(new EnemyAIComponent())
  })

  it('CollectibleComponent', () => {
    expectRoundTrip(
      new CollectibleComponent(CollectibleType.EXPERIENCE ?? 'experience', 10)
    )
  })

  it('MagnetComponent', () => {
    expectRoundTrip(new MagnetComponent(150, 250))
  })

  it('DifficultyComponent', () => {
    expectRoundTrip(new DifficultyComponent())
  })

  it('SpawnerComponent', () => {
    expectRoundTrip(
      new SpawnerComponent({ center: { x: 0, y: 0 }, radius: 100 })
    )
  })
})

import {
  Engine,
  World,
  TransformComponent,
  HealthComponent,
  MovementComponent,
  CombatComponent,
  ExperienceComponent,
  InventoryComponent,
  MovementSystem,
  CombatSystem,
  ProgressionSystem,
  EconomySystem,
  GameEventType,
} from '@/index'

describe('Game Systems Integration', () => {
  let engine: Engine
  let world: World

  beforeEach(() => {
    engine = new Engine({
      engine: {
        targetFPS: 60,
        fixedTimeStep: false,
        enableEventHistory: true,
      }
    })
    world = engine.getWorld()
  })

  afterEach(() => {
    engine.destroy()
  })

  test('should create a complete game entity with all components', () => {
    // Create a player entity
    const player = world.createEntity()
    
    player.addComponent(new TransformComponent(100, 100))
    player.addComponent(new HealthComponent(100))
    player.addComponent(new MovementComponent(150)) // 150 units/sec max speed
    player.addComponent(new CombatComponent({
      damage: 25,
      range: 50,
      attackSpeed: 2, // 2 attacks per second
      criticalChance: 0.1,
      criticalMultiplier: 2.0,
    }))
    player.addComponent(new ExperienceComponent(1))
    player.addComponent(new InventoryComponent(20))

    expect(player.hasComponents(['transform', 'health', 'movement', 'combat', 'experience', 'inventory'])).toBe(true)
    expect((player.getComponent('health') as HealthComponent)?.current).toBe(100)
    expect((player.getComponent('experience') as ExperienceComponent)?.level).toBe(1)
  })

  test('should integrate movement and combat systems', () => {
    const events = engine.getEvents()
    let damageDealtEvents = 0
    
    events.on(GameEventType.DAMAGE_DEALT, () => {
      damageDealtEvents++
    })

    // Add systems
    const movementSystem = new MovementSystem(events)
    const combatSystem = new CombatSystem(events, world)
    
    world.addSystem(movementSystem)
    world.addSystem(combatSystem)

    // Create attacker
    const attacker = world.createEntity()
    attacker.addComponent(new TransformComponent(0, 0))
    attacker.addComponent(new MovementComponent(100))
    attacker.addComponent(new CombatComponent({
      damage: 20,
      range: 100,
      attackSpeed: 1,
    }))

    // Create target
    const target = world.createEntity()
    target.addComponent(new TransformComponent(50, 0)) // Within range
    target.addComponent(new HealthComponent(50))

    // Run one update cycle
    world.update(1000) // 1 second

    // Combat system should have found the target and attacked
    expect(damageDealtEvents).toBeGreaterThan(0)
    expect((target.getComponent('health') as HealthComponent)?.current).toBeLessThan(50)
  })

  test('should handle experience and progression', () => {
    const events = engine.getEvents()
    let levelUpEvents = 0
    
    events.on(GameEventType.LEVEL_UP, () => {
      levelUpEvents++
    })

    // Add progression system
    const progressionSystem = new ProgressionSystem(events, world)
    world.addSystem(progressionSystem)

    // Create player with experience
    const player = world.createEntity()
    player.addComponent(new ExperienceComponent(1))

    // Manually award experience
    const levelsGained = progressionSystem.grantExperience(player.id, 500)
    
    expect(levelsGained.length).toBeGreaterThan(0)
    expect(levelUpEvents).toBeGreaterThan(0)
    expect((player.getComponent('experience') as ExperienceComponent)?.level).toBeGreaterThan(1)
  })

  test('should handle economy and inventory management', () => {
    const events = engine.getEvents()
    
    // Add economy system
    const economySystem = new EconomySystem(events, world)
    world.addSystem(economySystem)

    // Create player with inventory
    const player = world.createEntity()
    const inventory = new InventoryComponent(10)
    player.addComponent(inventory)

    // Add some resources
    inventory.addResource('gold', 100)
    inventory.addResource('gems', 5)

    // Add some items
    inventory.addItem({ type: 'sword', quantity: 1 })
    inventory.addItem({ type: 'potion', quantity: 3 })

    expect(inventory.getResource('gold')).toBe(100)
    expect(inventory.getResource('gems')).toBe(5)
    expect(inventory.getItemQuantity('sword')).toBe(1)
    expect(inventory.getItemQuantity('potion')).toBe(3)
  })

  test('should handle complete combat scenario with death and experience', () => {
    const events = engine.getEvents()
    let entityKilledEvents = 0
    let experienceGainedEvents = 0
    
    events.on(GameEventType.ENTITY_KILLED, () => {
      entityKilledEvents++
    })
    
    events.on(GameEventType.EXPERIENCE_GAINED, () => {
      experienceGainedEvents++
    })

    // Add all systems
    world.addSystem(new MovementSystem(events))
    world.addSystem(new CombatSystem(events, world))
    world.addSystem(new ProgressionSystem(events, world))
    world.addSystem(new EconomySystem(events, world))

    // Create player
    const player = world.createEntity()
    player.addComponent(new TransformComponent(0, 0))
    player.addComponent(new HealthComponent(100))
    player.addComponent(new MovementComponent(100))
    player.addComponent(new CombatComponent({
      damage: 30,
      range: 60,
      attackSpeed: 10, // Fast attacks to ensure kill
    }))
    player.addComponent(new ExperienceComponent(1))
    player.addComponent(new InventoryComponent(20))

    // Create weak enemy
    const enemy = world.createEntity()
    enemy.addComponent(new TransformComponent(30, 0)) // Within range
    enemy.addComponent(new HealthComponent(10)) // Low health

    const initialLevel = (player.getComponent('experience') as ExperienceComponent)?.level

    // Run updates until enemy is dead
    for (let i = 0; i < 10; i++) {
      world.update(100) // 0.1 seconds per update
      
      const enemyHealth = enemy.getComponent('health') as HealthComponent
      if (enemyHealth && enemyHealth.isDead()) {
        break
      }
    }

    // Enemy should be dead
    expect((enemy.getComponent('health') as HealthComponent)?.isDead()).toBe(true)
    expect(entityKilledEvents).toBeGreaterThan(0)
    expect(experienceGainedEvents).toBeGreaterThan(0)
    
    // Player should have gained experience
    const finalLevel = (player.getComponent('experience') as ExperienceComponent)?.level
    expect(finalLevel).toBeGreaterThanOrEqual(initialLevel!)
  })

  test('should maintain performance with many entities', () => {
    // Add systems
    world.addSystem(new MovementSystem())
    world.addSystem(new CombatSystem(undefined, world))

    // Create many entities
    const entityCount = 100
    for (let i = 0; i < entityCount; i++) {
      const entity = world.createEntity()
      entity.addComponent(new TransformComponent(
        Math.random() * 1000,
        Math.random() * 1000
      ))
      entity.addComponent(new MovementComponent(50 + Math.random() * 100))
      
      // Give some entities combat abilities
      if (i % 2 === 0) {
        entity.addComponent(new CombatComponent({
          damage: 10,
          range: 40,
          attackSpeed: 1,
        }))
      }
      
      // Give some entities health
      if (i % 3 === 0) {
        entity.addComponent(new HealthComponent(50))
      }
    }

    // Measure update performance
    const startTime = performance.now()
    
    // Run 60 updates (simulate 1 second at 60 FPS)
    for (let i = 0; i < 60; i++) {
      world.update(16.67) // ~60 FPS
    }
    
    const endTime = performance.now()
    const totalTime = endTime - startTime
    
    // Should complete in reasonable time (less than 100ms for 100 entities * 60 updates)
    expect(totalTime).toBeLessThan(100)
    
    // All entities should still be active
    expect(world.getStats().activeEntityCount).toBe(entityCount)
  })
})
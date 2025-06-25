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
} from '@/index'

describe('Entity Performance Tests', () => {
  let engine: Engine
  let world: World

  beforeEach(() => {
    engine = new Engine({
      engine: {
        targetFPS: 60,
        fixedTimeStep: false,
        enableEventHistory: false, // Disable for performance
      }
    })
    world = engine.getWorld()
  })

  afterEach(() => {
    engine.destroy()
  })

  test('should handle 1000+ entities with acceptable performance', () => {
    const events = engine.getEvents()
    
    // Add all systems
    world.addSystem(new MovementSystem(events))
    world.addSystem(new CombatSystem(events, world))
    world.addSystem(new ProgressionSystem(events, world))
    world.addSystem(new EconomySystem(events, world))

    // Create 1000 entities with various component combinations
    const entityCount = 1000
    const entities = []

    console.log(`Creating ${entityCount} entities...`)
    const createStartTime = performance.now()

    for (let i = 0; i < entityCount; i++) {
      const entity = world.createEntity()
      entities.push(entity)
      
      // All entities get transform and movement
      entity.addComponent(new TransformComponent(
        Math.random() * 2000 - 1000, // Random position from -1000 to 1000
        Math.random() * 2000 - 1000
      ))
      entity.addComponent(new MovementComponent(50 + Math.random() * 150))
      
      // 80% get health
      if (Math.random() < 0.8) {
        entity.addComponent(new HealthComponent(50 + Math.random() * 100))
      }
      
      // 60% get combat abilities
      if (Math.random() < 0.6) {
        entity.addComponent(new CombatComponent({
          damage: 10 + Math.random() * 20,
          range: 30 + Math.random() * 70,
          attackSpeed: 0.5 + Math.random() * 2,
          criticalChance: Math.random() * 0.2,
          criticalMultiplier: 1.5 + Math.random() * 1.5,
        }))
      }
      
      // 40% get experience
      if (Math.random() < 0.4) {
        entity.addComponent(new ExperienceComponent(1))
      }
      
      // 30% get inventory
      if (Math.random() < 0.3) {
        entity.addComponent(new InventoryComponent(10 + Math.random() * 20))
      }
    }

    const createEndTime = performance.now()
    const createTime = createEndTime - createStartTime
    console.log(`Entity creation took ${createTime.toFixed(2)}ms`)

    // Target: Entity creation should be fast (< 100ms for 1000 entities)
    expect(createTime).toBeLessThan(100)

    // Get initial stats
    const stats = world.getStats()
    expect(stats.activeEntityCount).toBe(entityCount)
    console.log(`Active entities: ${stats.activeEntityCount}`)
    console.log(`Total components: ${stats.componentCount}`)

    // Performance test: Run 60 update cycles (simulating 1 second at 60 FPS)
    console.log('Running performance test (60 updates)...')
    const updateStartTime = performance.now()
    
    const frameTimes = []
    for (let frame = 0; frame < 60; frame++) {
      const frameStart = performance.now()
      world.update(16.67) // ~60 FPS
      const frameEnd = performance.now()
      frameTimes.push(frameEnd - frameStart)
    }
    
    const updateEndTime = performance.now()
    const totalUpdateTime = updateEndTime - updateStartTime
    const averageFrameTime = totalUpdateTime / 60
    const maxFrameTime = Math.max(...frameTimes)
    const minFrameTime = Math.min(...frameTimes)

    console.log(`Total update time: ${totalUpdateTime.toFixed(2)}ms`)
    console.log(`Average frame time: ${averageFrameTime.toFixed(2)}ms`)
    console.log(`Max frame time: ${maxFrameTime.toFixed(2)}ms`)
    console.log(`Min frame time: ${minFrameTime.toFixed(2)}ms`)

    // Performance targets:
    // - Average frame time should be under 16.67ms (60 FPS target)
    // - Total time for 60 updates should be reasonable
    expect(averageFrameTime).toBeLessThan(25) // Should average under 25ms per frame (40fps)
    expect(maxFrameTime).toBeLessThan(300) // Allow for occasional frame spikes during development
    expect(totalUpdateTime).toBeLessThan(1000) // Total 60 frames should be under 1 second

    // Verify entities are still active after performance test
    const finalStats = world.getStats()
    expect(finalStats.activeEntityCount).toBe(entityCount)
  })

  test('should handle 2000+ entities with degraded but acceptable performance', () => {
    const events = engine.getEvents()
    
    // Add systems (minimal set for this stress test)
    world.addSystem(new MovementSystem(events))
    world.addSystem(new CombatSystem(events, world))

    // Create 2000 entities - stress test
    const entityCount = 2000
    console.log(`Creating ${entityCount} entities for stress test...`)

    for (let i = 0; i < entityCount; i++) {
      const entity = world.createEntity()
      
      entity.addComponent(new TransformComponent(
        Math.random() * 4000 - 2000,
        Math.random() * 4000 - 2000
      ))
      entity.addComponent(new MovementComponent(50 + Math.random() * 100))
      
      // 50% get health and combat (reduce complexity)
      if (Math.random() < 0.5) {
        entity.addComponent(new HealthComponent(50 + Math.random() * 50))
        entity.addComponent(new CombatComponent({
          damage: 10 + Math.random() * 10,
          range: 40 + Math.random() * 40,
          attackSpeed: 0.5 + Math.random() * 1,
        }))
      }
    }

    const stats = world.getStats()
    expect(stats.activeEntityCount).toBe(entityCount)
    console.log(`Active entities: ${stats.activeEntityCount}`)

    // Run fewer updates for stress test
    console.log('Running stress test (30 updates)...')
    const updateStartTime = performance.now()
    
    for (let frame = 0; frame < 30; frame++) {
      world.update(16.67)
    }
    
    const updateEndTime = performance.now()
    const totalTime = updateEndTime - updateStartTime
    const averageFrameTime = totalTime / 30

    console.log(`Stress test total time: ${totalTime.toFixed(2)}ms`)
    console.log(`Stress test average frame time: ${averageFrameTime.toFixed(2)}ms`)

    // Relaxed performance targets for stress test - 2000 entities is expected to be slower
    expect(averageFrameTime).toBeLessThan(100) // Should average under 100ms per frame for stress test
    expect(totalTime).toBeLessThan(3000) // Total 30 frames should be under 3 seconds

    // All entities should still be active
    const finalStats = world.getStats()
    expect(finalStats.activeEntityCount).toBe(entityCount)
  })

  test('should efficiently create and destroy entities', () => {
    // Test entity lifecycle performance
    const entityCount = 500
    const cycles = 4 // Create and destroy 4 times

    console.log(`Testing entity lifecycle (${cycles} cycles of ${entityCount} entities)...`)

    for (let cycle = 0; cycle < cycles; cycle++) {
      const createStartTime = performance.now()
      
      // Create entities
      const entities = []
      for (let i = 0; i < entityCount; i++) {
        const entity = world.createEntity()
        entity.addComponent(new TransformComponent(i, i))
        entity.addComponent(new HealthComponent(100))
        entities.push(entity)
      }
      
      const createEndTime = performance.now()
      const createTime = createEndTime - createStartTime

      // Run a few updates to ensure entities are integrated
      for (let j = 0; j < 5; j++) {
        world.update(16.67)
      }

      const destroyStartTime = performance.now()
      
      // Destroy entities
      entities.forEach(entity => {
        world.destroyEntity(entity.id)
      })
      
      const destroyEndTime = performance.now()
      const destroyTime = destroyEndTime - destroyStartTime

      console.log(`Cycle ${cycle + 1}: Create ${createTime.toFixed(2)}ms, Destroy ${destroyTime.toFixed(2)}ms`)

      // Performance targets for entity lifecycle
      expect(createTime).toBeLessThan(50) // Creation should be fast
      expect(destroyTime).toBeLessThan(25) // Destruction should be very fast

      // Verify all entities are gone
      expect(world.getStats().activeEntityCount).toBe(0)
    }
  })
})
import type {
  EntityId,
  ComponentType,
  SystemName,
  EntityQuery,
  WorldSnapshot,
  SystemUpdateContext,
} from '../../types/CoreTypes'
import { Entity } from './Entity'
import type { System } from './System'
import type { Component } from './Component'
import { ObjectPool, type PoolFactory } from '../../utils/Pooling'
import { globalProfiler } from '../Profiler'

/**
 * World class that manages all entities and systems in the ECS architecture.
 * The World is responsible for creating/destroying entities, managing systems,
 * and orchestrating the update loop.
 */
export class World {
  private entities = new Map<EntityId, Entity>()
  private systems = new Map<SystemName, System>()
  private entityQueries = new Map<string, Set<EntityId>>()
  private frameCount: number = 0
  private totalTime: number = 0
  private entityPool: ObjectPool<Entity>
  private recycledIds: EntityId[] = []

  constructor() {
    // Initialize entity pool
    const entityFactory: PoolFactory<Entity> = {
      create: () => new Entity(),
      reset: (entity: Entity) => {
        entity.reset()
      },
    }

    this.entityPool = new ObjectPool(entityFactory, {
      initialSize: 100,
      maxSize: 10000,
      autoResize: true,
      enableMetrics: true,
    })
  }

  /**
   * Creates a new entity in the world
   */
  createEntity(): Entity {
    // Get entity from pool
    const entity = this.entityPool.acquire()

    // Assign ID (reuse recycled ID if available)
    if (this.recycledIds.length > 0) {
      const recycledId = this.recycledIds.pop()!
      entity.setId(recycledId)
    } else {
      entity.setId(Entity.generateId())
    }

    this.entities.set(entity.id, entity)
    return entity
  }

  /**
   * Destroys an entity and removes it from the world
   */
  destroyEntity(entityId: EntityId): void {
    const entity = this.entities.get(entityId)
    if (!entity) {
      return
    }

    // Remove from all queries
    this.entityQueries.forEach((entities) => {
      entities.delete(entityId)
    })

    // Remove from world
    this.entities.delete(entityId)

    // Recycle the entity ID
    this.recycledIds.push(entityId)

    // Return entity to pool
    this.entityPool.release(entity)
  }

  /**
   * Removes an entity from the world (alias for destroyEntity)
   */
  removeEntity(entityId: EntityId): void {
    this.destroyEntity(entityId)
  }

  /**
   * Gets an entity by ID
   */
  getEntity(entityId: EntityId): Entity | null {
    return this.entities.get(entityId) ?? null
  }

  /**
   * Gets all entities in the world
   */
  getAllEntities(): Entity[] {
    return Array.from(this.entities.values())
  }

  /**
   * Gets all active entities
   */
  getActiveEntities(): Entity[] {
    return Array.from(this.entities.values()).filter((entity) =>
      entity.isActive()
    )
  }

  /**
   * Adds a system to the world
   */
  addSystem(system: System): void {
    if (this.systems.has(system.name)) {
      throw new Error(`System "${system.name}" already exists in world`)
    }

    this.systems.set(system.name, system)

    // Initialize the system
    if (system.initialize) {
      system.initialize()
    }

    // Create query key for this system
    const queryKey = this.getQueryKey(system.requiredComponents)
    if (!this.entityQueries.has(queryKey)) {
      this.entityQueries.set(queryKey, new Set())
    }
  }

  /**
   * Removes a system from the world
   */
  removeSystem(systemName: SystemName): void {
    const system = this.systems.get(systemName)
    if (!system) {
      return
    }

    // Destroy the system
    if (system.destroy) {
      system.destroy()
    }

    this.systems.delete(systemName)
  }

  /**
   * Gets a system by name
   */
  getSystem<T extends System>(systemName: SystemName): T | null {
    return (this.systems.get(systemName) as T) ?? null
  }

  /**
   * Updates all systems
   */
  update(deltaTime: number): void {
    this.frameCount++
    this.totalTime += deltaTime

    const context: SystemUpdateContext = {
      deltaTime,
      totalTime: this.totalTime,
      frameCount: this.frameCount,
    }

    // Update entity queries
    globalProfiler.beginMark('world.updateQueries')
    this.updateEntityQueries()
    globalProfiler.endMark('world.updateQueries')

    // Update each system
    this.systems.forEach((system) => {
      if (!system.enabled) {
        return
      }

      globalProfiler.beginMark(`system.${system.name}`, {
        entityCount: this.entities.size,
      })

      const startTime = performance.now()
      const entities = this.getEntitiesForSystem(system)

      system.update(context, entities)

      const updateTime = performance.now() - startTime
      system.updateMetrics(entities.length, updateTime)

      globalProfiler.endMark(`system.${system.name}`)
    })
  }

  /**
   * Gets entities that match a system's requirements
   */
  private getEntitiesForSystem(system: System): EntityQuery[] {
    const queryKey = this.getQueryKey(system.requiredComponents)
    const entityIds = this.entityQueries.get(queryKey) ?? new Set()

    const queries: EntityQuery[] = []

    entityIds.forEach((id) => {
      const entity = this.entities.get(id)
      if (!entity || !entity.isActive()) {
        return
      }

      const components: Record<string, Component> = {}
      system.requiredComponents.forEach((type) => {
        const component = entity.getComponent(type)
        if (component) {
          components[type] = component
        }
      })

      queries.push({
        id: entity.id,
        components: components as unknown as Component,
      })
    })

    return queries
  }

  /**
   * Updates entity queries based on current component compositions
   */
  private updateEntityQueries(): void {
    // Clear all queries
    this.entityQueries.forEach((set) => set.clear())

    // Rebuild queries
    this.entities.forEach((entity) => {
      if (!entity.isActive()) {
        return
      }

      // Check each system's requirements
      this.systems.forEach((system) => {
        if (entity.hasComponents(system.requiredComponents)) {
          const queryKey = this.getQueryKey(system.requiredComponents)
          let query = this.entityQueries.get(queryKey)

          if (!query) {
            query = new Set()
            this.entityQueries.set(queryKey, query)
          }

          query.add(entity.id)
        }
      })
    })
  }

  /**
   * Creates a query key from component types
   */
  private getQueryKey(componentTypes: ComponentType[]): string {
    return componentTypes.slice().sort().join(',')
  }

  /**
   * Gets entities with specific components
   */
  getEntitiesWithComponents(componentTypes: ComponentType[]): Entity[] {
    return Array.from(this.entities.values()).filter(
      (entity) => entity.isActive() && entity.hasComponents(componentTypes)
    )
  }

  /**
   * Creates a snapshot of the world state
   */
  snapshot(): WorldSnapshot {
    const entitySnapshots = Array.from(this.entities.values())
      .filter((entity) => entity.isActive())
      .map((entity) => entity.snapshot())

    const systemSnapshots = Array.from(this.systems.values()).map((system) =>
      system.snapshot()
    )

    let componentCount = 0
    entitySnapshots.forEach((entity) => {
      componentCount += Object.keys(entity.components).length
    })

    return {
      entities: entitySnapshots,
      systems: systemSnapshots,
      entityCount: entitySnapshots.length,
      componentCount,
      timestamp: this.totalTime,
    }
  }

  /**
   * Clears all entities and systems from the world
   */
  clear(): void {
    // Destroy all systems
    this.systems.forEach((system) => {
      if (system.destroy) {
        system.destroy()
      }
    })

    // Return all entities to pool
    this.entities.forEach((entity) => {
      this.entityPool.release(entity)
    })

    this.entities.clear()
    this.systems.clear()
    this.entityQueries.clear()
    this.recycledIds.length = 0
    this.frameCount = 0
    this.totalTime = 0
  }

  /**
   * Gets entity pool statistics
   */
  getEntityPoolStats() {
    return this.entityPool.getStatistics('entities')
  }

  /**
   * Pre-warms the entity pool
   */
  prewarmEntityPool(size: number): void {
    this.entityPool.prewarm(size)
  }

  /**
   * Gets statistics about the world
   */
  getStats(): {
    entityCount: number
    activeEntityCount: number
    systemCount: number
    componentCount: number
    frameCount: number
    totalTime: number
    poolStats: ReturnType<ObjectPool<Entity>['getStatistics']>
  } {
    let componentCount = 0
    let activeEntityCount = 0

    this.entities.forEach((entity) => {
      if (entity.isActive()) {
        activeEntityCount++
        componentCount += entity.getComponentTypes().length
      }
    })

    return {
      entityCount: this.entities.size,
      activeEntityCount,
      systemCount: this.systems.size,
      componentCount,
      frameCount: this.frameCount,
      totalTime: this.totalTime,
      poolStats: this.entityPool.getStatistics('entities'),
    }
  }
}

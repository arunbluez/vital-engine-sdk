import { System } from '../core/ECS/System'
import type { 
  ComponentType, 
  SystemUpdateContext, 
  EntityQuery,
  EntityId,
  EventSystem,
  World
} from '../types/CoreTypes'
import type { TransformComponent } from '../components/Transform'
import type { MagnetComponent } from '../components/Magnet'
import type { CollectibleComponent } from '../components/Collectible'
import { Vector2Math } from '../utils/Math'
import type { Entity } from '../core/ECS/Entity'

// Entity type definitions for the collection system
type CollectorEntityQuery = EntityQuery & {
  components: {
    transform: TransformComponent
    magnet: MagnetComponent
  }
}

type CollectibleEntityQuery = EntityQuery & {
  components: {
    transform: TransformComponent
    collectible: CollectibleComponent
  }
}

/**
 * Simple Collection System for testing Phase 3 features
 * Handles basic attraction and collection of items
 */
export class SimpleCollectionSystem extends System {
  readonly name = 'collection'
  readonly requiredComponents: ComponentType[] = ['transform']
  
  private eventSystem?: EventSystem
  private world?: World

  constructor(eventSystem?: EventSystem, world?: World) {
    super()
    this.eventSystem = eventSystem
    this.world = world
  }
  
  public update(context: SystemUpdateContext, entities: EntityQuery[]): void {
    const deltaTime = context.deltaTime / 1000 // Convert to seconds
    
    // Instead of relying on the entities parameter, query the world directly
    let allEntities: Entity[] = []
    let collectors: Entity[] = []
    let collectibles: Entity[] = []
    
    if (this.world && this.world.getActiveEntities) {
      allEntities = this.world.getActiveEntities() as Entity[]
      
      // Find collectors (entities with magnet)
      collectors = allEntities.filter((e: Entity) => 
        e.hasComponent && e.hasComponent('magnet') && e.hasComponent('transform')
      )
      
      // Find collectibles  
      collectibles = allEntities.filter((e: Entity) => 
        e.hasComponent && e.hasComponent('collectible') && e.hasComponent('transform')
      )
    }
    
    if (collectors.length === 0 || collectibles.length === 0) return
    
    // Process each collector-collectible pair
    collectors.forEach(collector => {
      collectibles.forEach(collectible => {
        this.processCollectionPair(collector, collectible, deltaTime)
      })
    })
  }
  
  private processCollectionPair(collector: Entity, collectible: Entity, deltaTime: number): void {
    const collectorTransform = collector.getComponent('transform') as TransformComponent
    const collectorMagnet = collector.getComponent('magnet') as MagnetComponent
    const collectibleTransform = collectible.getComponent('transform') as TransformComponent
    const collectibleComp = collectible.getComponent('collectible') as CollectibleComponent
    
    if (!collectorTransform || !collectorMagnet || !collectibleTransform || !collectibleComp) {
      return
    }
    
    // Calculate distance
    const distance = Vector2Math.distance(
      collectorTransform.position,
      collectibleTransform.position
    )
    
    const magnetRange = collectorMagnet.magneticField.range || 100
    const collectionRadius = 30 // Increased from 20 to 30
    
    // Check if within magnetic range
    if (distance > magnetRange) return
    
    // If close enough, collect the item
    if (distance <= collectionRadius) {
      this.collectItem(collector, collectible)
      return
    }
    
    // Apply magnetic attraction
    const direction = Vector2Math.normalize(Vector2Math.subtract(
      collectorTransform.position,
      collectibleTransform.position
    ))
    
    const attractionStrength = collectorMagnet.magneticField.strength || 50
    const force = attractionStrength * (1 - distance / magnetRange) // Stronger when closer
    
    // Move collectible toward collector
    collectibleTransform.position.x += direction.x * force * deltaTime
    collectibleTransform.position.y += direction.y * force * deltaTime
  }
  
  private collectItem(collector: Entity, collectible: Entity): void {
    
    // Remove the collectible
    if (this.world && this.world.removeEntity) {
      this.world.removeEntity(collectible.id)
    }
    
    // Emit collection event
    if (this.eventSystem) {
      this.eventSystem.emit('COLLECTIBLE_COLLECTED', {
        collectorId: collector.id,
        collectibleId: collectible.id,
        timestamp: Date.now()
      })
    }
  }
}
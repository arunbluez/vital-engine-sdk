import { System } from '../core/ECS/System'
import { ComponentType, EntityId, SystemUpdateContext } from '../types/CoreTypes'
import { CollectibleComponent } from '../components/Collectible'
import { MagnetComponent } from '../components/Magnet'
import { TransformComponent } from '../components/Transform'
import { Vector2 } from '../utils/Math'
import { CollectionEvent } from '../types/Events'
import { SpatialHashGrid, type SpatialEntity } from '../utils/SpatialPartitioning'

export interface CollectorEntityQuery {
  entityId: EntityId
  magnet: MagnetComponent
  transform: TransformComponent
}

export interface CollectibleEntityQuery {
  entityId: EntityId
  collectible: CollectibleComponent
  transform: TransformComponent
}

export class CollectionSystem extends System {
  readonly name = 'collection'
  readonly requiredComponents: ComponentType[] = ['transform'] // We'll filter for magnet/collectible in the update method
  
  private maxCollectionUpdatesPerFrame: number = 50
  private collectionUpdateIndex: number = 0
  private collectibleUpdateIndex: number = 0
  private eventSystem?: any
  private world?: any
  private spatialGrid: SpatialHashGrid

  constructor(eventSystem?: any, world?: any) {
    super()
    this.eventSystem = eventSystem
    this.world = world
    
    // Initialize spatial grid for efficient proximity queries
    this.spatialGrid = new SpatialHashGrid({
      cellSize: 100, // 100 units per cell
      worldBounds: {
        minX: -5000,
        minY: -5000,
        maxX: 5000,
        maxY: 5000
      }
    })
    
    // Configure batch processing
    this.batchConfig = {
      batchSize: 50,
      maxBatchTime: 1,
      enableParallelProcessing: false
    }
  }
  
  public update(context: SystemUpdateContext, entities: any[]): void {
    const deltaTime = context.deltaTime
    
    // Update spatial grid
    this.updateSpatialGrid(entities)
    
    // Filter entities to get collectors and collectibles
    const collectors = entities.filter(e => 
      e.hasComponent('magnet') && e.hasComponent('transform')
    )
    const collectibles = entities.filter(e => 
      e.hasComponent('collectible') && e.hasComponent('transform')
    )
    
    if (collectors.length === 0 || collectibles.length === 0) return
    
    // Use spatial partitioning for efficient collection processing
    this.processCollectionWithSpatialPartitioning(collectors, deltaTime)
    this.processCollectibleLifecycle(collectibles, deltaTime)
  }
  
  private updateSpatialGrid(entities: any[]): void {
    // Clear and rebuild spatial grid each frame
    this.spatialGrid.clear()
    
    entities.forEach(entity => {
      const transform = entity.getComponent('transform')
      if (!transform) return
      
      const spatialEntity: SpatialEntity = {
        id: entity.id,
        position: transform.position,
        radius: entity.hasComponent('collectible') ? 20 : 0 // Collectibles have a small radius
      }
      
      this.spatialGrid.insert(spatialEntity)
    })
  }
  
  private processCollectionWithSpatialPartitioning(
    collectors: any[],
    deltaTime: number
  ): void {
    collectors.forEach(collector => {
      const collectorTransform = collector.getComponent('transform')
      const collectorMagnet = collector.getComponent('magnet')
      
      if (!collectorTransform || !collectorMagnet) return
      
      // Query nearby entities within magnetic range
      const nearbyEntityIds = this.spatialGrid.query({
        position: collectorTransform.position,
        radius: collectorMagnet.magneticField.range
      })
      
      // Process only nearby collectibles
      nearbyEntityIds.forEach(entityId => {
        const entity = this.world?.getEntity(entityId)
        if (!entity || !entity.hasComponent('collectible')) return
        
        this.processCollectorCollectiblePair(collector, entity, deltaTime)
      })
    })
  }
  
  // Keep the old method for backward compatibility but mark as deprecated
  private processCollectionUpdates(
    collectors: any[],
    collectibles: any[],
    deltaTime: number
  ): void {
    // This method is now replaced by processCollectionWithSpatialPartitioning
    // which is much more efficient for large numbers of entities
  }
  
  private processCollectorCollectiblePair(
    collector: any,
    collectible: any,
    deltaTime: number
  ): void {
    const collectorTransform = collector.getComponent('transform')
    const collectorMagnet = collector.getComponent('magnet')
    const collectibleTransform = collectible.getComponent('transform')
    const collectibleComp = collectible.getComponent('collectible')
    
    if (!collectorTransform || !collectorMagnet || !collectibleTransform || !collectibleComp) return
    
    const distance = this.calculateDistance(
      collectorTransform.position,
      collectibleTransform.position
    )
    
    const magnetRange = collectorMagnet.magneticField.range
    
    if (distance > magnetRange) return
    
    // Simple collection: if close enough, collect the item
    const collectionRadius = 20 // Simple collection radius
    if (distance <= collectionRadius) {
      this.collectItem(collector, collectible)
      return
    }
    
    // Apply simple magnetic attraction
    this.applyMagneticForce(collector, collectible, deltaTime)
  }
  
  private canCollect(collector: CollectorEntityQuery, collectible: CollectibleEntityQuery): boolean {
    const magnet = collector.magnet
    const item = collectible.collectible
    
    if (magnet.collectionFilters.length === 0) return true
    
    return magnet.collectionFilters.some(filter => {
      switch (filter.filterType) {
        case 'TYPE':
          return filter.allowedValues.includes(item.collectibleType)
        case 'RARITY':
          return filter.allowedValues.includes(item.rarity)
        case 'MINIMUM_VALUE':
          return item.value >= (filter.minimumValue || 0)
        case 'MAXIMUM_VALUE':
          return item.value <= (filter.maximumValue || Infinity)
        case 'TAG':
          return item.tags.some(tag => filter.allowedValues.includes(tag))
        default:
          return true
      }
    })
  }
  
  private applyMagneticForce(
    collector: CollectorEntityQuery,
    collectible: CollectibleEntityQuery,
    deltaTime: number
  ): void {
    const magneticForce = collector.magnet.calculateMagneticForce(
      collector.transform.position,
      collectible.transform.position,
      Date.now()
    )
    
    const collectibleForce = collectible.collectible.calculateMagneticForce(
      collectible.transform.position,
      collector.transform.position,
      Date.now()
    )
    
    const combinedForce: Vector2 = {
      x: magneticForce.x + collectibleForce.x,
      y: magneticForce.y + collectibleForce.y
    }
    
    const maxForce = collectible.collectible.magnetismConfig.attractionForce
    const forceMagnitude = Math.sqrt(combinedForce.x * combinedForce.x + combinedForce.y * combinedForce.y)
    
    if (forceMagnitude > maxForce) {
      const scale = maxForce / forceMagnitude
      combinedForce.x *= scale
      combinedForce.y *= scale
    }
    
    collectible.transform.position.x += combinedForce.x * deltaTime
    collectible.transform.position.y += combinedForce.y * deltaTime
    
    collectible.collectible.currentVelocity = {
      x: combinedForce.x,
      y: combinedForce.y
    }
    
    if (collectible.collectible.visualEffects.attractionEffect) {
      collectible.collectible.visualEffects.attractionEffect.isActive = true
      collectible.collectible.visualEffects.attractionEffect.intensity = 
        Math.min(forceMagnitude / maxForce, 1.0)
    }
  }
  
  private collectItem(collector: CollectorEntityQuery, collectible: CollectibleEntityQuery): void {
    const collectionEvent: CollectionEvent = {
      type: 'collection',
      timestamp: Date.now(),
      collectorEntityId: collector.entityId,
      collectibleEntityId: collectible.entityId,
      collectibleType: collectible.collectible.collectibleType,
      value: collectible.collectible.value,
      rarity: collectible.collectible.rarity,
      position: { ...collectible.transform.position }
    }
    
    this.world.eventSystem.emit('collection', collectionEvent)
    
    if (collectible.collectible.visualEffects.collectionEffect) {
      collectible.collectible.visualEffects.collectionEffect.isActive = true
      collectible.collectible.visualEffects.collectionEffect.intensity = 1.0
      
      setTimeout(() => {
        this.world.removeEntity(collectible.entityId)
      }, collectible.collectible.visualEffects.collectionEffect.duration)
    } else {
      this.world.removeEntity(collectible.entityId)
    }
    
    this.updateCollectorStats(collector, collectible)
  }
  
  private updateCollectorStats(collector: CollectorEntityQuery, collectible: CollectibleEntityQuery): void {
    const magnet = collector.magnet
    
    magnet.collectionStats.totalCollected++
    magnet.collectionStats.totalValue += collectible.collectible.value
    magnet.collectionStats.collectedByType.set(
      collectible.collectible.collectibleType,
      (magnet.collectionStats.collectedByType.get(collectible.collectible.collectibleType) || 0) + 1
    )
    
    magnet.collectionStats.lastCollectionTime = Date.now()
    
    if (magnet.magneticField.type === 'ADAPTIVE') {
      this.adaptMagneticField(magnet, collectible.collectible)
    }
  }
  
  private adaptMagneticField(magnet: MagnetComponent, collectible: CollectibleComponent): void {
    const recentCollections = magnet.collectionStats.totalCollected
    const baseRange = magnet.magneticField.baseRange || magnet.magneticField.range
    const baseStrength = magnet.magneticField.baseStrength || magnet.magneticField.strength
    
    const adaptationFactor = Math.min(recentCollections / 100, 0.5)
    
    if (collectible.rarity === 'LEGENDARY' || collectible.rarity === 'EPIC') {
      magnet.magneticField.range = baseRange * (1 + adaptationFactor * 0.3)
      magnet.magneticField.strength = baseStrength * (1 + adaptationFactor * 0.2)
    } else {
      magnet.magneticField.range = Math.max(baseRange * (1 - adaptationFactor * 0.1), baseRange * 0.8)
      magnet.magneticField.strength = Math.max(baseStrength * (1 - adaptationFactor * 0.05), baseStrength * 0.9)
    }
  }
  
  private processCollectibleLifecycle(collectibles: CollectibleEntityQuery[], deltaTime: number): void {
    const currentTime = Date.now()
    let updatesProcessed = 0
    
    while (updatesProcessed < this.maxCollectionUpdatesPerFrame && this.collectibleUpdateIndex < collectibles.length) {
      const collectible = collectibles[this.collectibleUpdateIndex]
      
      if (collectible.collectible.expirationTime && currentTime >= collectible.collectible.expirationTime) {
        this.expireCollectible(collectible)
      } else {
        this.updateCollectibleEffects(collectible, deltaTime)
      }
      
      this.collectibleUpdateIndex++
      updatesProcessed++
    }
    
    if (this.collectibleUpdateIndex >= collectibles.length) {
      this.collectibleUpdateIndex = 0
    }
  }
  
  private expireCollectible(collectible: CollectibleEntityQuery): void {
    if (collectible.collectible.visualEffects.expirationEffect) {
      collectible.collectible.visualEffects.expirationEffect.isActive = true
      collectible.collectible.visualEffects.expirationEffect.intensity = 1.0
      
      setTimeout(() => {
        this.world.removeEntity(collectible.entityId)
      }, collectible.collectible.visualEffects.expirationEffect.duration)
    } else {
      this.world.removeEntity(collectible.entityId)
    }
    
    const expirationEvent = {
      type: 'collectible_expired' as const,
      timestamp: Date.now(),
      collectibleEntityId: collectible.entityId,
      collectibleType: collectible.collectible.collectibleType,
      position: { ...collectible.transform.position }
    }
    
    this.world.eventSystem.emit('collectible_expired', expirationEvent)
  }
  
  private updateCollectibleEffects(collectible: CollectibleEntityQuery, deltaTime: number): void {
    const effects = collectible.collectible.visualEffects
    
    if (effects.idleEffect?.isActive) {
      const time = Date.now() / 1000
      const pulseIntensity = 0.5 + 0.3 * Math.sin(time * effects.idleEffect.pulseSpeed)
      effects.idleEffect.intensity = pulseIntensity
    }
    
    if (effects.attractionEffect?.isActive) {
      const decayRate = 0.95
      effects.attractionEffect.intensity *= decayRate
      
      if (effects.attractionEffect.intensity < 0.1) {
        effects.attractionEffect.isActive = false
        effects.attractionEffect.intensity = 0
      }
    }
    
    const velocity = collectible.collectible.currentVelocity
    if (velocity && (Math.abs(velocity.x) > 0.1 || Math.abs(velocity.y) > 0.1)) {
      const dampingFactor = 0.98
      velocity.x *= dampingFactor
      velocity.y *= dampingFactor
      
      if (Math.abs(velocity.x) < 0.1 && Math.abs(velocity.y) < 0.1) {
        collectible.collectible.currentVelocity = { x: 0, y: 0 }
      }
    }
  }
  
  private calculateDistance(pos1: Vector2, pos2: Vector2): number {
    const dx = pos2.x - pos1.x
    const dy = pos2.y - pos1.y
    return Math.sqrt(dx * dx + dy * dy)
  }
  
  public createCollectible(
    position: Vector2,
    collectibleType: string,
    rarity: string = 'COMMON',
    value: number = 1,
    tags: string[] = [],
    expirationTimeMs?: number
  ): EntityId {
    const entity = this.world.createEntity()
    
    const transform = new TransformComponent()
    transform.position = { ...position }
    entity.addComponent(transform)
    
    const collectible = new CollectibleComponent()
    collectible.collectibleType = collectibleType
    collectible.rarity = rarity
    collectible.value = value
    collectible.tags = [...tags]
    
    if (expirationTimeMs) {
      collectible.expirationTime = Date.now() + expirationTimeMs
    }
    
    collectible.visualEffects.idleEffect = {
      isActive: true,
      intensity: 1.0,
      duration: Infinity,
      pulseSpeed: 2.0
    }
    
    entity.addComponent(collectible)
    
    return entity.id
  }
  
  public createMagneticCollector(
    position: Vector2,
    magneticRange: number = 100,
    magneticStrength: number = 50,
    fieldType: string = 'UNIFORM'
  ): EntityId {
    const entity = this.world.createEntity()
    
    const transform = new TransformComponent()
    transform.position = { ...position }
    entity.addComponent(transform)
    
    const magnet = new MagnetComponent()
    magnet.magneticField.type = fieldType
    magnet.magneticField.range = magneticRange
    magnet.magneticField.strength = magneticStrength
    magnet.magneticField.baseRange = magneticRange
    magnet.magneticField.baseStrength = magneticStrength
    
    entity.addComponent(magnet)
    
    return entity.id
  }
  
  public getCollectionStats(collectorEntityId: EntityId): {
    totalCollected: number
    totalValue: number
    collectedByType: Map<string, number>
    averageCollectionRate: number
  } | null {
    const entity = this.world.getEntity(collectorEntityId)
    if (!entity) return null
    
    const magnet = entity.getComponent('magnet') as MagnetComponent
    if (!magnet) return null
    
    const stats = magnet.collectionStats
    const timePeriod = Math.max(Date.now() - stats.firstCollectionTime, 1000)
    const averageRate = (stats.totalCollected / timePeriod) * 60000 // per minute
    
    return {
      totalCollected: stats.totalCollected,
      totalValue: stats.totalValue,
      collectedByType: new Map(stats.collectedByType),
      averageCollectionRate: averageRate
    }
  }
}
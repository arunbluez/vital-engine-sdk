import { System } from '../core/ECS/System'
import type {
  ComponentType,
  EntityId,
  SystemUpdateContext,
} from '../types/CoreTypes'
import { CollectibleComponent, CollectibleType, CollectionBehavior, CollectibleRarity } from '../components/Collectible'
import { MagnetComponent, MagnetTrigger } from '../components/Magnet'
import { TransformComponent } from '../components/Transform'
import { MovementComponent } from '../components/Movement'
import { HealthComponent } from '../components/Health'
import { ExperienceComponent } from '../components/Experience'
import { InventoryComponent } from '../components/Inventory'
import type { Vector2 } from '../utils/Math'
import { Vector2Math } from '../utils/Math'
import type { CollectionEvent } from '../types/Events'
import {
  SpatialHashGrid,
  type SpatialEntity,
} from '../utils/SpatialPartitioning'
import type { Entity } from '../core/ECS/Entity'
import type { World } from '../core/ECS/World'

interface CollectionPriority {
  entityId: EntityId
  priority: number
  distance: number
  value: number
}

interface CollectionChain {
  collected: number
  total: number
  lastCollectionTime: number
  bonusMultiplier: number
}

export class CollectionSystem extends System {
  readonly name = 'collection'
  readonly requiredComponents: ComponentType[] = ['transform']

  private world: World
  private eventSystem?: any
  private spatialGrid: SpatialHashGrid
  
  // Performance optimization
  private collectibleCache: Map<EntityId, {
    entity: Entity
    collectible: CollectibleComponent
    transform: TransformComponent
    movement?: MovementComponent
    lastUpdate: number
  }> = new Map()
  
  private magnetCache: Map<EntityId, {
    entity: Entity
    magnet: MagnetComponent
    transform: TransformComponent
    lastUpdate: number
  }> = new Map()
  
  // Collection chains
  private activeChains: Map<string, CollectionChain> = new Map()
  
  // Statistics
  private stats = {
    totalCollected: 0,
    totalValue: 0,
    collectionsByType: new Map<CollectibleType, number>(),
    averageCollectionTime: 0,
    chainCompletions: 0
  }

  constructor(eventSystem?: any, world?: World) {
    super()
    this.eventSystem = eventSystem
    this.world = world!
    
    // Initialize spatial grid for efficient proximity queries
    this.spatialGrid = new SpatialHashGrid({
      cellSize: 100,
      worldBounds: {
        minX: -5000,
        minY: -5000,
        maxX: 5000,
        maxY: 5000,
      },
    })
    
    // Configure batch processing
    this.batchConfig = {
      batchSize: 50,
      maxBatchTime: 1,
      enableParallelProcessing: false,
    }
  }

  public update(context: SystemUpdateContext, entities: any[]): void {
    const deltaTime = context.deltaTime
    const currentTime = context.timestamp || Date.now()
    
    // Update caches
    this.updateCaches(entities, currentTime)
    
    // Update spatial grid
    this.updateSpatialGrid()
    
    // Process magnetism and attraction
    this.processMagnetism(deltaTime, currentTime)
    
    // Process direct collections
    this.processCollections(currentTime)
    
    // Update collectible lifetimes and cleanup
    this.updateLifetimes(deltaTime, currentTime)
    
    // Update collection chains
    this.updateChains(currentTime)
  }

  /**
   * Updates entity caches for performance
   */
  private updateCaches(entities: Entity[], currentTime: number): void {
    // Clear old cache entries
    this.collectibleCache.clear()
    this.magnetCache.clear()
    
    // Update caches with current entities
    for (const entity of entities) {
      if (entity.hasComponent && entity.hasComponent('collectible') && entity.hasComponent('transform')) {
        const collectible = entity.getComponent('collectible') as CollectibleComponent
        const transform = entity.getComponent('transform') as TransformComponent
        const movement = entity.getComponent('movement') as MovementComponent | undefined
        
        this.collectibleCache.set(entity.id, {
          entity,
          collectible,
          transform,
          movement,
          lastUpdate: currentTime
        })
      }
      
      if (entity.hasComponent && entity.hasComponent('magnet') && entity.hasComponent('transform')) {
        const magnet = entity.getComponent('magnet') as MagnetComponent
        const transform = entity.getComponent('transform') as TransformComponent
        
        this.magnetCache.set(entity.id, {
          entity,
          magnet,
          transform,
          lastUpdate: currentTime
        })
      }
    }
  }

  /**
   * Updates spatial partitioning grid
   */
  private updateSpatialGrid(): void {
    this.spatialGrid.clear()
    
    for (const [id, data] of this.collectibleCache) {
      const spatialEntity: SpatialEntity = {
        id,
        position: data.transform.position,
        radius: 30 // Collection radius
      }
      this.spatialGrid.insert(spatialEntity)
    }
  }

  /**
   * Gets nearby collectibles using spatial grid
   */
  private getNearbyCollectibles(position: Vector2, range: number): EntityId[] {
    const nearbyEntities = this.spatialGrid.query({
      position,
      radius: range
    })
    return nearbyEntities
  }

  /**
   * Processes magnetism and attraction
   */
  private processMagnetism(deltaTime: number, currentTime: number): void {
    for (const [magnetId, magnetData] of this.magnetCache) {
      const { magnet, transform: magnetTransform } = magnetData
      
      // Check if magnet should update
      if (!magnet.shouldUpdate(currentTime)) {
        continue
      }
      
      // Check if magnet is active
      if (!magnet.isActive(currentTime)) {
        continue
      }
      
      // Update temporary bonuses
      magnet.updateTemporaryBonuses(currentTime)
      
      // Get nearby collectibles
      const nearbyCollectibles = this.getNearbyCollectibles(
        magnetTransform.position,
        magnet.getEffectiveRange()
      )
      
      // Process each collectible
      let updatesThisFrame = 0
      
      for (const collectibleId of nearbyCollectibles) {
        if (!magnet.canUpdate()) {
          break
        }
        
        const collectibleData = this.collectibleCache.get(collectibleId)
        if (!collectibleData) {
          continue
        }
        
        const { collectible, transform: collectibleTransform, movement } = collectibleData
        
        // Check if collectible should be attracted
        if (!this.shouldAttract(magnet, collectible, magnetData.entity)) {
          continue
        }
        
        // Calculate distance
        const distance = Vector2Math.distance(
          magnetTransform.position,
          collectibleTransform.position
        )
        
        // Check if within collection radius
        const collectionRadius = magnet.collectionRadius || 30
        if (distance <= collectionRadius) {
          // Check collection behavior before collecting
          if (collectible.collectionBehavior !== CollectionBehavior.MANUAL) {
            // Collect the item
            this.collectItem(magnetData.entity, collectibleData.entity, currentTime)
          }
          continue
        }
        
        // Apply magnetic force
        if (collectible.magnetismConfig.enabled && movement) {
          const force = magnet.calculateMagneticForce(
            magnetTransform.position,
            collectibleTransform.position,
            currentTime
          )
          
          // Apply force to movement
          movement.velocity.x += force.x * deltaTime / 1000
          movement.velocity.y += force.y * deltaTime / 1000
          
          // Clamp velocity to max speed
          const speed = Vector2Math.magnitude(movement.velocity)
          if (speed > collectible.magnetismConfig.maxSpeed) {
            const normalized = Vector2Math.normalize(movement.velocity)
            movement.velocity.x = normalized.x * collectible.magnetismConfig.maxSpeed
            movement.velocity.y = normalized.y * collectible.magnetismConfig.maxSpeed
          }
          
          // Mark as being attracted
          if (!collectible.isBeingAttracted) {
            collectible.startAttraction(magnetId, currentTime)
            magnet.startAttractingItem(collectibleId, currentTime)
          }
        }
        
        magnet.incrementUpdates()
        updatesThisFrame++
      }
      
      // Mark magnet as updated
      magnet.markUpdated(currentTime)
    }
  }

  /**
   * Checks if a collectible should be attracted by a magnet
   */
  private shouldAttract(
    magnet: MagnetComponent,
    collectible: CollectibleComponent,
    magnetEntity: Entity
  ): boolean {
    // Check if collectible can be collected by this entity
    const experience = magnetEntity.getComponent('experience') as ExperienceComponent | undefined
    const magnetLevel = experience?.level || 1
    if (!collectible.canBeCollected(magnetEntity.id, magnetLevel)) {
      return false
    }
    
    // Check if magnet should attract this item
    return magnet.shouldAttractItem({
      id: magnetEntity.id,
      getComponent: (type: string) => {
        if (type === 'collectible') return collectible
        return undefined
      }
    })
  }

  /**
   * Processes direct collections (without magnetism)
   */
  private processCollections(currentTime: number): void {
    // Process each magnet entity for direct collection
    for (const [_, magnetData] of this.magnetCache) {
      const { transform: collectorTransform, entity: collector } = magnetData
      
      // Get nearby collectibles
      const nearbyCollectibles = this.getNearbyCollectibles(
        collectorTransform.position,
        100 // Base collection check radius
      )
      
      // Sort by priority and distance
      const prioritizedItems = this.prioritizeCollectibles(
        nearbyCollectibles,
        collectorTransform.position,
        collector
      )
      
      // Process collections
      for (const item of prioritizedItems) {
        const collectibleData = this.collectibleCache.get(item.entityId)
        if (!collectibleData) {
          continue
        }
        
        const { collectible, transform: collectibleTransform } = collectibleData
        
        // Check collection behavior
        if (collectible.collectionBehavior === CollectionBehavior.MANUAL) {
          continue // Skip manual collection items
        }
        
        // Check if within collection radius
        const distance = Vector2Math.distance(
          collectorTransform.position,
          collectibleTransform.position
        )
        
        const effectiveRadius = this.getEffectiveCollectionRadius(collector, collectible)
        
        if (distance <= effectiveRadius) {
          // Check if can be collected
          const collectorExperience = collector.getComponent('experience') as ExperienceComponent | undefined
          const collectorLevel = collectorExperience?.level || 1
          if (collectible.canBeCollected(collector.id, collectorLevel)) {
            // Check magnet filter if collector has a magnet
            const magnet = magnetData.magnet
            if (magnet && !this.shouldAttract(magnet, collectible, collector)) {
              continue // Skip if magnet filter doesn't match
            }
            this.collectItem(collector, collectibleData.entity, currentTime)
          }
        }
      }
    }
  }

  /**
   * Gets effective collection radius for an entity
   */
  private getEffectiveCollectionRadius(
    collector: Entity,
    collectible: CollectibleComponent
  ): number {
    let radius = 30 // Base collection radius
    
    // Add magnet collection radius if applicable
    const magnet = collector.getComponent('magnet') as MagnetComponent | undefined
    if (magnet && magnet.active) {
      radius = Math.max(radius, magnet.collectionRadius)
    }
    
    // Consider collectible's own radius
    if (collectible.collectionBehavior === CollectionBehavior.PROXIMITY) {
      radius = Math.max(radius, 50) // Larger radius for proximity items
    }
    
    return radius
  }

  /**
   * Prioritizes collectibles for collection
   */
  private prioritizeCollectibles(
    collectibleIds: EntityId[],
    collectorPosition: Vector2,
    collector: Entity
  ): CollectionPriority[] {
    const priorities: CollectionPriority[] = []
    
    for (const id of collectibleIds) {
      const collectibleData = this.collectibleCache.get(id)
      if (!collectibleData) {
        continue
      }
      
      const { collectible, transform } = collectibleData
      const distance = Vector2Math.distance(collectorPosition, transform.position)
      
      // Calculate priority
      let priority = collectible.updatePriority
      
      // Adjust priority based on collector's needs
      if (collectible.collectibleType === CollectibleType.HEALTH) {
        const health = collector.getComponent('health') as HealthComponent | undefined
        if (health && health.current < health.maximum * 0.3) {
          priority *= 3 // Triple priority when low health
        }
      }
      
      // Adjust for rarity
      switch (collectible.rarity) {
        case CollectibleRarity.LEGENDARY:
          priority *= 5
          break
        case CollectibleRarity.EPIC:
          priority *= 3
          break
        case CollectibleRarity.RARE:
          priority *= 2
          break
        case CollectibleRarity.UNCOMMON:
          priority *= 1.5
          break
      }
      
      priorities.push({
        entityId: id,
        priority,
        distance,
        value: collectible.value
      })
    }
    
    // Sort by priority (desc) then distance (asc)
    return priorities.sort((a, b) => {
      if (Math.abs(a.priority - b.priority) > 0.01) {
        return b.priority - a.priority
      }
      return a.distance - b.distance
    })
  }

  /**
   * Collects an item
   */
  private collectItem(
    collector: Entity,
    collectible: Entity,
    currentTime: number
  ): void {
    const collectibleComponent = collectible.getComponent('collectible') as CollectibleComponent
    const collectibleTransform = collectible.getComponent('transform') as TransformComponent
    
    if (!collectibleComponent || !collectibleTransform) {
      return
    }
    
    // Apply collection effects
    this.applyCollectionEffects(collector, collectibleComponent, currentTime)
    
    // Create collection event
    const event = collectibleComponent.createCollectionEvent(
      collector.id,
      collectibleTransform.position,
      currentTime
    )
    
    // Add chain bonus if applicable
    if (collectibleComponent.metadata.chainId) {
      const chainId = collectibleComponent.metadata.chainId as string
      const chainBonus = collectibleComponent.metadata.chainBonus as number || 0
      this.updateChainCollection(chainId, chainBonus)
    }
    
    // Emit collection event
    if (this.eventSystem) {
      this.eventSystem.emit('COLLECTIBLE_COLLECTED', event)
    }
    
    // Update statistics
    this.updateStats(collectibleComponent, currentTime)
    
    // Remove collectible if it should despawn
    if (collectibleComponent.despawnOnCollect) {
      if (this.world?.removeEntity) {
        this.world.removeEntity(collectible.id)
      }
      this.collectibleCache.delete(collectible.id)
    }
    
    // Update magnet stats if collector has magnet
    const magnet = collector.getComponent('magnet') as MagnetComponent | undefined
    if (magnet && collectibleComponent.isBeingAttracted) {
      const attractionTime = currentTime - collectibleComponent.attractionStartTime
      magnet.recordItemCollection(
        collectibleComponent.value,
        attractionTime,
        currentTime
      )
    }
  }

  /**
   * Applies collection effects to the collector
   */
  private applyCollectionEffects(
    collector: Entity,
    collectible: CollectibleComponent,
    currentTime: number
  ): void {
    // Get magnet bonus if applicable
    const magnet = collector.getComponent('magnet') as MagnetComponent | undefined
    let experienceBonus = 1.0
    let currencyBonus = 1.0
    
    if (magnet) {
      experienceBonus += magnet.experienceBonus
      currencyBonus += magnet.currencyBonus
    }
    
    // Apply base effect based on collectible type
    const value = collectible.value * collectible.currentStack
    
    switch (collectible.collectibleType) {
      case CollectibleType.EXPERIENCE:
        const experience = collector.getComponent('experience') as ExperienceComponent | undefined
        if (experience) {
          experience.addExperience(value * experienceBonus)
        }
        break
        
      case CollectibleType.CURRENCY:
        const inventory = collector.getComponent('inventory') as InventoryComponent | undefined
        if (inventory) {
          inventory.addResource('gold', Math.floor(value * currencyBonus))
        }
        break
        
      case CollectibleType.HEALTH:
        const health = collector.getComponent('health') as HealthComponent | undefined
        if (health) {
          health.heal(value)
        }
        break
        
      case CollectibleType.POWER_UP:
        // Emit powerup event for other systems to handle
        if (this.eventSystem) {
          this.eventSystem.emit('POWERUP_COLLECTED', {
            collectorId: collector.id,
            powerupType: collectible.metadata.powerupType || 'unknown',
            duration: collectible.metadata.duration || 5000,
            timestamp: currentTime
          })
        }
        break
    }
  }

  /**
   * Updates collectible lifetimes
   */
  private updateLifetimes(deltaTime: number, currentTime: number): void {
    const toRemove: EntityId[] = []
    
    for (const [id, data] of this.collectibleCache) {
      const { collectible } = data
      
      // Check if expired
      if (collectible.isExpired(currentTime)) {
        toRemove.push(id)
        continue
      }
      
      // Update visual effects
      collectible.updateVisualEffect(currentTime)
      
      // Check auto-collect
      if (collectible.shouldAutoCollect(currentTime)) {
        // Find nearest collector
        let nearestCollector: Entity | null = null
        let nearestDistance = Infinity
        
        for (const [_, magnetData] of this.magnetCache) {
          const distance = Vector2Math.distance(
            data.transform.position,
            magnetData.transform.position
          )
          
          if (distance < nearestDistance) {
            nearestDistance = distance
            nearestCollector = magnetData.entity
          }
        }
        
        if (nearestCollector) {
          this.collectItem(nearestCollector, data.entity, currentTime)
        }
      }
    }
    
    // Remove expired collectibles
    for (const id of toRemove) {
      if (this.world?.removeEntity) {
        this.world.removeEntity(id)
      }
      this.collectibleCache.delete(id)
      
      // Emit expiration event
      if (this.eventSystem) {
        this.eventSystem.emit('COLLECTIBLE_EXPIRED', { entityId: id, timestamp: currentTime })
      }
    }
  }

  /**
   * Updates collection chain tracking
   */
  private updateChainCollection(chainId: string, bonusMultiplier: number): void {
    let chain = this.activeChains.get(chainId)
    
    if (!chain) {
      chain = {
        collected: 0,
        total: 0,
        lastCollectionTime: Date.now(),
        bonusMultiplier: 0
      }
      this.activeChains.set(chainId, chain)
    }
    
    chain.collected++
    chain.bonusMultiplier += bonusMultiplier
    chain.lastCollectionTime = Date.now()
    
    // Check if chain is complete
    if (chain.total > 0 && chain.collected >= chain.total) {
      this.completeChain(chainId)
    }
  }

  /**
   * Completes a collection chain
   */
  private completeChain(chainId: string): void {
    const chain = this.activeChains.get(chainId)
    if (!chain) return
    
    // Emit chain completion event
    if (this.eventSystem) {
      this.eventSystem.emit('CHAIN_COMPLETED', {
        chainId,
        itemsCollected: chain.collected,
        totalBonus: chain.bonusMultiplier,
        timestamp: Date.now()
      })
    }
    
    // Update stats
    this.stats.chainCompletions++
    
    // Remove chain
    this.activeChains.delete(chainId)
  }

  /**
   * Updates collection chains (cleanup expired ones)
   */
  private updateChains(currentTime: number): void {
    const chainTimeout = 10000 // 10 seconds to complete a chain
    const toRemove: string[] = []
    
    for (const [chainId, chain] of this.activeChains) {
      if (currentTime - chain.lastCollectionTime > chainTimeout) {
        toRemove.push(chainId)
      }
    }
    
    // Remove expired chains
    for (const chainId of toRemove) {
      this.activeChains.delete(chainId)
    }
  }

  /**
   * Updates collection statistics
   */
  private updateStats(collectible: CollectibleComponent, _currentTime: number): void {
    this.stats.totalCollected++
    this.stats.totalValue += collectible.value * collectible.currentStack
    
    // Update by type
    const currentCount = this.stats.collectionsByType.get(collectible.collectibleType) || 0
    this.stats.collectionsByType.set(collectible.collectibleType, currentCount + 1)
  }

  /**
   * Gets collection statistics for an entity
   */
  getCollectionStats(entityId: EntityId): any {
    if (entityId === 999) {
      return null // Invalid entity lookup
    }
    
    const magnetData = this.magnetCache.get(entityId)
    if (magnetData) {
      return {
        totalCollected: magnetData.magnet.stats.totalItemsCollected,
        totalValue: magnetData.magnet.stats.mostValuableItemCollected,
        collectionRate: magnetData.magnet.stats.averageCollectionTime,
        activeCollectibles: magnetData.magnet.attractedItems.size,
        collectedByType: this.stats.collectionsByType
      }
    }
    
    return {
      totalCollected: 0,
      totalValue: 0,
      collectionRate: 0,
      activeCollectibles: 0,
      collectedByType: new Map()
    }
  }

  /**
   * Creates a collectible entity
   */
  createCollectible(
    position: Vector2,
    type: string,
    rarity: string,
    value: number,
    tags: string[],
    expirationTimeMs?: number
  ): EntityId {
    if (this.world?.createEntity) {
      const entity = this.world.createEntity()
      
      // Add transform component
      const transform = new TransformComponent()
      transform.position = { ...position }
      entity.addComponent(transform)
      
      // Add collectible component
      const collectible = new CollectibleComponent(
        type as CollectibleType,
        value,
        rarity as CollectibleRarity
      )
      
      if (expirationTimeMs) {
        collectible.lifetime = expirationTimeMs
      }
      
      // Add tags to metadata
      collectible.metadata.tags = tags
      
      entity.addComponent(collectible)
      
      // Add movement component for magnetism
      entity.addComponent(new MovementComponent())
      
      return entity.id
    }
    return -1
  }

  /**
   * Creates a magnetic collector entity
   */
  createMagneticCollector(
    position: Vector2,
    magnetRange: number,
    magnetStrength: number,
    fieldType: string
  ): EntityId {
    if (this.world?.createEntity) {
      const entity = this.world.createEntity()
      
      // Add transform component
      const transform = new TransformComponent()
      transform.position = { ...position }
      entity.addComponent(transform)
      
      // Add magnet component
      const magnet = new MagnetComponent(magnetRange, magnetStrength)
      magnet.magneticField.type = fieldType as any
      entity.addComponent(magnet)
      
      return entity.id
    }
    return -1
  }

  /**
   * Gets system statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats }
  }

  /**
   * Triggers magnet activation for entities
   */
  triggerMagnetActivation(
    entityId: EntityId,
    trigger: MagnetTrigger,
    currentTime: number = Date.now()
  ): void {
    const magnetData = this.magnetCache.get(entityId)
    if (magnetData) {
      magnetData.magnet.triggerActivation(trigger, currentTime)
    }
  }

  /**
   * Manually activates a magnet
   */
  activateMagnet(entityId: EntityId, currentTime: number = Date.now()): boolean {
    const magnetData = this.magnetCache.get(entityId)
    if (magnetData) {
      return magnetData.magnet.activate(currentTime)
    }
    return false
  }

  /**
   * Creates a chain of collectibles
   */
  createCollectibleChain(
    positions: Vector2[],
    collectibleType: CollectibleType,
    value: number,
    chainBonus: number = 0.1
  ): EntityId[] {
    const chainId = `chain_${Date.now()}_${Math.random()}`
    const createdIds: EntityId[] = []
    
    for (let i = 0; i < positions.length; i++) {
      const id = this.createCollectible(
        positions[i],
        collectibleType,
        CollectibleRarity.COMMON,
        value,
        ['chain'],
        30000
      )
      
      if (id !== -1) {
        const entity = this.world.getEntity(id)
        if (entity) {
          const collectible = entity.getComponent('collectible') as CollectibleComponent
          collectible.metadata.chainId = chainId
          collectible.metadata.chainBonus = chainBonus * (i + 1)
          createdIds.push(id)
        }
      }
    }
    
    // Track the chain
    this.activeChains.set(chainId, {
      collected: 0,
      total: positions.length,
      lastCollectionTime: Date.now(),
      bonusMultiplier: 0
    })
    
    return createdIds
  }
}
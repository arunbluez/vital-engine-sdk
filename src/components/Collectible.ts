import { Component } from '../core/ECS/Component'
import type { EntityId } from '../types/CoreTypes'
import type { Vector2 } from '../utils/Math'
import { Vector2Math } from '../utils/Math'

/**
 * Types of collectible items
 */
export enum CollectibleType {
  EXPERIENCE = 'experience',
  HEALTH = 'health',
  MANA = 'mana',
  CURRENCY = 'currency',
  POWER_UP = 'power_up',
  SKILL_POINT = 'skill_point',
  UPGRADE_MATERIAL = 'upgrade_material',
  WEAPON = 'weapon',
  ARMOR = 'armor',
  CONSUMABLE = 'consumable'
}

/**
 * Collectible rarity levels
 */
export enum CollectibleRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary'
}

/**
 * Collection behavior types
 */
export enum CollectionBehavior {
  IMMEDIATE = 'immediate',      // Collected instantly on contact
  MAGNETIC = 'magnetic',        // Attracted to player when in range
  MANUAL = 'manual',           // Requires player action to collect
  AUTOMATIC = 'automatic',     // Automatically collected after delay
  PROXIMITY = 'proximity'      // Collected when player is nearby
}

/**
 * Visual effect types for collectibles
 */
export enum CollectibleEffect {
  NONE = 'none',
  GLOW = 'glow',
  PULSE = 'pulse',
  SPARKLE = 'sparkle',
  FLOAT = 'float',
  SPIN = 'spin',
  BOUNCE = 'bounce'
}

/**
 * Collection event data
 */
export interface CollectionEvent {
  collectibleId: EntityId
  collectorId: EntityId
  type: CollectibleType
  value: number
  rarity: CollectibleRarity
  position: Vector2
  timestamp: number
}

/**
 * Magnetism configuration
 */
export interface MagnetismConfig {
  enabled: boolean
  range: number               // Attraction range
  strength: number           // Attraction force
  maxSpeed: number          // Maximum attraction speed
  acceleration: number      // Attraction acceleration
  decayRate: number        // Force decay over distance
}

/**
 * Collection requirements
 */
export interface CollectionRequirement {
  type: 'level' | 'item' | 'skill' | 'achievement'
  value: number | string
  operator: '>' | '>=' | '=' | '<' | '<='
}

/**
 * Collectible component for items that can be picked up
 */
export class CollectibleComponent extends Component {
  readonly type = 'collectible'

  // Core properties
  public collectibleType: CollectibleType
  public rarity: CollectibleRarity = CollectibleRarity.COMMON
  public value: number = 1
  public stackSize: number = 1
  public currentStack: number = 1

  // Collection behavior
  public collectionBehavior: CollectionBehavior = CollectionBehavior.MAGNETIC
  public autoCollectDelay: number = 5000 // Auto-collect after 5 seconds
  public canBeCollectedBy: EntityId[] = [] // Empty = anyone can collect

  // Magnetism
  public magnetismConfig: MagnetismConfig = {
    enabled: true,
    range: 80,
    strength: 150,
    maxSpeed: 200,
    acceleration: 300,
    decayRate: 0.5
  }

  // Lifetime and despawn
  public lifetime: number = 30000 // 30 seconds default
  public spawnTime: number = 0
  public despawnOnCollect: boolean = true
  public persistAfterDeath: boolean = false

  // Visual and audio
  public visualEffect: CollectibleEffect = CollectibleEffect.GLOW
  public effectIntensity: number = 1.0
  public soundEffect: string | null = null
  public collectSound: string | null = null

  // Collection state
  public isBeingAttracted: boolean = false
  public attractionTarget: EntityId | null = null
  public attractionStartTime: number = 0
  public lastAttractionUpdate: number = 0

  // Collection requirements
  public requirements: CollectionRequirement[] = []
  public collectionMessage: string | null = null

  // Metadata
  public metadata: Record<string, unknown> = {}
  public dropSource: EntityId | null = null // Entity that dropped this item
  public isTemporary: boolean = false

  // Performance optimization
  public updatePriority: number = 1 // Higher = more frequent updates
  public lastUpdateTime: number = 0
  public updateInterval: number = 100 // Update every 100ms

  constructor(
    collectibleType: CollectibleType, 
    value: number = 1, 
    rarity: CollectibleRarity = CollectibleRarity.COMMON
  ) {
    super()
    this.collectibleType = collectibleType
    this.value = value
    this.rarity = rarity
    this.spawnTime = Date.now()
    this.initializeDefaults()
  }

  /**
   * Initializes default values based on type and rarity
   */
  private initializeDefaults(): void {
    // Set defaults based on collectible type
    switch (this.collectibleType) {
      case CollectibleType.EXPERIENCE:
        this.collectionBehavior = CollectionBehavior.MAGNETIC
        this.magnetismConfig.range = 100
        this.visualEffect = CollectibleEffect.GLOW
        this.lifetime = 20000
        break

      case CollectibleType.HEALTH:
        this.collectionBehavior = CollectionBehavior.IMMEDIATE
        this.visualEffect = CollectibleEffect.PULSE
        this.lifetime = 15000
        break

      case CollectibleType.CURRENCY:
        this.collectionBehavior = CollectionBehavior.MAGNETIC
        this.magnetismConfig.range = 120
        this.visualEffect = CollectibleEffect.SPARKLE
        this.lifetime = 25000
        break

      case CollectibleType.POWER_UP:
        this.collectionBehavior = CollectionBehavior.IMMEDIATE
        this.visualEffect = CollectibleEffect.FLOAT
        this.lifetime = 10000
        break

      case CollectibleType.WEAPON:
      case CollectibleType.ARMOR:
        this.collectionBehavior = CollectionBehavior.MANUAL
        this.visualEffect = CollectibleEffect.SPIN
        this.lifetime = 60000
        this.persistAfterDeath = true
        break
    }

    // Adjust based on rarity
    switch (this.rarity) {
      case CollectibleRarity.UNCOMMON:
        this.effectIntensity = 1.2
        this.magnetismConfig.range *= 1.1
        break

      case CollectibleRarity.RARE:
        this.effectIntensity = 1.5
        this.magnetismConfig.range *= 1.2
        this.lifetime *= 1.5
        break

      case CollectibleRarity.EPIC:
        this.effectIntensity = 2.0
        this.magnetismConfig.range *= 1.4
        this.lifetime *= 2
        this.persistAfterDeath = true
        break

      case CollectibleRarity.LEGENDARY:
        this.effectIntensity = 3.0
        this.magnetismConfig.range *= 1.6
        this.lifetime *= 3
        this.persistAfterDeath = true
        this.visualEffect = CollectibleEffect.SPARKLE
        break
    }
  }

  /**
   * Checks if the collectible can be collected by an entity
   */
  canBeCollected(collectorId: EntityId, collectorLevel?: number, collectorItems?: string[]): boolean {
    // Check if specific entities can collect
    if (this.canBeCollectedBy.length > 0 && !this.canBeCollectedBy.includes(collectorId)) {
      return false
    }

    // Check collection requirements
    if (this.requirements.length > 0 && collectorLevel !== undefined) {
      return this.meetsRequirements(collectorLevel, collectorItems)
    }

    return true
  }

  /**
   * Checks if collection requirements are met
   */
  private meetsRequirements(collectorLevel: number, collectorItems?: string[]): boolean {
    return this.requirements.every(req => {
      switch (req.type) {
        case 'level':
          return this.compareValues(collectorLevel, req.operator, req.value as number)
        case 'item':
          return collectorItems?.includes(req.value as string) ?? false
        default:
          return true
      }
    })
  }

  /**
   * Helper method for requirement comparison
   */
  private compareValues(actual: number, operator: string, expected: number): boolean {
    switch (operator) {
      case '>': return actual > expected
      case '>=': return actual >= expected
      case '=': return actual === expected
      case '<': return actual < expected
      case '<=': return actual <= expected
      default: return false
    }
  }

  /**
   * Starts magnetic attraction to a target
   */
  startAttraction(targetId: EntityId, currentTime: number): void {
    this.isBeingAttracted = true
    this.attractionTarget = targetId
    this.attractionStartTime = currentTime
    this.lastAttractionUpdate = currentTime
  }

  /**
   * Stops magnetic attraction
   */
  stopAttraction(): void {
    this.isBeingAttracted = false
    this.attractionTarget = null
    this.attractionStartTime = 0
  }

  /**
   * Calculates magnetic force toward target
   */
  calculateMagneticForce(
    currentPosition: Vector2, 
    targetPosition: Vector2, 
    _currentTime: number
  ): Vector2 {
    if (!this.magnetismConfig.enabled || !this.isBeingAttracted) {
      return { x: 0, y: 0 }
    }

    const direction = Vector2Math.subtract(targetPosition, currentPosition)
    const distance = Vector2Math.magnitude(direction)

    if (distance === 0 || distance > this.magnetismConfig.range) {
      return { x: 0, y: 0 }
    }

    // Calculate force based on distance (closer = stronger)
    const distanceRatio = 1 - (distance / this.magnetismConfig.range)
    const forceMultiplier = Math.pow(distanceRatio, this.magnetismConfig.decayRate)
    
    const normalizedDirection = Vector2Math.normalize(direction)
    const force = this.magnetismConfig.strength * forceMultiplier

    return {
      x: normalizedDirection.x * force,
      y: normalizedDirection.y * force
    }
  }

  /**
   * Checks if the collectible has expired
   */
  isExpired(currentTime: number): boolean {
    if (this.lifetime <= 0) {
      return false // Never expires
    }
    return currentTime - this.spawnTime >= this.lifetime
  }

  /**
   * Checks if auto-collect delay has passed
   */
  shouldAutoCollect(currentTime: number): boolean {
    if (this.collectionBehavior !== CollectionBehavior.AUTOMATIC) {
      return false
    }
    return currentTime - this.spawnTime >= this.autoCollectDelay
  }

  /**
   * Gets the time remaining before expiration
   */
  getTimeRemaining(currentTime: number): number {
    if (this.lifetime <= 0) {
      return Infinity
    }
    return Math.max(0, this.lifetime - (currentTime - this.spawnTime))
  }

  /**
   * Gets the collection progress (for auto-collect items)
   */
  getCollectionProgress(currentTime: number): number {
    if (this.collectionBehavior !== CollectionBehavior.AUTOMATIC) {
      return 0
    }
    
    const elapsed = currentTime - this.spawnTime
    return Math.min(1, elapsed / this.autoCollectDelay)
  }

  /**
   * Checks if collectible should update (performance optimization)
   */
  shouldUpdate(currentTime: number): boolean {
    const timeSinceUpdate = currentTime - this.lastUpdateTime
    const adjustedInterval = this.updateInterval / this.updatePriority
    return timeSinceUpdate >= adjustedInterval
  }

  /**
   * Marks the collectible as updated
   */
  markUpdated(currentTime: number): void {
    this.lastUpdateTime = currentTime
  }

  /**
   * Updates the visual effect animation
   */
  updateVisualEffect(currentTime: number): void {
    // This would typically be handled by a rendering system
    // Here we just update internal animation state if needed
    
    switch (this.visualEffect) {
      case CollectibleEffect.PULSE:
        // Pulse effect could modify effectIntensity
        const pulseSpeed = 2.0
        this.effectIntensity = 1.0 + 0.3 * Math.sin(currentTime * pulseSpeed * 0.001)
        break

      case CollectibleEffect.FLOAT:
        // Float effect could modify position offset
        const floatSpeed = 1.5
        const floatOffset = Math.sin(currentTime * floatSpeed * 0.001) * 5
        this.metadata.floatOffset = floatOffset
        break

      case CollectibleEffect.SPIN:
        // Spin effect could modify rotation
        const spinSpeed = 3.0
        this.metadata.rotation = (currentTime * spinSpeed * 0.001) % (Math.PI * 2)
        break
    }
  }

  /**
   * Increases the stack size (for stackable collectibles)
   */
  addToStack(amount: number): boolean {
    if (this.currentStack + amount <= this.stackSize) {
      this.currentStack += amount
      return true
    }
    return false
  }

  /**
   * Creates a collection event data object
   */
  createCollectionEvent(collectorId: EntityId, position: Vector2, currentTime: number): CollectionEvent {
    return {
      collectibleId: collectorId, // Note: This should be the collectible's entity ID
      collectorId,
      type: this.collectibleType,
      value: this.value * this.currentStack,
      rarity: this.rarity,
      position: { ...position },
      timestamp: currentTime
    }
  }

  /**
   * Gets display information for UI
   */
  getDisplayInfo(): Record<string, unknown> {
    return {
      type: this.collectibleType,
      rarity: this.rarity,
      value: this.value,
      currentStack: this.currentStack,
      stackSize: this.stackSize,
      visualEffect: this.visualEffect,
      effectIntensity: this.effectIntensity,
      isBeingAttracted: this.isBeingAttracted,
      timeRemaining: this.getTimeRemaining(Date.now()),
      collectionProgress: this.getCollectionProgress(Date.now())
    }
  }

  clone(): CollectibleComponent {
    const clone = new CollectibleComponent(this.collectibleType, this.value, this.rarity)
    
    clone.stackSize = this.stackSize
    clone.currentStack = this.currentStack
    clone.collectionBehavior = this.collectionBehavior
    clone.autoCollectDelay = this.autoCollectDelay
    clone.canBeCollectedBy = [...this.canBeCollectedBy]
    
    clone.magnetismConfig = { ...this.magnetismConfig }
    
    clone.lifetime = this.lifetime
    clone.spawnTime = this.spawnTime
    clone.despawnOnCollect = this.despawnOnCollect
    clone.persistAfterDeath = this.persistAfterDeath
    
    clone.visualEffect = this.visualEffect
    clone.effectIntensity = this.effectIntensity
    clone.soundEffect = this.soundEffect
    clone.collectSound = this.collectSound
    
    clone.isBeingAttracted = this.isBeingAttracted
    clone.attractionTarget = this.attractionTarget
    clone.attractionStartTime = this.attractionStartTime
    clone.lastAttractionUpdate = this.lastAttractionUpdate
    
    clone.requirements = this.requirements.map(req => ({ ...req }))
    clone.collectionMessage = this.collectionMessage
    
    clone.metadata = { ...this.metadata }
    clone.dropSource = this.dropSource
    clone.isTemporary = this.isTemporary
    
    clone.updatePriority = this.updatePriority
    clone.lastUpdateTime = this.lastUpdateTime
    clone.updateInterval = this.updateInterval

    return clone
  }

  serialize(): Record<string, unknown> {
    return {
      collectibleType: this.collectibleType,
      rarity: this.rarity,
      value: this.value,
      stackSize: this.stackSize,
      currentStack: this.currentStack,
      
      collectionBehavior: this.collectionBehavior,
      autoCollectDelay: this.autoCollectDelay,
      canBeCollectedBy: this.canBeCollectedBy,
      
      magnetismConfig: this.magnetismConfig,
      
      lifetime: this.lifetime,
      spawnTime: this.spawnTime,
      despawnOnCollect: this.despawnOnCollect,
      persistAfterDeath: this.persistAfterDeath,
      
      visualEffect: this.visualEffect,
      effectIntensity: this.effectIntensity,
      soundEffect: this.soundEffect,
      collectSound: this.collectSound,
      
      isBeingAttracted: this.isBeingAttracted,
      attractionTarget: this.attractionTarget,
      attractionStartTime: this.attractionStartTime,
      lastAttractionUpdate: this.lastAttractionUpdate,
      
      requirements: this.requirements,
      collectionMessage: this.collectionMessage,
      
      metadata: this.metadata,
      dropSource: this.dropSource,
      isTemporary: this.isTemporary,
      
      updatePriority: this.updatePriority,
      lastUpdateTime: this.lastUpdateTime,
      updateInterval: this.updateInterval
    }
  }

  deserialize(data: Record<string, unknown>): void {
    this.collectibleType = data.collectibleType as CollectibleType
    this.rarity = data.rarity as CollectibleRarity
    this.value = data.value as number
    this.stackSize = data.stackSize as number
    this.currentStack = data.currentStack as number
    
    this.collectionBehavior = data.collectionBehavior as CollectionBehavior
    this.autoCollectDelay = data.autoCollectDelay as number
    this.canBeCollectedBy = data.canBeCollectedBy as EntityId[]
    
    this.magnetismConfig = data.magnetismConfig as MagnetismConfig
    
    this.lifetime = data.lifetime as number
    this.spawnTime = data.spawnTime as number
    this.despawnOnCollect = data.despawnOnCollect as boolean
    this.persistAfterDeath = data.persistAfterDeath as boolean
    
    this.visualEffect = data.visualEffect as CollectibleEffect
    this.effectIntensity = data.effectIntensity as number
    this.soundEffect = data.soundEffect as string | null
    this.collectSound = data.collectSound as string | null
    
    this.isBeingAttracted = data.isBeingAttracted as boolean
    this.attractionTarget = data.attractionTarget as EntityId | null
    this.attractionStartTime = data.attractionStartTime as number
    this.lastAttractionUpdate = data.lastAttractionUpdate as number
    
    this.requirements = data.requirements as CollectionRequirement[]
    this.collectionMessage = data.collectionMessage as string | null
    
    this.metadata = data.metadata as Record<string, unknown>
    this.dropSource = data.dropSource as EntityId | null
    this.isTemporary = data.isTemporary as boolean
    
    this.updatePriority = data.updatePriority as number
    this.lastUpdateTime = data.lastUpdateTime as number
    this.updateInterval = data.updateInterval as number
  }
}
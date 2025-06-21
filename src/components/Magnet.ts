import { Component } from '../core/ECS/Component'
import type { EntityId } from '../types/CoreTypes'
import type { Vector2 } from '../utils/Math'
import { Vector2Math } from '../utils/Math'

/**
 * Magnet field types
 */
export enum MagnetFieldType {
  CIRCULAR = 'circular', // Circular magnetic field
  DIRECTIONAL = 'directional', // Directional pull (like vacuum)
  PULSE = 'pulse', // Pulsing magnetic field
  SELECTIVE = 'selective', // Only attracts specific types
  REPULSIVE = 'repulsive', // Pushes items away
}

/**
 * Magnet target types
 */
export enum MagnetTargetType {
  ALL = 'all', // Attracts all collectibles
  EXPERIENCE = 'experience', // Only experience orbs
  CURRENCY = 'currency', // Only currency items
  POWER_UPS = 'power_ups', // Only power-ups
  WEAPONS = 'weapons', // Only weapons
  RARE_ONLY = 'rare_only', // Only rare+ items
  CUSTOM = 'custom', // Custom filter logic
}

/**
 * Magnet activation trigger
 */
export enum MagnetTrigger {
  ALWAYS = 'always', // Always active
  MANUAL = 'manual', // Activated manually
  ON_DAMAGE = 'on_damage', // Activates when taking damage
  ON_KILL = 'on_kill', // Activates on enemy kill
  ON_SKILL = 'on_skill', // Activates when using skills
  PERIODIC = 'periodic', // Activates periodically
  LOW_HEALTH = 'low_health', // Activates when health is low
}

/**
 * Magnetic field configuration
 */
export interface MagneticField {
  type: MagnetFieldType
  range: number // Base attraction range
  strength: number // Base attraction strength
  efficiency: number // How effectively items are pulled (0-1)
  maxTargets: number // Maximum items that can be attracted simultaneously
  decayRate: number // How force diminishes over distance
}

/**
 * Collection filter for selective magnetism
 */
export interface CollectionFilter {
  targetType: MagnetTargetType
  minRarity?: string // Minimum rarity to attract
  maxDistance?: number // Override magnetic range for this filter
  priority: number // Priority when multiple filters match
  customPredicate?: (collectible: unknown) => boolean
}

/**
 * Magnet statistics for tracking
 */
export interface MagnetStats {
  totalItemsAttracted: number
  totalItemsCollected: number
  averageCollectionTime: number
  mostValuableItemCollected: number
  lastActivationTime: number
  activationCount: number
}

/**
 * Magnet component for entities that can attract collectibles
 */
export class MagnetComponent extends Component {
  readonly type = 'magnet'

  // Core magnet properties
  public active: boolean = true
  public collectionRadius: number = 30 // Radius for actual collection
  public magneticField: MagneticField = {
    type: MagnetFieldType.CIRCULAR,
    range: 100,
    strength: 200,
    efficiency: 1.0,
    maxTargets: 10,
    decayRate: 0.5,
  }

  // Activation and control
  public trigger: MagnetTrigger = MagnetTrigger.ALWAYS
  public manuallyActivated: boolean = false
  public activationDuration: number = 5000 // Duration for triggered activations (ms)
  public activationCooldown: number = 10000 // Cooldown between periodic activations
  public lastActivationTime: number = 0

  // Filtering and targeting
  public collectionFilters: CollectionFilter[] = []
  public attractedItems: Set<EntityId> = new Set()
  public blacklistedItems: Set<EntityId> = new Set() // Items that shouldn't be attracted

  // Enhancement and scaling
  public rangeMultiplier: number = 1.0
  public strengthMultiplier: number = 1.0
  public efficiencyBonus: number = 0.0
  public experienceBonus: number = 0.0 // Extra XP from collected items
  public currencyBonus: number = 0.0 // Extra currency from collected items

  // Pulse magnetism (for pulse type)
  public pulseInterval: number = 3000 // Time between pulses
  public pulseStrength: number = 2.0 // Multiplier during pulse
  public pulseDuration: number = 1000 // How long the pulse lasts
  public lastPulseTime: number = 0
  public isPulsing: boolean = false

  // Visual and audio feedback
  public visualEffect: string = 'magnetic_aura'
  public pulseEffect: string = 'magnetic_pulse'
  public collectEffect: string = 'item_collect'
  public soundEnabled: boolean = true

  // Performance optimization
  public updateInterval: number = 200 // Update every 200ms
  public lastUpdateTime: number = 0
  public maxUpdatesPerFrame: number = 5 // Limit attraction calculations
  public currentUpdates: number = 0

  // Statistics tracking
  public stats: MagnetStats = {
    totalItemsAttracted: 0,
    totalItemsCollected: 0,
    averageCollectionTime: 0,
    mostValuableItemCollected: 0,
    lastActivationTime: 0,
    activationCount: 0,
  }

  // Temporary modifiers (for skills/power-ups)
  public temporaryRangeBonus: number = 0
  public temporaryStrengthBonus: number = 0
  public bonusExpirationTime: number = 0

  constructor(range: number = 100, strength: number = 200) {
    super()
    this.magneticField.range = range
    this.magneticField.strength = strength
    this.initializeDefaultFilters()
  }

  /**
   * Initializes default collection filters
   */
  private initializeDefaultFilters(): void {
    // Default filter attracts all items
    this.collectionFilters.push({
      targetType: MagnetTargetType.ALL,
      priority: 1,
    })
  }

  /**
   * Adds a collection filter
   */
  addFilter(filter: CollectionFilter): void {
    this.collectionFilters.push(filter)
    // Sort by priority (higher priority first)
    this.collectionFilters.sort((a, b) => b.priority - a.priority)
  }

  /**
   * Removes a collection filter
   */
  removeFilter(targetType: MagnetTargetType): void {
    this.collectionFilters = this.collectionFilters.filter(
      (f) => f.targetType !== targetType
    )
  }

  /**
   * Checks if the magnet is currently active
   */
  isActive(currentTime: number): boolean {
    if (!this.active) {
      return false
    }

    switch (this.trigger) {
      case MagnetTrigger.ALWAYS:
        return true

      case MagnetTrigger.MANUAL:
        if (this.manuallyActivated) {
          // Check if manual activation has expired
          if (currentTime - this.lastActivationTime > this.activationDuration) {
            this.manuallyActivated = false
            return false
          }
          return true
        }
        return false

      case MagnetTrigger.PERIODIC:
        // Check if enough time has passed for next activation
        return currentTime - this.lastActivationTime >= this.activationCooldown

      default:
        return true
    }
  }

  /**
   * Manually activates the magnet
   */
  activate(currentTime: number): boolean {
    if (
      this.trigger === MagnetTrigger.MANUAL ||
      this.trigger === MagnetTrigger.PERIODIC
    ) {
      // Check cooldown
      if (currentTime - this.lastActivationTime < this.activationCooldown) {
        return false
      }

      this.manuallyActivated = true
      this.lastActivationTime = currentTime
      this.stats.activationCount++
      this.stats.lastActivationTime = currentTime
      return true
    }
    return false
  }

  /**
   * Triggers magnet activation based on events
   */
  triggerActivation(triggerType: MagnetTrigger, currentTime: number): boolean {
    if (this.trigger !== triggerType) {
      return false
    }

    return this.activate(currentTime)
  }

  /**
   * Gets the effective magnetic range
   */
  getEffectiveRange(): number {
    const baseRange = this.magneticField.range * this.rangeMultiplier
    const tempBonus = this.temporaryRangeBonus
    return baseRange + tempBonus
  }

  /**
   * Gets the effective magnetic strength
   */
  getEffectiveStrength(): number {
    const baseStrength = this.magneticField.strength * this.strengthMultiplier
    const tempBonus = this.temporaryStrengthBonus
    let finalStrength = baseStrength + tempBonus

    // Apply pulse multiplier if pulsing
    if (this.isPulsing && this.magneticField.type === MagnetFieldType.PULSE) {
      finalStrength *= this.pulseStrength
    }

    return finalStrength
  }

  /**
   * Checks if an item should be attracted
   */
  shouldAttractItem(collectible: Record<string, unknown>): boolean {
    if (!collectible || this.blacklistedItems.has(collectible.id as EntityId)) {
      return false
    }

    // Check if already at max targets
    if (this.attractedItems.size >= this.magneticField.maxTargets) {
      return false
    }

    // Check filters
    return this.collectionFilters.some((filter) =>
      this.filterMatches(filter, collectible)
    )
  }

  /**
   * Checks if a collection filter matches an item
   */
  private filterMatches(
    filter: CollectionFilter,
    collectible: Record<string, unknown>
  ): boolean {
    const getComponent = collectible.getComponent as
      | ((type: string) => unknown)
      | undefined
    const collectibleComponent = getComponent?.('collectible') as
      | Record<string, unknown>
      | undefined
    if (!collectibleComponent) {
      return false
    }

    switch (filter.targetType) {
      case MagnetTargetType.ALL:
        return true

      case MagnetTargetType.EXPERIENCE:
        return collectibleComponent.collectibleType === 'experience'

      case MagnetTargetType.CURRENCY:
        return collectibleComponent.collectibleType === 'currency'

      case MagnetTargetType.POWER_UPS:
        return collectibleComponent.collectibleType === 'power_up'

      case MagnetTargetType.WEAPONS:
        return collectibleComponent.collectibleType === 'weapon'

      case MagnetTargetType.RARE_ONLY:
        const rarity = collectibleComponent.rarity
        return rarity === 'rare' || rarity === 'epic' || rarity === 'legendary'

      case MagnetTargetType.CUSTOM:
        return filter.customPredicate
          ? filter.customPredicate(collectible)
          : false

      default:
        return false
    }
  }

  /**
   * Calculates magnetic force for an item
   */
  calculateMagneticForce(
    magnetPosition: Vector2,
    itemPosition: Vector2,
    currentTime: number
  ): Vector2 {
    const direction = Vector2Math.subtract(magnetPosition, itemPosition)
    const distance = Vector2Math.magnitude(direction)
    const effectiveRange = this.getEffectiveRange()

    if (distance === 0 || distance > effectiveRange) {
      return { x: 0, y: 0 }
    }

    // Calculate force based on field type
    let force = this.calculateForceByType(distance, effectiveRange, currentTime)

    // Apply efficiency
    force *= this.magneticField.efficiency

    // Normalize direction and apply force
    const normalizedDirection = Vector2Math.normalize(direction)
    return {
      x: normalizedDirection.x * force,
      y: normalizedDirection.y * force,
    }
  }

  /**
   * Calculates force based on magnetic field type
   */
  private calculateForceByType(
    distance: number,
    range: number,
    currentTime: number
  ): number {
    const strength = this.getEffectiveStrength()
    const distanceRatio = 1 - distance / range

    switch (this.magneticField.type) {
      case MagnetFieldType.CIRCULAR:
        return strength * Math.pow(distanceRatio, this.magneticField.decayRate)

      case MagnetFieldType.DIRECTIONAL:
        // Stronger pull in one direction
        return strength * distanceRatio * 1.5

      case MagnetFieldType.PULSE:
        this.updatePulse(currentTime)
        return strength * Math.pow(distanceRatio, this.magneticField.decayRate)

      case MagnetFieldType.REPULSIVE:
        // Negative force (pushes away)
        return (
          -strength *
          Math.pow(distanceRatio, this.magneticField.decayRate) *
          0.5
        )

      case MagnetFieldType.SELECTIVE:
        // Standard force for selective magnetism
        return strength * Math.pow(distanceRatio, this.magneticField.decayRate)

      default:
        return strength * Math.pow(distanceRatio, this.magneticField.decayRate)
    }
  }

  /**
   * Updates pulse magnetism state
   */
  private updatePulse(currentTime: number): void {
    if (this.magneticField.type !== MagnetFieldType.PULSE) {
      return
    }

    // Check if it's time for a new pulse
    if (currentTime - this.lastPulseTime >= this.pulseInterval) {
      this.isPulsing = true
      this.lastPulseTime = currentTime
    }

    // Check if pulse should end
    if (
      this.isPulsing &&
      currentTime - this.lastPulseTime >= this.pulseDuration
    ) {
      this.isPulsing = false
    }
  }

  /**
   * Starts attracting an item
   */
  startAttractingItem(itemId: EntityId, _currentTime: number): void {
    this.attractedItems.add(itemId)
    this.stats.totalItemsAttracted++
  }

  /**
   * Stops attracting an item
   */
  stopAttractingItem(itemId: EntityId): void {
    this.attractedItems.delete(itemId)
  }

  /**
   * Records item collection for statistics
   */
  recordItemCollection(
    itemValue: number,
    collectionTime: number,
    _currentTime: number
  ): void {
    this.stats.totalItemsCollected++

    // Update most valuable item
    if (itemValue > this.stats.mostValuableItemCollected) {
      this.stats.mostValuableItemCollected = itemValue
    }

    // Update average collection time
    const totalTime =
      this.stats.averageCollectionTime * (this.stats.totalItemsCollected - 1) +
      collectionTime
    this.stats.averageCollectionTime =
      totalTime / this.stats.totalItemsCollected
  }

  /**
   * Applies temporary bonuses
   */
  applyTemporaryBonus(
    rangeBonus: number = 0,
    strengthBonus: number = 0,
    duration: number = 5000,
    currentTime: number = Date.now()
  ): void {
    this.temporaryRangeBonus = Math.max(this.temporaryRangeBonus, rangeBonus)
    this.temporaryStrengthBonus = Math.max(
      this.temporaryStrengthBonus,
      strengthBonus
    )
    this.bonusExpirationTime = Math.max(
      this.bonusExpirationTime,
      currentTime + duration
    )
  }

  /**
   * Updates temporary bonuses (removes expired ones)
   */
  updateTemporaryBonuses(currentTime: number): void {
    if (currentTime >= this.bonusExpirationTime) {
      this.temporaryRangeBonus = 0
      this.temporaryStrengthBonus = 0
      this.bonusExpirationTime = 0
    }
  }

  /**
   * Checks if magnet should update (performance optimization)
   */
  shouldUpdate(currentTime: number): boolean {
    const timeSinceUpdate = currentTime - this.lastUpdateTime
    return timeSinceUpdate >= this.updateInterval
  }

  /**
   * Marks magnet as updated
   */
  markUpdated(currentTime: number): void {
    this.lastUpdateTime = currentTime
    this.currentUpdates = 0
  }

  /**
   * Checks if can perform more updates this frame
   */
  canUpdate(): boolean {
    return this.currentUpdates < this.maxUpdatesPerFrame
  }

  /**
   * Increments update counter
   */
  incrementUpdates(): void {
    this.currentUpdates++
  }

  /**
   * Gets magnet display information
   */
  getDisplayInfo(): Record<string, unknown> {
    return {
      active: this.active,
      range: this.getEffectiveRange(),
      strength: this.getEffectiveStrength(),
      attractedItems: this.attractedItems.size,
      maxTargets: this.magneticField.maxTargets,
      isPulsing: this.isPulsing,
      stats: { ...this.stats },
      temporaryBonuses: {
        range: this.temporaryRangeBonus,
        strength: this.temporaryStrengthBonus,
        timeRemaining: Math.max(0, this.bonusExpirationTime - Date.now()),
      },
    }
  }

  clone(): MagnetComponent {
    const clone = new MagnetComponent(
      this.magneticField.range,
      this.magneticField.strength
    )

    clone.active = this.active
    clone.magneticField = { ...this.magneticField }

    clone.trigger = this.trigger
    clone.manuallyActivated = this.manuallyActivated
    clone.activationDuration = this.activationDuration
    clone.activationCooldown = this.activationCooldown
    clone.lastActivationTime = this.lastActivationTime

    clone.collectionFilters = this.collectionFilters.map((f) => ({ ...f }))
    clone.attractedItems = new Set(this.attractedItems)
    clone.blacklistedItems = new Set(this.blacklistedItems)

    clone.rangeMultiplier = this.rangeMultiplier
    clone.strengthMultiplier = this.strengthMultiplier
    clone.efficiencyBonus = this.efficiencyBonus
    clone.experienceBonus = this.experienceBonus
    clone.currencyBonus = this.currencyBonus

    clone.pulseInterval = this.pulseInterval
    clone.pulseStrength = this.pulseStrength
    clone.pulseDuration = this.pulseDuration
    clone.lastPulseTime = this.lastPulseTime
    clone.isPulsing = this.isPulsing

    clone.visualEffect = this.visualEffect
    clone.pulseEffect = this.pulseEffect
    clone.collectEffect = this.collectEffect
    clone.soundEnabled = this.soundEnabled

    clone.updateInterval = this.updateInterval
    clone.lastUpdateTime = this.lastUpdateTime
    clone.maxUpdatesPerFrame = this.maxUpdatesPerFrame
    clone.currentUpdates = this.currentUpdates

    clone.stats = { ...this.stats }

    clone.temporaryRangeBonus = this.temporaryRangeBonus
    clone.temporaryStrengthBonus = this.temporaryStrengthBonus
    clone.bonusExpirationTime = this.bonusExpirationTime

    return clone
  }

  serialize(): Record<string, unknown> {
    return {
      active: this.active,
      magneticField: this.magneticField,

      trigger: this.trigger,
      manuallyActivated: this.manuallyActivated,
      activationDuration: this.activationDuration,
      activationCooldown: this.activationCooldown,
      lastActivationTime: this.lastActivationTime,

      collectionFilters: this.collectionFilters,
      attractedItems: Array.from(this.attractedItems),
      blacklistedItems: Array.from(this.blacklistedItems),

      rangeMultiplier: this.rangeMultiplier,
      strengthMultiplier: this.strengthMultiplier,
      efficiencyBonus: this.efficiencyBonus,
      experienceBonus: this.experienceBonus,
      currencyBonus: this.currencyBonus,

      pulseInterval: this.pulseInterval,
      pulseStrength: this.pulseStrength,
      pulseDuration: this.pulseDuration,
      lastPulseTime: this.lastPulseTime,
      isPulsing: this.isPulsing,

      visualEffect: this.visualEffect,
      pulseEffect: this.pulseEffect,
      collectEffect: this.collectEffect,
      soundEnabled: this.soundEnabled,

      updateInterval: this.updateInterval,
      lastUpdateTime: this.lastUpdateTime,
      maxUpdatesPerFrame: this.maxUpdatesPerFrame,
      currentUpdates: this.currentUpdates,

      stats: this.stats,

      temporaryRangeBonus: this.temporaryRangeBonus,
      temporaryStrengthBonus: this.temporaryStrengthBonus,
      bonusExpirationTime: this.bonusExpirationTime,
    }
  }

  deserialize(data: Record<string, unknown>): void {
    this.active = data.active as boolean
    this.magneticField = data.magneticField as MagneticField

    this.trigger = data.trigger as MagnetTrigger
    this.manuallyActivated = data.manuallyActivated as boolean
    this.activationDuration = data.activationDuration as number
    this.activationCooldown = data.activationCooldown as number
    this.lastActivationTime = data.lastActivationTime as number

    this.collectionFilters = data.collectionFilters as CollectionFilter[]
    this.attractedItems = new Set(data.attractedItems as EntityId[])
    this.blacklistedItems = new Set(data.blacklistedItems as EntityId[])

    this.rangeMultiplier = data.rangeMultiplier as number
    this.strengthMultiplier = data.strengthMultiplier as number
    this.efficiencyBonus = data.efficiencyBonus as number
    this.experienceBonus = data.experienceBonus as number
    this.currencyBonus = data.currencyBonus as number

    this.pulseInterval = data.pulseInterval as number
    this.pulseStrength = data.pulseStrength as number
    this.pulseDuration = data.pulseDuration as number
    this.lastPulseTime = data.lastPulseTime as number
    this.isPulsing = data.isPulsing as boolean

    this.visualEffect = data.visualEffect as string
    this.pulseEffect = data.pulseEffect as string
    this.collectEffect = data.collectEffect as string
    this.soundEnabled = data.soundEnabled as boolean

    this.updateInterval = data.updateInterval as number
    this.lastUpdateTime = data.lastUpdateTime as number
    this.maxUpdatesPerFrame = data.maxUpdatesPerFrame as number
    this.currentUpdates = data.currentUpdates as number

    this.stats = data.stats as MagnetStats

    this.temporaryRangeBonus = data.temporaryRangeBonus as number
    this.temporaryStrengthBonus = data.temporaryStrengthBonus as number
    this.bonusExpirationTime = data.bonusExpirationTime as number
  }
}

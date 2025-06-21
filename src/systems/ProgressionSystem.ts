import { System } from '../core/ECS/System'
import type {
  EntityQuery,
  SystemUpdateContext,
  ComponentType,
} from '../types/CoreTypes'
import type { ExperienceComponent } from '../components/Experience'
import { GameEventType } from '../types/Events'

type ProgressionEntityQuery = EntityQuery & {
  components: {
    experience: ExperienceComponent
  }
}

export interface XPSource {
  type: string
  baseAmount: number
  levelMultiplier?: number
}

/**
 * Progression system handles experience gain and leveling
 */
export class ProgressionSystem extends System {
  readonly name = 'progression'
  readonly requiredComponents: ComponentType[] = ['experience']

  private eventSystem?: any
  private world?: any
  private xpSources: Map<string, XPSource> = new Map()
  private pendingLevelUps: Map<number, number[]> = new Map() // entityId -> levels gained

  constructor(eventSystem?: any, world?: any) {
    super()
    this.eventSystem = eventSystem
    this.world = world
    this.initializeXPSources()
  }

  private initializeXPSources(): void {
    // Default XP sources
    this.xpSources.set('enemy_kill', {
      type: 'enemy_kill',
      baseAmount: 10,
      levelMultiplier: 1.1,
    })

    this.xpSources.set('quest_complete', {
      type: 'quest_complete',
      baseAmount: 50,
      levelMultiplier: 1.2,
    })

    this.xpSources.set('item_collect', {
      type: 'item_collect',
      baseAmount: 2,
    })
  }

  update(_context: SystemUpdateContext, entities: EntityQuery[]): void {
    // Process any pending level ups and apply stat increases
    entities.forEach(entity => {
      this.processLevelUpStatIncreases(entity)
    })
  }

  initialize(): void {
    if (this.eventSystem) {
      // Listen for events that should grant XP
      this.eventSystem.on(
        GameEventType.ENTITY_KILLED,
        this.handleEntityKilled.bind(this)
      )
      this.eventSystem.on(
        GameEventType.ITEM_COLLECTED,
        this.handleItemCollected.bind(this)
      )
    }
  }

  private handleEntityKilled(event: any): void {
    const { killerEntityId, killerId, victimEntityId, entityId, victimType } = event.data

    // Support both killerEntityId and killerId for compatibility
    const actualKillerId = killerEntityId || killerId
    const actualVictimId = victimEntityId || entityId
    
    if (!actualKillerId) return

    // Determine enemy type and XP multiplier
    let xpMultiplier = 1
    let enemyType = victimType || 'unknown'
    
    if (victimType) {
      if (victimType.includes('boss')) {
        xpMultiplier = 5 // Boss enemies give 5x XP
      } else if (victimType.includes('elite')) {
        xpMultiplier = 2 // Elite enemies give 2x XP
      }
    }

    // Award XP to the killer
    const baseXP = this.xpSources.get('enemy_kill')?.baseAmount || 10
    const finalXP = Math.floor(baseXP * xpMultiplier)
    
    this.awardExperienceAmount(actualKillerId, finalXP, 'combat', {
      enemyType,
      sourceEntityId: actualVictimId,
    })
  }

  private handleItemCollected(event: any): void {
    const { entityId, itemType } = event.data

    // Award XP for collecting items
    this.awardExperience(entityId, 'item_collect', {
      itemType,
    })
  }

  /**
   * Awards experience to an entity based on XP source type
   */
  awardExperience(
    entityId: number,
    sourceType: string,
    metadata?: Record<string, unknown>
  ): number[] {
    if (!this.eventSystem) {
      return []
    }

    // Find the entity with experience component
    const entities = this.getEntitiesWithExperience()
    const entity = entities.find((e) => e.id === entityId)

    if (!entity) {
      return []
    }

    const xpSource = this.xpSources.get(sourceType)
    if (!xpSource) {
      return []
    }

    // Calculate XP amount
    let xpAmount = xpSource.baseAmount

    if (xpSource.levelMultiplier) {
      const currentLevel = entity.components.experience.level
      xpAmount = Math.floor(
        xpAmount * Math.pow(xpSource.levelMultiplier, currentLevel - 1)
      )
    }

    return this.awardExperienceAmount(entityId, xpAmount, sourceType, metadata)
  }

  /**
   * Awards a specific amount of experience to an entity
   */
  awardExperienceAmount(
    entityId: number,
    amount: number,
    source: string,
    sourceDetails?: Record<string, unknown>
  ): number[] {
    if (!this.eventSystem) {
      return []
    }

    // Find the entity with experience component
    const entities = this.getEntitiesWithExperience()
    const entity = entities.find((e) => e.id === entityId)

    if (!entity) {
      return []
    }

    // Award the experience
    const levelsGained = entity.components.experience.addExperience(amount)

    // Emit experience gained event
    this.eventSystem.emit(GameEventType.EXPERIENCE_GAINED, {
      entityId,
      amount,
      source,
      sourceDetails,
      timestamp: Date.now(),
    })

    // Store pending level ups for stat increases
    if (levelsGained.length > 0) {
      this.pendingLevelUps.set(entityId, levelsGained)
    }

    // Emit level up events
    levelsGained.forEach((newLevel: number) => {
      this.eventSystem.emit(GameEventType.LEVEL_UP, {
        entityId,
        previousLevel: newLevel - 1,
        newLevel,
        timestamp: Date.now(),
      })
    })

    return levelsGained
  }

  /**
   * Manually awards experience (for quests, cheats, etc.)
   */
  grantExperience(
    entityId: number,
    amount: number,
    source: string = 'manual'
  ): number[] {
    if (!this.world) {
      return []
    }

    // Get entity directly from world
    const entity = this.world.getEntity(entityId)
    if (!entity || !entity.hasComponent('experience')) {
      return []
    }

    const experienceComponent = entity.getComponent('experience')
    const levelsGained = experienceComponent.addExperience(amount)

    // Store pending level ups for stat increases
    if (levelsGained.length > 0) {
      this.pendingLevelUps.set(entityId, levelsGained)
    }

    if (this.eventSystem) {
      this.eventSystem.emit(GameEventType.EXPERIENCE_GAINED, {
        entityId,
        amount,
        source,
        timestamp: Date.now(),
      })

      levelsGained.forEach((newLevel: number) => {
        this.eventSystem.emit(GameEventType.LEVEL_UP, {
          entityId,
          previousLevel: newLevel - 1,
          newLevel,
          timestamp: Date.now(),
        })
      })
    }

    return levelsGained
  }

  /**
   * Registers a new XP source
   */
  registerXPSource(source: XPSource): void {
    this.xpSources.set(source.type, source)
  }

  /**
   * Updates an existing XP source
   */
  updateXPSource(sourceType: string, updates: Partial<XPSource>): void {
    const existing = this.xpSources.get(sourceType)
    if (existing) {
      this.xpSources.set(sourceType, { ...existing, ...updates })
    }
  }

  /**
   * Gets an entity's current level
   */
  getLevel(entityId: number): number {
    const entities = this.getEntitiesWithExperience()
    const entity = entities.find((e) => e.id === entityId)
    return entity?.components.experience.level ?? 0
  }

  /**
   * Gets an entity's total XP
   */
  getTotalXP(entityId: number): number {
    const entities = this.getEntitiesWithExperience()
    const entity = entities.find((e) => e.id === entityId)
    return entity?.components.experience.totalXP ?? 0
  }

  /**
   * Gets an entity's progress to next level (0-1)
   */
  getLevelProgress(entityId: number): number {
    const entities = this.getEntitiesWithExperience()
    const entity = entities.find((e) => e.id === entityId)
    return entity?.components.experience.getLevelProgress() ?? 0
  }

  /**
   * Helper to get all entities with experience components
   */
  private getEntitiesWithExperience(): ProgressionEntityQuery[] {
    if (!this.world) {
      return []
    }

    const entities = this.world.getEntitiesWithComponents(['experience'])
    return entities.map((entity: any) => ({
      id: entity.id,
      components: {
        experience: entity.getComponent('experience'),
      },
    }))
  }

  /**
   * Processes level up stat increases for entities
   */
  private processLevelUpStatIncreases(entity: EntityQuery): void {
    const pendingLevels = this.pendingLevelUps.get(entity.id)
    if (!pendingLevels || pendingLevels.length === 0) {
      return
    }

    if (!this.world) {
      return
    }

    // Get the full entity from world to access all components
    const fullEntity = this.world.getEntity(entity.id)
    if (!fullEntity) {
      return
    }

    // Apply stat increases for each level gained
    pendingLevels.forEach((newLevel: number) => {
      this.applyLevelUpStatIncreases(fullEntity, newLevel)
    })

    // Clear pending level ups
    this.pendingLevelUps.delete(entity.id)
  }

  /**
   * Applies stat increases for a single level up
   */
  private applyLevelUpStatIncreases(entity: any, newLevel: number): void {
    // Increase health
    if (entity.hasComponent && entity.hasComponent('health')) {
      const health = entity.getComponent('health')
      if (health) {
        const healthIncrease = 10 + (newLevel * 2) // Base 10 + 2 per level
        health.maximum += healthIncrease
        health.current += healthIncrease // Also heal on level up
      }
    }

    // Increase combat damage
    if (entity.hasComponent && entity.hasComponent('combat')) {
      const combat = entity.getComponent('combat')
      if (combat && combat.weapon) {
        const damageIncrease = 2 + Math.floor(newLevel / 2) // Base 2 + 1 every 2 levels
        combat.weapon.damage += damageIncrease
      }
    }

    // Could add more stat increases here (speed, critical chance, etc.)
  }
}

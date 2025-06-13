import { System } from '../core/ECS/System'
import type { 
  EntityQuery, 
  SystemUpdateContext, 
  ComponentType 
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

  update(_context: SystemUpdateContext, _entities: EntityQuery[]): void {
    // Progression system mainly reacts to events rather than updating each frame
    // This could be used for passive XP gain over time if needed
  }

  initialize(): void {
    if (this.eventSystem) {
      // Listen for events that should grant XP
      this.eventSystem.on(GameEventType.ENTITY_KILLED, this.handleEntityKilled.bind(this))
      this.eventSystem.on(GameEventType.ITEM_COLLECTED, this.handleItemCollected.bind(this))
    }
  }

  private handleEntityKilled(event: any): void {
    const { killerId, entityId } = event.data

    if (!killerId) return

    // Award XP to the killer
    this.awardExperience(killerId, 'enemy_kill', {
      sourceEntityId: entityId,
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
   * Awards experience to an entity
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
    const entity = entities.find(e => e.id === entityId)

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
      xpAmount = Math.floor(xpAmount * Math.pow(xpSource.levelMultiplier, currentLevel - 1))
    }

    // Award the experience
    const levelsGained = entity.components.experience.addExperience(xpAmount)

    // Emit experience gained event
    this.eventSystem.emit(GameEventType.EXPERIENCE_GAINED, {
      entityId,
      amount: xpAmount,
      source: sourceType,
      metadata,
      timestamp: Date.now(),
    })

    // Emit level up events
    levelsGained.forEach(newLevel => {
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
  grantExperience(entityId: number, amount: number, source: string = 'manual'): number[] {
    const entities = this.getEntitiesWithExperience()
    const entity = entities.find(e => e.id === entityId)

    if (!entity) {
      return []
    }

    const levelsGained = entity.components.experience.addExperience(amount)

    if (this.eventSystem) {
      this.eventSystem.emit(GameEventType.EXPERIENCE_GAINED, {
        entityId,
        amount,
        source,
        timestamp: Date.now(),
      })

      levelsGained.forEach(newLevel => {
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
    const entity = entities.find(e => e.id === entityId)
    return entity?.components.experience.level ?? 0
  }

  /**
   * Gets an entity's total XP
   */
  getTotalXP(entityId: number): number {
    const entities = this.getEntitiesWithExperience()
    const entity = entities.find(e => e.id === entityId)
    return entity?.components.experience.totalXP ?? 0
  }

  /**
   * Gets an entity's progress to next level (0-1)
   */
  getLevelProgress(entityId: number): number {
    const entities = this.getEntitiesWithExperience()
    const entity = entities.find(e => e.id === entityId)
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
        experience: entity.getComponent('experience')
      }
    }))
  }
}
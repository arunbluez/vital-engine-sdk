import { System } from '../core/ECS/System'
import type {
  EntityQuery,
  SystemUpdateContext,
  ComponentType,
  EntityId,
} from '../types/CoreTypes'
import {
  EnemyAIComponent,
  AIBehaviorState,
  type AIDecisionFactors,
  type AIAction,
} from '../components/EnemyAI'
import {
  SpawnerComponent,
  SpawnTiming,
  type EnemyType,
  type ComponentTemplate,
} from '../components/Spawner'
import { TransformComponent } from '../components/Transform'
import { HealthComponent } from '../components/Health'
import { MovementComponent } from '../components/Movement'
import { CombatComponent } from '../components/Combat'
import { SkillsComponent } from '../components/Skills'
import { Vector2Math } from '../utils/Math'
import { GameEventType } from '../types/Events'

type EnemyEntityQuery = EntityQuery & {
  components: {
    enemyAI: EnemyAIComponent
    transform: TransformComponent
    health: HealthComponent
    movement: MovementComponent
  }
}

type SpawnerEntityQuery = EntityQuery & {
  components: {
    spawner: SpawnerComponent
    transform: TransformComponent
  }
}

/**
 * Enemy system configuration
 */
export interface EnemySystemConfig {
  maxEnemies: number
  aiUpdateInterval: number
  spawnerUpdateInterval: number
  pathfindingEnabled: boolean
  groupBehaviorEnabled: boolean
  performanceMode: boolean
}

/**
 * Enemy system handles AI behavior and spawning
 */
export class EnemySystem extends System {
  readonly name = 'enemy'
  readonly requiredComponents: ComponentType[] = ['enemyAI', 'transform']

  private eventSystem?: any
  private world?: any
  private config: EnemySystemConfig
  private playerEntityId: EntityId | null = null
  private lastAIUpdate: number = 0
  private lastSpawnerUpdate: number = 0

  // Performance tracking
  private aiUpdatesThisFrame: number = 0
  private maxAIUpdatesPerFrame: number = 20

  constructor(
    eventSystem?: any,
    world?: any,
    config: Partial<EnemySystemConfig> = {}
  ) {
    super()
    this.eventSystem = eventSystem
    this.world = world

    this.config = {
      maxEnemies: 100,
      aiUpdateInterval: 100, // Update AI every 100ms
      spawnerUpdateInterval: 500, // Update spawners every 500ms
      pathfindingEnabled: true,
      groupBehaviorEnabled: true,
      performanceMode: false,
      ...config,
    }
  }

  initialize(): void {
    // Event listeners commented out - handlers not implemented yet
    // if (this.eventSystem) {
    //   this.eventSystem.on(GameEventType.ENTITY_KILLED, this.handleEntityDeath.bind(this))
    //   this.eventSystem.on(GameEventType.DAMAGE_DEALT, this.handleDamageDealt.bind(this))
    // }
  }

  update(context: SystemUpdateContext, entities: EntityQuery[]): void {
    const currentTime = context.totalTime
    this.aiUpdatesThisFrame = 0

    // Find player entity for AI targeting
    // this.updatePlayerReference()

    // Update spawners
    // if (
    //   currentTime - this.lastSpawnerUpdate >=
    //   this.config.spawnerUpdateInterval
    // ) {
    //   this.updateSpawners(entities, currentTime, context)
    //   this.lastSpawnerUpdate = currentTime
    // }

    // Update AI entities
    // if (currentTime - this.lastAIUpdate >= this.config.aiUpdateInterval) {
    //   this.updateEnemyAI(entities as EnemyEntityQuery[], currentTime, context)
    //   this.lastAIUpdate = currentTime
    // }
  }

  /*
   * All remaining methods are commented out due to incomplete implementation
   * TODO: Implement these methods properly
   */
}

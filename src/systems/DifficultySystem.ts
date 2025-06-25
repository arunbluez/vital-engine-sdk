import { System } from '../core/ECS/System'
import type {
  ComponentType,
  EntityId,
  SystemUpdateContext,
} from '../types/CoreTypes'
import type {
  DifficultyLevel,
  ScalingMetric,
  DifficultyModifier,
} from '../components/Difficulty'
import { DifficultyComponent } from '../components/Difficulty'
import type { HealthComponent } from '../components/Health'
import type { CombatComponent } from '../components/Combat'
import type { MovementComponent } from '../components/Movement'
import type { SpawnerComponent } from '../components/Spawner'
import type { EnemyAIComponent } from '../components/EnemyAI'
import type { DifficultyChangedEvent } from '../types/Events'

export interface DifficultyEntityQuery {
  entityId: EntityId
  difficulty: DifficultyComponent
}

export interface ScalableEntityQuery {
  entityId: EntityId
  health?: HealthComponent
  combat?: CombatComponent
  movement?: MovementComponent
  spawner?: SpawnerComponent
  enemyAI?: EnemyAIComponent
}

export class DifficultySystem extends System {
  readonly name = 'difficulty'
  readonly requiredComponents: ComponentType[] = ['difficulty']

  private world?: any
  private eventSystem?: any
  private lastDifficultyUpdate: number = Date.now()
  private difficultyUpdateInterval: number = 1000

  constructor(world?: any, eventSystem?: any) {
    super()
    this.world = world
    this.eventSystem = eventSystem
  }

  public update(context: SystemUpdateContext): void {
    const deltaTime = context.deltaTime
    const currentTime = Date.now()

    if (
      currentTime - this.lastDifficultyUpdate <
      this.difficultyUpdateInterval
    ) {
      return
    }

    const difficultyEntities = this.world?.getEntitiesWithComponents([
      'difficulty',
    ]) as DifficultyEntityQuery[]

    if (!difficultyEntities) return

    for (const entity of difficultyEntities) {
      this.updateDifficultyMetrics(entity, deltaTime)
      this.processAdaptiveDifficulty(entity, currentTime)
      this.applyDifficultyModifiers(entity)
    }

    this.lastDifficultyUpdate = currentTime
  }

  private updateDifficultyMetrics(
    entity: DifficultyEntityQuery,
    deltaTime: number
  ): void {
    const difficulty = entity.difficulty

    difficulty.updatePerformanceMetrics('SURVIVAL_TIME', deltaTime, true)

    const newScore = difficulty.calculateCurrentScore()
    difficulty.currentScore = newScore
    difficulty.performanceMetrics.score = newScore
  }

  private processAdaptiveDifficulty(
    entity: DifficultyEntityQuery,
    currentTime: number
  ): void {
    const difficulty = entity.difficulty

    if (!difficulty.adaptiveSettings.isEnabled) return

    const timeSinceLastAdaptation = currentTime - difficulty.lastAdaptationTime
    if (
      timeSinceLastAdaptation < difficulty.adaptiveSettings.adaptationInterval
    )
      return

    const performanceScore = difficulty.getPerformanceScore()
    difficulty.performanceHistory.push(performanceScore)

    if (
      difficulty.performanceHistory.length >
      difficulty.adaptiveSettings.performanceWindowSize
    ) {
      difficulty.performanceHistory.shift()
    }

    if (difficulty.performanceHistory.length < 3) return

    const averagePerformance =
      difficulty.performanceHistory.reduce((a, b) => a + b, 0) /
      difficulty.performanceHistory.length
    const targetRange = difficulty.adaptiveSettings.targetPerformanceRange

    let adjustment = 0

    if (averagePerformance < targetRange.min) {
      adjustment =
        (targetRange.min - averagePerformance) *
        difficulty.adaptiveSettings.adaptationRate *
        -1
    } else if (averagePerformance > targetRange.max) {
      adjustment =
        (averagePerformance - targetRange.max) *
        difficulty.adaptiveSettings.adaptationRate
    }

    if (
      Math.abs(averagePerformance - (targetRange.min + targetRange.max) / 2) >
      difficulty.adaptiveSettings.emergencyAdjustmentThreshold
    ) {
      adjustment *= 2
    }

    adjustment = Math.max(
      -difficulty.adaptiveSettings.maxAdjustmentPerInterval,
      Math.min(difficulty.adaptiveSettings.maxAdjustmentPerInterval, adjustment)
    )

    if (Math.abs(adjustment) > 0.01) {
      const newTargetScore = Math.max(
        0,
        difficulty.targetScore + adjustment * 100
      )

      const transitionResult =
        difficulty.shouldTransitionDifficulty(newTargetScore)

      if (transitionResult.shouldTransition && transitionResult.newLevel) {
        this.changeDifficultyLevel(entity, transitionResult.newLevel)
      } else {
        difficulty.targetScore = newTargetScore
      }

      difficulty.lastAdaptationTime = currentTime
    }

    const performanceVariance = this.calculateVariance(
      difficulty.performanceHistory
    )
    difficulty.isStabilized =
      performanceVariance < difficulty.adaptiveSettings.stabilityThreshold
  }

  private calculateVariance(values: number[]): number {
    if (values.length < 2) return 0

    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const squaredDifferences = values.map((value) => Math.pow(value - mean, 2))
    return squaredDifferences.reduce((a, b) => a + b, 0) / values.length
  }

  private changeDifficultyLevel(
    entity: DifficultyEntityQuery,
    newLevel: DifficultyLevel
  ): void {
    const difficulty = entity.difficulty
    const oldLevel = difficulty.currentLevel

    if (oldLevel === newLevel) return

    difficulty.currentLevel = newLevel

    const newBand = difficulty.getDifficultyBandForScore(
      difficulty.currentScore
    )
    if (newBand) {
      difficulty.activeModifiers.clear()

      for (const modifier of newBand.modifiers) {
        if (modifier.isActive) {
          difficulty.activeModifiers.set(modifier.id, modifier)
        }
      }
    }

    const difficultyEvent: DifficultyChangedEvent = {
      type: 'difficulty_changed',
      timestamp: Date.now(),
      entityId: entity.entityId,
      oldLevel,
      newLevel,
      currentScore: difficulty.currentScore,
      performanceScore: difficulty.getPerformanceScore(),
      isAdaptive: difficulty.adaptiveSettings.isEnabled,
    }

    if (this.eventSystem) {
      this.eventSystem.emit('difficulty_changed', difficultyEvent)
    }

    difficulty.performanceHistory = []
    difficulty.isStabilized = false
  }

  private applyDifficultyModifiers(entity: DifficultyEntityQuery): void {
    const difficulty = entity.difficulty
    if (!this.world) return

    // Get all entities to potentially scale
    const allEntities = this.world.getAllEntities()
    
    for (const [modifierId, modifier] of difficulty.activeModifiers) {
      // Filter entities based on modifier target
      for (const targetEntity of allEntities) {
        if (this.shouldApplyModifier(targetEntity, modifier)) {
          this.applyModifierToEntity(
            targetEntity,
            modifier,
            difficulty.currentScore
          )
        }
      }
    }
  }

  private shouldApplyModifier(entity: any, modifier: DifficultyModifier): boolean {
    const targetProperty = modifier.targetProperty
    
    if (targetProperty === 'all') return true
    
    if (targetProperty.startsWith('health.') && entity.hasComponent('health')) return true
    if (targetProperty.startsWith('combat.') && entity.hasComponent('combat')) return true
    if (targetProperty.startsWith('movement.') && entity.hasComponent('movement')) return true
    if (targetProperty.startsWith('spawner.') && entity.hasComponent('spawner')) return true
    if (targetProperty.startsWith('enemyAI.') && entity.hasComponent('enemyAI')) return true
    
    return false
  }


  private applyModifierToEntity(
    entity: any,
    modifier: DifficultyModifier,
    difficultyScore: number
  ): void {
    const targetProperty = modifier.targetProperty
    const normalizedScore = Math.min(difficultyScore / 100, 5.0)
    const difficultyEntities = this.world?.getEntitiesWithComponents(['difficulty']) as DifficultyEntityQuery[]
    const difficulty = difficultyEntities?.[0]?.difficulty as DifficultyComponent
    
    if (!difficulty) return

    // Helper function to get calculated modifier value
    const getModifierValue = () => difficulty.calculateModifierValue(modifier, normalizedScore)

    if (targetProperty === 'health.maxHealth' && entity.hasComponent('health')) {
      const health = entity.getComponent('health') as HealthComponent
      const baseHealth = (health as any).baseMaximum || health.maximum
      const scaledHealth = getModifierValue() * baseHealth
      health.maximum = Math.max(1, Math.round(scaledHealth))
      if (!(health as any).baseMaximum) (health as any).baseMaximum = baseHealth
    } else if (targetProperty === 'combat.damage' && entity.hasComponent('combat')) {
      const combat = entity.getComponent('combat') as CombatComponent
      const baseDamage = (combat as any).baseDamage || combat.weapon.damage
      const scaledDamage = getModifierValue() * baseDamage
      combat.weapon.damage = Math.max(1, Math.round(scaledDamage))
      if (!(combat as any).baseDamage) (combat as any).baseDamage = baseDamage
    } else if (targetProperty === 'movement.speed' && entity.hasComponent('movement')) {
      const movement = entity.getComponent('movement') as MovementComponent
      const baseSpeed = (movement as any).baseMaxSpeed || movement.maxSpeed
      const scaledSpeed = getModifierValue() * baseSpeed
      movement.maxSpeed = Math.max(0.1, scaledSpeed)
      if (!(movement as any).baseMaxSpeed) (movement as any).baseMaxSpeed = baseSpeed
    } else if (targetProperty === 'spawner.spawnRate' && entity.hasComponent('spawner')) {
      const spawner = entity.getComponent('spawner') as SpawnerComponent
      const baseRate = (spawner as any).baseSpawnRate || spawner.currentSpawnRate
      const scaledRate = getModifierValue() * baseRate
      spawner.currentSpawnRate = Math.max(0.1, scaledRate)
      if (!(spawner as any).baseSpawnRate) (spawner as any).baseSpawnRate = baseRate
    } else if (targetProperty === 'spawner.maxActiveEnemies' && entity.hasComponent('spawner')) {
      const spawner = entity.getComponent('spawner') as SpawnerComponent
      const baseMax = (spawner as any).baseMaxActiveEnemies || spawner.maxActiveEnemies
      const scaledMax = getModifierValue() * baseMax
      spawner.maxActiveEnemies = Math.max(1, Math.round(scaledMax))
      if (!(spawner as any).baseMaxActiveEnemies) (spawner as any).baseMaxActiveEnemies = baseMax
    } else if (targetProperty === 'spawner.timeBetweenWaves' && entity.hasComponent('spawner')) {
      const spawner = entity.getComponent('spawner') as SpawnerComponent
      const baseTime = (spawner as any).baseTimeBetweenWaves || spawner.timeBetweenWaves
      const scaledTime = getModifierValue() * baseTime
      spawner.timeBetweenWaves = Math.max(1000, Math.round(scaledTime))
      if (!(spawner as any).baseTimeBetweenWaves) (spawner as any).baseTimeBetweenWaves = baseTime
    } else if (targetProperty === 'enemyAI.aggressionLevel' && entity.hasComponent('enemyAI')) {
      const enemyAI = entity.getComponent('enemyAI') as EnemyAIComponent
      const baseAggression = (enemyAI as any).baseAggressionLevel || 1.0
      const scaledAggression = getModifierValue() * baseAggression
      enemyAI.aggressionLevel = Math.max(0.1, Math.min(3.0, scaledAggression))
      if (!(enemyAI as any).baseAggressionLevel) (enemyAI as any).baseAggressionLevel = baseAggression
    } else if (targetProperty === 'all') {
      // Apply all possible modifiers
      if (entity.hasComponent('health')) {
        this.applyModifierToEntity(entity, { ...modifier, targetProperty: 'health.maxHealth' }, difficultyScore)
      }
      if (entity.hasComponent('combat')) {
        this.applyModifierToEntity(entity, { ...modifier, targetProperty: 'combat.damage' }, difficultyScore)
      }
      if (entity.hasComponent('movement')) {
        this.applyModifierToEntity(entity, { ...modifier, targetProperty: 'movement.speed' }, difficultyScore)
      }
      if (entity.hasComponent('spawner')) {
        this.applyModifierToEntity(entity, { ...modifier, targetProperty: 'spawner.spawnRate' }, difficultyScore)
        this.applyModifierToEntity(entity, { ...modifier, targetProperty: 'spawner.maxActiveEnemies' }, difficultyScore)
      }
      if (entity.hasComponent('enemyAI')) {
        this.applyModifierToEntity(entity, { ...modifier, targetProperty: 'enemyAI.aggressionLevel' }, difficultyScore)
      }
    }
  }

  public recordPlayerAction(
    entityId: EntityId,
    metric: ScalingMetric,
    value: number,
    isIncrement: boolean = false
  ): void {
    const entity = this.world?.getEntity(entityId)
    if (!entity) return

    const difficulty = entity.getComponent('difficulty') as DifficultyComponent
    if (!difficulty) return

    difficulty.updatePerformanceMetrics(metric, value, isIncrement)
  }

  public setDifficultyLevel(
    entityId: EntityId,
    level: DifficultyLevel
  ): boolean {
    const entity = this.world?.getEntity(entityId)
    if (!entity) return false

    const difficulty = entity.getComponent('difficulty') as DifficultyComponent
    if (!difficulty) return false

    const targetBand = difficulty.difficultyBands.find(
      (band) => band.level === level
    )
    if (!targetBand) return false

    this.changeDifficultyLevel({ entityId, difficulty }, level)
    return true
  }

  public enableAdaptiveDifficulty(
    entityId: EntityId,
    enabled: boolean
  ): boolean {
    const entity = this.world?.getEntity(entityId)
    if (!entity) return false

    const difficulty = entity.getComponent('difficulty') as DifficultyComponent
    if (!difficulty) return false

    difficulty.adaptiveSettings.isEnabled = enabled

    if (enabled) {
      difficulty.performanceHistory = []
      difficulty.lastAdaptationTime = Date.now()
      difficulty.isStabilized = false
    }

    return true
  }

  public configureAdaptiveSettings(
    entityId: EntityId,
    settings: Partial<{
      adaptationRate: number
      adaptationInterval: number
      performanceWindowSize: number
      stabilityThreshold: number
      maxAdjustmentPerInterval: number
      targetPerformanceRange: { min: number; max: number }
      emergencyAdjustmentThreshold: number
    }>
  ): boolean {
    const entity = this.world?.getEntity(entityId)
    if (!entity) return false

    const difficulty = entity.getComponent('difficulty') as DifficultyComponent
    if (!difficulty) return false

    Object.assign(difficulty.adaptiveSettings, settings)
    return true
  }

  public getDifficultyStats(entityId: EntityId): {
    currentLevel: DifficultyLevel
    currentScore: number
    targetScore: number
    performanceScore: number
    isStabilized: boolean
    adaptiveEnabled: boolean
    performanceHistory: number[]
    activeModifiers: string[]
  } | null {
    const entity = this.world?.getEntity(entityId)
    if (!entity) return null

    const difficulty = entity.getComponent('difficulty') as DifficultyComponent
    if (!difficulty) return null

    return {
      currentLevel: difficulty.currentLevel,
      currentScore: difficulty.currentScore,
      targetScore: difficulty.targetScore,
      performanceScore: difficulty.getPerformanceScore(),
      isStabilized: difficulty.isStabilized,
      adaptiveEnabled: difficulty.adaptiveSettings.isEnabled,
      performanceHistory: [...difficulty.performanceHistory],
      activeModifiers: Array.from(difficulty.activeModifiers.keys()),
    }
  }

  public createDifficultyManager(adaptiveEnabled: boolean = true): EntityId {
    const entity = this.world?.createEntity()

    const difficulty = new DifficultyComponent()
    difficulty.adaptiveSettings.isEnabled = adaptiveEnabled

    entity.addComponent(difficulty)

    return entity.id
  }

  public addCustomModifier(
    entityId: EntityId,
    modifier: DifficultyModifier,
    targetLevel?: DifficultyLevel
  ): boolean {
    const entity = this.world?.getEntity(entityId)
    if (!entity) return false

    const difficulty = entity.getComponent('difficulty') as DifficultyComponent
    if (!difficulty) return false

    if (targetLevel) {
      const targetBand = difficulty.difficultyBands.find(
        (band) => band.level === targetLevel
      )
      if (targetBand) {
        targetBand.modifiers.push(modifier)
      }
    }

    if (targetLevel === difficulty.currentLevel || !targetLevel) {
      difficulty.activeModifiers.set(modifier.id, modifier)
    }

    return true
  }

  public removeCustomModifier(entityId: EntityId, modifierId: string): boolean {
    const entity = this.world?.getEntity(entityId)
    if (!entity) return false

    const difficulty = entity.getComponent('difficulty') as DifficultyComponent
    if (!difficulty) return false

    difficulty.activeModifiers.delete(modifierId)

    for (const band of difficulty.difficultyBands) {
      band.modifiers = band.modifiers.filter((mod) => mod.id !== modifierId)
    }

    return true
  }
}

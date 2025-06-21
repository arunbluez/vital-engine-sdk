import { System } from '../core/ECS/System'
import type {
  EntityQuery,
  SystemUpdateContext,
  ComponentType,
  EntityId,
} from '../types/CoreTypes'
import {
  SpawnerComponent,
  SpawnTiming,
  type EnemyType,
  type SpawnWave,
} from '../components/Spawner'
import { TransformComponent } from '../components/Transform'
import { HealthComponent } from '../components/Health'
import { MovementComponent } from '../components/Movement'
import { CombatComponent } from '../components/Combat'
import { AIComponent, AIPersonality } from '../components/AI'
import { Vector2Math, type Vector2 } from '../utils/Math'
import type { SpatialHashGrid } from '../utils/SpatialPartitioning'
import type { SpatialEntity } from '../utils/SpatialPartitioning'
import { GameEventType } from '../types/Events'

/**
 * Spawner query type
 */
type SpawnerEntityQuery = EntityQuery & {
  components: {
    spawner: SpawnerComponent
    transform: TransformComponent
  }
}

/**
 * Spawn system configuration
 */
export interface SpawnSystemConfig {
  maxGlobalEnemies: number
  maxEnemiesPerSpawner: number
  spawnUpdateInterval: number
  difficultyScaling: boolean
  bossSpawnEnabled: boolean
  dynamicDifficulty: boolean
  performanceMode: boolean
}

/**
 * Difficulty scaling parameters
 */
interface DifficultyParams {
  playerLevel: number
  survivalTime: number
  enemiesKilled: number
  bossesDefeated: string[]
  difficultyMultiplier: number
  [key: string]: unknown
}

/**
 * Spawn System handles enemy spawning, wave management, and difficulty scaling
 */
export class SpawnSystem extends System {
  readonly name = 'spawn'
  readonly requiredComponents: ComponentType[] = ['spawner', 'transform']

  private config: SpawnSystemConfig
  private spatialGrid: SpatialHashGrid
  private eventSystem?: {
    emit: (eventType: string, data: unknown) => void
    on: (eventType: string, callback: (event: unknown) => void) => void
  }
  private world?: {
    createEntity: () => { id: EntityId; addComponent: (comp: unknown) => void }
    getEntity?: (id: EntityId) => any
    getEntitiesWithComponents: (components: string[]) => unknown[]
    removeEntity: (id: EntityId) => void
  }

  // Global spawn tracking
  private globalEnemyCount: number = 0
  private totalEnemiesSpawned: number = 0
  private enemiesKilledThisWave: number = 0
  private activeSpawners: Set<EntityId> = new Set()

  // Difficulty tracking
  private currentDifficulty: DifficultyParams = {
    playerLevel: 1,
    survivalTime: 0,
    enemiesKilled: 0,
    bossesDefeated: [],
    difficultyMultiplier: 1.0,
  }

  // Performance tracking
  private lastUpdateTime: number = 0
  private spawnsThisFrame: number = 0
  private maxSpawnsPerFrame: number = 10

  // Boss management
  private activeBosses: Map<EntityId, string> = new Map()
  private bossPhaseTransitions: Map<EntityId, number> = new Map()

  constructor(
    spatialGrid: SpatialHashGrid,
    config: Partial<SpawnSystemConfig> = {},
    eventSystem?: {
      emit: (eventType: string, data: unknown) => void
      on: (eventType: string, callback: (event: unknown) => void) => void
    },
    world?: {
      createEntity: () => {
        id: EntityId
        addComponent: (comp: unknown) => void
      }
      getEntity?: (id: EntityId) => any
      getEntitiesWithComponents: (components: string[]) => unknown[]
      removeEntity: (id: EntityId) => void
    }
  ) {
    super()
    this.spatialGrid = spatialGrid
    this.eventSystem = eventSystem
    this.world = world

    this.config = {
      maxGlobalEnemies: 500,
      maxEnemiesPerSpawner: 50,
      spawnUpdateInterval: 100,
      difficultyScaling: true,
      bossSpawnEnabled: true,
      dynamicDifficulty: true,
      performanceMode: false,
      ...config,
    }
  }

  initialize(): void {
    if (this.eventSystem) {
      // Listen for game events
      this.eventSystem.on(
        GameEventType.ENTITY_KILLED,
        this.handleEntityKilled.bind(this)
      )
      this.eventSystem.on(GameEventType.LEVEL_UP, this.handleLevelUp.bind(this))
      this.eventSystem.on(
        'BOSS_PHASE_CHANGE',
        this.handleBossPhaseChange.bind(this)
      )
      this.eventSystem.on('WAVE_COMPLETE', this.handleWaveComplete.bind(this))
    }
  }

  update(context: SystemUpdateContext, entities: EntityQuery[]): void {
    const spawnerEntities = entities as SpawnerEntityQuery[]
    const currentTime = context.totalTime

    // Update survival time for difficulty
    this.currentDifficulty.survivalTime = currentTime

    // Reset frame counters
    this.spawnsThisFrame = 0

    // Update global enemy count
    this.updateGlobalEnemyCount()

    // Process each spawner
    spawnerEntities.forEach((spawner) => {
      if (
        this.config.performanceMode &&
        this.spawnsThisFrame >= this.maxSpawnsPerFrame
      ) {
        return
      }

      this.updateSpawner(spawner, currentTime, context)
    })

    // Update difficulty if enabled
    if (
      this.config.dynamicDifficulty &&
      currentTime - this.lastUpdateTime > 10000
    ) {
      this.updateDynamicDifficulty()
      this.lastUpdateTime = currentTime
    }

    // Emit spawn statistics
    if (this.eventSystem && currentTime % 5000 < context.deltaTime) {
      this.eventSystem.emit('SPAWN_STATS', this.getStats())
    }
  }

  /**
   * Updates a single spawner
   */
  private updateSpawner(
    spawner: SpawnerEntityQuery,
    currentTime: number,
    context: SystemUpdateContext
  ): void {
    const spawnerComponent = spawner.components.spawner

    if (!spawnerComponent.active) return

    // Update spawn rates based on difficulty
    if (this.config.difficultyScaling) {
      spawnerComponent.updateSpawnRates(
        currentTime,
        this.currentDifficulty.playerLevel,
        this.currentDifficulty.survivalTime
      )
      spawnerComponent.difficultyMultiplier =
        this.currentDifficulty.difficultyMultiplier
    }

    // Try to start next wave
    if (spawnerComponent.spawnTiming === SpawnTiming.WAVE) {
      spawnerComponent.tryStartNextWave(currentTime, this.currentDifficulty)
    }

    // Update current wave progress
    spawnerComponent.updateWave(currentTime)

    // Process spawning
    if (spawnerComponent.shouldSpawn(currentTime)) {
      this.processSpawning(spawner, currentTime)
    }

    // Handle boss spawning
    if (
      this.config.bossSpawnEnabled &&
      spawnerComponent.spawnTiming === SpawnTiming.BOSS
    ) {
      this.processBossSpawning(spawner, currentTime)
    }

    // Mark spawner as active
    this.activeSpawners.add(spawner.id)
  }

  /**
   * Processes regular enemy spawning
   */
  private processSpawning(
    spawner: SpawnerEntityQuery,
    currentTime: number
  ): void {
    const spawnerComponent = spawner.components.spawner

    // Check global limits
    if (this.globalEnemyCount >= this.config.maxGlobalEnemies) return
    if (
      spawnerComponent.currentActiveEnemies >= this.config.maxEnemiesPerSpawner
    )
      return

    // Check spawn budget
    if (this.spawnsThisFrame >= spawnerComponent.spawnBudget) return

    // Select enemy type based on current difficulty
    const enemyType = spawnerComponent.selectEnemyType(
      this.currentDifficulty.playerLevel
    )
    if (!enemyType) return

    // Calculate spawn position
    const spawnPosition = spawnerComponent.calculateSpawnPosition()

    // Check if position is valid (not too close to player or other enemies)
    if (!this.isValidSpawnPosition(spawnPosition, enemyType)) return

    // Create enemy entity
    const enemy = this.createEnemy(enemyType, spawnPosition, spawner.id)
    if (!enemy) return

    // Record spawn
    spawnerComponent.recordSpawn(
      enemy.id,
      enemyType.id,
      spawnPosition,
      currentTime
    )
    this.globalEnemyCount++
    this.totalEnemiesSpawned++
    this.spawnsThisFrame++

    // Emit spawn event
    if (this.eventSystem) {
      this.eventSystem.emit(GameEventType.ENEMY_SPAWNED, {
        entityId: enemy.id,
        enemyType: enemyType.id,
        position: spawnPosition,
        spawnerId: spawner.id,
        timestamp: currentTime,
      })
    }
  }

  /**
   * Processes boss spawning
   */
  private processBossSpawning(
    spawner: SpawnerEntityQuery,
    currentTime: number
  ): void {
    const spawnerComponent = spawner.components.spawner

    // Check if boss already exists
    if (
      spawnerComponent.bossEntityId &&
      this.activeBosses.has(spawnerComponent.bossEntityId)
    ) {
      return
    }

    // Check boss spawn conditions
    if (!this.checkBossSpawnConditions()) return

    // Get boss type (first enemy type is assumed to be boss)
    const bossType = spawnerComponent.enemyTypes[0]
    if (!bossType) return

    // Create boss at spawner location
    const bossPosition = spawner.components.transform.position
    const boss = this.createBoss(bossType, bossPosition, spawner.id)
    if (!boss) return

    // Track boss
    spawnerComponent.bossEntityId = boss.id
    this.activeBosses.set(boss.id, bossType.id)
    this.bossPhaseTransitions.set(boss.id, 0)

    // Emit boss spawn event
    if (this.eventSystem) {
      this.eventSystem.emit('BOSS_SPAWNED', {
        entityId: boss.id,
        bossType: bossType.id,
        position: bossPosition,
        spawnerId: spawner.id,
        timestamp: currentTime,
      })
    }
  }

  /**
   * Creates a regular enemy entity
   */
  private createEnemy(
    enemyType: EnemyType,
    position: Vector2,
    spawnerId: EntityId
  ): EntityQuery | null {
    if (!this.world) return null

    const entity = this.world.createEntity()

    // Add transform component
    const transform = new TransformComponent(position.x, position.y)
    entity.addComponent(transform)

    // Add health component with scaling
    const baseHealth = 100
    const scaledHealth = this.scaleValue(
      baseHealth,
      enemyType.scalingFactors?.health || 1
    )
    const health = new HealthComponent(scaledHealth)
    entity.addComponent(health)

    // Add movement component
    const baseSpeed = 50
    const scaledSpeed = this.scaleValue(
      baseSpeed,
      enemyType.scalingFactors?.speed || 1
    )
    const movement = new MovementComponent(scaledSpeed)
    entity.addComponent(movement)

    // Add combat component
    const baseDamage = 10
    const scaledDamage = this.scaleValue(
      baseDamage,
      enemyType.scalingFactors?.damage || 1
    )
    const combat = new CombatComponent({
      damage: scaledDamage,
      attackSpeed: 1.0,
      range: 50,
      criticalChance: 0.1,
      criticalMultiplier: 1.5,
    })
    entity.addComponent(combat)

    // Add AI component based on enemy type
    const aiPersonality = this.getAIPersonalityForType(enemyType.id)
    const ai = new AIComponent(aiPersonality)

    // Configure AI based on enemy type
    this.configureAIForType(ai, enemyType)
    entity.addComponent(ai)

    // Add custom components from enemy type template
    enemyType.components.forEach((template) => {
      if (
        ['transform', 'health', 'movement', 'combat', 'ai'].includes(
          template.type
        )
      ) {
        return // Skip components we've already added
      }

      // Create component from template
      const component = this.createComponentFromTemplate(template, enemyType)
      if (component) {
        entity.addComponent(component)
      }
    })

    return entity as unknown as EntityQuery
  }

  /**
   * Creates a boss entity
   */
  private createBoss(
    bossType: EnemyType,
    position: Vector2,
    spawnerId: EntityId
  ): EntityQuery | null {
    if (!this.world) return null

    const entity = this.world.createEntity()

    // Add transform component
    const transform = new TransformComponent(position.x, position.y)
    entity.addComponent(transform)

    // Add health component with boss scaling
    const baseHealth = 1000
    const scaledHealth = this.scaleValue(
      baseHealth,
      bossType.scalingFactors?.health || 5
    )
    const health = new HealthComponent(scaledHealth)
    entity.addComponent(health)

    // Add movement component (bosses are slower)
    const baseSpeed = 30
    const scaledSpeed = this.scaleValue(
      baseSpeed,
      bossType.scalingFactors?.speed || 0.8
    )
    const movement = new MovementComponent(scaledSpeed)
    entity.addComponent(movement)

    // Add combat component with boss stats
    const baseDamage = 50
    const scaledDamage = this.scaleValue(
      baseDamage,
      bossType.scalingFactors?.damage || 3
    )
    const combat = new CombatComponent({
      damage: scaledDamage,
      attackSpeed: 0.5,
      range: 100,
      criticalChance: 0.25,
      criticalMultiplier: 2.0,
    })
    entity.addComponent(combat)

    // Add AI component with boss personality
    const ai = new AIComponent(AIPersonality.BERSERKER)
    ai.sightRange = 400
    ai.attackRange = 100
    ai.moveSpeed = 0.8
    ai.fearLevel = 0
    ai.aggressionLevel = 1.0
    entity.addComponent(ai)

    return entity as unknown as EntityQuery
  }

  /**
   * Gets AI personality based on enemy type
   */
  private getAIPersonalityForType(enemyTypeId: string): AIPersonality {
    const typeMap: Record<string, AIPersonality> = {
      basic_melee: AIPersonality.AGGRESSIVE,
      basic_ranged: AIPersonality.DEFENSIVE,
      fast_scout: AIPersonality.HUNTER,
      tank: AIPersonality.GUARDIAN,
      healer: AIPersonality.SUPPORT,
      swarm: AIPersonality.SWARM,
      elite: AIPersonality.TACTICAL,
      coward: AIPersonality.COWARD,
      berserker: AIPersonality.BERSERKER,
    }

    return typeMap[enemyTypeId] || AIPersonality.AGGRESSIVE
  }

  /**
   * Configures AI component based on enemy type
   */
  private configureAIForType(ai: AIComponent, enemyType: EnemyType): void {
    // Configure based on enemy type ID
    switch (enemyType.id) {
      case 'basic_melee':
        ai.sightRange = 150
        ai.attackRange = 40
        ai.moveSpeed = 1.0
        break

      case 'basic_ranged':
        ai.sightRange = 200
        ai.attackRange = 150
        ai.moveSpeed = 0.8
        ai.preferredDistance = 120
        break

      case 'fast_scout':
        ai.sightRange = 250
        ai.attackRange = 30
        ai.moveSpeed = 1.5
        ai.curiosity = 0.8
        break

      case 'tank':
        ai.sightRange = 100
        ai.attackRange = 50
        ai.moveSpeed = 0.6
        ai.fearLevel = 0.1
        break

      case 'swarm':
        ai.sightRange = 120
        ai.attackRange = 30
        ai.moveSpeed = 1.2
        ai.loyalty = 0.9
        break

      case 'elite':
        ai.sightRange = 200
        ai.attackRange = 60
        ai.moveSpeed = 1.1
        ai.updateInterval = 50 // Faster AI updates
        break
    }

    // Apply level-based modifiers
    const levelModifier = 1 + (enemyType.minLevel - 1) * 0.05
    ai.sightRange *= levelModifier
    ai.moveSpeed *= levelModifier
  }

  /**
   * Creates component from template
   */
  private createComponentFromTemplate(
    template: any,
    enemyType: EnemyType
  ): any {
    // This would create components based on template data
    // For now, return null as we handle core components manually
    return null
  }

  /**
   * Scales a value based on difficulty
   */
  private scaleValue(baseValue: number, scalingFactor: number): number {
    return (
      baseValue * scalingFactor * this.currentDifficulty.difficultyMultiplier
    )
  }

  /**
   * Checks if spawn position is valid
   */
  private isValidSpawnPosition(
    position: Vector2,
    enemyType: EnemyType
  ): boolean {
    // Check distance from player
    const nearbyEntityIds = this.spatialGrid.query({
      position,
      radius: 50,
    })

    const nearbyEntities = nearbyEntityIds
      .map((id) => this.world?.getEntity?.(id))
      .filter((e) => e != null)

    for (const entity of nearbyEntities) {
      const hasAI = entity.hasComponent('ai')
      if (!hasAI) {
        // Assume non-AI entities are players
        return false // Too close to player
      }
    }

    // Check density (prevent overcrowding)
    const nearbyEnemies = nearbyEntities.filter((e: any) =>
      e.hasComponent('ai')
    )
    if (nearbyEnemies.length > 5) {
      return false // Too crowded
    }

    return true
  }

  /**
   * Checks if boss should spawn
   */
  private checkBossSpawnConditions(): boolean {
    // Don't spawn if boss already active
    if (this.activeBosses.size > 0) return false

    // Check survival time
    if (this.currentDifficulty.survivalTime < 120000) return false // 2 minutes

    // Check enemies killed
    if (this.currentDifficulty.enemiesKilled < 100) return false

    return true
  }

  /**
   * Updates global enemy count
   */
  private updateGlobalEnemyCount(): void {
    if (!this.world) return

    const enemies = this.world.getEntitiesWithComponents(['ai', 'health'])
    this.globalEnemyCount = enemies.filter((e: any) => {
      const health = e.getComponent('health') as HealthComponent
      return health && !health.isDead()
    }).length
  }

  /**
   * Updates dynamic difficulty
   */
  private updateDynamicDifficulty(): void {
    // Calculate performance metrics
    const killRate =
      this.enemiesKilledThisWave / (this.currentDifficulty.survivalTime / 1000)
    const survivalMinutes = this.currentDifficulty.survivalTime / 60000

    // Adjust difficulty based on performance
    if (killRate > 2) {
      // Player is doing well, increase difficulty
      this.currentDifficulty.difficultyMultiplier *= 1.1
    } else if (killRate < 0.5) {
      // Player is struggling, decrease difficulty
      this.currentDifficulty.difficultyMultiplier *= 0.9
    }

    // Add time-based difficulty increase
    this.currentDifficulty.difficultyMultiplier += survivalMinutes * 0.05

    // Clamp difficulty
    this.currentDifficulty.difficultyMultiplier = Math.max(
      0.5,
      Math.min(5.0, this.currentDifficulty.difficultyMultiplier)
    )
  }

  /**
   * Handles entity killed event
   */
  private handleEntityKilled(event: any): void {
    const { entityId, killerType } = event.data

    // Update enemy counts
    if (this.world) {
      const entity = this.world.getEntity?.(entityId)
      if (entity?.hasComponent('ai')) {
        this.globalEnemyCount--
        this.currentDifficulty.enemiesKilled++
        this.enemiesKilledThisWave++

        // Check if boss
        if (this.activeBosses.has(entityId)) {
          const bossType = this.activeBosses.get(entityId)!
          this.activeBosses.delete(entityId)
          this.bossPhaseTransitions.delete(entityId)
          this.currentDifficulty.bossesDefeated.push(bossType)

          if (this.eventSystem) {
            this.eventSystem.emit('BOSS_DEFEATED', {
              bossType,
              entityId,
              timestamp: Date.now(),
            })
          }
        }

        // Update spawner counts
        this.activeSpawners.forEach((spawnerId) => {
          const spawner = this.world!.getEntity?.(spawnerId)
          if (spawner) {
            const spawnerComponent = spawner.getComponent(
              'spawner'
            ) as SpawnerComponent
            spawnerComponent.recordEnemyDeath(entityId)
          }
        })
      }
    }
  }

  /**
   * Handles level up event
   */
  private handleLevelUp(event: any): void {
    const { level } = event.data
    this.currentDifficulty.playerLevel = level
  }

  /**
   * Handles boss phase change
   */
  private handleBossPhaseChange(event: any): void {
    const { entityId, phase } = event.data

    if (this.bossPhaseTransitions.has(entityId)) {
      this.bossPhaseTransitions.set(entityId, phase)

      // Spawn adds for boss phase
      if (this.world) {
        const boss = this.world.getEntity?.(entityId)
        if (boss) {
          const transform = boss.getComponent('transform') as TransformComponent
          this.spawnBossAdds(entityId, transform.position, phase)
        }
      }
    }
  }

  /**
   * Handles wave complete event
   */
  private handleWaveComplete(event: any): void {
    this.enemiesKilledThisWave = 0

    if (this.eventSystem) {
      this.eventSystem.emit('SPAWN_WAVE_STATS', {
        totalSpawned: this.totalEnemiesSpawned,
        enemiesKilled: this.currentDifficulty.enemiesKilled,
        currentDifficulty: this.currentDifficulty.difficultyMultiplier,
      })
    }
  }

  /**
   * Spawns boss adds during phase transitions
   */
  private spawnBossAdds(
    bossId: EntityId,
    bossPosition: Vector2,
    phase: number
  ): void {
    const addCount = 3 + phase * 2
    const addType: EnemyType = {
      id: 'boss_add',
      name: 'Boss Minion',
      weight: 1,
      minLevel: 1,
      maxLevel: 99,
      components: [],
      scalingFactors: { health: 0.5, damage: 0.8, speed: 1.2, experience: 0.5 },
    }

    for (let i = 0; i < addCount; i++) {
      const angle = (i / addCount) * Math.PI * 2
      const distance = 100
      const position = {
        x: bossPosition.x + Math.cos(angle) * distance,
        y: bossPosition.y + Math.sin(angle) * distance,
      }

      this.createEnemy(addType, position, bossId)
    }
  }

  /**
   * Creates a spawner entity
   */
  createSpawner(
    position: Vector2,
    config: Partial<SpawnerComponent>
  ): EntityQuery | null {
    if (!this.world) return null

    const entity = this.world.createEntity()

    const transform = new TransformComponent(position.x, position.y)
    entity.addComponent(transform)

    const spawner = new SpawnerComponent({
      center: position,
      radius: 200,
      ...config.spawnArea,
    })

    // Apply config
    Object.assign(spawner, config)

    entity.addComponent(spawner)

    return entity as unknown as EntityQuery
  }

  /**
   * Gets spawn system statistics
   */
  getStats(): Record<string, unknown> {
    return {
      globalEnemyCount: this.globalEnemyCount,
      maxGlobalEnemies: this.config.maxGlobalEnemies,
      totalEnemiesSpawned: this.totalEnemiesSpawned,
      enemiesKilled: this.currentDifficulty.enemiesKilled,
      activeSpawners: this.activeSpawners.size,
      activeBosses: this.activeBosses.size,
      currentDifficulty: this.currentDifficulty.difficultyMultiplier,
      playerLevel: this.currentDifficulty.playerLevel,
      survivalTime: this.currentDifficulty.survivalTime,
      bossesDefeated: this.currentDifficulty.bossesDefeated,
    }
  }
}

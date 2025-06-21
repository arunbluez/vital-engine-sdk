import { Component } from '../core/ECS/Component'
import type { EntityId } from '../types/CoreTypes'
import type { Vector2 } from '../utils/Math'

/**
 * Spawn pattern types
 */
export enum SpawnPattern {
  RANDOM = 'random', // Random positions within area
  CIRCLE = 'circle', // Around a center point
  LINE = 'line', // Along a line
  GRID = 'grid', // Grid formation
  WAVE = 'wave', // Wave formation
  PERIMETER = 'perimeter', // Around map edges
  PORTAL = 'portal', // From specific points
}

/**
 * Spawn timing types
 */
export enum SpawnTiming {
  CONTINUOUS = 'continuous', // Constant spawning
  WAVE = 'wave', // Discrete waves
  TRIGGERED = 'triggered', // Event-based spawning
  BOSS = 'boss', // Boss encounter spawning
  REINFORCEMENT = 'reinforcement', // Spawn when allies are low
}

/**
 * Enemy type definition for spawning
 */
export interface EnemyType {
  id: string
  name: string
  weight: number // Spawn probability weight
  minLevel: number // Minimum level to spawn
  maxLevel: number // Maximum level to spawn
  components: ComponentTemplate[]
  scalingFactors?: ScalingFactors
}

/**
 * Component template for creating entities
 */
export interface ComponentTemplate {
  type: string
  data: Record<string, unknown>
}

/**
 * Scaling factors for enemy stats
 */
export interface ScalingFactors {
  health: number
  damage: number
  speed: number
  experience: number
}

/**
 * Spawn wave definition
 */
export interface SpawnWave {
  id: string
  enemyTypes: string[] // Enemy type IDs to spawn
  totalCount: number // Total enemies in wave
  spawnRate: number // Enemies per second
  pattern: SpawnPattern
  area: SpawnArea
  delay: number // Delay before wave starts (ms)
  requirements?: WaveRequirement[]
}

/**
 * Wave requirement definition
 */
export interface WaveRequirement {
  type: 'time' | 'level' | 'previous_wave' | 'enemy_count' | 'boss_defeated'
  value: number | string
  operator: '>' | '>=' | '=' | '<' | '<='
}

/**
 * Spawn area definition
 */
export interface SpawnArea {
  center: Vector2
  radius?: number // For circle patterns
  width?: number // For grid/line patterns
  height?: number // For grid patterns
  points?: Vector2[] // For custom patterns
}

/**
 * Spawn event for tracking
 */
export interface SpawnEvent {
  entityId: EntityId
  enemyType: string
  position: Vector2
  timestamp: number
  waveId?: string
}

/**
 * Boss phase definition
 */
export interface BossPhase {
  id: string
  healthThreshold: number // Health % to trigger phase
  enemyTypes: string[] // Enemies to spawn in this phase
  spawnCount: number // Number to spawn
  pattern: SpawnPattern
  special?: boolean // Special abilities active
}

/**
 * Spawner component for managing enemy creation
 */
export class SpawnerComponent extends Component {
  readonly type = 'spawner'

  // Core spawning properties
  public active: boolean = true
  public spawnTiming: SpawnTiming = SpawnTiming.CONTINUOUS
  public spawnPattern: SpawnPattern = SpawnPattern.RANDOM
  public spawnArea: SpawnArea

  // Enemy configuration
  public enemyTypes: EnemyType[] = []
  public levelRange: { min: number; max: number } = { min: 1, max: 10 }
  public difficultyMultiplier: number = 1.0

  // Spawn rates and limits
  public baseSpawnRate: number = 1.0 // Enemies per second
  public currentSpawnRate: number = 1.0
  public maxActiveEnemies: number = 50
  public currentActiveEnemies: number = 0
  public totalSpawned: number = 0

  // Wave system
  public waves: SpawnWave[] = []
  public currentWaveIndex: number = 0
  public currentWave: SpawnWave | null = null
  public waveProgress: number = 0
  public waveStartTime: number = 0
  public timeBetweenWaves: number = 5000 // 5 seconds

  // Boss spawning
  public bossPhases: BossPhase[] = []
  public currentBossPhase: number = 0
  public bossEntityId: EntityId | null = null

  // Timing
  public lastSpawnTime: number = 0
  public nextSpawnTime: number = 0
  public spawnCooldown: number = 1000 // Base cooldown between spawns

  // Scaling
  public timeMultiplier: number = 1.0 // Increases over time
  public levelMultiplier: number = 1.0 // Based on player level
  public survivalMultiplier: number = 1.0 // Based on survival time

  // Spawn history
  public spawnHistory: SpawnEvent[] = []
  public maxHistorySize: number = 100

  // Performance optimization
  public updateInterval: number = 500 // Update every 500ms
  public lastUpdateTime: number = 0
  public spawnBudget: number = 5 // Max spawns per update cycle

  constructor(spawnArea: SpawnArea) {
    super()
    this.spawnArea = spawnArea
    this.calculateNextSpawnTime()
  }

  /**
   * Adds an enemy type to the spawn pool
   */
  addEnemyType(enemyType: EnemyType): void {
    this.enemyTypes.push(enemyType)
  }

  /**
   * Removes an enemy type from the spawn pool
   */
  removeEnemyType(enemyTypeId: string): void {
    this.enemyTypes = this.enemyTypes.filter((type) => type.id !== enemyTypeId)
  }

  /**
   * Adds a spawn wave
   */
  addWave(wave: SpawnWave): void {
    this.waves.push(wave)
  }

  /**
   * Starts the next wave if conditions are met
   */
  tryStartNextWave(
    currentTime: number,
    gameState: Record<string, unknown>
  ): boolean {
    if (this.currentWave) {
      return false // Wave already active
    }

    if (this.currentWaveIndex >= this.waves.length) {
      return false // No more waves
    }

    const nextWave = this.waves[this.currentWaveIndex]

    // Check wave requirements
    if (nextWave.requirements) {
      const meetsRequirements = nextWave.requirements.every((req) =>
        this.checkWaveRequirement(req, gameState, currentTime)
      )
      if (!meetsRequirements) {
        return false
      }
    }

    // Start the wave
    this.currentWave = nextWave
    this.waveStartTime = currentTime + nextWave.delay
    this.waveProgress = 0
    this.currentWaveIndex++

    return true
  }

  /**
   * Checks if a wave requirement is met
   */
  private checkWaveRequirement(
    requirement: WaveRequirement,
    gameState: Record<string, unknown>,
    currentTime: number
  ): boolean {
    switch (requirement.type) {
      case 'time':
        const timeValue = currentTime - ((gameState.startTime as number) || 0)
        return this.compareValues(
          timeValue,
          requirement.operator,
          requirement.value as number
        )

      case 'level':
        const playerLevel = (gameState.playerLevel as number) || 1
        return this.compareValues(
          playerLevel,
          requirement.operator,
          requirement.value as number
        )

      case 'previous_wave':
        return this.currentWaveIndex > 0

      case 'enemy_count':
        return this.compareValues(
          this.currentActiveEnemies,
          requirement.operator,
          requirement.value as number
        )

      case 'boss_defeated':
        return (
          (gameState.bossesDefeated as string[] | undefined)?.includes(
            requirement.value as string
          ) ?? false
        )

      default:
        return true
    }
  }

  /**
   * Helper method for requirement comparison
   */
  private compareValues(
    actual: number,
    operator: string,
    expected: number
  ): boolean {
    switch (operator) {
      case '>':
        return actual > expected
      case '>=':
        return actual >= expected
      case '=':
        return actual === expected
      case '<':
        return actual < expected
      case '<=':
        return actual <= expected
      default:
        return false
    }
  }

  /**
   * Updates wave progress
   */
  updateWave(currentTime: number): void {
    if (!this.currentWave || currentTime < this.waveStartTime) {
      return
    }

    const timeInWave = currentTime - this.waveStartTime
    const expectedProgress = (timeInWave / 1000) * this.currentWave.spawnRate

    this.waveProgress = Math.min(expectedProgress, this.currentWave.totalCount)

    // Check if wave is complete
    if (this.waveProgress >= this.currentWave.totalCount) {
      this.completeWave()
    }
  }

  /**
   * Completes the current wave
   */
  private completeWave(): void {
    this.currentWave = null
    this.waveProgress = 0
    this.waveStartTime = 0
  }

  /**
   * Selects a random enemy type based on weights and level
   */
  selectEnemyType(currentLevel: number): EnemyType | null {
    const validTypes = this.enemyTypes.filter(
      (type) => currentLevel >= type.minLevel && currentLevel <= type.maxLevel
    )

    if (validTypes.length === 0) {
      return null
    }

    const totalWeight = validTypes.reduce((sum, type) => sum + type.weight, 0)
    let random = Math.random() * totalWeight

    for (const type of validTypes) {
      random -= type.weight
      if (random <= 0) {
        return type
      }
    }

    return validTypes[validTypes.length - 1] // Fallback
  }

  /**
   * Calculates spawn position based on pattern and area
   */
  calculateSpawnPosition(pattern?: SpawnPattern): Vector2 {
    const currentPattern = pattern || this.spawnPattern
    const area = this.spawnArea

    switch (currentPattern) {
      case SpawnPattern.RANDOM:
        return this.randomPositionInArea(area)

      case SpawnPattern.CIRCLE:
        return this.circularSpawnPosition(area)

      case SpawnPattern.PERIMETER:
        return this.perimeterSpawnPosition(area)

      case SpawnPattern.LINE:
        return this.lineSpawnPosition(area)

      case SpawnPattern.GRID:
        return this.gridSpawnPosition(area)

      case SpawnPattern.PORTAL:
        return this.portalSpawnPosition(area)

      default:
        return { ...area.center }
    }
  }

  /**
   * Random position within the spawn area
   */
  private randomPositionInArea(area: SpawnArea): Vector2 {
    if (area.radius) {
      const angle = Math.random() * Math.PI * 2
      const distance = Math.random() * area.radius
      return {
        x: area.center.x + Math.cos(angle) * distance,
        y: area.center.y + Math.sin(angle) * distance,
      }
    }

    const width = area.width || 100
    const height = area.height || 100
    return {
      x: area.center.x + (Math.random() - 0.5) * width,
      y: area.center.y + (Math.random() - 0.5) * height,
    }
  }

  /**
   * Circular spawn position (around perimeter)
   */
  private circularSpawnPosition(area: SpawnArea): Vector2 {
    const angle = Math.random() * Math.PI * 2
    const radius = area.radius || 100
    return {
      x: area.center.x + Math.cos(angle) * radius,
      y: area.center.y + Math.sin(angle) * radius,
    }
  }

  /**
   * Perimeter spawn position
   */
  private perimeterSpawnPosition(area: SpawnArea): Vector2 {
    const width = area.width || 200
    const height = area.height || 200
    const side = Math.floor(Math.random() * 4)

    switch (side) {
      case 0: // Top
        return {
          x: area.center.x + (Math.random() - 0.5) * width,
          y: area.center.y - height / 2,
        }
      case 1: // Right
        return {
          x: area.center.x + width / 2,
          y: area.center.y + (Math.random() - 0.5) * height,
        }
      case 2: // Bottom
        return {
          x: area.center.x + (Math.random() - 0.5) * width,
          y: area.center.y + height / 2,
        }
      case 3: // Left
        return {
          x: area.center.x - width / 2,
          y: area.center.y + (Math.random() - 0.5) * height,
        }
      default:
        return { ...area.center }
    }
  }

  /**
   * Line spawn position
   */
  private lineSpawnPosition(area: SpawnArea): Vector2 {
    const width = area.width || 100
    const offset = (Math.random() - 0.5) * width
    return {
      x: area.center.x + offset,
      y: area.center.y,
    }
  }

  /**
   * Grid spawn position
   */
  private gridSpawnPosition(area: SpawnArea): Vector2 {
    const width = area.width || 100
    const height = area.height || 100
    const gridSize = 5

    const gridX = Math.floor(Math.random() * gridSize)
    const gridY = Math.floor(Math.random() * gridSize)

    return {
      x: area.center.x - width / 2 + (gridX / (gridSize - 1)) * width,
      y: area.center.y - height / 2 + (gridY / (gridSize - 1)) * height,
    }
  }

  /**
   * Portal spawn position (from predefined points)
   */
  private portalSpawnPosition(area: SpawnArea): Vector2 {
    if (area.points && area.points.length > 0) {
      const randomIndex = Math.floor(Math.random() * area.points.length)
      return { ...area.points[randomIndex] }
    }
    return { ...area.center }
  }

  /**
   * Calculates the next spawn time
   */
  calculateNextSpawnTime(): void {
    const baseInterval = 1000 / this.currentSpawnRate
    const jitter = baseInterval * 0.2 * (Math.random() - 0.5) // ±10% jitter
    this.nextSpawnTime = this.lastSpawnTime + baseInterval + jitter
  }

  /**
   * Checks if spawner should spawn now
   */
  shouldSpawn(currentTime: number): boolean {
    if (!this.active || this.currentActiveEnemies >= this.maxActiveEnemies) {
      return false
    }

    if (this.spawnTiming === SpawnTiming.WAVE && !this.currentWave) {
      return false
    }

    return currentTime >= this.nextSpawnTime
  }

  /**
   * Records a spawn event
   */
  recordSpawn(
    entityId: EntityId,
    enemyType: string,
    position: Vector2,
    currentTime: number
  ): void {
    const spawnEvent: SpawnEvent = {
      entityId,
      enemyType,
      position: { ...position },
      timestamp: currentTime,
      waveId: this.currentWave?.id,
    }

    this.spawnHistory.push(spawnEvent)

    // Trim history if too large
    if (this.spawnHistory.length > this.maxHistorySize) {
      this.spawnHistory.shift()
    }

    this.totalSpawned++
    this.currentActiveEnemies++
    this.lastSpawnTime = currentTime
    this.calculateNextSpawnTime()
  }

  /**
   * Records enemy death (decreases active count)
   */
  recordEnemyDeath(entityId: EntityId): void {
    this.currentActiveEnemies = Math.max(0, this.currentActiveEnemies - 1)

    // Remove from history if needed
    const historyIndex = this.spawnHistory.findIndex(
      (event) => event.entityId === entityId
    )
    if (historyIndex !== -1) {
      this.spawnHistory.splice(historyIndex, 1)
    }
  }

  /**
   * Updates spawn rates based on game progression
   */
  updateSpawnRates(
    gameTime: number,
    playerLevel: number,
    survivalTime: number
  ): void {
    // Time-based scaling
    this.timeMultiplier = 1 + (gameTime / 60000) * 0.1 // +10% per minute

    // Level-based scaling
    this.levelMultiplier = 1 + (playerLevel - 1) * 0.05 // +5% per level

    // Survival-based scaling
    this.survivalMultiplier = 1 + (survivalTime / 120000) * 0.15 // +15% per 2 minutes

    // Calculate final spawn rate
    const totalMultiplier =
      this.timeMultiplier *
      this.levelMultiplier *
      this.survivalMultiplier *
      this.difficultyMultiplier
    this.currentSpawnRate = this.baseSpawnRate * totalMultiplier
  }

  /**
   * Gets spawn statistics
   */
  getSpawnStats(): Record<string, unknown> {
    return {
      totalSpawned: this.totalSpawned,
      currentActive: this.currentActiveEnemies,
      maxActive: this.maxActiveEnemies,
      currentSpawnRate: this.currentSpawnRate,
      currentWave: this.currentWave?.id,
      waveProgress: this.waveProgress,
      timeMultiplier: this.timeMultiplier,
      levelMultiplier: this.levelMultiplier,
      survivalMultiplier: this.survivalMultiplier,
    }
  }

  clone(): SpawnerComponent {
    const clone = new SpawnerComponent({
      ...this.spawnArea,
      center: { ...this.spawnArea.center },
    })

    clone.active = this.active
    clone.spawnTiming = this.spawnTiming
    clone.spawnPattern = this.spawnPattern

    clone.enemyTypes = this.enemyTypes.map((type) => ({
      ...type,
      components: type.components.map((comp) => ({
        ...comp,
        data: { ...comp.data },
      })),
      scalingFactors: type.scalingFactors
        ? { ...type.scalingFactors }
        : undefined,
    }))
    clone.levelRange = { ...this.levelRange }
    clone.difficultyMultiplier = this.difficultyMultiplier

    clone.baseSpawnRate = this.baseSpawnRate
    clone.currentSpawnRate = this.currentSpawnRate
    clone.maxActiveEnemies = this.maxActiveEnemies
    clone.currentActiveEnemies = this.currentActiveEnemies
    clone.totalSpawned = this.totalSpawned

    clone.waves = this.waves.map((wave) => ({
      ...wave,
      area: { ...wave.area, center: { ...wave.area.center } },
      requirements: wave.requirements?.map((req) => ({ ...req })),
    }))
    clone.currentWaveIndex = this.currentWaveIndex
    clone.currentWave = this.currentWave ? { ...this.currentWave } : null
    clone.waveProgress = this.waveProgress
    clone.waveStartTime = this.waveStartTime
    clone.timeBetweenWaves = this.timeBetweenWaves

    clone.bossPhases = this.bossPhases.map((phase) => ({ ...phase }))
    clone.currentBossPhase = this.currentBossPhase
    clone.bossEntityId = this.bossEntityId

    clone.lastSpawnTime = this.lastSpawnTime
    clone.nextSpawnTime = this.nextSpawnTime
    clone.spawnCooldown = this.spawnCooldown

    clone.timeMultiplier = this.timeMultiplier
    clone.levelMultiplier = this.levelMultiplier
    clone.survivalMultiplier = this.survivalMultiplier

    clone.spawnHistory = this.spawnHistory.map((event) => ({
      ...event,
      position: { ...event.position },
    }))
    clone.maxHistorySize = this.maxHistorySize

    clone.updateInterval = this.updateInterval
    clone.lastUpdateTime = this.lastUpdateTime
    clone.spawnBudget = this.spawnBudget

    return clone
  }

  serialize(): Record<string, unknown> {
    return {
      active: this.active,
      spawnTiming: this.spawnTiming,
      spawnPattern: this.spawnPattern,
      spawnArea: this.spawnArea,

      enemyTypes: this.enemyTypes,
      levelRange: this.levelRange,
      difficultyMultiplier: this.difficultyMultiplier,

      baseSpawnRate: this.baseSpawnRate,
      currentSpawnRate: this.currentSpawnRate,
      maxActiveEnemies: this.maxActiveEnemies,
      currentActiveEnemies: this.currentActiveEnemies,
      totalSpawned: this.totalSpawned,

      waves: this.waves,
      currentWaveIndex: this.currentWaveIndex,
      currentWave: this.currentWave,
      waveProgress: this.waveProgress,
      waveStartTime: this.waveStartTime,
      timeBetweenWaves: this.timeBetweenWaves,

      bossPhases: this.bossPhases,
      currentBossPhase: this.currentBossPhase,
      bossEntityId: this.bossEntityId,

      lastSpawnTime: this.lastSpawnTime,
      nextSpawnTime: this.nextSpawnTime,
      spawnCooldown: this.spawnCooldown,

      timeMultiplier: this.timeMultiplier,
      levelMultiplier: this.levelMultiplier,
      survivalMultiplier: this.survivalMultiplier,

      spawnHistory: this.spawnHistory,
      maxHistorySize: this.maxHistorySize,

      updateInterval: this.updateInterval,
      lastUpdateTime: this.lastUpdateTime,
      spawnBudget: this.spawnBudget,
    }
  }

  deserialize(data: Record<string, unknown>): void {
    this.active = data.active as boolean
    this.spawnTiming = data.spawnTiming as SpawnTiming
    this.spawnPattern = data.spawnPattern as SpawnPattern
    this.spawnArea = data.spawnArea as SpawnArea

    this.enemyTypes = data.enemyTypes as EnemyType[]
    this.levelRange = data.levelRange as { min: number; max: number }
    this.difficultyMultiplier = data.difficultyMultiplier as number

    this.baseSpawnRate = data.baseSpawnRate as number
    this.currentSpawnRate = data.currentSpawnRate as number
    this.maxActiveEnemies = data.maxActiveEnemies as number
    this.currentActiveEnemies = data.currentActiveEnemies as number
    this.totalSpawned = data.totalSpawned as number

    this.waves = data.waves as SpawnWave[]
    this.currentWaveIndex = data.currentWaveIndex as number
    this.currentWave = data.currentWave as SpawnWave | null
    this.waveProgress = data.waveProgress as number
    this.waveStartTime = data.waveStartTime as number
    this.timeBetweenWaves = data.timeBetweenWaves as number

    this.bossPhases = data.bossPhases as BossPhase[]
    this.currentBossPhase = data.currentBossPhase as number
    this.bossEntityId = data.bossEntityId as EntityId | null

    this.lastSpawnTime = data.lastSpawnTime as number
    this.nextSpawnTime = data.nextSpawnTime as number
    this.spawnCooldown = data.spawnCooldown as number

    this.timeMultiplier = data.timeMultiplier as number
    this.levelMultiplier = data.levelMultiplier as number
    this.survivalMultiplier = data.survivalMultiplier as number

    this.spawnHistory = data.spawnHistory as SpawnEvent[]
    this.maxHistorySize = data.maxHistorySize as number

    this.updateInterval = data.updateInterval as number
    this.lastUpdateTime = data.lastUpdateTime as number
    this.spawnBudget = data.spawnBudget as number
  }
}

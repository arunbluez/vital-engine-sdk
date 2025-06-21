import { Component } from '../core/ECS/Component'

export type DifficultyLevel =
  | 'EASY'
  | 'NORMAL'
  | 'HARD'
  | 'EXTREME'
  | 'NIGHTMARE'

export type ScalingMetric =
  | 'SURVIVAL_TIME'
  | 'PLAYER_LEVEL'
  | 'ENEMIES_KILLED'
  | 'DAMAGE_DEALT'
  | 'DAMAGE_TAKEN'
  | 'SCORE'
  | 'COLLECTION_RATE'

export interface DifficultyModifier {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly targetProperty: string
  readonly scalingFunction: ScalingFunction
  readonly isActive: boolean
  readonly priority: number
  minValue?: number
  maxValue?: number
  conditions?: DifficultyCondition[]
}

export interface ScalingFunction {
  readonly type: 'LINEAR' | 'EXPONENTIAL' | 'LOGARITHMIC' | 'STEP' | 'CUSTOM'
  readonly baseValue: number
  readonly scalingFactor: number
  readonly threshold?: number
  readonly stepSize?: number
  readonly customFormula?: string
}

export interface DifficultyCondition {
  readonly metric: ScalingMetric
  readonly operator:
    | 'GREATER_THAN'
    | 'LESS_THAN'
    | 'EQUALS'
    | 'GREATER_EQUAL'
    | 'LESS_EQUAL'
  readonly value: number
  readonly isInverse?: boolean
}

export interface DifficultyBand {
  readonly level: DifficultyLevel
  readonly minScore: number
  readonly maxScore: number
  readonly name: string
  readonly description: string
  modifiers: DifficultyModifier[]
  readonly transitionThreshold: number
}

export interface PerformanceMetrics {
  survivalTime: number
  playerLevel: number
  enemiesKilled: number
  damageDealt: number
  damageTaken: number
  score: number
  collectionRate: number
  accuracy: number
  averageReactionTime: number
  skillActivations: number
  deathCount: number
  lastUpdateTime: number
}

export interface AdaptiveSettings {
  isEnabled: boolean
  adaptationRate: number
  adaptationInterval: number
  performanceWindowSize: number
  stabilityThreshold: number
  maxAdjustmentPerInterval: number
  targetPerformanceRange: { min: number; max: number }
  emergencyAdjustmentThreshold: number
}

export class DifficultyComponent extends Component {
  readonly type = 'difficulty'

  public currentLevel: DifficultyLevel = 'NORMAL'
  public currentScore: number = 100
  public targetScore: number = 100

  public performanceMetrics: PerformanceMetrics = {
    survivalTime: 0,
    playerLevel: 1,
    enemiesKilled: 0,
    damageDealt: 0,
    damageTaken: 0,
    score: 100,
    collectionRate: 0,
    accuracy: 1.0,
    averageReactionTime: 1000,
    skillActivations: 0,
    deathCount: 0,
    lastUpdateTime: Date.now(),
  }

  public difficultyBands: DifficultyBand[] = []
  public activeModifiers: Map<string, DifficultyModifier> = new Map()
  public modifierValues: Map<string, number> = new Map()

  public adaptiveSettings: AdaptiveSettings = {
    isEnabled: true,
    adaptationRate: 0.1,
    adaptationInterval: 5000,
    performanceWindowSize: 10,
    stabilityThreshold: 0.05,
    maxAdjustmentPerInterval: 0.2,
    targetPerformanceRange: { min: 0.6, max: 0.8 },
    emergencyAdjustmentThreshold: 0.3,
  }

  public performanceHistory: number[] = []
  public lastAdaptationTime: number = Date.now()
  public isStabilized: boolean = false

  constructor() {
    super()
    this.initializeDefaultBands()
  }

  private initializeDefaultBands(): void {
    this.difficultyBands = [
      {
        level: 'EASY',
        minScore: 0,
        maxScore: 50,
        name: 'Casual',
        description: 'Relaxed gameplay for new players',
        transitionThreshold: 60,
        modifiers: [
          {
            id: 'easy_enemy_health',
            name: 'Reduced Enemy Health',
            description: 'Enemies have less health',
            targetProperty: 'health.maxHealth',
            scalingFunction: {
              type: 'LINEAR',
              baseValue: 1.0,
              scalingFactor: -0.3,
            },
            isActive: true,
            priority: 1,
          },
          {
            id: 'easy_spawn_rate',
            name: 'Slower Spawning',
            description: 'Enemies spawn less frequently',
            targetProperty: 'spawner.spawnRate',
            scalingFunction: {
              type: 'LINEAR',
              baseValue: 1.0,
              scalingFactor: -0.4,
            },
            isActive: true,
            priority: 1,
          },
        ],
      },
      {
        level: 'NORMAL',
        minScore: 50,
        maxScore: 150,
        name: 'Balanced',
        description: 'Standard difficulty for most players',
        transitionThreshold: 25,
        modifiers: [],
      },
      {
        level: 'HARD',
        minScore: 150,
        maxScore: 250,
        name: 'Challenging',
        description: 'Increased challenge for experienced players',
        transitionThreshold: 50,
        modifiers: [
          {
            id: 'hard_enemy_damage',
            name: 'Increased Enemy Damage',
            description: 'Enemies deal more damage',
            targetProperty: 'combat.damage',
            scalingFunction: {
              type: 'LINEAR',
              baseValue: 1.0,
              scalingFactor: 0.3,
            },
            isActive: true,
            priority: 1,
          },
          {
            id: 'hard_spawn_variety',
            name: 'More Enemy Types',
            description: 'Greater variety of enemy types',
            targetProperty: 'spawner.enemyVariety',
            scalingFunction: {
              type: 'STEP',
              baseValue: 1.0,
              scalingFactor: 1.5,
              stepSize: 0.5,
            },
            isActive: true,
            priority: 2,
          },
        ],
      },
      {
        level: 'EXTREME',
        minScore: 250,
        maxScore: 400,
        name: 'Brutal',
        description: 'Very high difficulty for experts',
        transitionThreshold: 75,
        modifiers: [
          {
            id: 'extreme_enemy_speed',
            name: 'Faster Enemies',
            description: 'Enemies move significantly faster',
            targetProperty: 'movement.speed',
            scalingFunction: {
              type: 'EXPONENTIAL',
              baseValue: 1.0,
              scalingFactor: 0.5,
            },
            isActive: true,
            priority: 1,
          },
          {
            id: 'extreme_ai_aggression',
            name: 'Aggressive AI',
            description: 'Enemy AI is more aggressive',
            targetProperty: 'enemyAI.aggressionLevel',
            scalingFunction: {
              type: 'LINEAR',
              baseValue: 1.0,
              scalingFactor: 0.6,
            },
            isActive: true,
            priority: 1,
          },
        ],
      },
      {
        level: 'NIGHTMARE',
        minScore: 400,
        maxScore: Infinity,
        name: 'Nightmare',
        description: 'Maximum difficulty for the most skilled players',
        transitionThreshold: 100,
        modifiers: [
          {
            id: 'nightmare_all_stats',
            name: 'Enhanced Everything',
            description: 'All enemy stats significantly boosted',
            targetProperty: 'all',
            scalingFunction: {
              type: 'EXPONENTIAL',
              baseValue: 1.0,
              scalingFactor: 0.8,
            },
            isActive: true,
            priority: 1,
          },
          {
            id: 'nightmare_boss_frequency',
            name: 'Frequent Bosses',
            description: 'Boss enemies appear much more often',
            targetProperty: 'spawner.bossFrequency',
            scalingFunction: {
              type: 'LINEAR',
              baseValue: 1.0,
              scalingFactor: 3.0,
            },
            isActive: true,
            priority: 2,
          },
        ],
      },
    ]
  }

  public updatePerformanceMetrics(
    metric: ScalingMetric,
    value: number,
    isIncrement: boolean = false
  ): void {
    const currentTime = Date.now()

    switch (metric) {
      case 'SURVIVAL_TIME':
        this.performanceMetrics.survivalTime = isIncrement
          ? this.performanceMetrics.survivalTime + value
          : value
        break
      case 'PLAYER_LEVEL':
        this.performanceMetrics.playerLevel = value
        break
      case 'ENEMIES_KILLED':
        this.performanceMetrics.enemiesKilled = isIncrement
          ? this.performanceMetrics.enemiesKilled + value
          : value
        break
      case 'DAMAGE_DEALT':
        this.performanceMetrics.damageDealt = isIncrement
          ? this.performanceMetrics.damageDealt + value
          : value
        break
      case 'DAMAGE_TAKEN':
        this.performanceMetrics.damageTaken = isIncrement
          ? this.performanceMetrics.damageTaken + value
          : value
        break
      case 'SCORE':
        this.performanceMetrics.score = value
        break
      case 'COLLECTION_RATE':
        this.performanceMetrics.collectionRate = value
        break
    }

    this.performanceMetrics.lastUpdateTime = currentTime
  }

  public calculateCurrentScore(): number {
    const metrics = this.performanceMetrics
    const timeInMinutes = Math.max(metrics.survivalTime / 60000, 1)

    let score = 100

    score += (metrics.enemiesKilled / timeInMinutes) * 10
    score += metrics.playerLevel * 15
    score += (metrics.damageDealt / timeInMinutes) * 0.01
    score -= (metrics.damageTaken / timeInMinutes) * 0.02
    score += metrics.accuracy * 50
    score += metrics.collectionRate * 20
    score -= metrics.deathCount * 25

    if (metrics.averageReactionTime < 500) score += 20
    else if (metrics.averageReactionTime > 2000) score -= 20

    return Math.max(score, 0)
  }

  public getDifficultyBandForScore(score: number): DifficultyBand | null {
    return (
      this.difficultyBands.find(
        (band) => score >= band.minScore && score <= band.maxScore
      ) || null
    )
  }

  public shouldTransitionDifficulty(newScore: number): {
    shouldTransition: boolean
    newLevel?: DifficultyLevel
    confidence: number
  } {
    const currentBand = this.getDifficultyBandForScore(this.currentScore)
    const targetBand = this.getDifficultyBandForScore(newScore)

    if (!currentBand || !targetBand || currentBand.level === targetBand.level) {
      return { shouldTransition: false, confidence: 0 }
    }

    const scoreDifference = Math.abs(newScore - this.currentScore)
    const confidence = Math.min(
      scoreDifference / targetBand.transitionThreshold,
      1.0
    )

    const shouldTransition = confidence >= 0.7

    return {
      shouldTransition,
      newLevel: shouldTransition ? targetBand.level : undefined,
      confidence,
    }
  }

  public calculateModifierValue(
    modifier: DifficultyModifier,
    inputValue: number
  ): number {
    if (!this.evaluateConditions(modifier.conditions || [])) {
      return inputValue
    }

    const scaling = modifier.scalingFunction
    let result: number

    switch (scaling.type) {
      case 'LINEAR':
        result = scaling.baseValue + inputValue * scaling.scalingFactor
        break
      case 'EXPONENTIAL':
        result =
          scaling.baseValue * Math.pow(1 + scaling.scalingFactor, inputValue)
        break
      case 'LOGARITHMIC':
        result =
          scaling.baseValue + scaling.scalingFactor * Math.log(inputValue + 1)
        break
      case 'STEP':
        const stepLevel = Math.floor(inputValue / (scaling.stepSize || 1))
        result = scaling.baseValue + stepLevel * scaling.scalingFactor
        break
      case 'CUSTOM':
        result = this.evaluateCustomFormula(
          scaling.customFormula || '',
          inputValue,
          scaling.baseValue
        )
        break
      default:
        result = inputValue
    }

    if (modifier.minValue !== undefined)
      result = Math.max(result, modifier.minValue)
    if (modifier.maxValue !== undefined)
      result = Math.min(result, modifier.maxValue)

    return result
  }

  private evaluateConditions(conditions: DifficultyCondition[]): boolean {
    if (conditions.length === 0) return true

    return conditions.every((condition) => {
      const metricValue = this.getMetricValue(condition.metric)
      let passes = false

      switch (condition.operator) {
        case 'GREATER_THAN':
          passes = metricValue > condition.value
          break
        case 'LESS_THAN':
          passes = metricValue < condition.value
          break
        case 'EQUALS':
          passes = Math.abs(metricValue - condition.value) < 0.001
          break
        case 'GREATER_EQUAL':
          passes = metricValue >= condition.value
          break
        case 'LESS_EQUAL':
          passes = metricValue <= condition.value
          break
      }

      return condition.isInverse ? !passes : passes
    })
  }

  private getMetricValue(metric: ScalingMetric): number {
    switch (metric) {
      case 'SURVIVAL_TIME':
        return this.performanceMetrics.survivalTime
      case 'PLAYER_LEVEL':
        return this.performanceMetrics.playerLevel
      case 'ENEMIES_KILLED':
        return this.performanceMetrics.enemiesKilled
      case 'DAMAGE_DEALT':
        return this.performanceMetrics.damageDealt
      case 'DAMAGE_TAKEN':
        return this.performanceMetrics.damageTaken
      case 'SCORE':
        return this.performanceMetrics.score
      case 'COLLECTION_RATE':
        return this.performanceMetrics.collectionRate
      default:
        return 0
    }
  }

  private evaluateCustomFormula(
    formula: string,
    input: number,
    base: number
  ): number {
    try {
      const sanitizedFormula = formula
        .replace(/input/g, input.toString())
        .replace(/base/g, base.toString())
        .replace(/[^0-9+\-*/().]/g, '')

      return Function(`"use strict"; return (${sanitizedFormula})`)()
    } catch {
      return input
    }
  }

  public getPerformanceScore(): number {
    const timeInMinutes = Math.max(
      this.performanceMetrics.survivalTime / 60000,
      1
    )
    const killRate = this.performanceMetrics.enemiesKilled / timeInMinutes
    const efficiency =
      this.performanceMetrics.damageDealt /
      Math.max(this.performanceMetrics.damageTaken, 1)

    const normalizedKillRate = Math.min(killRate / 10, 1.0)
    const normalizedEfficiency = Math.min(efficiency / 5, 1.0)
    const normalizedAccuracy = this.performanceMetrics.accuracy

    return (normalizedKillRate + normalizedEfficiency + normalizedAccuracy) / 3
  }

  public clone(): DifficultyComponent {
    const cloned = new DifficultyComponent()
    cloned.currentLevel = this.currentLevel
    cloned.currentScore = this.currentScore
    cloned.targetScore = this.targetScore
    cloned.performanceMetrics = { ...this.performanceMetrics }
    cloned.difficultyBands = [...this.difficultyBands]
    cloned.activeModifiers = new Map(this.activeModifiers)
    cloned.modifierValues = new Map(this.modifierValues)
    cloned.adaptiveSettings = { ...this.adaptiveSettings }
    cloned.performanceHistory = [...this.performanceHistory]
    cloned.lastAdaptationTime = this.lastAdaptationTime
    cloned.isStabilized = this.isStabilized
    return cloned
  }

  public serialize(): Record<string, unknown> {
    return {
      type: this.type,
      currentLevel: this.currentLevel,
      currentScore: this.currentScore,
      targetScore: this.targetScore,
      performanceMetrics: this.performanceMetrics,
      adaptiveSettings: this.adaptiveSettings,
      performanceHistory: this.performanceHistory,
      lastAdaptationTime: this.lastAdaptationTime,
      isStabilized: this.isStabilized,
    }
  }

  public deserialize(data: Record<string, unknown>): void {
    this.currentLevel = (data.currentLevel as DifficultyLevel) || 'NORMAL'
    this.currentScore = (data.currentScore as number) || 100
    this.targetScore = (data.targetScore as number) || 100
    this.performanceMetrics =
      (data.performanceMetrics as PerformanceMetrics) || this.performanceMetrics
    this.adaptiveSettings =
      (data.adaptiveSettings as AdaptiveSettings) || this.adaptiveSettings
    this.performanceHistory = (data.performanceHistory as number[]) || []
    this.lastAdaptationTime = (data.lastAdaptationTime as number) || Date.now()
    this.isStabilized = (data.isStabilized as boolean) || false
  }
}

import { Component } from '../core/ECS/Component'
import type { EntityId } from '../types/CoreTypes'
import type { Vector2 } from '../utils/Math'
import { Vector2Math } from '../utils/Math'

/**
 * AI behavior states
 */
export enum AIBehaviorState {
  IDLE = 'idle',
  SEEKING = 'seeking',
  ATTACKING = 'attacking',
  FLEEING = 'fleeing',
  PATROLLING = 'patrolling',
  STUNNED = 'stunned',
  DEAD = 'dead',
}

/**
 * AI behavior types
 */
export enum AIBehaviorType {
  AGGRESSIVE = 'aggressive', // Always seeks and attacks
  DEFENSIVE = 'defensive', // Attacks when threatened
  PASSIVE = 'passive', // Avoids combat
  PACK = 'pack', // Coordinates with nearby allies
  ELITE = 'elite', // Complex behavior patterns
  BOSS = 'boss', // Multi-phase behavior
}

/**
 * Movement patterns for AI
 */
export enum MovementPattern {
  DIRECT = 'direct', // Move directly toward target
  CIRCULAR = 'circular', // Circle around target
  ZIGZAG = 'zigzag', // Zigzag approach
  RETREAT = 'retreat', // Move away from target
  PATROL = 'patrol', // Follow patrol points
  SWARM = 'swarm', // Group movement behavior
  TELEPORT = 'teleport', // Instant position changes
}

/**
 * AI decision factors
 */
export interface AIDecisionFactors {
  healthPercentage: number
  nearbyAllies: number
  nearbyEnemies: number
  distanceToTarget: number
  timeSinceLastAction: number
  damageReceived: number
}

/**
 * AI action definition
 */
export interface AIAction {
  type: 'move' | 'attack' | 'skill' | 'wait' | 'flee'
  target?: EntityId
  position?: Vector2
  skillId?: string
  duration?: number
  priority: number
}

/**
 * AI state machine transition
 */
export interface AIStateTransition {
  fromState: AIBehaviorState
  toState: AIBehaviorState
  condition: (factors: AIDecisionFactors) => boolean
  priority: number
}

/**
 * Patrol point for patrolling behavior
 */
export interface PatrolPoint {
  position: Vector2
  waitTime: number
  requiredActions?: AIAction[]
}

/**
 * AI component for enemy behavior
 */
export class EnemyAIComponent extends Component {
  readonly type = 'enemyAI'

  // Core AI properties
  public behaviorType: AIBehaviorType
  public currentState: AIBehaviorState = AIBehaviorState.IDLE
  public previousState: AIBehaviorState = AIBehaviorState.IDLE
  public stateEnterTime: number = 0
  public stateUpdateInterval: number = 500 // Update AI every 500ms

  // Targeting
  public targetEntityId: EntityId | null = null
  public lastKnownTargetPosition: Vector2 | null = null
  public detectionRange: number = 150
  public attackRange: number = 50
  public loseTargetDistance: number = 300

  // Movement
  public movementPattern: MovementPattern = MovementPattern.DIRECT
  public moveSpeed: number = 1.0 // Speed multiplier
  public patrolPoints: PatrolPoint[] = []
  public currentPatrolIndex: number = 0
  public lastPatrolTime: number = 0

  // Behavior parameters
  public aggressionLevel: number = 0.5 // 0-1, affects decision making
  public fleeThreshold: number = 0.3 // Health % at which to flee
  public groupRadius: number = 100 // Range for pack coordination
  public reactionTime: number = 250 // Time to react to changes (ms)

  // Action queue and timing
  public actionQueue: AIAction[] = []
  public lastActionTime: number = 0
  public actionCooldown: number = 1000
  public lastDecisionTime: number = 0

  // State machine
  public stateTransitions: AIStateTransition[] = []

  // Memory and learning
  public memory: Map<string, unknown> = new Map()
  public lastDamageTime: number = 0
  public lastDamageSource: EntityId | null = null
  public threatLevel: number = 0

  // Performance optimization
  public lastUpdateTime: number = 0
  public updatePriority: number = 1 // Higher = more frequent updates

  constructor(behaviorType: AIBehaviorType = AIBehaviorType.AGGRESSIVE) {
    super()
    this.behaviorType = behaviorType
    this.initializeStateMachine()
    this.initializeBehaviorDefaults()
  }

  /**
   * Initializes the AI state machine with default transitions
   */
  private initializeStateMachine(): void {
    this.stateTransitions = [
      // From IDLE transitions
      {
        fromState: AIBehaviorState.IDLE,
        toState: AIBehaviorState.SEEKING,
        condition: (factors) =>
          factors.nearbyEnemies > 0 &&
          factors.distanceToTarget < this.detectionRange,
        priority: 2,
      },
      {
        fromState: AIBehaviorState.IDLE,
        toState: AIBehaviorState.PATROLLING,
        condition: () => this.patrolPoints.length > 0,
        priority: 1,
      },

      // From SEEKING transitions
      {
        fromState: AIBehaviorState.SEEKING,
        toState: AIBehaviorState.ATTACKING,
        condition: (factors) => factors.distanceToTarget <= this.attackRange,
        priority: 3,
      },
      {
        fromState: AIBehaviorState.SEEKING,
        toState: AIBehaviorState.FLEEING,
        condition: (factors) => factors.healthPercentage < this.fleeThreshold,
        priority: 4,
      },
      {
        fromState: AIBehaviorState.SEEKING,
        toState: AIBehaviorState.IDLE,
        condition: (factors) =>
          factors.distanceToTarget > this.loseTargetDistance,
        priority: 1,
      },

      // From ATTACKING transitions
      {
        fromState: AIBehaviorState.ATTACKING,
        toState: AIBehaviorState.FLEEING,
        condition: (factors) => factors.healthPercentage < this.fleeThreshold,
        priority: 4,
      },
      {
        fromState: AIBehaviorState.ATTACKING,
        toState: AIBehaviorState.SEEKING,
        condition: (factors) => factors.distanceToTarget > this.attackRange,
        priority: 2,
      },

      // From FLEEING transitions
      {
        fromState: AIBehaviorState.FLEEING,
        toState: AIBehaviorState.SEEKING,
        condition: (factors) =>
          factors.healthPercentage > this.fleeThreshold + 0.2 &&
          factors.distanceToTarget < this.detectionRange,
        priority: 2,
      },
      {
        fromState: AIBehaviorState.FLEEING,
        toState: AIBehaviorState.IDLE,
        condition: (factors) =>
          factors.distanceToTarget > this.loseTargetDistance,
        priority: 1,
      },

      // From PATROLLING transitions
      {
        fromState: AIBehaviorState.PATROLLING,
        toState: AIBehaviorState.SEEKING,
        condition: (factors) =>
          factors.nearbyEnemies > 0 &&
          factors.distanceToTarget < this.detectionRange,
        priority: 3,
      },

      // Universal transitions
      {
        fromState: AIBehaviorState.STUNNED,
        toState: AIBehaviorState.IDLE,
        condition: (factors) => factors.timeSinceLastAction > 2000, // 2 second stun duration
        priority: 5,
      },
    ]
  }

  /**
   * Initializes behavior-specific defaults
   */
  private initializeBehaviorDefaults(): void {
    switch (this.behaviorType) {
      case AIBehaviorType.AGGRESSIVE:
        this.aggressionLevel = 0.8
        this.detectionRange = 180
        this.attackRange = 60
        this.fleeThreshold = 0.1
        break

      case AIBehaviorType.DEFENSIVE:
        this.aggressionLevel = 0.4
        this.detectionRange = 120
        this.attackRange = 80
        this.fleeThreshold = 0.4
        break

      case AIBehaviorType.PASSIVE:
        this.aggressionLevel = 0.1
        this.detectionRange = 80
        this.attackRange = 40
        this.fleeThreshold = 0.8
        break

      case AIBehaviorType.PACK:
        this.aggressionLevel = 0.6
        this.detectionRange = 150
        this.groupRadius = 80
        this.fleeThreshold = 0.3
        break

      case AIBehaviorType.ELITE:
        this.aggressionLevel = 0.7
        this.detectionRange = 200
        this.attackRange = 100
        this.fleeThreshold = 0.2
        this.reactionTime = 150
        break

      case AIBehaviorType.BOSS:
        this.aggressionLevel = 0.9
        this.detectionRange = 250
        this.attackRange = 120
        this.fleeThreshold = 0.05
        this.reactionTime = 100
        break
    }
  }

  /**
   * Updates the AI state based on current conditions
   */
  updateState(factors: AIDecisionFactors, currentTime: number): boolean {
    if (currentTime - this.lastDecisionTime < this.reactionTime) {
      return false
    }

    // const previousState = this.currentState // Kept for future use
    const validTransitions = this.stateTransitions
      .filter((transition) => transition.fromState === this.currentState)
      .filter((transition) => transition.condition(factors))
      .sort((a, b) => b.priority - a.priority)

    if (validTransitions.length > 0) {
      const newState = validTransitions[0].toState
      if (newState !== this.currentState) {
        this.previousState = this.currentState
        this.currentState = newState
        this.stateEnterTime = currentTime
        this.lastDecisionTime = currentTime
        return true
      }
    }

    return false
  }

  /**
   * Sets the current target
   */
  setTarget(targetId: EntityId | null, targetPosition?: Vector2): void {
    this.targetEntityId = targetId
    if (targetPosition) {
      this.lastKnownTargetPosition = targetPosition
    }
  }

  /**
   * Adds an action to the queue
   */
  queueAction(action: AIAction): void {
    // Insert action based on priority
    const insertIndex = this.actionQueue.findIndex(
      (a) => a.priority < action.priority
    )
    if (insertIndex === -1) {
      this.actionQueue.push(action)
    } else {
      this.actionQueue.splice(insertIndex, 0, action)
    }
  }

  /**
   * Gets the next action to execute
   */
  getNextAction(): AIAction | null {
    return this.actionQueue.shift() ?? null
  }

  /**
   * Adds a patrol point for patrolling behavior
   */
  addPatrolPoint(position: Vector2, waitTime: number): void {
    this.patrolPoints.push({
      position,
      waitTime,
    })
  }

  /**
   * Gets the current patrol target position
   */
  getCurrentPatrolTarget(): Vector2 | null {
    if (this.patrolPoints.length === 0) {
      return null
    }
    return this.patrolPoints[this.currentPatrolIndex]?.position ?? null
  }

  /**
   * Clears all queued actions
   */
  clearActions(): void {
    this.actionQueue = []
  }


  /**
   * Advances to the next patrol point
   */
  nextPatrolPoint(): void {
    if (this.patrolPoints.length > 0) {
      this.currentPatrolIndex =
        (this.currentPatrolIndex + 1) % this.patrolPoints.length
    }
  }

  /**
   * Records damage received for AI decision making
   */
  recordDamage(amount: number, sourceId: EntityId, currentTime: number): void {
    this.lastDamageTime = currentTime
    this.lastDamageSource = sourceId
    this.threatLevel = Math.min(this.threatLevel + amount / 100, 1.0)

    // Store in memory
    this.memory.set('lastDamage', { amount, sourceId, time: currentTime })
  }

  /**
   * Checks if the AI can perform an action
   */
  canPerformAction(currentTime: number): boolean {
    return currentTime - this.lastActionTime >= this.actionCooldown
  }

  /**
   * Marks an action as performed
   */
  actionPerformed(currentTime: number): void {
    this.lastActionTime = currentTime
  }

  /**
   * Gets the time spent in current state
   */
  getTimeInCurrentState(currentTime: number): number {
    return currentTime - this.stateEnterTime
  }

  /**
   * Calculates movement direction based on pattern
   */
  calculateMovementDirection(
    currentPosition: Vector2,
    targetPosition: Vector2,
    currentTime: number
  ): Vector2 {
    switch (this.movementPattern) {
      case MovementPattern.DIRECT:
        return Vector2Math.normalize(
          Vector2Math.subtract(targetPosition, currentPosition)
        )

      case MovementPattern.CIRCULAR:
        const toTarget = Vector2Math.subtract(targetPosition, currentPosition)
        const distance = Vector2Math.magnitude(toTarget)
        if (distance < this.attackRange * 1.5) {
          // Circle around target
          const perpendicular = { x: -toTarget.y, y: toTarget.x }
          return Vector2Math.normalize(perpendicular)
        }
        return Vector2Math.normalize(toTarget)

      case MovementPattern.ZIGZAG:
        const direct = Vector2Math.normalize(
          Vector2Math.subtract(targetPosition, currentPosition)
        )
        const zigzagOffset = Math.sin(currentTime * 0.01) * 0.5
        return {
          x: direct.x + zigzagOffset * direct.y,
          y: direct.y - zigzagOffset * direct.x,
        }

      case MovementPattern.RETREAT:
        return Vector2Math.normalize(
          Vector2Math.subtract(currentPosition, targetPosition)
        )

      default:
        return Vector2Math.normalize(
          Vector2Math.subtract(targetPosition, currentPosition)
        )
    }
  }

  /**
   * Checks if AI should update (for performance optimization)
   */
  shouldUpdate(currentTime: number): boolean {
    const timeSinceUpdate = currentTime - this.lastUpdateTime
    const updateInterval = this.stateUpdateInterval / this.updatePriority
    return timeSinceUpdate >= updateInterval
  }

  /**
   * Marks AI as updated
   */
  markUpdated(currentTime: number): void {
    this.lastUpdateTime = currentTime
  }

  clone(): EnemyAIComponent {
    const clone = new EnemyAIComponent(this.behaviorType)

    // Copy all properties
    clone.currentState = this.currentState
    clone.previousState = this.previousState
    clone.stateEnterTime = this.stateEnterTime
    clone.stateUpdateInterval = this.stateUpdateInterval

    clone.targetEntityId = this.targetEntityId
    clone.lastKnownTargetPosition = this.lastKnownTargetPosition
      ? { ...this.lastKnownTargetPosition }
      : null
    clone.detectionRange = this.detectionRange
    clone.attackRange = this.attackRange
    clone.loseTargetDistance = this.loseTargetDistance

    clone.movementPattern = this.movementPattern
    clone.moveSpeed = this.moveSpeed
    clone.patrolPoints = this.patrolPoints.map((p) => ({
      ...p,
      position: { ...p.position },
    }))
    clone.currentPatrolIndex = this.currentPatrolIndex
    clone.lastPatrolTime = this.lastPatrolTime

    clone.aggressionLevel = this.aggressionLevel
    clone.fleeThreshold = this.fleeThreshold
    clone.groupRadius = this.groupRadius
    clone.reactionTime = this.reactionTime

    clone.actionQueue = this.actionQueue.map((a) => ({ ...a }))
    clone.lastActionTime = this.lastActionTime
    clone.actionCooldown = this.actionCooldown
    clone.lastDecisionTime = this.lastDecisionTime

    clone.stateTransitions = this.stateTransitions.map((t) => ({ ...t }))

    clone.memory = new Map(this.memory)
    clone.lastDamageTime = this.lastDamageTime
    clone.lastDamageSource = this.lastDamageSource
    clone.threatLevel = this.threatLevel

    clone.lastUpdateTime = this.lastUpdateTime
    clone.updatePriority = this.updatePriority

    return clone
  }

  serialize(): Record<string, unknown> {
    return {
      behaviorType: this.behaviorType,
      currentState: this.currentState,
      previousState: this.previousState,
      stateEnterTime: this.stateEnterTime,
      stateUpdateInterval: this.stateUpdateInterval,

      targetEntityId: this.targetEntityId,
      lastKnownTargetPosition: this.lastKnownTargetPosition,
      detectionRange: this.detectionRange,
      attackRange: this.attackRange,
      loseTargetDistance: this.loseTargetDistance,

      movementPattern: this.movementPattern,
      moveSpeed: this.moveSpeed,
      patrolPoints: this.patrolPoints,
      currentPatrolIndex: this.currentPatrolIndex,
      lastPatrolTime: this.lastPatrolTime,

      aggressionLevel: this.aggressionLevel,
      fleeThreshold: this.fleeThreshold,
      groupRadius: this.groupRadius,
      reactionTime: this.reactionTime,

      actionQueue: this.actionQueue,
      lastActionTime: this.lastActionTime,
      actionCooldown: this.actionCooldown,
      lastDecisionTime: this.lastDecisionTime,

      memory: Object.fromEntries(this.memory),
      lastDamageTime: this.lastDamageTime,
      lastDamageSource: this.lastDamageSource,
      threatLevel: this.threatLevel,

      lastUpdateTime: this.lastUpdateTime,
      updatePriority: this.updatePriority,
    }
  }

  deserialize(data: Record<string, unknown>): void {
    this.behaviorType = data.behaviorType as AIBehaviorType
    this.currentState = data.currentState as AIBehaviorState
    this.previousState = data.previousState as AIBehaviorState
    this.stateEnterTime = data.stateEnterTime as number
    this.stateUpdateInterval = data.stateUpdateInterval as number

    this.targetEntityId = data.targetEntityId as EntityId | null
    this.lastKnownTargetPosition =
      data.lastKnownTargetPosition as Vector2 | null
    this.detectionRange = data.detectionRange as number
    this.attackRange = data.attackRange as number
    this.loseTargetDistance = data.loseTargetDistance as number

    this.movementPattern = data.movementPattern as MovementPattern
    this.moveSpeed = data.moveSpeed as number
    this.patrolPoints = data.patrolPoints as PatrolPoint[]
    this.currentPatrolIndex = data.currentPatrolIndex as number
    this.lastPatrolTime = data.lastPatrolTime as number

    this.aggressionLevel = data.aggressionLevel as number
    this.fleeThreshold = data.fleeThreshold as number
    this.groupRadius = data.groupRadius as number
    this.reactionTime = data.reactionTime as number

    this.actionQueue = data.actionQueue as AIAction[]
    this.lastActionTime = data.lastActionTime as number
    this.actionCooldown = data.actionCooldown as number
    this.lastDecisionTime = data.lastDecisionTime as number

    this.memory = new Map(
      Object.entries(data.memory as Record<string, unknown>)
    )
    this.lastDamageTime = data.lastDamageTime as number
    this.lastDamageSource = data.lastDamageSource as EntityId | null
    this.threatLevel = data.threatLevel as number

    this.lastUpdateTime = data.lastUpdateTime as number
    this.updatePriority = data.updatePriority as number

    // Reinitialize state machine and behavior defaults
    this.initializeStateMachine()
  }
}

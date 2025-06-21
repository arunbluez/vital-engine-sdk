import { Component } from '../core/ECS/Component'
import type { EntityId } from '../types/CoreTypes'
import type { Vector2 } from '../utils/Math'

/**
 * AI behavior states for state machine
 */
export enum AIState {
  IDLE = 'idle',
  PATROL = 'patrol',
  CHASE = 'chase',
  ATTACK = 'attack',
  FLEE = 'flee',
  STUNNED = 'stunned',
  DEAD = 'dead',
  INVESTIGATE = 'investigate',
  RETREAT = 'retreat',
  SUPPORT = 'support',
  GUARD = 'guard'
}

/**
 * AI personality types that affect decision making
 */
export enum AIPersonality {
  AGGRESSIVE = 'aggressive',     // High aggression, low fear
  DEFENSIVE = 'defensive',       // Balanced, prioritizes survival
  COWARD = 'coward',            // Low aggression, high fear
  BERSERKER = 'berserker',      // Ignores health, always attacks
  TACTICAL = 'tactical',        // Smart positioning, hit and run
  SUPPORT = 'support',          // Heals/buffs allies
  GUARDIAN = 'guardian',        // Protects specific area/entity
  HUNTER = 'hunter',            // Stalks and ambushes
  SWARM = 'swarm'              // Coordinates with nearby allies
}

/**
 * State transition condition
 */
export interface StateTransition {
  from: AIState
  to: AIState
  condition: (context: AIContext) => boolean
  priority: number
  cooldown?: number
  onEnter?: (ai: AIComponent) => void
  onExit?: (ai: AIComponent) => void
}

/**
 * AI decision context
 */
export interface AIContext {
  health: number
  maxHealth: number
  stamina?: number
  distanceToTarget: number
  targetVisible: boolean
  nearbyAllies: number
  nearbyEnemies: number
  isUnderAttack: boolean
  timeSinceLastAttack: number
  currentStateTime: number
  hasPath: boolean
  isStuck: boolean
}

/**
 * AI memory for learning and adaptation
 */
export interface AIMemory {
  lastSeenPositions: Map<EntityId, Vector2>
  damageReceived: Map<EntityId, number>
  threatLevels: Map<EntityId, number>
  blackboard: Map<string, unknown>
}

/**
 * Behavior tree node types
 */
export enum BehaviorNodeType {
  SEQUENCE = 'sequence',
  SELECTOR = 'selector',
  PARALLEL = 'parallel',
  DECORATOR = 'decorator',
  ACTION = 'action',
  CONDITION = 'condition'
}

/**
 * Behavior tree node
 */
export interface BehaviorNode {
  type: BehaviorNodeType
  name: string
  children?: BehaviorNode[]
  action?: (ai: AIComponent, context: AIContext) => boolean
  condition?: (context: AIContext) => boolean
  decorator?: {
    type: 'repeat' | 'invert' | 'succeed' | 'fail' | 'retry'
    times?: number
  }
}

/**
 * AI component with advanced behavior state machine and behavior trees
 */
export class AIComponent extends Component {
  readonly type = 'ai'

  // State machine
  public currentState: AIState = AIState.IDLE
  public previousState: AIState = AIState.IDLE
  public stateTransitions: StateTransition[] = []
  public stateStartTime: number = 0
  public stateCooldowns: Map<AIState, number> = new Map()

  // Personality and behavior
  public personality: AIPersonality = AIPersonality.AGGRESSIVE
  public behaviorTree: BehaviorNode | null = null
  public aggressionLevel: number = 0.5
  public fearLevel: number = 0.5
  public curiosity: number = 0.5
  public loyalty: number = 0.5

  // Targeting
  public targetId: EntityId | null = null
  public targetPosition: Vector2 | null = null
  public homePosition: Vector2 | null = null
  public guardPosition: Vector2 | null = null
  public patrolPath: Vector2[] = []
  public currentPatrolIndex: number = 0

  // Detection
  public sightRange: number = 200
  public hearingRange: number = 300
  public attackRange: number = 50
  public fleeDistance: number = 400
  public fieldOfView: number = 120 // degrees

  // Movement
  public moveSpeed: number = 1.0
  public turnSpeed: number = 5.0
  public preferredDistance: number = 100
  public avoidanceRadius: number = 30

  // Combat
  public attackCooldown: number = 1000
  public lastAttackTime: number = 0
  public damageDealt: number = 0
  public damageReceived: number = 0

  // Memory and learning
  public memory: AIMemory = {
    lastSeenPositions: new Map(),
    damageReceived: new Map(),
    threatLevels: new Map(),
    blackboard: new Map()
  }

  // Performance optimization
  public updatePriority: number = 1
  public lastUpdateTime: number = 0
  public updateInterval: number = 100

  // Pathfinding cache
  public currentPath: Vector2[] = []
  public pathIndex: number = 0
  public lastPathfindTime: number = 0
  public pathfindCooldown: number = 500
  public stuckCounter: number = 0
  public lastPosition: Vector2 | null = null

  constructor(personality: AIPersonality = AIPersonality.AGGRESSIVE) {
    super()
    this.personality = personality
    this.initializePersonality()
    this.initializeStateMachine()
  }

  /**
   * Initializes personality-based parameters
   */
  private initializePersonality(): void {
    switch (this.personality) {
      case AIPersonality.AGGRESSIVE:
        this.aggressionLevel = 0.8
        this.fearLevel = 0.2
        this.curiosity = 0.6
        this.loyalty = 0.4
        break

      case AIPersonality.DEFENSIVE:
        this.aggressionLevel = 0.5
        this.fearLevel = 0.5
        this.curiosity = 0.4
        this.loyalty = 0.6
        break

      case AIPersonality.COWARD:
        this.aggressionLevel = 0.2
        this.fearLevel = 0.8
        this.curiosity = 0.3
        this.loyalty = 0.2
        break

      case AIPersonality.BERSERKER:
        this.aggressionLevel = 1.0
        this.fearLevel = 0.0
        this.curiosity = 0.7
        this.loyalty = 0.3
        break

      case AIPersonality.TACTICAL:
        this.aggressionLevel = 0.6
        this.fearLevel = 0.4
        this.curiosity = 0.7
        this.loyalty = 0.5
        break

      case AIPersonality.SUPPORT:
        this.aggressionLevel = 0.3
        this.fearLevel = 0.6
        this.curiosity = 0.5
        this.loyalty = 0.8
        break

      case AIPersonality.GUARDIAN:
        this.aggressionLevel = 0.7
        this.fearLevel = 0.1
        this.curiosity = 0.2
        this.loyalty = 0.9
        break

      case AIPersonality.HUNTER:
        this.aggressionLevel = 0.7
        this.fearLevel = 0.3
        this.curiosity = 0.8
        this.loyalty = 0.4
        break

      case AIPersonality.SWARM:
        this.aggressionLevel = 0.6
        this.fearLevel = 0.4
        this.curiosity = 0.5
        this.loyalty = 0.7
        break
    }
  }

  /**
   * Initializes the state machine with default transitions
   */
  private initializeStateMachine(): void {
    this.stateTransitions = [
      // IDLE transitions
      {
        from: AIState.IDLE,
        to: AIState.PATROL,
        condition: (ctx) => this.patrolPath.length > 0 && !ctx.nearbyEnemies,
        priority: 1
      },
      {
        from: AIState.IDLE,
        to: AIState.INVESTIGATE,
        condition: (ctx) => this.curiosity > 0.5 && ctx.nearbyEnemies > 0 && !ctx.targetVisible,
        priority: 2
      },
      {
        from: AIState.IDLE,
        to: AIState.CHASE,
        condition: (ctx) => ctx.targetVisible && ctx.distanceToTarget > this.attackRange,
        priority: 3
      },

      // PATROL transitions
      {
        from: AIState.PATROL,
        to: AIState.CHASE,
        condition: (ctx) => ctx.targetVisible && this.aggressionLevel > 0.3,
        priority: 3
      },
      {
        from: AIState.PATROL,
        to: AIState.INVESTIGATE,
        condition: (ctx) => ctx.nearbyEnemies > 0 && !ctx.targetVisible,
        priority: 2
      },

      // CHASE transitions
      {
        from: AIState.CHASE,
        to: AIState.ATTACK,
        condition: (ctx) => ctx.distanceToTarget <= this.attackRange,
        priority: 4
      },
      {
        from: AIState.CHASE,
        to: AIState.FLEE,
        condition: (ctx) => ctx.health / ctx.maxHealth < 0.3 && this.fearLevel > 0.5,
        priority: 5
      },
      {
        from: AIState.CHASE,
        to: AIState.INVESTIGATE,
        condition: (ctx) => !ctx.targetVisible && ctx.currentStateTime > 3000,
        priority: 2
      },

      // ATTACK transitions
      {
        from: AIState.ATTACK,
        to: AIState.CHASE,
        condition: (ctx) => ctx.distanceToTarget > this.attackRange,
        priority: 3
      },
      {
        from: AIState.ATTACK,
        to: AIState.FLEE,
        condition: (ctx) => ctx.health / ctx.maxHealth < 0.2 && this.fearLevel > 0.3,
        priority: 5
      },
      {
        from: AIState.ATTACK,
        to: AIState.RETREAT,
        condition: (ctx) => ctx.nearbyEnemies > 3 && this.personality === AIPersonality.TACTICAL,
        priority: 4
      },

      // FLEE transitions
      {
        from: AIState.FLEE,
        to: AIState.IDLE,
        condition: (ctx) => ctx.distanceToTarget > this.fleeDistance,
        priority: 2
      },
      {
        from: AIState.FLEE,
        to: AIState.SUPPORT,
        condition: (ctx) => ctx.nearbyAllies > 2 && this.personality === AIPersonality.SUPPORT,
        priority: 3
      },

      // INVESTIGATE transitions
      {
        from: AIState.INVESTIGATE,
        to: AIState.CHASE,
        condition: (ctx) => ctx.targetVisible,
        priority: 3
      },
      {
        from: AIState.INVESTIGATE,
        to: AIState.IDLE,
        condition: (ctx) => ctx.currentStateTime > 5000,
        priority: 1
      }
    ]
  }

  /**
   * Changes AI state
   */
  changeState(newState: AIState, currentTime: number): void {
    if (this.currentState === newState) return

    // Check cooldown
    const cooldown = this.stateCooldowns.get(newState) || 0
    if (currentTime < cooldown) return

    // Find transition
    const transition = this.stateTransitions.find(
      t => t.from === this.currentState && t.to === newState
    )

    // Execute exit callback
    if (transition?.onExit) {
      transition.onExit(this)
    }

    // Change state
    this.previousState = this.currentState
    this.currentState = newState
    this.stateStartTime = currentTime

    // Execute enter callback
    if (transition?.onEnter) {
      transition.onEnter(this)
    }

    // Set cooldown
    if (transition?.cooldown) {
      this.stateCooldowns.set(newState, currentTime + transition.cooldown)
    }
  }

  /**
   * Updates state machine
   */
  updateStateMachine(context: AIContext, currentTime: number): boolean {
    context.currentStateTime = currentTime - this.stateStartTime

    // Check all valid transitions from current state
    const validTransitions = this.stateTransitions
      .filter(t => t.from === this.currentState)
      .filter(t => t.condition(context))
      .sort((a, b) => b.priority - a.priority)

    if (validTransitions.length > 0) {
      this.changeState(validTransitions[0].to, currentTime)
      return true
    }

    return false
  }

  /**
   * Executes behavior tree
   */
  executeBehaviorTree(context: AIContext): boolean {
    if (!this.behaviorTree) return false
    return this.executeNode(this.behaviorTree, context)
  }

  /**
   * Executes a behavior tree node
   */
  private executeNode(node: BehaviorNode, context: AIContext): boolean {
    switch (node.type) {
      case BehaviorNodeType.SEQUENCE:
        // All children must succeed
        if (!node.children) return true
        for (const child of node.children) {
          if (!this.executeNode(child, context)) return false
        }
        return true

      case BehaviorNodeType.SELECTOR:
        // First child to succeed stops execution
        if (!node.children) return false
        for (const child of node.children) {
          if (this.executeNode(child, context)) return true
        }
        return false

      case BehaviorNodeType.PARALLEL:
        // Execute all children
        if (!node.children) return true
        let successCount = 0
        for (const child of node.children) {
          if (this.executeNode(child, context)) successCount++
        }
        return successCount > node.children.length / 2

      case BehaviorNodeType.DECORATOR:
        if (!node.children || node.children.length === 0) return false
        const childResult = this.executeNode(node.children[0], context)
        
        switch (node.decorator?.type) {
          case 'invert': return !childResult
          case 'succeed': return true
          case 'fail': return false
          case 'repeat':
            for (let i = 0; i < (node.decorator.times || 1); i++) {
              this.executeNode(node.children[0], context)
            }
            return true
          default: return childResult
        }

      case BehaviorNodeType.CONDITION:
        return node.condition ? node.condition(context) : false

      case BehaviorNodeType.ACTION:
        return node.action ? node.action(this, context) : false

      default:
        return false
    }
  }

  /**
   * Sets a target for the AI
   */
  setTarget(targetId: EntityId | null, position?: Vector2): void {
    this.targetId = targetId
    if (position) {
      this.targetPosition = { ...position }
      if (targetId) {
        this.memory.lastSeenPositions.set(targetId, { ...position })
      }
    }
  }

  /**
   * Updates threat level for an entity
   */
  updateThreatLevel(entityId: EntityId, threat: number): void {
    const currentThreat = this.memory.threatLevels.get(entityId) || 0
    this.memory.threatLevels.set(entityId, Math.max(0, Math.min(1, currentThreat + threat)))
  }

  /**
   * Records damage from an entity
   */
  recordDamage(fromEntity: EntityId, damage: number): void {
    const currentDamage = this.memory.damageReceived.get(fromEntity) || 0
    this.memory.damageReceived.set(fromEntity, currentDamage + damage)
    this.updateThreatLevel(fromEntity, damage / 100)
    this.damageReceived += damage
  }

  /**
   * Gets the highest threat entity
   */
  getHighestThreat(): EntityId | null {
    let highestThreat = 0
    let highestEntity: EntityId | null = null

    this.memory.threatLevels.forEach((threat, entity) => {
      if (threat > highestThreat) {
        highestThreat = threat
        highestEntity = entity
      }
    })

    return highestEntity
  }

  /**
   * Checks if should update based on priority
   */
  shouldUpdate(currentTime: number): boolean {
    const timeSinceUpdate = currentTime - this.lastUpdateTime
    const adjustedInterval = this.updateInterval / this.updatePriority
    return timeSinceUpdate >= adjustedInterval
  }

  /**
   * Marks as updated
   */
  markUpdated(currentTime: number): void {
    this.lastUpdateTime = currentTime
  }

  /**
   * Sets path for pathfinding
   */
  setPath(path: Vector2[]): void {
    this.currentPath = path
    this.pathIndex = 0
  }

  /**
   * Gets next waypoint in path
   */
  getNextWaypoint(): Vector2 | null {
    if (this.pathIndex >= this.currentPath.length) return null
    return this.currentPath[this.pathIndex]
  }

  /**
   * Advances to next waypoint
   */
  advanceWaypoint(): void {
    this.pathIndex++
  }

  /**
   * Checks if stuck
   */
  checkStuck(currentPosition: Vector2): boolean {
    if (!this.lastPosition) {
      this.lastPosition = { ...currentPosition }
      return false
    }

    const distance = Math.sqrt(
      Math.pow(currentPosition.x - this.lastPosition.x, 2) +
      Math.pow(currentPosition.y - this.lastPosition.y, 2)
    )

    if (distance < 1) {
      this.stuckCounter++
    } else {
      this.stuckCounter = 0
    }

    this.lastPosition = { ...currentPosition }
    return this.stuckCounter > 10
  }

  clone(): AIComponent {
    const clone = new AIComponent(this.personality)
    
    // Copy all properties
    clone.currentState = this.currentState
    clone.previousState = this.previousState
    clone.stateTransitions = [...this.stateTransitions]
    clone.stateStartTime = this.stateStartTime
    clone.stateCooldowns = new Map(this.stateCooldowns)
    
    clone.behaviorTree = this.behaviorTree
    clone.aggressionLevel = this.aggressionLevel
    clone.fearLevel = this.fearLevel
    clone.curiosity = this.curiosity
    clone.loyalty = this.loyalty
    
    clone.targetId = this.targetId
    clone.targetPosition = this.targetPosition ? { ...this.targetPosition } : null
    clone.homePosition = this.homePosition ? { ...this.homePosition } : null
    clone.guardPosition = this.guardPosition ? { ...this.guardPosition } : null
    clone.patrolPath = this.patrolPath.map(p => ({ ...p }))
    clone.currentPatrolIndex = this.currentPatrolIndex
    
    clone.sightRange = this.sightRange
    clone.hearingRange = this.hearingRange
    clone.attackRange = this.attackRange
    clone.fleeDistance = this.fleeDistance
    clone.fieldOfView = this.fieldOfView
    
    clone.moveSpeed = this.moveSpeed
    clone.turnSpeed = this.turnSpeed
    clone.preferredDistance = this.preferredDistance
    clone.avoidanceRadius = this.avoidanceRadius
    
    clone.attackCooldown = this.attackCooldown
    clone.lastAttackTime = this.lastAttackTime
    clone.damageDealt = this.damageDealt
    clone.damageReceived = this.damageReceived
    
    clone.memory = {
      lastSeenPositions: new Map(this.memory.lastSeenPositions),
      damageReceived: new Map(this.memory.damageReceived),
      threatLevels: new Map(this.memory.threatLevels),
      blackboard: new Map(this.memory.blackboard)
    }
    
    clone.updatePriority = this.updatePriority
    clone.lastUpdateTime = this.lastUpdateTime
    clone.updateInterval = this.updateInterval
    
    clone.currentPath = [...this.currentPath]
    clone.pathIndex = this.pathIndex
    clone.lastPathfindTime = this.lastPathfindTime
    clone.pathfindCooldown = this.pathfindCooldown
    clone.stuckCounter = this.stuckCounter
    clone.lastPosition = this.lastPosition ? { ...this.lastPosition } : null
    
    return clone
  }

  serialize(): Record<string, unknown> {
    return {
      currentState: this.currentState,
      previousState: this.previousState,
      stateStartTime: this.stateStartTime,
      stateCooldowns: Array.from(this.stateCooldowns.entries()),
      
      personality: this.personality,
      aggressionLevel: this.aggressionLevel,
      fearLevel: this.fearLevel,
      curiosity: this.curiosity,
      loyalty: this.loyalty,
      
      targetId: this.targetId,
      targetPosition: this.targetPosition,
      homePosition: this.homePosition,
      guardPosition: this.guardPosition,
      patrolPath: this.patrolPath,
      currentPatrolIndex: this.currentPatrolIndex,
      
      sightRange: this.sightRange,
      hearingRange: this.hearingRange,
      attackRange: this.attackRange,
      fleeDistance: this.fleeDistance,
      fieldOfView: this.fieldOfView,
      
      moveSpeed: this.moveSpeed,
      turnSpeed: this.turnSpeed,
      preferredDistance: this.preferredDistance,
      avoidanceRadius: this.avoidanceRadius,
      
      attackCooldown: this.attackCooldown,
      lastAttackTime: this.lastAttackTime,
      damageDealt: this.damageDealt,
      damageReceived: this.damageReceived,
      
      memory: {
        lastSeenPositions: Array.from(this.memory.lastSeenPositions.entries()),
        damageReceived: Array.from(this.memory.damageReceived.entries()),
        threatLevels: Array.from(this.memory.threatLevels.entries()),
        blackboard: Array.from(this.memory.blackboard.entries())
      },
      
      updatePriority: this.updatePriority,
      lastUpdateTime: this.lastUpdateTime,
      updateInterval: this.updateInterval,
      
      currentPath: this.currentPath,
      pathIndex: this.pathIndex,
      lastPathfindTime: this.lastPathfindTime,
      pathfindCooldown: this.pathfindCooldown,
      stuckCounter: this.stuckCounter,
      lastPosition: this.lastPosition
    }
  }

  deserialize(data: Record<string, unknown>): void {
    this.currentState = data.currentState as AIState
    this.previousState = data.previousState as AIState
    this.stateStartTime = data.stateStartTime as number
    this.stateCooldowns = new Map(data.stateCooldowns as any)
    
    this.personality = data.personality as AIPersonality
    this.aggressionLevel = data.aggressionLevel as number
    this.fearLevel = data.fearLevel as number
    this.curiosity = data.curiosity as number
    this.loyalty = data.loyalty as number
    
    this.targetId = data.targetId as EntityId | null
    this.targetPosition = data.targetPosition as Vector2 | null
    this.homePosition = data.homePosition as Vector2 | null
    this.guardPosition = data.guardPosition as Vector2 | null
    this.patrolPath = data.patrolPath as Vector2[]
    this.currentPatrolIndex = data.currentPatrolIndex as number
    
    this.sightRange = data.sightRange as number
    this.hearingRange = data.hearingRange as number
    this.attackRange = data.attackRange as number
    this.fleeDistance = data.fleeDistance as number
    this.fieldOfView = data.fieldOfView as number
    
    this.moveSpeed = data.moveSpeed as number
    this.turnSpeed = data.turnSpeed as number
    this.preferredDistance = data.preferredDistance as number
    this.avoidanceRadius = data.avoidanceRadius as number
    
    this.attackCooldown = data.attackCooldown as number
    this.lastAttackTime = data.lastAttackTime as number
    this.damageDealt = data.damageDealt as number
    this.damageReceived = data.damageReceived as number
    
    const memoryData = data.memory as any
    this.memory = {
      lastSeenPositions: new Map(memoryData.lastSeenPositions),
      damageReceived: new Map(memoryData.damageReceived),
      threatLevels: new Map(memoryData.threatLevels),
      blackboard: new Map(memoryData.blackboard)
    }
    
    this.updatePriority = data.updatePriority as number
    this.lastUpdateTime = data.lastUpdateTime as number
    this.updateInterval = data.updateInterval as number
    
    this.currentPath = data.currentPath as Vector2[]
    this.pathIndex = data.pathIndex as number
    this.lastPathfindTime = data.lastPathfindTime as number
    this.pathfindCooldown = data.pathfindCooldown as number
    this.stuckCounter = data.stuckCounter as number
    this.lastPosition = data.lastPosition as Vector2 | null
    
    // Reinitialize state machine
    this.initializeStateMachine()
  }
}
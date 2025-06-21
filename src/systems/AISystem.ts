import { System } from '../core/ECS/System'
import type { EntityQuery, SystemUpdateContext, ComponentType, EntityId } from '../types/CoreTypes'
import { AIComponent, AIState, AIPersonality, type AIContext } from '../components/AI'
import { TransformComponent } from '../components/Transform'
import { MovementComponent } from '../components/Movement'
import { HealthComponent } from '../components/Health'
import { CombatComponent } from '../components/Combat'
import { Vector2Math, type Vector2 } from '../utils/Math'
import { SpatialHashGrid } from '../utils/SpatialPartitioning'
import { GameEventType } from '../types/Events'

/**
 * Pathfinding algorithm types
 */
export enum PathfindingType {
  FLOW_FIELD = 'flow_field',      // Best for many entities to same target
  A_STAR = 'a_star',              // Best for individual paths
  SIMPLE = 'simple',              // Direct line with obstacle avoidance
  DIJKSTRA = 'dijkstra',          // Guaranteed shortest path
  NAVIGATION_MESH = 'nav_mesh'    // Pre-computed navigation areas
}

/**
 * Path node for A* pathfinding
 */
interface PathNode {
  position: Vector2
  g: number  // Cost from start
  h: number  // Heuristic cost to goal
  f: number  // Total cost (g + h)
  parent: PathNode | null
}

/**
 * Flow field cell
 */
interface FlowFieldCell {
  direction: Vector2
  cost: number
  bestCost: number
}

/**
 * Navigation mesh polygon
 */
interface NavMeshPolygon {
  vertices: Vector2[]
  neighbors: number[]
  center: Vector2
}

/**
 * AI query type
 */
type AIEntityQuery = EntityQuery & {
  components: {
    ai: AIComponent
    transform: TransformComponent
    movement: MovementComponent
  }
}

/**
 * AI system configuration
 */
export interface AISystemConfig {
  pathfindingType: PathfindingType
  maxPathfindingPerFrame: number
  flowFieldResolution: number
  maxPathLength: number
  obstacleAvoidanceRadius: number
  groupBehaviorEnabled: boolean
  debugPathfinding: boolean
}

/**
 * AI System handles all AI behavior processing and pathfinding
 */
export class AISystem extends System {
  readonly name = 'ai'
  readonly requiredComponents: ComponentType[] = ['ai', 'transform', 'movement']

  private config: AISystemConfig
  private spatialGrid: SpatialHashGrid
  private eventSystem?: { emit: (eventType: string, data: unknown) => void }
  private world?: { 
    getEntity: (id: EntityId) => unknown
    getEntitiesWithComponents: (components: string[]) => unknown[]
    getSystem?: (name: string) => any
  }

  // Pathfinding cache
  private flowFields: Map<string, FlowFieldCell[][]> = new Map()
  private navigationMesh: NavMeshPolygon[] = []
  private pathCache: Map<string, Vector2[]> = new Map()
  private pathfindingQueue: Array<{ entity: AIEntityQuery; target: Vector2 }> = []
  private pathfindingThisFrame: number = 0

  // Performance tracking
  private lastUpdateTime: number = 0
  private aiUpdatesThisFrame: number = 0
  private maxAIUpdatesPerFrame: number = 50

  // Player tracking
  private playerEntityId: EntityId | null = null
  private playerPosition: Vector2 | null = null

  constructor(
    spatialGrid: SpatialHashGrid,
    config: Partial<AISystemConfig> = {},
    eventSystem?: { emit: (eventType: string, data: unknown) => void },
    world?: { 
      getEntity: (id: EntityId) => unknown
      getEntitiesWithComponents: (components: string[]) => unknown[]
      getSystem?: (name: string) => any
    }
  ) {
    super()
    this.spatialGrid = spatialGrid
    this.eventSystem = eventSystem
    this.world = world
    
    this.config = {
      pathfindingType: PathfindingType.FLOW_FIELD,
      maxPathfindingPerFrame: 10,
      flowFieldResolution: 32,
      maxPathLength: 50,
      obstacleAvoidanceRadius: 30,
      groupBehaviorEnabled: true,
      debugPathfinding: false,
      ...config
    }
  }

  initialize(): void {
    // Initialize navigation mesh if needed
    if (this.config.pathfindingType === PathfindingType.NAVIGATION_MESH) {
      this.generateNavigationMesh()
    }

    // Listen for events
    if (this.eventSystem) {
      this.eventSystem.emit('AI_SYSTEM_INITIALIZED', { config: this.config })
    }
  }

  update(context: SystemUpdateContext, entities: EntityQuery[]): void {
    const aiEntities = entities as AIEntityQuery[]
    const currentTime = context.totalTime
    
    this.aiUpdatesThisFrame = 0
    this.pathfindingThisFrame = 0

    // Update player reference
    this.updatePlayerReference()

    // Process pathfinding queue
    this.processPathfindingQueue()

    // Update flow fields if needed
    if (this.config.pathfindingType === PathfindingType.FLOW_FIELD && this.playerPosition) {
      this.updateFlowField(this.playerPosition, 'player')
    }

    // Update each AI entity
    aiEntities.forEach((entity, index) => {
      if (this.aiUpdatesThisFrame >= this.maxAIUpdatesPerFrame) return

      const ai = entity.components.ai
      
      // Check if should update based on priority
      if (!ai.shouldUpdate(currentTime)) return

      // Update AI
      this.updateSingleAI(entity, currentTime, context)
      ai.markUpdated(currentTime)
      this.aiUpdatesThisFrame++
    })

    // Clear old path cache
    if (currentTime - this.lastUpdateTime > 5000) {
      this.clearOldPathCache(currentTime)
      this.lastUpdateTime = currentTime
    }
  }

  /**
   * Updates a single AI entity
   */
  private updateSingleAI(entity: AIEntityQuery, currentTime: number, context: SystemUpdateContext): void {
    const ai = entity.components.ai
    const transform = entity.components.transform
    const movement = entity.components.movement
    const health = (entity as any).getComponent?.('health') as HealthComponent

    // Build AI context
    const aiContext = this.buildAIContext(entity, currentTime)

    // Update state machine
    const stateChanged = ai.updateStateMachine(aiContext, currentTime)
    if (stateChanged && this.eventSystem) {
      this.eventSystem.emit('AI_STATE_CHANGED', {
        entityId: entity.id,
        previousState: ai.previousState,
        newState: ai.currentState,
        timestamp: currentTime
      })
    }

    // Execute behavior tree if present
    if (ai.behaviorTree) {
      ai.executeBehaviorTree(aiContext)
    }

    // Process current state
    this.processAIState(entity, aiContext, currentTime)

    // Update pathfinding if needed
    if (this.shouldUpdatePath(entity, currentTime)) {
      this.requestPathfinding(entity, ai.targetPosition || ai.homePosition)
    }

    // Apply movement from pathfinding
    this.applyPathfindingMovement(entity, currentTime)

    // Apply group behaviors if enabled
    if (this.config.groupBehaviorEnabled) {
      this.applyGroupBehaviors(entity, currentTime)
    }
  }

  /**
   * Builds AI context for decision making
   */
  private buildAIContext(entity: AIEntityQuery, currentTime: number): AIContext {
    const ai = entity.components.ai
    const transform = entity.components.transform
    const health = (entity as any).getComponent?.('health') as HealthComponent

    // Get nearby entities
    const nearbyEntityIds = this.spatialGrid.query({
      position: transform.position,
      radius: Math.max(ai.sightRange, ai.hearingRange)
    })
    
    const nearbyEntities = nearbyEntityIds.map(id => 
      this.world?.getEntity(id)
    ).filter(e => e != null)

    let nearbyAllies = 0
    let nearbyEnemies = 0
    let targetVisible = false
    let distanceToTarget = Infinity

    nearbyEntities.forEach((nearbyEntity: any) => {
      if (nearbyEntity.id === entity.id) return

      const hasAI = nearbyEntity.hasComponent('ai')
      const isEnemy = !hasAI // Simple check - entities without AI are enemies (players)

      if (isEnemy) {
        nearbyEnemies++
        if (nearbyEntity.id === ai.targetId) {
          const targetTransform = nearbyEntity.getComponent('transform') as TransformComponent
          distanceToTarget = Vector2Math.distance(transform.position, targetTransform.position)
          targetVisible = this.checkLineOfSight(transform.position, targetTransform.position, ai.sightRange)
        }
      } else {
        nearbyAllies++
      }
    })

    // Check if stuck
    const isStuck = ai.checkStuck(transform.position)

    return {
      health: health?.current || 100,
      maxHealth: health?.maximum || 100,
      distanceToTarget,
      targetVisible,
      nearbyAllies,
      nearbyEnemies,
      isUnderAttack: currentTime - ai.lastAttackTime < 2000,
      timeSinceLastAttack: currentTime - ai.lastAttackTime,
      currentStateTime: currentTime - ai.stateStartTime,
      hasPath: ai.currentPath.length > 0,
      isStuck
    }
  }

  /**
   * Processes the current AI state
   */
  private processAIState(entity: AIEntityQuery, context: AIContext, currentTime: number): void {
    const ai = entity.components.ai

    switch (ai.currentState) {
      case AIState.IDLE:
        this.processIdleState(entity, context, currentTime)
        break

      case AIState.PATROL:
        this.processPatrolState(entity, context, currentTime)
        break

      case AIState.CHASE:
        this.processChaseState(entity, context, currentTime)
        break

      case AIState.ATTACK:
        this.processAttackState(entity, context, currentTime)
        break

      case AIState.FLEE:
        this.processFleeState(entity, context, currentTime)
        break

      case AIState.INVESTIGATE:
        this.processInvestigateState(entity, context, currentTime)
        break

      case AIState.RETREAT:
        this.processRetreatState(entity, context, currentTime)
        break

      case AIState.SUPPORT:
        this.processSupportState(entity, context, currentTime)
        break

      case AIState.GUARD:
        this.processGuardState(entity, context, currentTime)
        break
    }
  }

  /**
   * Process idle state
   */
  private processIdleState(entity: AIEntityQuery, context: AIContext, currentTime: number): void {
    const ai = entity.components.ai
    const movement = entity.components.movement

    // Stop movement
    movement.setVelocity(0, 0)

    // Look for targets periodically
    if (context.nearbyEnemies > 0 && this.playerEntityId) {
      ai.setTarget(this.playerEntityId, this.playerPosition || undefined)
    }
  }

  /**
   * Process patrol state
   */
  private processPatrolState(entity: AIEntityQuery, context: AIContext, currentTime: number): void {
    const ai = entity.components.ai
    const transform = entity.components.transform

    if (ai.patrolPath.length === 0) return

    const currentTarget = ai.patrolPath[ai.currentPatrolIndex]
    const distance = Vector2Math.distance(transform.position, currentTarget)

    if (distance < 20) {
      // Reached patrol point
      ai.currentPatrolIndex = (ai.currentPatrolIndex + 1) % ai.patrolPath.length
      ai.setPath([]) // Clear path to recalculate
    } else if (!ai.currentPath.length) {
      // Request path to patrol point
      this.requestPathfinding(entity, currentTarget)
    }
  }

  /**
   * Process chase state
   */
  private processChaseState(entity: AIEntityQuery, context: AIContext, currentTime: number): void {
    const ai = entity.components.ai

    if (!ai.targetPosition) return

    // Update path to target
    if (currentTime - ai.lastPathfindTime > ai.pathfindCooldown) {
      this.requestPathfinding(entity, ai.targetPosition)
    }

    // If lost sight of target, go to last known position
    if (!context.targetVisible && ai.memory.lastSeenPositions.has(ai.targetId!)) {
      const lastPos = ai.memory.lastSeenPositions.get(ai.targetId!)!
      this.requestPathfinding(entity, lastPos)
    }
  }

  /**
   * Process attack state
   */
  private processAttackState(entity: AIEntityQuery, context: AIContext, currentTime: number): void {
    const ai = entity.components.ai
    const combat = (entity as any).getComponent?.('combat') as CombatComponent

    if (!combat || !ai.targetId || currentTime - ai.lastAttackTime < ai.attackCooldown) return

    // Perform attack
    if (this.world) {
      const combatSystem = this.world.getSystem?.('combat')
      if (combatSystem && combatSystem.triggerAttack) {
        combatSystem.triggerAttack(entity, ai.targetId)
        ai.lastAttackTime = currentTime
      }
    }
  }

  /**
   * Process flee state
   */
  private processFleeState(entity: AIEntityQuery, context: AIContext, currentTime: number): void {
    const ai = entity.components.ai
    const transform = entity.components.transform

    if (!ai.targetPosition) return

    // Calculate flee direction (away from threat)
    const fleeDirection = Vector2Math.normalize(
      Vector2Math.subtract(transform.position, ai.targetPosition)
    )

    const fleeTarget = {
      x: transform.position.x + fleeDirection.x * ai.fleeDistance,
      y: transform.position.y + fleeDirection.y * ai.fleeDistance
    }

    // Request path away from threat
    this.requestPathfinding(entity, fleeTarget)
  }

  /**
   * Process investigate state
   */
  private processInvestigateState(entity: AIEntityQuery, context: AIContext, currentTime: number): void {
    const ai = entity.components.ai

    // Move to last known position of target
    if (ai.targetId && ai.memory.lastSeenPositions.has(ai.targetId)) {
      const investigatePos = ai.memory.lastSeenPositions.get(ai.targetId)!
      this.requestPathfinding(entity, investigatePos)
    }
  }

  /**
   * Process retreat state
   */
  private processRetreatState(entity: AIEntityQuery, context: AIContext, currentTime: number): void {
    const ai = entity.components.ai
    const transform = entity.components.transform

    // Retreat to a safe distance while maintaining sight
    if (ai.targetPosition) {
      const retreatDirection = Vector2Math.normalize(
        Vector2Math.subtract(transform.position, ai.targetPosition)
      )

      const retreatTarget = {
        x: ai.targetPosition.x + retreatDirection.x * ai.preferredDistance,
        y: ai.targetPosition.y + retreatDirection.y * ai.preferredDistance
      }

      this.requestPathfinding(entity, retreatTarget)
    }
  }

  /**
   * Process support state
   */
  private processSupportState(entity: AIEntityQuery, context: AIContext, currentTime: number): void {
    const ai = entity.components.ai

    // Find nearest ally that needs help
    const nearbyEntityIds = this.spatialGrid.query({
      position: entity.components.transform.position,
      radius: ai.sightRange
    })
    
    const nearbyEntities = nearbyEntityIds.map(id => 
      this.world?.getEntity(id)
    ).filter(e => e != null)

    let lowestHealthAlly: EntityQuery | null = null
    let lowestHealth = 1.0

    nearbyEntities.forEach((nearbyEntity: any) => {
      if (nearbyEntity.id === entity.id) return
      if (!nearbyEntity.hasComponent('ai')) return

      const health = nearbyEntity.getComponent('health') as HealthComponent
      if (health) {
        const healthPercent = health.current / health.maximum
        if (healthPercent < lowestHealth) {
          lowestHealth = healthPercent
          lowestHealthAlly = nearbyEntity
        }
      }
    })

    if (lowestHealthAlly && lowestHealth < 0.5) {
      const allyTransform = (lowestHealthAlly as any).getComponent('transform') as TransformComponent
      this.requestPathfinding(entity, allyTransform.position)
    }
  }

  /**
   * Process guard state
   */
  private processGuardState(entity: AIEntityQuery, context: AIContext, currentTime: number): void {
    const ai = entity.components.ai
    const transform = entity.components.transform

    if (!ai.guardPosition) return

    const distanceToGuardPos = Vector2Math.distance(transform.position, ai.guardPosition)

    // Return to guard position if too far
    if (distanceToGuardPos > ai.sightRange / 2) {
      this.requestPathfinding(entity, ai.guardPosition)
    } else if (context.nearbyEnemies > 0) {
      // Face towards nearest enemy
      const movement = entity.components.movement
      movement.setVelocity(0, 0) // Stand ground
    }
  }

  /**
   * Checks if should update path
   */
  private shouldUpdatePath(entity: AIEntityQuery, currentTime: number): boolean {
    const ai = entity.components.ai

    // Don't update if recently calculated
    if (currentTime - ai.lastPathfindTime < ai.pathfindCooldown) return false

    // Update if stuck
    if (ai.stuckCounter > 5) return true

    // Update if no path
    if (ai.currentPath.length === 0) return true

    // Update if target moved significantly
    if (ai.targetPosition && ai.currentPath.length > 0) {
      const pathTarget = ai.currentPath[ai.currentPath.length - 1]
      const targetMoved = Vector2Math.distance(pathTarget, ai.targetPosition) > 50
      if (targetMoved) return true
    }

    return false
  }

  /**
   * Requests pathfinding for an entity
   */
  private requestPathfinding(entity: AIEntityQuery, target: Vector2 | null): void {
    if (!target) return

    // Add to pathfinding queue
    this.pathfindingQueue.push({ entity, target })
  }

  /**
   * Processes pathfinding queue
   */
  private processPathfindingQueue(): void {
    while (this.pathfindingQueue.length > 0 && this.pathfindingThisFrame < this.config.maxPathfindingPerFrame) {
      const request = this.pathfindingQueue.shift()!
      this.calculatePath(request.entity, request.target)
      this.pathfindingThisFrame++
    }
  }

  /**
   * Calculates path for entity
   */
  private calculatePath(entity: AIEntityQuery, target: Vector2): void {
    const ai = entity.components.ai
    const transform = entity.components.transform
    const currentTime = Date.now()

    // Check cache first
    const cacheKey = `${Math.floor(transform.position.x / 50)},${Math.floor(transform.position.y / 50)}-${Math.floor(target.x / 50)},${Math.floor(target.y / 50)}`
    if (this.pathCache.has(cacheKey)) {
      ai.setPath(this.pathCache.get(cacheKey)!)
      ai.lastPathfindTime = currentTime
      return
    }

    let path: Vector2[] = []

    switch (this.config.pathfindingType) {
      case PathfindingType.SIMPLE:
        path = this.calculateSimplePath(transform.position, target)
        break

      case PathfindingType.A_STAR:
        path = this.calculateAStarPath(transform.position, target)
        break

      case PathfindingType.FLOW_FIELD:
        path = this.calculateFlowFieldPath(transform.position, target)
        break

      case PathfindingType.DIJKSTRA:
        path = this.calculateDijkstraPath(transform.position, target)
        break

      case PathfindingType.NAVIGATION_MESH:
        path = this.calculateNavMeshPath(transform.position, target)
        break
    }

    // Cache path
    if (path.length > 0) {
      this.pathCache.set(cacheKey, path)
    }

    ai.setPath(path)
    ai.lastPathfindTime = currentTime
  }

  /**
   * Simple path calculation (direct line with obstacle avoidance)
   */
  private calculateSimplePath(start: Vector2, end: Vector2): Vector2[] {
    const path: Vector2[] = []
    const distance = Vector2Math.distance(start, end)
    const steps = Math.ceil(distance / 50)

    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      path.push({
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t
      })
    }

    return path
  }

  /**
   * A* pathfinding algorithm
   */
  private calculateAStarPath(start: Vector2, end: Vector2): Vector2[] {
    const gridSize = 20
    const openSet: PathNode[] = []
    const closedSet: Set<string> = new Set()

    const startNode: PathNode = {
      position: start,
      g: 0,
      h: Vector2Math.distance(start, end),
      f: 0,
      parent: null
    }
    startNode.f = startNode.g + startNode.h

    openSet.push(startNode)

    while (openSet.length > 0 && closedSet.size < this.config.maxPathLength) {
      // Get node with lowest f cost
      openSet.sort((a, b) => a.f - b.f)
      const current = openSet.shift()!

      // Check if reached goal
      if (Vector2Math.distance(current.position, end) < gridSize) {
        return this.reconstructPath(current)
      }

      const key = `${Math.floor(current.position.x / gridSize)},${Math.floor(current.position.y / gridSize)}`
      closedSet.add(key)

      // Check neighbors
      const neighbors = this.getNeighbors(current.position, gridSize)
      for (const neighborPos of neighbors) {
        const neighborKey = `${Math.floor(neighborPos.x / gridSize)},${Math.floor(neighborPos.y / gridSize)}`
        if (closedSet.has(neighborKey)) continue

        const g = current.g + Vector2Math.distance(current.position, neighborPos)
        const h = Vector2Math.distance(neighborPos, end)
        const f = g + h

        const existingNode = openSet.find(n => 
          Math.abs(n.position.x - neighborPos.x) < gridSize &&
          Math.abs(n.position.y - neighborPos.y) < gridSize
        )

        if (!existingNode) {
          openSet.push({
            position: neighborPos,
            g, h, f,
            parent: current
          })
        } else if (g < existingNode.g) {
          existingNode.g = g
          existingNode.f = f
          existingNode.parent = current
        }
      }
    }

    // No path found, return direct path
    return this.calculateSimplePath(start, end)
  }

  /**
   * Flow field pathfinding (efficient for many entities to same target)
   */
  private calculateFlowFieldPath(start: Vector2, target: Vector2): Vector2[] {
    const fieldKey = `${Math.floor(target.x / 100)},${Math.floor(target.y / 100)}`
    let flowField = this.flowFields.get(fieldKey)

    if (!flowField) {
      flowField = this.generateFlowField(target)
      this.flowFields.set(fieldKey, flowField)
    }

    // Follow flow field to target
    const path: Vector2[] = []
    let current = { ...start }
    const stepSize = this.config.flowFieldResolution

    for (let i = 0; i < this.config.maxPathLength; i++) {
      const gridX = Math.floor(current.x / stepSize)
      const gridY = Math.floor(current.y / stepSize)

      if (gridY >= 0 && gridY < flowField.length && gridX >= 0 && gridX < flowField[0].length) {
        const cell = flowField[gridY][gridX]
        if (cell.cost === Infinity) break

        current = {
          x: current.x + cell.direction.x * stepSize,
          y: current.y + cell.direction.y * stepSize
        }
        path.push({ ...current })

        if (Vector2Math.distance(current, target) < stepSize) break
      } else {
        break
      }
    }

    return path
  }

  /**
   * Dijkstra pathfinding (guaranteed shortest path)
   */
  private calculateDijkstraPath(start: Vector2, end: Vector2): Vector2[] {
    // Similar to A* but without heuristic
    return this.calculateAStarPath(start, end) // Simplified for now
  }

  /**
   * Navigation mesh pathfinding
   */
  private calculateNavMeshPath(start: Vector2, end: Vector2): Vector2[] {
    if (this.navigationMesh.length === 0) {
      return this.calculateSimplePath(start, end)
    }

    // Find polygons containing start and end
    const startPoly = this.findNavMeshPolygon(start)
    const endPoly = this.findNavMeshPolygon(end)

    if (!startPoly || !endPoly) {
      return this.calculateSimplePath(start, end)
    }

    // TODO: Implement polygon path search
    return this.calculateSimplePath(start, end)
  }

  /**
   * Generates flow field for a target
   */
  private generateFlowField(target: Vector2): FlowFieldCell[][] {
    const resolution = this.config.flowFieldResolution
    const gridWidth = Math.ceil(1000 / resolution)
    const gridHeight = Math.ceil(1000 / resolution)

    // Initialize grid
    const grid: FlowFieldCell[][] = []
    for (let y = 0; y < gridHeight; y++) {
      grid[y] = []
      for (let x = 0; x < gridWidth; x++) {
        grid[y][x] = {
          direction: { x: 0, y: 0 },
          cost: Infinity,
          bestCost: Infinity
        }
      }
    }

    // Set target cell cost to 0
    const targetX = Math.floor(target.x / resolution)
    const targetY = Math.floor(target.y / resolution)
    if (targetY >= 0 && targetY < gridHeight && targetX >= 0 && targetX < gridWidth) {
      grid[targetY][targetX].cost = 0
      grid[targetY][targetX].bestCost = 0
    }

    // Calculate costs (wave propagation)
    const queue: Vector2[] = [{ x: targetX, y: targetY }]
    const directions = [
      { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 },
      { x: -1, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }
    ]

    while (queue.length > 0) {
      const current = queue.shift()!
      const currentCost = grid[current.y][current.x].bestCost

      for (const dir of directions) {
        const nextX = current.x + dir.x
        const nextY = current.y + dir.y

        if (nextY >= 0 && nextY < gridHeight && nextX >= 0 && nextX < gridWidth) {
          const newCost = currentCost + (Math.abs(dir.x) + Math.abs(dir.y) > 1 ? 1.414 : 1)
          
          if (newCost < grid[nextY][nextX].bestCost) {
            grid[nextY][nextX].bestCost = newCost
            queue.push({ x: nextX, y: nextY })
          }
        }
      }
    }

    // Calculate flow directions
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        if (grid[y][x].bestCost === Infinity) continue

        let bestDir = { x: 0, y: 0 }
        let bestCost = grid[y][x].bestCost

        for (const dir of directions) {
          const nextX = x + dir.x
          const nextY = y + dir.y

          if (nextY >= 0 && nextY < gridHeight && nextX >= 0 && nextX < gridWidth) {
            if (grid[nextY][nextX].bestCost < bestCost) {
              bestCost = grid[nextY][nextX].bestCost
              bestDir = dir
            }
          }
        }

        grid[y][x].direction = Vector2Math.normalize(bestDir)
      }
    }

    return grid
  }

  /**
   * Gets neighbor positions for pathfinding
   */
  private getNeighbors(position: Vector2, gridSize: number): Vector2[] {
    const neighbors: Vector2[] = []
    const directions = [
      { x: 0, y: -gridSize }, { x: gridSize, y: 0 },
      { x: 0, y: gridSize }, { x: -gridSize, y: 0 },
      { x: -gridSize, y: -gridSize }, { x: gridSize, y: -gridSize },
      { x: gridSize, y: gridSize }, { x: -gridSize, y: gridSize }
    ]

    for (const dir of directions) {
      const neighborPos = {
        x: position.x + dir.x,
        y: position.y + dir.y
      }

      // Check if position is valid (would check obstacles here)
      neighbors.push(neighborPos)
    }

    return neighbors
  }

  /**
   * Reconstructs path from A* nodes
   */
  private reconstructPath(endNode: PathNode): Vector2[] {
    const path: Vector2[] = []
    let current: PathNode | null = endNode

    while (current) {
      path.unshift({ ...current.position })
      current = current.parent
    }

    return path
  }

  /**
   * Applies movement from pathfinding
   */
  private applyPathfindingMovement(entity: AIEntityQuery, currentTime: number): void {
    const ai = entity.components.ai
    const transform = entity.components.transform
    const movement = entity.components.movement

    const waypoint = ai.getNextWaypoint()
    if (!waypoint) {
      movement.setVelocity(0, 0)
      return
    }

    const distance = Vector2Math.distance(transform.position, waypoint)
    if (distance < 10) {
      ai.advanceWaypoint()
      return
    }

    // Calculate movement direction
    const direction = Vector2Math.normalize(
      Vector2Math.subtract(waypoint, transform.position)
    )

    // Apply movement with speed modifier
    const speed = movement.maxSpeed * ai.moveSpeed
    movement.setVelocity(direction.x * speed, direction.y * speed)

    // Apply obstacle avoidance
    this.applyObstacleAvoidance(entity, direction)
  }

  /**
   * Applies obstacle avoidance
   */
  private applyObstacleAvoidance(entity: AIEntityQuery, desiredDirection: Vector2): void {
    const transform = entity.components.transform
    const movement = entity.components.movement
    const ai = entity.components.ai

    // Get nearby entities for avoidance
    const nearbyEntityIds = this.spatialGrid.query({
      position: transform.position,
      radius: ai.avoidanceRadius
    })
    
    const nearbyEntities = nearbyEntityIds.map(id => 
      this.world?.getEntity(id)
    ).filter(e => e != null)

    let avoidanceForce = { x: 0, y: 0 }

    nearbyEntities.forEach((other: any) => {
      if (other.id === entity.id) return

      const otherTransform = other.getComponent('transform') as TransformComponent
      const distance = Vector2Math.distance(transform.position, otherTransform.position)

      if (distance < ai.avoidanceRadius && distance > 0) {
        const avoidDir = Vector2Math.normalize(
          Vector2Math.subtract(transform.position, otherTransform.position)
        )
        const strength = 1 - (distance / ai.avoidanceRadius)
        avoidanceForce.x += avoidDir.x * strength
        avoidanceForce.y += avoidDir.y * strength
      }
    })

    // Combine desired direction with avoidance
    if (avoidanceForce.x !== 0 || avoidanceForce.y !== 0) {
      avoidanceForce = Vector2Math.normalize(avoidanceForce)
      const combinedDir = Vector2Math.normalize({
        x: desiredDirection.x * 0.7 + avoidanceForce.x * 0.3,
        y: desiredDirection.y * 0.7 + avoidanceForce.y * 0.3
      })

      const speed = movement.maxSpeed * ai.moveSpeed
      movement.setVelocity(combinedDir.x * speed, combinedDir.y * speed)
    }
  }

  /**
   * Applies group behaviors (flocking, formations)
   */
  private applyGroupBehaviors(entity: AIEntityQuery, currentTime: number): void {
    const ai = entity.components.ai
    const transform = entity.components.transform
    const movement = entity.components.movement

    if (ai.personality !== AIPersonality.SWARM) return

    const nearbyAllyIds = this.spatialGrid.query({
      position: transform.position,
      radius: 100
    })
    
    const nearbyAllies = nearbyAllyIds.map(id => 
      this.world?.getEntity(id)
    ).filter((e: any) => e && e.hasComponent('ai') && e.id !== entity.id)

    if (nearbyAllies.length === 0) return

    let separation = { x: 0, y: 0 }
    let alignment = { x: 0, y: 0 }
    let cohesion = { x: 0, y: 0 }

    nearbyAllies.forEach((ally: any) => {
      const allyTransform = ally.getComponent('transform') as TransformComponent
      const allyMovement = ally.getComponent('movement') as MovementComponent
      const distance = Vector2Math.distance(transform.position, allyTransform.position)

      // Separation
      if (distance < 30) {
        const separateDir = Vector2Math.normalize(
          Vector2Math.subtract(transform.position, allyTransform.position)
        )
        separation.x += separateDir.x / distance
        separation.y += separateDir.y / distance
      }

      // Alignment
      alignment.x += allyMovement.velocity.x
      alignment.y += allyMovement.velocity.y

      // Cohesion
      cohesion.x += allyTransform.position.x
      cohesion.y += allyTransform.position.y
    })

    // Average behaviors
    if (nearbyAllies.length > 0) {
      alignment = Vector2Math.normalize({
        x: alignment.x / nearbyAllies.length,
        y: alignment.y / nearbyAllies.length
      })

      cohesion = {
        x: cohesion.x / nearbyAllies.length - transform.position.x,
        y: cohesion.y / nearbyAllies.length - transform.position.y
      }
      cohesion = Vector2Math.normalize(cohesion)
    }

    // Combine behaviors
    const flockingForce = {
      x: separation.x * 0.5 + alignment.x * 0.3 + cohesion.x * 0.2,
      y: separation.y * 0.5 + alignment.y * 0.3 + cohesion.y * 0.2
    }

    if (flockingForce.x !== 0 || flockingForce.y !== 0) {
      const currentVel = movement.velocity
      const newVel = {
        x: currentVel.x * 0.8 + flockingForce.x * movement.maxSpeed * 0.2,
        y: currentVel.y * 0.8 + flockingForce.y * movement.maxSpeed * 0.2
      }
      movement.setVelocity(newVel.x, newVel.y)
    }
  }

  /**
   * Checks line of sight between two points
   */
  private checkLineOfSight(from: Vector2, to: Vector2, maxRange: number): boolean {
    const distance = Vector2Math.distance(from, to)
    if (distance > maxRange) return false

    // Simple line of sight check - would check obstacles in real implementation
    return true
  }

  /**
   * Updates player reference
   */
  private updatePlayerReference(): void {
    if (!this.world) return

    const entities = this.world.getEntitiesWithComponents(['transform', 'health'])
    const player = entities.find((e: any) => !e.hasComponent('ai')) as any

    if (player) {
      this.playerEntityId = player.id
      const transform = player.getComponent('transform') as TransformComponent
      this.playerPosition = { ...transform.position }
    }
  }

  /**
   * Updates flow field for a target
   */
  private updateFlowField(target: Vector2, key: string): void {
    const flowField = this.generateFlowField(target)
    this.flowFields.set(key, flowField)
  }

  /**
   * Finds nav mesh polygon containing point
   */
  private findNavMeshPolygon(point: Vector2): NavMeshPolygon | null {
    // TODO: Implement point-in-polygon test
    return null
  }

  /**
   * Generates navigation mesh
   */
  private generateNavigationMesh(): void {
    // TODO: Generate nav mesh from world geometry
  }

  /**
   * Clears old cached paths
   */
  private clearOldPathCache(currentTime: number): void {
    // Clear half of cache when it gets too large
    if (this.pathCache.size > 100) {
      const keysToDelete: string[] = []
      let count = 0
      this.pathCache.forEach((path, key) => {
        if (count++ < this.pathCache.size / 2) {
          keysToDelete.push(key)
        }
      })
      keysToDelete.forEach(key => this.pathCache.delete(key))
    }

    // Clear old flow fields
    if (this.flowFields.size > 10) {
      const keysToDelete: string[] = []
      let count = 0
      this.flowFields.forEach((field, key) => {
        if (count++ < this.flowFields.size / 2) {
          keysToDelete.push(key)
        }
      })
      keysToDelete.forEach(key => this.flowFields.delete(key))
    }
  }

  /**
   * Gets system statistics
   */
  getStats(): Record<string, unknown> {
    return {
      aiUpdatesThisFrame: this.aiUpdatesThisFrame,
      pathfindingThisFrame: this.pathfindingThisFrame,
      pathCacheSize: this.pathCache.size,
      flowFieldCount: this.flowFields.size,
      pathfindingQueueLength: this.pathfindingQueue.length,
      pathfindingType: this.config.pathfindingType
    }
  }
}
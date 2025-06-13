import { System } from '../core/ECS/System'
import type { 
  EntityQuery, 
  SystemUpdateContext, 
  ComponentType,
  EntityId
} from '../types/CoreTypes'
import { EnemyAIComponent, AIBehaviorState, type AIDecisionFactors, type AIAction } from '../components/EnemyAI'
import { SpawnerComponent, SpawnTiming, type EnemyType, type ComponentTemplate } from '../components/Spawner'
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

  private eventSystem?: { emit: (eventType: string, data: unknown) => void; on: (eventType: string, callback: (event: unknown) => void) => void }
  private world?: { getEntity: (id: EntityId) => unknown; createEntity: () => { id: EntityId; addComponent: (comp: unknown) => void; getComponent: (type: string) => unknown }; getEntitiesWithComponents: (components: string[]) => unknown[]; getSystem: (name: string) => unknown }
  private config: EnemySystemConfig
  private playerEntityId: EntityId | null = null
  private lastAIUpdate: number = 0
  private lastSpawnerUpdate: number = 0

  // Performance tracking
  private aiUpdatesThisFrame: number = 0
  private maxAIUpdatesPerFrame: number = 20

  constructor(
    eventSystem?: { emit: (eventType: string, data: unknown) => void; on: (eventType: string, callback: (event: unknown) => void) => void }, 
    world?: { getEntity: (id: EntityId) => unknown; createEntity: () => { id: EntityId; addComponent: (comp: unknown) => void; getComponent: (type: string) => unknown }; getEntitiesWithComponents: (components: string[]) => unknown[]; getSystem: (name: string) => unknown }, 
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
      ...config
    }
  }

  initialize(): void {
    if (this.eventSystem) {
      // Listen for entity death to update AI targets
      this.eventSystem.on(GameEventType.ENTITY_KILLED, this.handleEntityDeath.bind(this))
      this.eventSystem.on(GameEventType.DAMAGE_DEALT, this.handleDamageDealt.bind(this))
    }
  }

  update(context: SystemUpdateContext, entities: EntityQuery[]): void {
    const currentTime = context.totalTime
    this.aiUpdatesThisFrame = 0

    // Find player entity for AI targeting
    this.updatePlayerReference()

    // Update spawners
    if (currentTime - this.lastSpawnerUpdate >= this.config.spawnerUpdateInterval) {
      this.updateSpawners(entities, currentTime, context)
      this.lastSpawnerUpdate = currentTime
    }

    // Update AI entities
    if (currentTime - this.lastAIUpdate >= this.config.aiUpdateInterval) {
      this.updateEnemyAI(entities as EnemyEntityQuery[], currentTime, context)
      this.lastAIUpdate = currentTime
    }
  }

  /**
   * Updates enemy AI behavior
   */
  private updateEnemyAI(entities: EnemyEntityQuery[], currentTime: number, context: SystemUpdateContext): void {
    const playerEntity = this.getPlayerEntity()
    
    entities.forEach((entity, index) => {
      // Performance optimization: limit AI updates per frame
      if (this.config.performanceMode && this.aiUpdatesThisFrame >= this.maxAIUpdatesPerFrame) {
        return
      }

      const aiComponent = entity.components.enemyAI
      
      // Check if this AI should update (performance optimization)
      if (!aiComponent.shouldUpdate(currentTime)) {
        return
      }

      this.updateSingleEnemyAI(entity, playerEntity, currentTime, context)
      aiComponent.markUpdated(currentTime)
      this.aiUpdatesThisFrame++
    })
  }

  /**
   * Updates a single enemy's AI
   */
  private updateSingleEnemyAI(
    enemy: EnemyEntityQuery, 
    player: { id: EntityId; getComponent: (type: string) => unknown } | null, 
    currentTime: number, 
    context: SystemUpdateContext
  ): void {
    const aiComponent = enemy.components.enemyAI
    const healthComponent = enemy.components.health
    const transformComponent = enemy.components.transform
    const movementComponent = enemy.components.movement

    // Check if health component exists and skip dead enemies
    if (!healthComponent || healthComponent.isDead()) {
      if (aiComponent.currentState !== AIBehaviorState.DEAD) {
        aiComponent.currentState = AIBehaviorState.DEAD
        this.handleEnemyDeath(enemy, currentTime)
      }
      return
    }

    // Calculate decision factors
    const factors = this.calculateDecisionFactors(enemy, player, currentTime)
    
    // Update AI state
    const stateChanged = aiComponent.updateState(factors, currentTime)
    if (stateChanged && this.eventSystem) {
      this.eventSystem.emit('ENEMY_STATE_CHANGED', {
        entityId: enemy.id,
        previousState: aiComponent.previousState,
        newState: aiComponent.currentState,
        timestamp: currentTime
      })
    }

    // Process current state
    this.processEnemyState(enemy, player, factors, currentTime, context)

    // Execute queued actions
    this.executeEnemyActions(enemy, currentTime, context)
  }

  /**
   * Calculates decision factors for AI
   */
  private calculateDecisionFactors(
    enemy: EnemyEntityQuery, 
    player: { id: EntityId; getComponent: (type: string) => unknown } | null, 
    currentTime: number
  ): AIDecisionFactors {
    const aiComponent = enemy.components.enemyAI
    const healthComponent = enemy.components.health
    const transformComponent = enemy.components.transform

    // Calculate distance to target
    let distanceToTarget = Infinity
    if (player && aiComponent.targetEntityId === player.id) {
      const playerTransform = player.getComponent('transform')
      if (playerTransform) {
        distanceToTarget = Vector2Math.distance(
          transformComponent.position, 
          playerTransform.position
        )
      }
    }

    // Count nearby allies and enemies
    const nearbyAllies = this.config.groupBehaviorEnabled ? 
      this.countNearbyEntities(enemy, 'ally', aiComponent.groupRadius) : 0
    const nearbyEnemies = this.countNearbyEntities(enemy, 'enemy', aiComponent.detectionRange)

    return {
      healthPercentage: healthComponent.getHealthPercentage(),
      nearbyAllies,
      nearbyEnemies,
      distanceToTarget,
      timeSinceLastAction: currentTime - aiComponent.lastActionTime,
      damageReceived: currentTime - aiComponent.lastDamageTime < 5000 ? 1 : 0
    }
  }

  /**
   * Processes the current AI state
   */
  private processEnemyState(
    enemy: EnemyEntityQuery, 
    player: { id: EntityId; getComponent: (type: string) => unknown } | null, 
    factors: AIDecisionFactors, 
    currentTime: number,
    context: SystemUpdateContext
  ): void {
    const aiComponent = enemy.components.enemyAI

    switch (aiComponent.currentState) {
      case AIBehaviorState.IDLE:
        this.processIdleState(enemy, player, factors, currentTime)
        break

      case AIBehaviorState.SEEKING:
        this.processSeekingState(enemy, player, factors, currentTime)
        break

      case AIBehaviorState.ATTACKING:
        this.processAttackingState(enemy, player, factors, currentTime)
        break

      case AIBehaviorState.FLEEING:
        this.processFleeingState(enemy, player, factors, currentTime)
        break

      case AIBehaviorState.PATROLLING:
        this.processPatrollingState(enemy, factors, currentTime)
        break

      case AIBehaviorState.STUNNED:
        this.processStunnedState(enemy, currentTime)
        break
    }
  }

  /**
   * Processes idle state
   */
  private processIdleState(
    enemy: EnemyEntityQuery, 
    player: { id: EntityId; getComponent: (type: string) => unknown } | null, 
    factors: AIDecisionFactors, 
    currentTime: number
  ): void {
    const aiComponent = enemy.components.enemyAI

    // Look for targets
    if (player && factors.distanceToTarget <= aiComponent.detectionRange) {
      aiComponent.setTarget(player.id, player.getComponent('transform').position)
    }

    // Queue idle actions (like random movement)
    if (aiComponent.canPerformAction(currentTime)) {
      const idleAction: AIAction = {
        type: 'wait',
        duration: 1000 + Math.random() * 2000,
        priority: 1
      }
      aiComponent.queueAction(idleAction)
    }
  }

  /**
   * Processes seeking state
   */
  private processSeekingState(
    enemy: EnemyEntityQuery, 
    player: { id: EntityId; getComponent: (type: string) => unknown } | null, 
    factors: AIDecisionFactors, 
    currentTime: number
  ): void {
    const aiComponent = enemy.components.enemyAI
    const transformComponent = enemy.components.transform

    if (player && aiComponent.targetEntityId === player.id) {
      const playerTransform = player.getComponent('transform')
      
      // Update last known position
      aiComponent.lastKnownTargetPosition = { ...playerTransform.position }

      // Queue movement action
      const moveAction: AIAction = {
        type: 'move',
        target: player.id,
        position: playerTransform.position,
        priority: 3
      }
      aiComponent.queueAction(moveAction)
    }
  }

  /**
   * Processes attacking state
   */
  private processAttackingState(
    enemy: EnemyEntityQuery, 
    player: { id: EntityId; getComponent: (type: string) => unknown } | null, 
    factors: AIDecisionFactors, 
    currentTime: number
  ): void {
    const aiComponent = enemy.components.enemyAI

    if (player && aiComponent.canPerformAction(currentTime)) {
      const attackAction: AIAction = {
        type: 'attack',
        target: player.id,
        priority: 5
      }
      aiComponent.queueAction(attackAction)
    }
  }

  /**
   * Processes fleeing state
   */
  private processFleeingState(
    enemy: EnemyEntityQuery, 
    player: { id: EntityId; getComponent: (type: string) => unknown } | null, 
    factors: AIDecisionFactors, 
    currentTime: number
  ): void {
    const aiComponent = enemy.components.enemyAI
    const transformComponent = enemy.components.transform

    if (player) {
      const playerTransform = player.getComponent('transform')
      
      // Calculate flee direction (away from player)
      const fleeDirection = Vector2Math.normalize(
        Vector2Math.subtract(transformComponent.position, playerTransform.position)
      )
      
      const fleePosition = {
        x: transformComponent.position.x + fleeDirection.x * 200,
        y: transformComponent.position.y + fleeDirection.y * 200
      }

      const fleeAction: AIAction = {
        type: 'move',
        position: fleePosition,
        priority: 4
      }
      aiComponent.queueAction(fleeAction)
    }
  }

  /**
   * Processes patrolling state
   */
  private processPatrollingState(
    enemy: EnemyEntityQuery, 
    factors: AIDecisionFactors, 
    currentTime: number
  ): void {
    const aiComponent = enemy.components.enemyAI
    const transformComponent = enemy.components.transform

    const currentPatrol = aiComponent.getCurrentPatrolTarget()
    if (currentPatrol) {
      const distanceToPatrol = Vector2Math.distance(
        transformComponent.position, 
        currentPatrol.position
      )

      if (distanceToPatrol < 20) { // Reached patrol point
        if (currentTime - aiComponent.lastPatrolTime > currentPatrol.waitTime) {
          aiComponent.nextPatrolPoint()
          aiComponent.lastPatrolTime = currentTime
        }
      } else {
        const moveAction: AIAction = {
          type: 'move',
          position: currentPatrol.position,
          priority: 2
        }
        aiComponent.queueAction(moveAction)
      }
    }
  }

  /**
   * Processes stunned state
   */
  private processStunnedState(enemy: EnemyEntityQuery, currentTime: number): void {
    // Clear all actions while stunned
    enemy.components.enemyAI.clearActions()
  }

  /**
   * Executes queued AI actions
   */
  private executeEnemyActions(
    enemy: EnemyEntityQuery, 
    currentTime: number, 
    context: SystemUpdateContext
  ): void {
    const aiComponent = enemy.components.enemyAI
    const movementComponent = enemy.components.movement
    const transformComponent = enemy.components.transform

    if (!aiComponent.canPerformAction(currentTime)) {
      return
    }

    const action = aiComponent.getNextAction()
    if (!action) {
      return
    }

    switch (action.type) {
      case 'move':
        this.executeMovementAction(enemy, action, currentTime)
        break

      case 'attack':
        this.executeAttackAction(enemy, action, currentTime)
        break

      case 'skill':
        this.executeSkillAction(enemy, action, currentTime)
        break

      case 'wait':
        // Do nothing for wait actions
        break

      case 'flee':
        this.executeMovementAction(enemy, action, currentTime)
        break
    }

    aiComponent.actionPerformed(currentTime)
  }

  /**
   * Executes a movement action
   */
  private executeMovementAction(
    enemy: EnemyEntityQuery, 
    action: AIAction, 
    currentTime: number
  ): void {
    const aiComponent = enemy.components.enemyAI
    const movementComponent = enemy.components.movement
    const transformComponent = enemy.components.transform

    if (!action.position) {
      return
    }

    // Calculate movement direction
    const direction = aiComponent.calculateMovementDirection(
      transformComponent.position,
      action.position,
      currentTime
    )

    // Apply movement speed modifier
    const speedMultiplier = aiComponent.moveSpeed
    const baseSpeed = movementComponent.maxSpeed
    
    movementComponent.setVelocity(
      direction.x * baseSpeed * speedMultiplier,
      direction.y * baseSpeed * speedMultiplier
    )
  }

  /**
   * Executes an attack action
   */
  private executeAttackAction(
    enemy: EnemyEntityQuery, 
    action: AIAction, 
    currentTime: number
  ): void {
    if (!this.world || !action.target) {
      return
    }

    const combatComponent = enemy.components.transform.getComponent?.('combat') as CombatComponent
    if (!combatComponent) {
      return
    }

    // Use combat system to perform attack
    const combatSystem = this.world.getSystem('combat')
    if (combatSystem && combatSystem.triggerAttack) {
      combatSystem.triggerAttack(enemy, action.target)
    }
  }

  /**
   * Executes a skill action
   */
  private executeSkillAction(
    enemy: EnemyEntityQuery, 
    action: AIAction, 
    currentTime: number
  ): void {
    if (!this.world || !action.skillId) {
      return
    }

    const skillSystem = this.world.getSystem('skills')
    if (skillSystem && skillSystem.activateSkill) {
      skillSystem.activateSkill(enemy.id, action.skillId, action.position, action.target)
    }
  }

  /**
   * Updates spawner entities
   */
  private updateSpawners(entities: EntityQuery[], currentTime: number, context: SystemUpdateContext): void {
    const spawnerEntities = entities.filter(entity => 
      entity.components.spawner && entity.components.transform
    ) as SpawnerEntityQuery[]

    spawnerEntities.forEach(spawnerEntity => {
      this.updateSingleSpawner(spawnerEntity, currentTime, context)
    })
  }

  /**
   * Updates a single spawner
   */
  private updateSingleSpawner(
    spawnerEntity: SpawnerEntityQuery, 
    currentTime: number, 
    context: SystemUpdateContext
  ): void {
    const spawnerComponent = spawnerEntity.components.spawner

    if (!spawnerComponent.active) {
      return
    }

    // Update spawn rates based on game progression
    const gameState = this.getGameState()
    spawnerComponent.updateSpawnRates(
      context.totalTime,
      gameState.playerLevel || 1,
      gameState.survivalTime || context.totalTime
    )

    // Try to start next wave
    spawnerComponent.tryStartNextWave(currentTime, gameState)

    // Update current wave
    spawnerComponent.updateWave(currentTime)

    // Check if should spawn
    if (spawnerComponent.shouldSpawn(currentTime)) {
      this.spawnEnemy(spawnerEntity, currentTime)
    }
  }

  /**
   * Spawns an enemy from a spawner
   */
  private spawnEnemy(spawnerEntity: SpawnerEntityQuery, currentTime: number): boolean {
    if (!this.world) {
      return false
    }

    const spawnerComponent = spawnerEntity.components.spawner
    
    // Check global enemy limit
    const currentEnemyCount = this.countActiveEnemies()
    if (currentEnemyCount >= this.config.maxEnemies) {
      return false
    }

    // Select enemy type
    const gameState = this.getGameState()
    const enemyType = spawnerComponent.selectEnemyType(gameState.playerLevel || 1)
    if (!enemyType) {
      return false
    }

    // Calculate spawn position
    const spawnPosition = spawnerComponent.calculateSpawnPosition()

    // Create enemy entity
    const enemyEntity = this.createEnemyEntity(enemyType, spawnPosition, gameState)
    if (!enemyEntity) {
      return false
    }

    // Record spawn
    spawnerComponent.recordSpawn(enemyEntity.id, enemyType.id, spawnPosition, currentTime)

    if (this.eventSystem) {
      this.eventSystem.emit('ENEMY_SPAWNED', {
        entityId: enemyEntity.id,
        enemyType: enemyType.id,
        position: spawnPosition,
        spawnerId: spawnerEntity.id,
        timestamp: currentTime
      })
    }

    return true
  }

  /**
   * Creates an enemy entity from a type definition
   */
  private createEnemyEntity(
    enemyType: EnemyType, 
    position: { x: number; y: number }, 
    gameState: Record<string, unknown>
  ): { id: EntityId; addComponent: (comp: unknown) => void; getComponent: (type: string) => unknown } | null {
    if (!this.world) {
      return null
    }

    const entity = this.world.createEntity()

    // Add components based on template
    enemyType.components.forEach(template => {
      const component = this.createComponentFromTemplate(template, enemyType, gameState)
      if (component) {
        entity.addComponent(component)
      }
    })

    // Ensure position is set
    const transform = entity.getComponent('transform')
    if (transform) {
      transform.setPosition(position.x, position.y)
    }

    return entity
  }

  /**
   * Creates a component from a template
   */
  private createComponentFromTemplate(
    template: ComponentTemplate, 
    enemyType: EnemyType, 
    gameState: Record<string, unknown>
  ): unknown {
    const componentClasses = {
      'transform': TransformComponent,
      'health': HealthComponent,
      'movement': MovementComponent,
      'combat': CombatComponent,
      'enemyAI': EnemyAIComponent,
      'skills': SkillsComponent
    }

    const ComponentClass = componentClasses[template.type as keyof typeof componentClasses]
    if (!ComponentClass) {
      return null
    }

    // Scale data based on difficulty and enemy level
    const scaledData = this.scaleComponentData(template.data, enemyType, gameState)

    // Create component with scaled data
    if (template.type === 'transform') {
      return new ComponentClass(scaledData.x || 0, scaledData.y || 0)
    } else if (template.type === 'health') {
      return new ComponentClass(scaledData.maximum || 100)
    } else if (template.type === 'movement') {
      return new ComponentClass(scaledData.maxSpeed || 100)
    } else if (template.type === 'combat') {
      return new ComponentClass(scaledData)
    } else if (template.type === 'enemyAI') {
      return new ComponentClass(scaledData.behaviorType || 'aggressive')
    } else {
      return new ComponentClass(scaledData)
    }
  }

  /**
   * Scales component data based on difficulty
   */
  private scaleComponentData(data: Record<string, unknown>, enemyType: EnemyType, gameState: Record<string, unknown>): Record<string, unknown> {
    const scaledData = { ...data }
    const scaling = enemyType.scalingFactors

    if (!scaling) {
      return scaledData
    }

    const difficultyMultiplier = 1 + (gameState.playerLevel || 1) * 0.1

    if (scaling.health && scaledData.maximum) {
      scaledData.maximum *= scaling.health * difficultyMultiplier
    }

    if (scaling.damage && scaledData.damage) {
      scaledData.damage *= scaling.damage * difficultyMultiplier
    }

    if (scaling.speed && scaledData.maxSpeed) {
      scaledData.maxSpeed *= scaling.speed * difficultyMultiplier
    }

    return scaledData
  }

  /**
   * Counts nearby entities of a specific type
   */
  private countNearbyEntities(
    sourceEntity: EnemyEntityQuery, 
    entityType: 'ally' | 'enemy', 
    radius: number
  ): number {
    if (!this.world) {
      return 0
    }

    const sourceTransform = sourceEntity.components.transform
    let count = 0

    const entities = this.world.getEntitiesWithComponents(['transform'])
    entities.forEach((entity: any) => {
      if (entity.id === sourceEntity.id) {
        return // Skip self
      }

      const transform = entity.getComponent('transform')
      if (!transform) {
        return
      }

      const distance = Vector2Math.distance(sourceTransform.position, transform.position)
      if (distance <= radius) {
        // Determine if ally or enemy
        const hasEnemyAI = entity.hasComponent('enemyAI')
        if ((entityType === 'ally' && hasEnemyAI) || (entityType === 'enemy' && !hasEnemyAI)) {
          count++
        }
      }
    })

    return count
  }

  /**
   * Counts active enemies in the world
   */
  private countActiveEnemies(): number {
    if (!this.world) {
      return 0
    }

    return this.world.getEntitiesWithComponents(['enemyAI', 'health'])
      .filter((entity: any) => {
        const health = entity.getComponent('health')
        return health && !health.isDead()
      }).length
  }

  /**
   * Gets the player entity reference
   */
  private getPlayerEntity(): { id: EntityId; getComponent: (type: string) => unknown } | null {
    if (!this.world || !this.playerEntityId) {
      return null
    }

    return this.world.getEntity(this.playerEntityId)
  }

  /**
   * Updates player entity reference
   */
  private updatePlayerReference(): void {
    if (!this.world) {
      return
    }

    // Find player entity (entity without enemyAI component)
    const entities = this.world.getEntitiesWithComponents(['transform', 'health'])
    const playerEntity = entities.find((entity: any) => !entity.hasComponent('enemyAI'))
    
    if (playerEntity) {
      this.playerEntityId = playerEntity.id
    }
  }

  /**
   * Gets current game state for spawning decisions
   */
  private getGameState(): Record<string, unknown> {
    // This would typically come from a game state manager
    // For now, return basic state
    return {
      playerLevel: 1,
      survivalTime: 0,
      bossesDefeated: [],
      startTime: 0
    }
  }

  /**
   * Handles entity death events
   */
  private handleEntityDeath(event: { data: { entityId: EntityId } }): void {
    const { entityId } = event.data

    // Update AI targets if targeting the dead entity
    if (this.world) {
      const enemyEntities = this.world.getEntitiesWithComponents(['enemyAI'])
      enemyEntities.forEach((entity: any) => {
        const ai = entity.getComponent('enemyAI') as EnemyAIComponent
        if (ai.targetEntityId === entityId) {
          ai.setTarget(null)
        }
      })

      // Update spawner enemy counts
      const spawnerEntities = this.world.getEntitiesWithComponents(['spawner'])
      spawnerEntities.forEach((entity: any) => {
        const spawner = entity.getComponent('spawner') as SpawnerComponent
        spawner.recordEnemyDeath(entityId)
      })
    }
  }

  /**
   * Handles damage dealt events for AI reactions
   */
  private handleDamageDealt(event: { data: { sourceId: EntityId; targetId: EntityId; damage: number } }): void {
    const { sourceId, targetId, damage } = event.data

    if (this.world) {
      const targetEntity = this.world.getEntity(targetId)
      if (targetEntity && targetEntity.hasComponent('enemyAI')) {
        const ai = targetEntity.getComponent('enemyAI') as EnemyAIComponent
        ai.recordDamage(damage, sourceId, Date.now())
      }
    }
  }

  /**
   * Handles enemy death (cleanup)
   */
  private handleEnemyDeath(enemy: EnemyEntityQuery, currentTime: number): void {
    if (this.eventSystem) {
      this.eventSystem.emit('ENEMY_DIED', {
        entityId: enemy.id,
        position: { ...enemy.components.transform.position },
        timestamp: currentTime
      })
    }
  }

  /**
   * Creates a boss spawner with predefined waves
   */
  createBossSpawner(
    position: { x: number; y: number }, 
    bossType: EnemyType,
    waves: unknown[] = []
  ): { id: EntityId; addComponent: (comp: unknown) => void } | null {
    if (!this.world) {
      return null
    }

    const spawnerEntity = this.world.createEntity()

    spawnerEntity.addComponent(new TransformComponent(position.x, position.y))
    
    const spawner = new SpawnerComponent({
      center: position,
      radius: 200
    })
    
    spawner.spawnTiming = SpawnTiming.BOSS
    spawner.addEnemyType(bossType)
    
    waves.forEach(wave => spawner.addWave(wave))
    
    spawnerEntity.addComponent(spawner)

    return spawnerEntity
  }

  /**
   * Gets enemy system statistics
   */
  getStats(): Record<string, unknown> {
    const activeEnemies = this.countActiveEnemies()
    
    return {
      activeEnemies,
      maxEnemies: this.config.maxEnemies,
      aiUpdatesThisFrame: this.aiUpdatesThisFrame,
      maxAIUpdatesPerFrame: this.maxAIUpdatesPerFrame,
      lastAIUpdate: this.lastAIUpdate,
      lastSpawnerUpdate: this.lastSpawnerUpdate
    }
  }
}
# Vital Engine SDK - TypeScript Examples

## Table of Contents
1. [Basic Game Setup](#basic-game-setup)
2. [Entity Creation Patterns](#entity-creation-patterns)
3. [System Implementation Examples](#system-implementation-examples)
4. [Event Handling Examples](#event-handling-examples)
5. [Advanced Patterns](#advanced-patterns)
6. [Performance Optimization Examples](#performance-optimization-examples)
7. [Complete Game Examples](#complete-game-examples)

## Basic Game Setup

### Simple Game Bootstrap
```typescript
import { 
  Engine, 
  World, 
  MovementSystem, 
  CombatSystem, 
  CollectionSystem 
} from 'vital-engine-sdk';

class SimpleGame {
  private engine: Engine;
  private world: World;
  private isRunning: boolean = false;

  constructor() {
    this.engine = new Engine();
    this.world = new World({
      maxEntities: 5000,
      enablePerformanceMonitoring: true
    });
    
    this.setupSystems();
  }

  private setupSystems(): void {
    // Add core systems
    this.world.addSystem(new MovementSystem());
    this.world.addSystem(new CombatSystem());
    this.world.addSystem(new CollectionSystem());
  }

  public start(): void {
    this.isRunning = true;
    this.engine.start();
    this.gameLoop();
  }

  public stop(): void {
    this.isRunning = false;
    this.engine.stop();
  }

  private gameLoop = (): void => {
    if (!this.isRunning) return;

    const deltaTime = this.engine.getDeltaTime();
    this.world.update(deltaTime);
    
    requestAnimationFrame(this.gameLoop);
  };
}

// Usage
const game = new SimpleGame();
game.start();
```

### Game with Configuration
```typescript
interface GameConfig {
  worldSize: { width: number; height: number };
  playerConfig: PlayerConfig;
  enemyConfig: EnemyConfig;
  difficultyConfig: DifficultyConfig;
}

interface PlayerConfig {
  startPosition: { x: number; y: number };
  health: { current: number; max: number };
  movement: { speed: number };
  combat: { damage: number; attackRange: number };
}

class ConfigurableGame {
  private engine: Engine;
  private world: World;
  private config: GameConfig;

  constructor(config: GameConfig) {
    this.config = config;
    this.engine = new Engine();
    this.world = new World();
    
    this.initialize();
  }

  private initialize(): void {
    this.setupSystems();
    this.createPlayer();
    this.setupEventHandlers();
  }

  private setupSystems(): void {
    this.world.addSystem(new MovementSystem());
    this.world.addSystem(new CombatSystem());
    this.world.addSystem(new EnemySystem());
    this.world.addSystem(new ProgressionSystem());
  }

  private createPlayer(): void {
    const player = EntityFactory.createPlayer(
      this.world, 
      this.config.playerConfig
    );
    
    // Store player reference for easy access
    this.world.setPlayerEntity(player);
  }

  private setupEventHandlers(): void {
    this.world.eventSystem.subscribe('player_died', this.handlePlayerDeath);
    this.world.eventSystem.subscribe('level_completed', this.handleLevelComplete);
  }

  private handlePlayerDeath = (data: { player: Entity }): void => {
    console.log('Game Over!');
    this.stop();
  };

  private handleLevelComplete = (data: { level: number }): void => {
    console.log(`Level ${data.level} completed!`);
    this.startNextLevel();
  };

  private startNextLevel(): void {
    // Increase difficulty
    // Spawn new enemies
    // Reset player position
  }
}
```

## Entity Creation Patterns

### Factory Pattern for Entities
```typescript
class EntityFactory {
  static createPlayer(world: World, config: PlayerConfig): Entity {
    const player = world.createEntity();
    
    player.addComponent(new Transform({
      x: config.startPosition.x,
      y: config.startPosition.y,
      rotation: 0
    }));
    
    player.addComponent(new Health({
      current: config.health.current,
      max: config.health.max,
      regenerationRate: 1
    }));
    
    player.addComponent(new Movement({
      speed: config.movement.speed,
      velocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: 0 }
    }));
    
    player.addComponent(new Combat({
      damage: config.combat.damage,
      attackRange: config.combat.attackRange,
      attackCooldown: 1000,
      lastAttackTime: 0
    }));
    
    player.addComponent(new Skills({
      activeSkills: [],
      passiveSkills: [],
      skillPoints: 0
    }));
    
    player.addComponent(new Inventory({
      slots: 20,
      items: [],
      gold: 0
    }));
    
    return player;
  }

  static createEnemy(world: World, type: EnemyType, position: Vector2): Entity {
    const enemy = world.createEntity();
    const config = EnemyConfigs[type];
    
    enemy.addComponent(new Transform({
      x: position.x,
      y: position.y,
      rotation: 0
    }));
    
    enemy.addComponent(new Health({
      current: config.health,
      max: config.health
    }));
    
    enemy.addComponent(new Movement({
      speed: config.speed,
      velocity: { x: 0, y: 0 }
    }));
    
    enemy.addComponent(new Combat({
      damage: config.damage,
      attackRange: config.attackRange,
      attackCooldown: config.attackCooldown,
      lastAttackTime: 0
    }));
    
    enemy.addComponent(new EnemyAI({
      type: config.aiType,
      detectionRange: config.detectionRange,
      target: null,
      state: 'idle'
    }));
    
    return enemy;
  }

  static createProjectile(
    world: World, 
    owner: Entity, 
    target: Vector2, 
    damage: number
  ): Entity {
    const projectile = world.createEntity();
    const ownerTransform = owner.getComponent(Transform);
    
    const direction = Math.atan2(
      target.y - ownerTransform.data.y,
      target.x - ownerTransform.data.x
    );
    
    const speed = 500;
    
    projectile.addComponent(new Transform({
      x: ownerTransform.data.x,
      y: ownerTransform.data.y,
      rotation: direction
    }));
    
    projectile.addComponent(new Movement({
      speed: speed,
      velocity: {
        x: Math.cos(direction) * speed,
        y: Math.sin(direction) * speed
      }
    }));
    
    projectile.addComponent(new Combat({
      damage: damage,
      attackRange: 10,
      attackCooldown: 0,
      lastAttackTime: 0
    }));
    
    // Auto-destroy after 3 seconds
    setTimeout(() => {
      if (world.hasEntity(projectile)) {
        world.removeEntity(projectile);
      }
    }, 3000);
    
    return projectile;
  }

  static createCollectible(
    world: World, 
    type: CollectibleType, 
    position: Vector2
  ): Entity {
    const collectible = world.createEntity();
    const config = CollectibleConfigs[type];
    
    collectible.addComponent(new Transform({
      x: position.x,
      y: position.y,
      rotation: 0
    }));
    
    collectible.addComponent(new Collectible({
      type: type,
      value: config.value,
      autoCollect: config.autoCollect,
      collectRange: config.collectRange
    }));
    
    if (config.magnetic) {
      collectible.addComponent(new Magnet({
        range: config.magnetRange,
        strength: config.magnetStrength
      }));
    }
    
    return collectible;
  }
}
```

### Builder Pattern for Complex Entities
```typescript
class EntityBuilder {
  private entity: Entity;
  private world: World;

  constructor(world: World) {
    this.world = world;
    this.entity = world.createEntity();
  }

  withTransform(x: number, y: number, rotation: number = 0): EntityBuilder {
    this.entity.addComponent(new Transform({ x, y, rotation }));
    return this;
  }

  withHealth(current: number, max: number, regen: number = 0): EntityBuilder {
    this.entity.addComponent(new Health({ 
      current, 
      max, 
      regenerationRate: regen 
    }));
    return this;
  }

  withMovement(speed: number): EntityBuilder {
    this.entity.addComponent(new Movement({
      speed,
      velocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: 0 }
    }));
    return this;
  }

  withCombat(damage: number, range: number, cooldown: number): EntityBuilder {
    this.entity.addComponent(new Combat({
      damage,
      attackRange: range,
      attackCooldown: cooldown,
      lastAttackTime: 0
    }));
    return this;
  }

  withAI(type: AIType, detectionRange: number): EntityBuilder {
    this.entity.addComponent(new EnemyAI({
      type,
      detectionRange,
      target: null,
      state: 'idle'
    }));
    return this;
  }

  withSkills(activeSkills: ActiveSkill[] = [], passiveSkills: PassiveSkill[] = []): EntityBuilder {
    this.entity.addComponent(new Skills({
      activeSkills,
      passiveSkills,
      skillPoints: 0
    }));
    return this;
  }

  withInventory(slots: number = 20): EntityBuilder {
    this.entity.addComponent(new Inventory({
      slots,
      items: [],
      gold: 0
    }));
    return this;
  }

  build(): Entity {
    return this.entity;
  }
}

// Usage
const player = new EntityBuilder(world)
  .withTransform(400, 300)
  .withHealth(100, 100, 1)
  .withMovement(200)
  .withCombat(25, 50, 1000)
  .withSkills()
  .withInventory(30)
  .build();

const enemy = new EntityBuilder(world)
  .withTransform(100, 100)
  .withHealth(50, 50)
  .withMovement(100)
  .withCombat(15, 30, 1500)
  .withAI('aggressive', 200)
  .build();
```

## System Implementation Examples

### Custom Movement System with Physics
```typescript
class PhysicsMovementSystem extends System {
  private friction: number = 0.98;
  private maxSpeed: number = 500;

  update(deltaTime: number): void {
    const entities = this.world.query([Transform, Movement]);
    
    entities.forEach(entity => {
      const transform = entity.getComponent(Transform);
      const movement = entity.getComponent(Movement);
      
      // Apply acceleration to velocity
      movement.data.velocity.x += movement.data.acceleration.x * deltaTime * 0.001;
      movement.data.velocity.y += movement.data.acceleration.y * deltaTime * 0.001;
      
      // Apply friction
      movement.data.velocity.x *= this.friction;
      movement.data.velocity.y *= this.friction;
      
      // Limit max speed
      const speed = Math.sqrt(
        movement.data.velocity.x ** 2 + movement.data.velocity.y ** 2
      );
      
      if (speed > this.maxSpeed) {
        const ratio = this.maxSpeed / speed;
        movement.data.velocity.x *= ratio;
        movement.data.velocity.y *= ratio;
      }
      
      // Update position
      transform.data.x += movement.data.velocity.x * deltaTime * 0.001;
      transform.data.y += movement.data.velocity.y * deltaTime * 0.001;
      
      // Reset acceleration for next frame
      movement.data.acceleration.x = 0;
      movement.data.acceleration.y = 0;
    });
  }

  applyForce(entity: Entity, force: Vector2): void {
    const movement = entity.getComponent(Movement);
    if (movement) {
      movement.data.acceleration.x += force.x;
      movement.data.acceleration.y += force.y;
    }
  }
}
```

### Advanced Combat System
```typescript
class AdvancedCombatSystem extends System {
  private spatialGrid: SpatialGrid<Entity>;

  constructor() {
    super();
    this.spatialGrid = new SpatialGrid<Entity>(100);
  }

  update(deltaTime: number): void {
    // Update spatial grid
    this.updateSpatialGrid();
    
    // Process combat for all entities with combat component
    const combatEntities = this.world.query([Transform, Combat]);
    
    combatEntities.forEach(attacker => {
      this.processCombat(attacker, deltaTime);
    });
  }

  private updateSpatialGrid(): void {
    this.spatialGrid.clear();
    
    const entities = this.world.query([Transform]);
    entities.forEach(entity => {
      const transform = entity.getComponent(Transform);
      this.spatialGrid.insert(entity, transform.data.x, transform.data.y);
    });
  }

  private processCombat(attacker: Entity, deltaTime: number): void {
    const attackerTransform = attacker.getComponent(Transform);
    const attackerCombat = attacker.getComponent(Combat);
    
    // Update attack cooldown
    if (attackerCombat.data.lastAttackTime > 0) {
      attackerCombat.data.lastAttackTime -= deltaTime;
    }
    
    // Check if can attack
    if (attackerCombat.data.lastAttackTime > 0) return;
    
    // Find potential targets in range
    const targets = this.spatialGrid.query(
      attackerTransform.data.x,
      attackerTransform.data.y,
      attackerCombat.data.attackRange
    );
    
    // Find closest valid target
    const target = this.findClosestTarget(attacker, targets);
    
    if (target) {
      this.performAttack(attacker, target);
    }
  }

  private findClosestTarget(attacker: Entity, candidates: Entity[]): Entity | null {
    const attackerTransform = attacker.getComponent(Transform);
    const attackerCombat = attacker.getComponent(Combat);
    
    let closestTarget: Entity | null = null;
    let closestDistance = attackerCombat.data.attackRange;
    
    candidates.forEach(candidate => {
      // Don't attack self
      if (candidate === attacker) return;
      
      // Must have health to be a valid target
      if (!candidate.hasComponent(Health)) return;
      
      const candidateTransform = candidate.getComponent(Transform);
      const distance = Math.sqrt(
        (candidateTransform.data.x - attackerTransform.data.x) ** 2 +
        (candidateTransform.data.y - attackerTransform.data.y) ** 2
      );
      
      if (distance < closestDistance) {
        closestTarget = candidate;
        closestDistance = distance;
      }
    });
    
    return closestTarget;
  }

  private performAttack(attacker: Entity, target: Entity): void {
    const attackerCombat = attacker.getComponent(Combat);
    const targetHealth = target.getComponent(Health);
    
    // Deal damage
    targetHealth.data.current -= attackerCombat.data.damage;
    
    // Set attack cooldown
    attackerCombat.data.lastAttackTime = attackerCombat.data.attackCooldown;
    
    // Emit events
    this.world.eventSystem.emit('damage_dealt', {
      attacker,
      target,
      damage: attackerCombat.data.damage
    });
    
    // Check if target died
    if (targetHealth.data.current <= 0) {
      this.world.eventSystem.emit('entity_died', {
        entity: target,
        killer: attacker
      });
      
      this.world.removeEntity(target);
    }
  }
}
```

### Smart Enemy AI System
```typescript
enum AIState {
  IDLE = 'idle',
  PATROL = 'patrol',
  CHASE = 'chase',
  ATTACK = 'attack',
  FLEE = 'flee',
  DEAD = 'dead'
}

class SmartEnemyAISystem extends System {
  private pathfinding: PathfindingService;

  constructor(pathfinding: PathfindingService) {
    super();
    this.pathfinding = pathfinding;
  }

  update(deltaTime: number): void {
    const enemies = this.world.query([Transform, EnemyAI, Health]);
    
    enemies.forEach(enemy => {
      const ai = enemy.getComponent(EnemyAI);
      const health = enemy.getComponent(Health);
      
      // Check if dead
      if (health.data.current <= 0) {
        ai.data.state = AIState.DEAD;
        return;
      }
      
      // Update AI state machine
      this.updateAIState(enemy, deltaTime);
      
      // Execute current state behavior
      this.executeState(enemy, deltaTime);
    });
  }

  private updateAIState(enemy: Entity, deltaTime: number): void {
    const ai = enemy.getComponent(EnemyAI);
    const transform = enemy.getComponent(Transform);
    const health = enemy.getComponent(Health);
    
    // Find player
    const player = this.world.getPlayerEntity();
    if (!player) return;
    
    const playerTransform = player.getComponent(Transform);
    const distanceToPlayer = this.calculateDistance(transform.data, playerTransform.data);
    
    // State transitions
    switch (ai.data.state) {
      case AIState.IDLE:
        if (distanceToPlayer <= ai.data.detectionRange) {
          ai.data.target = player;
          ai.data.state = AIState.CHASE;
        }
        break;
        
      case AIState.CHASE:
        if (distanceToPlayer > ai.data.detectionRange * 1.5) {
          ai.data.target = null;
          ai.data.state = AIState.IDLE;
        } else if (distanceToPlayer <= 50) { // Attack range
          ai.data.state = AIState.ATTACK;
        } else if (health.data.current < health.data.max * 0.3) {
          ai.data.state = AIState.FLEE;
        }
        break;
        
      case AIState.ATTACK:
        if (distanceToPlayer > 75) {
          ai.data.state = AIState.CHASE;
        } else if (health.data.current < health.data.max * 0.2) {
          ai.data.state = AIState.FLEE;
        }
        break;
        
      case AIState.FLEE:
        if (health.data.current > health.data.max * 0.6) {
          ai.data.state = AIState.CHASE;
        } else if (distanceToPlayer > ai.data.detectionRange * 2) {
          ai.data.state = AIState.IDLE;
        }
        break;
    }
  }

  private executeState(enemy: Entity, deltaTime: number): void {
    const ai = enemy.getComponent(EnemyAI);
    
    switch (ai.data.state) {
      case AIState.IDLE:
        this.executeIdleBehavior(enemy);
        break;
      case AIState.CHASE:
        this.executeChaseBehavior(enemy);
        break;
      case AIState.ATTACK:
        this.executeAttackBehavior(enemy);
        break;
      case AIState.FLEE:
        this.executeFleeBehavior(enemy);
        break;
    }
  }

  private executeIdleBehavior(enemy: Entity): void {
    const movement = enemy.getComponent(Movement);
    if (movement) {
      // Stop movement
      movement.data.velocity.x = 0;
      movement.data.velocity.y = 0;
    }
  }

  private executeChaseBehavior(enemy: Entity): void {
    const ai = enemy.getComponent(EnemyAI);
    const transform = enemy.getComponent(Transform);
    const movement = enemy.getComponent(Movement);
    
    if (!ai.data.target || !movement) return;
    
    const targetTransform = ai.data.target.getComponent(Transform);
    
    // Calculate direction to target
    const dx = targetTransform.data.x - transform.data.x;
    const dy = targetTransform.data.y - transform.data.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 0) {
      // Normalize and apply speed
      movement.data.velocity.x = (dx / distance) * movement.data.speed;
      movement.data.velocity.y = (dy / distance) * movement.data.speed;
    }
  }

  private executeAttackBehavior(enemy: Entity): void {
    const movement = enemy.getComponent(Movement);
    if (movement) {
      // Stop to attack
      movement.data.velocity.x = 0;
      movement.data.velocity.y = 0;
    }
    
    // Attack logic handled by combat system
  }

  private executeFleeBehavior(enemy: Entity): void {
    const ai = enemy.getComponent(EnemyAI);
    const transform = enemy.getComponent(Transform);
    const movement = enemy.getComponent(Movement);
    
    if (!ai.data.target || !movement) return;
    
    const targetTransform = ai.data.target.getComponent(Transform);
    
    // Calculate direction away from target
    const dx = transform.data.x - targetTransform.data.x;
    const dy = transform.data.y - targetTransform.data.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 0) {
      // Normalize and apply speed (fleeing)
      movement.data.velocity.x = (dx / distance) * movement.data.speed * 1.5;
      movement.data.velocity.y = (dy / distance) * movement.data.speed * 1.5;
    }
  }

  private calculateDistance(pos1: Vector2, pos2: Vector2): number {
    return Math.sqrt((pos2.x - pos1.x) ** 2 + (pos2.y - pos1.y) ** 2);
  }
}
```

## Event Handling Examples

### Comprehensive Event Management
```typescript
class GameEventManager {
  private eventSystem: EventSystem;
  private eventHistory: GameEvent[] = [];
  private maxHistorySize: number = 1000;

  constructor(eventSystem: EventSystem) {
    this.eventSystem = eventSystem;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Combat events
    this.eventSystem.subscribe('damage_dealt', this.handleDamageDealt);
    this.eventSystem.subscribe('entity_died', this.handleEntityDied);
    this.eventSystem.subscribe('player_died', this.handlePlayerDied);
    
    // Collection events
    this.eventSystem.subscribe('item_collected', this.handleItemCollected);
    this.eventSystem.subscribe('experience_gained', this.handleExperienceGained);
    this.eventSystem.subscribe('level_up', this.handleLevelUp);
    
    // Game state events
    this.eventSystem.subscribe('wave_started', this.handleWaveStarted);
    this.eventSystem.subscribe('wave_completed', this.handleWaveCompleted);
    this.eventSystem.subscribe('difficulty_increased', this.handleDifficultyIncreased);
  }

  private logEvent(eventType: string, data: any): void {
    const event: GameEvent = {
      type: eventType,
      data,
      timestamp: Date.now()
    };
    
    this.eventHistory.push(event);
    
    // Maintain history size
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  private handleDamageDealt = (data: DamageEvent): void => {
    this.logEvent('damage_dealt', data);
    
    // Visual effects
    this.spawnDamageNumber(data.target, data.damage);
    
    // Screen shake for significant damage
    if (data.damage > 30) {
      this.triggerScreenShake(data.damage * 0.1);
    }
  };

  private handleEntityDied = (data: DeathEvent): void => {
    this.logEvent('entity_died', data);
    
    // Drop loot
    this.dropLoot(data.entity);
    
    // Award experience
    if (data.killer && this.isPlayer(data.killer)) {
      const experience = this.calculateExperience(data.entity);
      this.eventSystem.emit('experience_gained', {
        entity: data.killer,
        amount: experience
      });
    }
    
    // Spawn death effect
    this.spawnDeathEffect(data.entity);
  };

  private handlePlayerDied = (data: PlayerDeathEvent): void => {
    this.logEvent('player_died', data);
    
    // Game over logic
    this.triggerGameOver();
  };

  private handleItemCollected = (data: CollectionEvent): void => {
    this.logEvent('item_collected', data);
    
    // Update inventory
    const inventory = data.collector.getComponent(Inventory);
    if (inventory) {
      this.addItemToInventory(inventory, data.item);
    }
    
    // Trigger collection effect
    this.spawnCollectionEffect(data.item.position);
  };

  private handleExperienceGained = (data: ExperienceEvent): void => {
    this.logEvent('experience_gained', data);
    
    const experience = data.entity.getComponent(Experience);
    if (experience) {
      experience.data.current += data.amount;
      
      // Check for level up
      const requiredXP = this.calculateRequiredExperience(experience.data.level);
      if (experience.data.current >= requiredXP) {
        this.levelUp(data.entity);
      }
    }
  };

  private handleLevelUp = (data: LevelUpEvent): void => {
    this.logEvent('level_up', data);
    
    const experience = data.entity.getComponent(Experience);
    const skills = data.entity.getComponent(Skills);
    
    if (experience && skills) {
      // Increase level
      experience.data.level++;
      experience.data.current -= this.calculateRequiredExperience(experience.data.level - 1);
      
      // Award skill points
      skills.data.skillPoints += 1;
      
      // Restore health
      const health = data.entity.getComponent(Health);
      if (health) {
        health.data.current = health.data.max;
      }
    }
    
    // Spawn level up effect
    this.spawnLevelUpEffect(data.entity);
  };

  private handleWaveStarted = (data: WaveEvent): void => {
    this.logEvent('wave_started', data);
    
    // Spawn enemies for the wave
    this.spawnWaveEnemies(data.waveNumber);
  };

  private handleWaveCompleted = (data: WaveEvent): void => {
    this.logEvent('wave_completed', data);
    
    // Award wave completion bonus
    const player = this.world.getPlayerEntity();
    if (player) {
      this.eventSystem.emit('experience_gained', {
        entity: player,
        amount: data.waveNumber * 100
      });
    }
  };

  private handleDifficultyIncreased = (data: DifficultyEvent): void => {
    this.logEvent('difficulty_increased', data);
    
    // Notify player
    this.showNotification(`Difficulty increased to level ${data.level}!`);
  };

  // Helper methods
  private spawnDamageNumber(target: Entity, damage: number): void {
    // Implementation for visual damage numbers
  }

  private triggerScreenShake(intensity: number): void {
    // Implementation for screen shake effect
  }

  private dropLoot(entity: Entity): void {
    // Implementation for loot dropping
  }

  private calculateExperience(entity: Entity): number {
    // Calculate experience based on entity level/type
    return 50; // placeholder
  }

  private isPlayer(entity: Entity): boolean {
    // Check if entity is the player
    return entity === this.world.getPlayerEntity();
  }

  private spawnDeathEffect(entity: Entity): void {
    // Implementation for death visual effects
  }

  private addItemToInventory(inventory: Inventory, item: InventoryItem): void {
    // Add item to inventory if space available
    if (inventory.data.items.length < inventory.data.slots) {
      inventory.data.items.push(item);
    }
  }

  private spawnCollectionEffect(position: Vector2): void {
    // Implementation for collection visual effects
  }

  private calculateRequiredExperience(level: number): number {
    return level * 100 + (level * level * 50);
  }

  private levelUp(entity: Entity): void {
    this.eventSystem.emit('level_up', { entity });
  }

  private spawnLevelUpEffect(entity: Entity): void {
    // Implementation for level up visual effects
  }

  private spawnWaveEnemies(waveNumber: number): void {
    // Implementation for spawning wave enemies
  }

  private showNotification(message: string): void {
    // Implementation for showing notifications
  }

  public getEventHistory(): GameEvent[] {
    return [...this.eventHistory];
  }

  public getEventsOfType(eventType: string): GameEvent[] {
    return this.eventHistory.filter(event => event.type === eventType);
  }
}
```

## Advanced Patterns

### State Machine for Game States
```typescript
enum GameState {
  MENU = 'menu',
  PLAYING = 'playing',
  PAUSED = 'paused',
  GAME_OVER = 'game_over',
  LEVEL_COMPLETE = 'level_complete'
}

class GameStateMachine {
  private currentState: GameState = GameState.MENU;
  private previousState: GameState | null = null;
  private stateHandlers: Map<GameState, StateHandler> = new Map();

  constructor() {
    this.setupStateHandlers();
  }

  private setupStateHandlers(): void {
    this.stateHandlers.set(GameState.MENU, new MenuStateHandler());
    this.stateHandlers.set(GameState.PLAYING, new PlayingStateHandler());
    this.stateHandlers.set(GameState.PAUSED, new PausedStateHandler());
    this.stateHandlers.set(GameState.GAME_OVER, new GameOverStateHandler());
    this.stateHandlers.set(GameState.LEVEL_COMPLETE, new LevelCompleteStateHandler());
  }

  public transition(newState: GameState): void {
    if (newState === this.currentState) return;

    // Exit current state
    const currentHandler = this.stateHandlers.get(this.currentState);
    if (currentHandler) {
      currentHandler.exit();
    }

    this.previousState = this.currentState;
    this.currentState = newState;

    // Enter new state
    const newHandler = this.stateHandlers.get(this.currentState);
    if (newHandler) {
      newHandler.enter();
    }
  }

  public update(deltaTime: number): void {
    const handler = this.stateHandlers.get(this.currentState);
    if (handler) {
      handler.update(deltaTime);
    }
  }

  public getCurrentState(): GameState {
    return this.currentState;
  }

  public getPreviousState(): GameState | null {
    return this.previousState;
  }
}

abstract class StateHandler {
  abstract enter(): void;
  abstract exit(): void;
  abstract update(deltaTime: number): void;
}

class PlayingStateHandler extends StateHandler {
  enter(): void {
    // Resume game systems
    console.log('Entering playing state');
  }

  exit(): void {
    // Pause/stop game systems if needed
    console.log('Exiting playing state');
  }

  update(deltaTime: number): void {
    // Update game world
    world.update(deltaTime);
  }
}
```

### Plugin System
```typescript
interface Plugin {
  name: string;
  version: string;
  initialize(engine: Engine): void;
  cleanup(): void;
}

class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private engine: Engine;

  constructor(engine: Engine) {
    this.engine = engine;
  }

  public registerPlugin(plugin: Plugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin ${plugin.name} is already registered`);
    }

    this.plugins.set(plugin.name, plugin);
    plugin.initialize(this.engine);
  }

  public unregisterPlugin(name: string): void {
    const plugin = this.plugins.get(name);
    if (plugin) {
      plugin.cleanup();
      this.plugins.delete(name);
    }
  }

  public getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  public listPlugins(): string[] {
    return Array.from(this.plugins.keys());
  }
}

// Example plugin implementation
class DebugPlugin implements Plugin {
  name = 'debug';
  version = '1.0.0';
  private isActive = false;

  initialize(engine: Engine): void {
    console.log('Debug plugin initialized');
    this.setupDebugCommands();
  }

  cleanup(): void {
    console.log('Debug plugin cleaned up');
    this.isActive = false;
  }

  private setupDebugCommands(): void {
    // Setup debug keyboard shortcuts
    document.addEventListener('keydown', (event) => {
      if (event.key === 'F1') {
        this.toggleDebugMode();
      }
    });
  }

  private toggleDebugMode(): void {
    this.isActive = !this.isActive;
    console.log(`Debug mode: ${this.isActive ? 'ON' : 'OFF'}`);
  }
}
```

This comprehensive TypeScript documentation provides practical examples and patterns for building games with the Vital Engine SDK, ensuring AI agents have clear reference material for implementation.
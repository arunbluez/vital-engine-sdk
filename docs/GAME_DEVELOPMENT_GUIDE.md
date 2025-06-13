# Vital Engine SDK - Game Development Guide

## Table of Contents
1. [Getting Started](#getting-started)
2. [Core Concepts](#core-concepts)
3. [Building Your First Game](#building-your-first-game)
4. [Advanced Game Features](#advanced-game-features)
5. [Performance Optimization](#performance-optimization)
6. [Best Practices](#best-practices)
7. [Common Patterns](#common-patterns)
8. [Debugging and Testing](#debugging-and-testing)

## Getting Started

### Installation
```typescript
npm install vital-engine-sdk
```

### Basic Setup
```typescript
import { Engine, World, Entity } from 'vital-engine-sdk';

// Create engine instance
const engine = new Engine();

// Create world
const world = new World();

// Start the engine
engine.start();
```

## Core Concepts

### Entity-Component-System (ECS) Architecture

The Vital Engine SDK uses an ECS architecture where:
- **Entities** are unique identifiers for game objects
- **Components** store data about entities
- **Systems** process entities with specific component combinations

```typescript
// Create an entity
const player = world.createEntity();

// Add components
player.addComponent(new Transform({ x: 0, y: 0 }));
player.addComponent(new Health({ current: 100, max: 100 }));
player.addComponent(new Movement({ speed: 200 }));
```

### World Management
```typescript
// Create world with configuration
const world = new World({
  maxEntities: 10000,
  enablePerformanceMonitoring: true
});

// Add systems to world
world.addSystem(new MovementSystem());
world.addSystem(new CombatSystem());
world.addSystem(new CollectionSystem());
```

## Building Your First Game

### 1. Create a Simple Player Entity
```typescript
import { Entity, Transform, Health, Movement } from 'vital-engine-sdk';

function createPlayer(world: World, x: number, y: number): Entity {
  const player = world.createEntity();
  
  player.addComponent(new Transform({ x, y, rotation: 0 }));
  player.addComponent(new Health({ current: 100, max: 100 }));
  player.addComponent(new Movement({ 
    speed: 200, 
    velocity: { x: 0, y: 0 } 
  }));
  
  return player;
}
```

### 2. Create Enemies
```typescript
function createEnemy(world: World, x: number, y: number): Entity {
  const enemy = world.createEntity();
  
  enemy.addComponent(new Transform({ x, y, rotation: 0 }));
  enemy.addComponent(new Health({ current: 50, max: 50 }));
  enemy.addComponent(new Movement({ speed: 100, velocity: { x: 0, y: 0 } }));
  enemy.addComponent(new Combat({ 
    damage: 10, 
    attackCooldown: 1000,
    lastAttackTime: 0 
  }));
  enemy.addComponent(new EnemyAI({ 
    type: 'aggressive',
    detectionRange: 200,
    target: null 
  }));
  
  return enemy;
}
```

### 3. Setup Game Systems
```typescript
function setupGameSystems(world: World): void {
  // Core systems
  world.addSystem(new MovementSystem());
  world.addSystem(new CombatSystem());
  world.addSystem(new EnemySystem());
  
  // Collection and progression
  world.addSystem(new CollectionSystem());
  world.addSystem(new ProgressionSystem());
  
  // Economy and difficulty
  world.addSystem(new EconomySystem());
  world.addSystem(new DifficultySystem());
}
```

### 4. Game Loop
```typescript
class Game {
  private engine: Engine;
  private world: World;
  private lastTime: number = 0;
  
  constructor() {
    this.engine = new Engine();
    this.world = new World();
    this.setupGame();
  }
  
  private setupGame(): void {
    // Setup systems
    setupGameSystems(this.world);
    
    // Create player
    const player = createPlayer(this.world, 400, 300);
    
    // Create initial enemies
    for (let i = 0; i < 5; i++) {
      createEnemy(
        this.world, 
        Math.random() * 800, 
        Math.random() * 600
      );
    }
  }
  
  public start(): void {
    this.engine.start();
    this.gameLoop();
  }
  
  private gameLoop = (): void => {
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;
    
    // Update world
    this.world.update(deltaTime);
    
    // Continue loop
    requestAnimationFrame(this.gameLoop);
  };
}
```

## Advanced Game Features

### Skills System
```typescript
import { SkillSystem, Skills } from 'vital-engine-sdk';

// Add skills to player
function addSkillsToPlayer(player: Entity): void {
  const skills = new Skills({
    activeSkills: [
      {
        id: 'fireball',
        name: 'Fireball',
        damage: 50,
        cooldown: 2000,
        manaCost: 20,
        range: 300,
        lastUsed: 0
      }
    ],
    passiveSkills: [
      {
        id: 'health_boost',
        name: 'Health Boost',
        effect: { type: 'health', value: 50 },
        level: 1
      }
    ]
  });
  
  player.addComponent(skills);
}

// Setup skill system
world.addSystem(new SkillSystem());
```

### Inventory System
```typescript
function addInventoryToPlayer(player: Entity): void {
  const inventory = new Inventory({
    slots: 20,
    items: [
      {
        id: 'health_potion',
        name: 'Health Potion',
        type: 'consumable',
        quantity: 5,
        effect: { type: 'heal', value: 50 }
      }
    ]
  });
  
  player.addComponent(inventory);
}
```

### Spawning System
```typescript
function setupEnemySpawner(world: World): void {
  const spawner = world.createEntity();
  
  spawner.addComponent(new Spawner({
    spawnRate: 2000, // every 2 seconds
    maxEntities: 10,
    spawnRadius: 500,
    entityTemplate: {
      components: [
        { type: 'Transform', data: { x: 0, y: 0 } },
        { type: 'Health', data: { current: 50, max: 50 } },
        { type: 'Movement', data: { speed: 100 } },
        { type: 'Combat', data: { damage: 10 } },
        { type: 'EnemyAI', data: { type: 'aggressive' } }
      ]
    }
  }));
}
```

## Performance Optimization

### Batch Processing
```typescript
import { BatchProcessor } from 'vital-engine-sdk';

// Process multiple entities in batches
const batchProcessor = new BatchProcessor<Entity>(100);

function processEntitiesInBatches(entities: Entity[]): void {
  batchProcessor.process(entities, (batch) => {
    // Process each batch
    batch.forEach(entity => {
      // Your processing logic here
    });
  });
}
```

### Object Pooling
```typescript
import { ObjectPool } from 'vital-engine-sdk';

// Create object pool for projectiles
const projectilePool = new ObjectPool<Entity>(
  () => createProjectile(), // factory function
  (projectile) => resetProjectile(projectile), // reset function
  100 // initial size
);

function fireProjectile(): void {
  const projectile = projectilePool.acquire();
  // Use projectile
  
  // Return to pool when done
  setTimeout(() => {
    projectilePool.release(projectile);
  }, 3000);
}
```

### Spatial Partitioning
```typescript
import { SpatialGrid } from 'vital-engine-sdk';

const spatialGrid = new SpatialGrid<Entity>(100); // 100x100 cell size

// Add entities to spatial grid
spatialGrid.insert(entity, x, y);

// Query nearby entities
const nearbyEntities = spatialGrid.query(x, y, radius);
```

## Best Practices

### 1. Component Design
```typescript
// Good: Small, focused components
class Transform extends Component {
  constructor(public data: { x: number; y: number; rotation: number }) {
    super();
  }
}

// Avoid: Large, multi-purpose components
class PlayerData extends Component {
  // Too many responsibilities
}
```

### 2. System Organization
```typescript
// Good: Single responsibility systems
class MovementSystem extends System {
  update(deltaTime: number): void {
    // Only handle movement logic
  }
}

// Good: Clear system dependencies
class CombatSystem extends System {
  requiredComponents = [Transform, Health, Combat];
  
  update(deltaTime: number): void {
    // Combat logic with required components
  }
}
```

### 3. Event Handling
```typescript
// Use events for loose coupling
world.eventSystem.emit('player_died', { playerId: player.id });

// Subscribe to events
world.eventSystem.subscribe('enemy_killed', (data) => {
  // Handle enemy death
  updateScore(data.points);
});
```

## Common Patterns

### State Machines
```typescript
enum EnemyState {
  IDLE,
  CHASING,
  ATTACKING,
  DEAD
}

class EnemyAISystem extends System {
  update(deltaTime: number): void {
    this.query([EnemyAI, Transform]).forEach(entity => {
      const ai = entity.getComponent(EnemyAI);
      
      switch (ai.state) {
        case EnemyState.IDLE:
          this.handleIdleState(entity);
          break;
        case EnemyState.CHASING:
          this.handleChasingState(entity);
          break;
        // ... other states
      }
    });
  }
}
```

### Factory Pattern
```typescript
class EntityFactory {
  static createPlayer(world: World, config: PlayerConfig): Entity {
    const player = world.createEntity();
    
    player.addComponent(new Transform(config.position));
    player.addComponent(new Health(config.health));
    player.addComponent(new Movement(config.movement));
    
    return player;
  }
  
  static createEnemy(world: World, type: EnemyType): Entity {
    const enemy = world.createEntity();
    
    const config = EnemyConfigs[type];
    enemy.addComponent(new Transform(config.position));
    enemy.addComponent(new Health(config.health));
    enemy.addComponent(new Combat(config.combat));
    
    return enemy;
  }
}
```

### Observer Pattern
```typescript
class GameManager {
  private observers: ((event: GameEvent) => void)[] = [];
  
  addObserver(callback: (event: GameEvent) => void): void {
    this.observers.push(callback);
  }
  
  notify(event: GameEvent): void {
    this.observers.forEach(observer => observer(event));
  }
}
```

## Debugging and Testing

### Performance Monitoring
```typescript
import { PerformanceMonitor } from 'vital-engine-sdk';

const monitor = new PerformanceMonitor();

// Enable monitoring
monitor.enable();

// Check performance metrics
const metrics = monitor.getMetrics();
console.log('FPS:', metrics.fps);
console.log('Memory usage:', metrics.memoryUsage);
```

### Profiling
```typescript
import { Profiler } from 'vital-engine-sdk';

// Profile system performance
Profiler.start('MovementSystem');
movementSystem.update(deltaTime);
Profiler.end('MovementSystem');

// Get profiling results
const results = Profiler.getResults();
console.log('MovementSystem took:', results.MovementSystem.time, 'ms');
```

### Testing Entities and Components
```typescript
// Example test
describe('Player Entity', () => {
  let world: World;
  let player: Entity;
  
  beforeEach(() => {
    world = new World();
    player = createPlayer(world, 0, 0);
  });
  
  it('should have required components', () => {
    expect(player.hasComponent(Transform)).toBe(true);
    expect(player.hasComponent(Health)).toBe(true);
    expect(player.hasComponent(Movement)).toBe(true);
  });
  
  it('should move when velocity is applied', () => {
    const transform = player.getComponent(Transform);
    const movement = player.getComponent(Movement);
    
    movement.data.velocity = { x: 10, y: 0 };
    
    const movementSystem = new MovementSystem();
    movementSystem.update(100); // 100ms
    
    expect(transform.data.x).toBe(1); // 10 * 0.1
  });
});
```

## Game Development Workflow

### 1. Design Phase
- Define game mechanics and requirements
- Identify required components and systems
- Plan entity hierarchies and relationships

### 2. Implementation Phase
- Create components for game data
- Implement systems for game logic
- Build entity factories and managers

### 3. Integration Phase
- Connect systems with event system
- Implement game loop and state management
- Add performance monitoring

### 4. Testing Phase
- Unit test components and systems
- Integration test system interactions
- Performance test with large entity counts

### 5. Optimization Phase
- Profile system performance
- Optimize hot paths
- Implement object pooling where needed

This guide provides the foundation for building games with the Vital Engine SDK. The ECS architecture promotes clean, maintainable code that scales well with complex game requirements.
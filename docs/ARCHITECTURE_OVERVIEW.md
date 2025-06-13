# Vital Engine SDK - Architecture Overview

## Table of Contents
1. [High-Level Architecture](#high-level-architecture)
2. [Entity-Component-System (ECS)](#entity-component-system-ecs)
3. [Core Systems](#core-systems)
4. [Component Architecture](#component-architecture)
5. [Event System](#event-system)
6. [Performance Architecture](#performance-architecture)
7. [Memory Management](#memory-management)
8. [Module Dependencies](#module-dependencies)

## High-Level Architecture

The Vital Engine SDK follows a modular, ECS-based architecture designed for high-performance game development.

```
┌─────────────────────────────────────────────────────────┐
│                    Game Application                      │
├─────────────────────────────────────────────────────────┤
│                  Vital Engine SDK                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │   Systems   │  │ Components  │  │   Events    │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              ECS Core (World, Entity)              │ │
│  └─────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────┐ │
│  │                Engine & Utilities                  │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Entity-Component-System (ECS)

### Entity
- Unique identifier (number)
- Container for components
- No behavior, only identity

```typescript
class Entity {
  private components: Map<ComponentType, Component> = new Map();
  
  addComponent<T extends Component>(component: T): Entity;
  removeComponent<T extends Component>(componentType: ComponentType<T>): Entity;
  getComponent<T extends Component>(componentType: ComponentType<T>): T | null;
  hasComponent<T extends Component>(componentType: ComponentType<T>): boolean;
}
```

### Component
- Pure data containers
- No logic or behavior
- Compositional approach to entity features

```typescript
abstract class Component {
  constructor(public data: any = {}) {}
}

// Example implementations
class Transform extends Component {
  data: { x: number; y: number; rotation: number };
}

class Health extends Component {
  data: { current: number; max: number };
}
```

### System
- Contains game logic
- Processes entities with specific component combinations
- Stateless operations on component data

```typescript
abstract class System {
  abstract update(deltaTime: number): void;
  
  protected query(componentTypes: ComponentType[]): Entity[] {
    // Return entities matching component requirements
  }
}
```

### World
- Central manager for entities, components, and systems
- Coordinates system execution
- Manages entity lifecycle

```typescript
class World {
  private entities: Map<number, Entity> = new Map();
  private systems: System[] = [];
  
  createEntity(): Entity;
  removeEntity(entity: Entity): void;
  addSystem(system: System): void;
  update(deltaTime: number): void;
}
```

## Core Systems

### Movement System
Handles entity movement and physics.

```typescript
class MovementSystem extends System {
  requiredComponents = [Transform, Movement];
  
  update(deltaTime: number): void {
    this.query([Transform, Movement]).forEach(entity => {
      const transform = entity.getComponent(Transform);
      const movement = entity.getComponent(Movement);
      
      // Apply velocity to position
      transform.data.x += movement.data.velocity.x * deltaTime * 0.001;
      transform.data.y += movement.data.velocity.y * deltaTime * 0.001;
    });
  }
}
```

### Combat System
Manages damage, health, and combat interactions.

```typescript
class CombatSystem extends System {
  requiredComponents = [Transform, Health, Combat];
  
  update(deltaTime: number): void {
    // Handle attack cooldowns
    // Process damage dealing
    // Manage health changes
  }
}
```

### Collection System
Handles item collection and inventory management.

```typescript
class CollectionSystem extends System {
  update(deltaTime: number): void {
    // Check for collectible items in range
    // Add items to inventory
    // Trigger collection events
  }
}
```

## Component Architecture

### Core Components

#### Transform
```typescript
interface TransformData {
  x: number;
  y: number;
  rotation: number;
}

class Transform extends Component {
  constructor(data: TransformData) {
    super(data);
  }
}
```

#### Health
```typescript
interface HealthData {
  current: number;
  max: number;
  regenerationRate?: number;
}

class Health extends Component {
  constructor(data: HealthData) {
    super(data);
  }
}
```

#### Movement
```typescript
interface MovementData {
  speed: number;
  velocity: { x: number; y: number };
  acceleration?: { x: number; y: number };
}

class Movement extends Component {
  constructor(data: MovementData) {
    super(data);
  }
}
```

#### Combat
```typescript
interface CombatData {
  damage: number;
  attackRange: number;
  attackCooldown: number;
  lastAttackTime: number;
}

class Combat extends Component {
  constructor(data: CombatData) {
    super(data);
  }
}
```

### Specialized Components

#### Skills
```typescript
interface SkillData {
  activeSkills: ActiveSkill[];
  passiveSkills: PassiveSkill[];
  skillPoints: number;
}

class Skills extends Component {
  constructor(data: SkillData) {
    super(data);
  }
}
```

#### Inventory
```typescript
interface InventoryData {
  slots: number;
  items: InventoryItem[];
  gold: number;
}

class Inventory extends Component {
  constructor(data: InventoryData) {
    super(data);
  }
}
```

#### EnemyAI
```typescript
interface EnemyAIData {
  type: 'passive' | 'aggressive' | 'defensive';
  detectionRange: number;
  target: Entity | null;
  state: string;
}

class EnemyAI extends Component {
  constructor(data: EnemyAIData) {
    super(data);
  }
}
```

## Event System

### Event Architecture
The event system provides loose coupling between systems and components.

```typescript
class EventSystem {
  private listeners: Map<string, EventListener[]> = new Map();
  
  subscribe(eventType: string, callback: EventListener): void;
  unsubscribe(eventType: string, callback: EventListener): void;
  emit(eventType: string, data?: any): void;
}
```

### Common Events

#### Combat Events
```typescript
// Player takes damage
eventSystem.emit('player_damaged', {
  entity: playerEntity,
  damage: 25,
  source: enemyEntity
});

// Enemy defeated
eventSystem.emit('enemy_defeated', {
  entity: enemyEntity,
  experience: 50,
  gold: 10
});
```

#### Collection Events
```typescript
// Item collected
eventSystem.emit('item_collected', {
  entity: playerEntity,
  item: { id: 'health_potion', quantity: 1 }
});

// Level up
eventSystem.emit('level_up', {
  entity: playerEntity,
  newLevel: 5,
  skillPoints: 1
});
```

#### System Events
```typescript
// Difficulty increased
eventSystem.emit('difficulty_increased', {
  newLevel: 3,
  multiplier: 1.5
});

// Wave completed
eventSystem.emit('wave_completed', {
  waveNumber: 10,
  enemiesDefeated: 25
});
```

## Performance Architecture

### Batch Processing
The SDK includes batch processing utilities for handling large numbers of entities efficiently.

```typescript
class BatchProcessor<T> {
  constructor(private batchSize: number) {}
  
  process(items: T[], processor: (batch: T[]) => void): void {
    for (let i = 0; i < items.length; i += this.batchSize) {
      const batch = items.slice(i, i + this.batchSize);
      processor(batch);
    }
  }
}
```

### Object Pooling
Reduces garbage collection pressure by reusing objects.

```typescript
class ObjectPool<T> {
  private pool: T[] = [];
  
  constructor(
    private factory: () => T,
    private reset: (obj: T) => void,
    initialSize: number
  ) {
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.factory());
    }
  }
  
  acquire(): T;
  release(obj: T): void;
}
```

### Spatial Partitioning
Optimizes collision detection and proximity queries.

```typescript
class SpatialGrid<T> {
  constructor(private cellSize: number) {}
  
  insert(item: T, x: number, y: number): void;
  remove(item: T, x: number, y: number): void;
  query(x: number, y: number, radius: number): T[];
}
```

## Memory Management

### Component Memory Layout
Components are designed for cache-friendly access patterns:

```typescript
// Good: Data-oriented design
class HealthComponent {
  data: {
    current: number;    // 4 bytes
    max: number;        // 4 bytes
    regen: number;      // 4 bytes
  }                     // Total: 12 bytes, cache-aligned
}

// Avoid: Object-oriented design with scattered data
class HealthComponentOOP {
  current: HealthValue;  // Reference to another object
  max: HealthValue;      // Reference to another object
  effects: Effect[];     // Array of references
}
```

### Entity Storage
Entities are stored in contiguous arrays when possible:

```typescript
class World {
  private entities: Entity[] = [];           // Contiguous storage
  private freeIndices: number[] = [];        // Reuse slots
  private componentArrays: Map<ComponentType, Component[]> = new Map();
}
```

### Memory Pooling Strategy
```typescript
// Pool frequently created/destroyed objects
const projectilePool = new ObjectPool<Entity>(
  () => createProjectileEntity(),
  (entity) => resetProjectileEntity(entity),
  100 // Pre-allocate 100 projectiles
);

// Pool component instances
const transformPool = new ObjectPool<Transform>(
  () => new Transform({ x: 0, y: 0, rotation: 0 }),
  (transform) => { transform.data.x = 0; transform.data.y = 0; transform.data.rotation = 0; },
  1000
);
```

## Module Dependencies

### Core Module Dependencies
```
Engine
├── World (ECS Core)
│   ├── Entity
│   ├── Component
│   └── System
├── EventSystem
├── PerformanceMonitor
└── Profiler

Components
├── Transform
├── Health
├── Movement
├── Combat
├── Skills
├── Inventory
├── EnemyAI
├── Collectible
├── Experience
├── Spawner
├── Magnet
└── Difficulty

Systems
├── MovementSystem
├── CombatSystem
├── CollectionSystem
├── EnemySystem
├── SkillSystem
├── ProgressionSystem
├── EconomySystem
├── DifficultySystem
└── SimpleCollectionSystem

Utils
├── BatchProcessor
├── ObjectPool
├── SpatialGrid
├── Math utilities
└── MemoryManagement
```

### Import Structure
```typescript
// Core ECS
import { Engine, World, Entity, Component, System } from 'vital-engine-sdk/core';

// Components
import { 
  Transform, 
  Health, 
  Movement, 
  Combat 
} from 'vital-engine-sdk/components';

// Systems
import { 
  MovementSystem, 
  CombatSystem, 
  CollectionSystem 
} from 'vital-engine-sdk/systems';

// Utilities
import { 
  BatchProcessor, 
  ObjectPool, 
  SpatialGrid 
} from 'vital-engine-sdk/utils';

// Types
import { 
  GameEvent, 
  InventoryItem, 
  ActiveSkill 
} from 'vital-engine-sdk/types';
```

### System Execution Order
Systems are executed in a specific order each frame:

```typescript
class World {
  update(deltaTime: number): void {
    // 1. Input processing (external)
    
    // 2. AI and decision making
    this.enemySystem.update(deltaTime);
    
    // 3. Physics and movement
    this.movementSystem.update(deltaTime);
    
    // 4. Collision and interaction
    this.combatSystem.update(deltaTime);
    this.collectionSystem.update(deltaTime);
    
    // 5. Game state updates
    this.progressionSystem.update(deltaTime);
    this.economySystem.update(deltaTime);
    this.difficultySystem.update(deltaTime);
    
    // 6. Cleanup and spawning
    this.entityCleanup();
    this.spawnerSystem.update(deltaTime);
    
    // 7. Rendering (external)
  }
}
```

This architecture ensures clean separation of concerns, high performance, and maintainable code structure for game development.
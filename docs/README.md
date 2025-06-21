# Vital Engine SDK Documentation

A comprehensive Entity-Component-System (ECS) game engine SDK built with TypeScript for high-performance game development.

## Documentation Overview

This documentation is designed to help AI coding agents and developers understand and implement games using the Vital Engine SDK. All examples use TypeScript for type safety and better development experience.

### Documentation Structure

#### 📚 [API Reference](./API_REFERENCE.md)
Complete API documentation covering all classes, interfaces, and methods in the SDK.
- Core architecture components
- Detailed method signatures
- Usage examples for each API

#### 🏗️ [Architecture Overview](./ARCHITECTURE_OVERVIEW.md)
In-depth explanation of the SDK's architecture and design patterns.
- ECS architecture principles
- System execution flow
- Memory management strategies
- Performance optimization techniques

#### 🎮 [Game Development Guide](./GAME_DEVELOPMENT_GUIDE.md)
Step-by-step guide for building games with the SDK.
- Getting started tutorial
- Core concepts and best practices
- Advanced game features
- Testing and debugging strategies

#### 💻 [TypeScript Examples](./TYPESCRIPT_EXAMPLES.md)
Comprehensive TypeScript code examples and patterns.
- Entity creation patterns
- System implementations
- Event handling examples
- Performance optimization code

#### ⚡ [Quick Start Guide](./QUICK_START.md)
Fast-track guide to get up and running quickly.
- Basic setup
- Simple game example
- Common use cases

#### 🔗 [Frontend Integration](./FRONTEND_INTEGRATION.md)
Guide for integrating the SDK with frontend frameworks.
- Browser compatibility
- Framework-specific examples
- Performance considerations

## Key Features

### 🏭 Entity-Component-System Architecture
- **Entities**: Unique identifiers for game objects
- **Components**: Data containers with no logic
- **Systems**: Logic processors that operate on entities with specific components

### ⚡ High Performance
- Batch processing for large entity counts
- Object pooling to reduce garbage collection
- Spatial partitioning for efficient collision detection
- Cache-friendly data structures

### 🎯 Type Safety
- Full TypeScript support with strict typing
- IntelliSense support for better development experience
- Compile-time error checking

### 🔧 Modular Design
- Plugin system for extensibility
- Configurable systems and components
- Easy to test and maintain

## Quick Example

```typescript
import { Engine, World, Entity } from 'vital-engine-sdk';
import { 
  Transform, 
  Health, 
  Movement, 
  MovementSystem, 
  CombatSystem 
} from 'vital-engine-sdk';

// Create engine and world
const engine = new Engine();
const world = new World();

// Add systems
world.addSystem(new MovementSystem());
world.addSystem(new CombatSystem());

// Create a player entity
const player = world.createEntity();
player.addComponent(new Transform({ x: 400, y: 300, rotation: 0 }));
player.addComponent(new Health({ current: 100, max: 100 }));
player.addComponent(new Movement({ speed: 200, velocity: { x: 0, y: 0 } }));

// Start the engine
engine.start();

// Game loop
function gameLoop() {
  const deltaTime = engine.getDeltaTime();
  world.update(deltaTime);
  requestAnimationFrame(gameLoop);
}

gameLoop();
```

## Core Concepts

### Entity Creation
```typescript
// Create entity with components
const enemy = world.createEntity();
enemy.addComponent(new Transform({ x: 100, y: 100, rotation: 0 }));
enemy.addComponent(new Health({ current: 50, max: 50 }));
enemy.addComponent(new EnemyAI({ type: 'aggressive', detectionRange: 200 }));
```

### System Implementation
```typescript
class CustomSystem extends System {
  update(deltaTime: number): void {
    // Query entities with required components
    const entities = this.world.query([Transform, Health]);
    
    entities.forEach(entity => {
      const transform = entity.getComponent(Transform);
      const health = entity.getComponent(Health);
      
      // Your game logic here
    });
  }
}
```

### Event Handling
```typescript
// Subscribe to events
world.eventSystem.subscribe('player_died', (data) => {
  console.log('Game Over!');
});

// Emit events
world.eventSystem.emit('enemy_defeated', {
  enemy: enemyEntity,
  experience: 50
});
```

## Available Components

### Core Components
- **Transform**: Position, rotation, and scale data
- **Health**: Health points, regeneration, and damage resistance
- **Movement**: Velocity, acceleration, and movement constraints
- **Combat**: Weapon stats, damage calculation, and targeting

### Advanced Components (Phase 3)
- **Skills**: Active and passive abilities with effects and cooldowns
- **Inventory**: Item storage, stacking, and resource management
- **Experience**: Level progression, XP tracking, and skill points
- **AIComponent**: Advanced AI with state machines and behavior trees
- **EnemyAIComponent**: Simplified enemy AI with behavior states
- **CollectibleComponent**: Collectible items with magnetism and effects
- **MagnetComponent**: Magnetic attraction for item collection
- **SpawnerComponent**: Wave-based entity spawning with patterns
- **DifficultyComponent**: Dynamic difficulty tracking and adjustment

## Available Systems

### Core Systems
- **MovementSystem**: Entity movement with collision detection
- **CombatSystem**: Damage calculation, targeting, and projectiles
- **ProgressionSystem**: Level progression and experience management
- **EconomySystem**: Currency, trading, and resource management

### Advanced Systems (Phase 3)
- **SkillSystem**: Skill activation, effects, cooldowns, and evolution
- **AISystem**: Advanced pathfinding (A*, Flow Field, Nav Mesh)
- **CollectionSystem**: Item collection with magnetic attraction
- **SimpleCollectionSystem**: Basic proximity-based collection
- **EnemySystem**: Enemy AI behavior and group coordination
- **SpawnSystem**: Wave-based spawning with patterns and timing
- **DifficultySystem**: Adaptive difficulty with performance tracking

## Performance Features

### Batch Processing
```typescript
import { BatchProcessor } from 'vital-engine-sdk';

const processor = new BatchProcessor<Entity>(100);
processor.process(entities, (batch) => {
  // Process entities in batches of 100
});
```

### Object Pooling
```typescript
import { ObjectPool } from 'vital-engine-sdk';

const projectilePool = new ObjectPool<Entity>(
  () => createProjectile(),
  (projectile) => resetProjectile(projectile),
  50 // Initial pool size
);
```

### Spatial Partitioning
```typescript
import { SpatialGrid } from 'vital-engine-sdk';

const spatialGrid = new SpatialGrid<Entity>(100);
spatialGrid.insert(entity, x, y);
const nearby = spatialGrid.query(x, y, radius);
```

## Installation

```bash
npm install vital-engine-sdk
```

## TypeScript Configuration

Ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

## For AI Coding Agents

This documentation is specifically designed for AI coding agents to understand and implement games using the Vital Engine SDK. Key points:

1. **Use TypeScript**: All examples and implementations should use TypeScript for type safety
2. **Follow ECS Patterns**: Understand the Entity-Component-System architecture
3. **Reference Examples**: Use the TypeScript examples as templates for implementation
4. **Performance Awareness**: Utilize the performance features for large-scale games
5. **Event-Driven Design**: Leverage the event system for loose coupling between systems

## Getting Help

- Check the [Quick Start Guide](./QUICK_START.md) for immediate setup
- Review [TypeScript Examples](./TYPESCRIPT_EXAMPLES.md) for implementation patterns
- Reference the [API Documentation](./API_REFERENCE.md) for detailed method information
- Study the [Architecture Overview](./ARCHITECTURE_OVERVIEW.md) for deep understanding

The Vital Engine SDK provides a solid foundation for building high-performance games with clean, maintainable code using modern TypeScript patterns.
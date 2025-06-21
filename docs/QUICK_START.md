# Quick Start Guide

Get up and running with the Vital Engine SDK in minutes.

## 1. Installation

```bash
npm install vital-engine-sdk
```

## 2. Basic Usage

```javascript
import {
  Engine,
  TransformComponent,
  HealthComponent,
  MovementComponent,
} from 'vital-engine-sdk'

// Create engine
const engine = new Engine({
  engine: {
    targetFPS: 60,
    fixedTimeStep: false,
  },
})

const world = engine.getWorld()

// Create a game entity
const player = world.createEntity()
player.addComponent(new TransformComponent(100, 100))
player.addComponent(new HealthComponent(100))
player.addComponent(new MovementComponent(150))

// Game loop
function gameLoop() {
  world.update(16.67) // ~60 FPS

  // Get all entities
  const entities = world.getActiveEntities()
  console.log(`Active entities: ${entities.length}`)

  requestAnimationFrame(gameLoop)
}

gameLoop()
```

## 3. Frontend Integration Test

To test the SDK with a visual frontend:

```bash
# From the SDK directory
npm run create-frontend-test

# Move to frontend project
cd ../frontend-test

# Copy complete implementation from docs/FRONTEND_INTEGRATION.md
# Then install and run:
npm install
npm run dev
```

## 4. Core Concepts

### Entity-Component-System (ECS)

- **Entities**: Game objects (player, enemies, items)
- **Components**: Data containers (position, health, inventory)
- **Systems**: Logic processors (movement, combat, progression)

### Event System

```javascript
const events = engine.getEvents()

// Listen for events
events.on('ENTITY_KILLED', (event) => {
  console.log('Entity died:', event.data)
})

// Systems automatically emit events
```

### Performance

The SDK is designed for high performance:

- ✅ 1000+ entities at 60 FPS
- ✅ 11.6ms average frame time
- ✅ Efficient entity creation/destruction

## 5. Example Game Loop with All Systems

```javascript
import {
  Engine,
  World,
  TransformComponent,
  HealthComponent,
  MovementComponent,
  CombatComponent,
  ExperienceComponent,
  InventoryComponent,
  MovementSystem,
  CombatSystem,
  ProgressionSystem,
  EconomySystem,
} from 'vital-engine-sdk'

const engine = new Engine()
const world = engine.getWorld()
const events = engine.getEvents()

// Add all core systems
world.addSystem(new MovementSystem(events))
world.addSystem(new CombatSystem(events, world))
world.addSystem(new ProgressionSystem(events, world))
world.addSystem(new EconomySystem(events, world))

// Create player
const player = world.createEntity()
player.addComponent(new TransformComponent(400, 300))
player.addComponent(new HealthComponent(100))
player.addComponent(new MovementComponent(150))
player.addComponent(
  new CombatComponent({
    damage: 25,
    range: 80,
    attackSpeed: 2,
  })
)
player.addComponent(new ExperienceComponent(1))
player.addComponent(new InventoryComponent(20))

// Create enemies
for (let i = 0; i < 10; i++) {
  const enemy = world.createEntity()
  enemy.addComponent(
    new TransformComponent(Math.random() * 800, Math.random() * 600)
  )
  enemy.addComponent(new HealthComponent(50))
  enemy.addComponent(new MovementComponent(75))
}

// Game loop
function update() {
  world.update(16.67)

  // Your rendering/UI updates here

  requestAnimationFrame(update)
}

update()
```

This creates a functional game with player, enemies, combat, progression, and economy systems all working together!

## 6. Advanced Features (Phase 3)

### Skills System

```javascript
import { SkillsComponent, SkillType, SkillEffectType, SkillSystem } from 'vital-engine-sdk'

// Add skills system
world.addSystem(new SkillSystem(world, {
  baseEffectRadius: 150,
  baseProjectileSpeed: 300,
  evolutionCheckInterval: 5000,
  maxActiveEffects: 10
}))

// Add skills to player
const skills = new SkillsComponent()
skills.addSkill({
  id: 'fireball',
  name: 'Fireball',
  type: SkillType.ACTIVE,
  targetType: SkillTargetType.PROJECTILE,
  cooldown: 2000,
  effects: [{
    type: SkillEffectType.DAMAGE,
    value: 50
  }]
})
player.addComponent(skills)
```

### Enemy AI System

```javascript
import { EnemyAIComponent, AIBehaviorType, AIBehaviorState, AISystem } from 'vital-engine-sdk'

// Add AI system with spatial partitioning
const spatialGrid = new SpatialHashGrid({
  cellSize: 100,
  worldBounds: { minX: 0, minY: 0, maxX: 800, maxY: 600 }
})
world.addSystem(new AISystem(spatialGrid, {
  pathfindingType: PathfindingType.A_STAR,
  groupBehaviorEnabled: true
}))

// Add AI to enemies
const ai = new EnemyAIComponent()
ai.behaviorType = AIBehaviorType.AGGRESSIVE
ai.targetEntityId = player.id
enemy.addComponent(ai)
```

### Spawning System

```javascript
import { SpawnerComponent, SpawnPattern, SpawnSystem } from 'vital-engine-sdk'

// Add spawn system
world.addSystem(new SpawnSystem(spatialGrid))

// Create spawner
const spawner = world.createEntity()
spawner.addComponent(new SpawnerComponent({
  center: { x: 400, y: 300 },
  radius: 300
}))

// Configure waves
spawnerComp.waves = [{
  id: 'wave1',
  enemyTypes: ['basic_enemy'],
  totalCount: 10,
  spawnRate: 1,
  pattern: SpawnPattern.CIRCLE,
  area: { center: { x: 400, y: 300 }, radius: 300 },
  delay: 5000
}]
```

### Collection System

```javascript
import { CollectibleComponent, CollectibleType, MagnetComponent, CollectionSystem } from 'vital-engine-sdk'

// Add collection system
world.addSystem(new CollectionSystem())

// Add magnet to player
player.addComponent(new MagnetComponent())

// Create collectibles
const collectible = world.createEntity()
collectible.addComponent(new TransformComponent(200, 200))
collectible.addComponent(new CollectibleComponent(
  CollectibleType.EXPERIENCE,
  10 // value
))
```

### Difficulty System

```javascript
import { DifficultyComponent, DifficultySystem } from 'vital-engine-sdk'

// Add difficulty system
world.addSystem(new DifficultySystem())

// Add difficulty tracking to player
player.addComponent(new DifficultyComponent())

// System automatically adjusts difficulty based on:
// - Player performance
// - Survival time
// - Enemy kill rate
// - Collection efficiency
```

## 7. Complete Example with All Features

Check out the `frontend-example` directory for a complete implementation with:
- All core and advanced systems
- Visual rendering with Canvas
- Input handling
- UI elements
- Particle effects
- Wave spawning
- Skill cooldowns
- And more!

```bash
cd frontend-example
npm install
npm run dev
```

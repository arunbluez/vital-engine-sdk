# Vital Engine SDK

A headless game engine SDK for building Survivor.io-style survival action games. This SDK provides pure game logic without any rendering or platform-specific dependencies.

## Features

- **Entity-Component-System (ECS) Architecture**: High-performance game object management
- **Event-Driven Communication**: Decoupled systems communicate through events
- **Platform Agnostic**: Works with any JavaScript frontend (Web, React Native, Unity WebGL)
- **Zero Runtime Dependencies**: Lightweight and efficient
- **TypeScript First**: Full type safety and excellent IDE support
- **Deterministic**: Reproducible game states for debugging and replays

## Installation

```bash
npm install vital-engine-sdk
```

## Quick Start

```typescript
import { Engine, Entity, Component, System, World } from 'vital-engine-sdk'

// Create the game engine
const engine = new Engine({
  targetFPS: 60,
  fixedTimeStep: true,
})

// Access the ECS world
const world = engine.getWorld()

// Create an entity
const player = world.createEntity()

// Add components to the entity
player.addComponent(new PositionComponent(0, 0))
player.addComponent(new HealthComponent(100))

// Add systems to process entities
world.addSystem(new MovementSystem())
world.addSystem(new CombatSystem())

// Start the game loop
engine.start()

// Listen for game events
engine.getEvents().on('DAMAGE_DEALT', (event) => {
  console.log('Damage dealt:', event.data)
})
```

## Architecture

The SDK follows an Entity-Component-System (ECS) architecture:

- **Entities**: Unique identifiers that represent game objects
- **Components**: Pure data containers attached to entities
- **Systems**: Logic processors that operate on entities with specific components
- **World**: Manages all entities and systems
- **Engine**: Orchestrates the game loop and provides the main API

## Development Status

This SDK is currently in early development (v0.0.1). The core ECS architecture and event system are implemented. Additional game systems and features are being developed.

## License

MIT
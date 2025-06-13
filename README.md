# Vital Engine SDK

[![npm version](https://img.shields.io/npm/v/vital-engine-sdk.svg)](https://www.npmjs.com/package/vital-engine-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D14-green.svg)](https://nodejs.org/)
[![Test Coverage](https://img.shields.io/badge/coverage-0%25-red.svg)](https://github.com/arunbluez/vital-engine-sdk)

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

## 📚 Documentation

For detailed documentation, examples, and guides, visit our [Documentation](./docs/README.md).

- [Quick Start Guide](./docs/QUICK_START.md)
- [Architecture Overview](./docs/ARCHITECTURE_OVERVIEW.md)
- [API Reference](./docs/API_REFERENCE.md)
- [Game Development Guide](./docs/GAME_DEVELOPMENT_GUIDE.md)
- [Frontend Integration](./docs/FRONTEND_INTEGRATION.md)
- [TypeScript Examples](./docs/TYPESCRIPT_EXAMPLES.md)

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

## 🏗️ Architecture

The SDK follows an Entity-Component-System (ECS) architecture:

- **Entities**: Unique identifiers that represent game objects
- **Components**: Pure data containers attached to entities
- **Systems**: Logic processors that operate on entities with specific components
- **World**: Manages all entities and systems
- **Engine**: Orchestrates the game loop and provides the main API

## 🛠️ Tech Stack

- **Language**: TypeScript 5.3+
- **Runtime**: Node.js 14+
- **Build System**: Rollup
- **Testing**: Jest with TypeScript support
- **Code Quality**: ESLint + Prettier
- **Package Format**: CommonJS, ESM, and TypeScript declarations

### Key Technologies & Features

- **Zero Dependencies**: No runtime dependencies for maximum performance
- **Type Safety**: Full TypeScript support with strict typing
- **Performance**: Optimized ECS implementation with spatial partitioning
- **Memory Management**: Object pooling and efficient component storage
- **Event System**: Decoupled communication between systems
- **Deterministic**: Reproducible game states for debugging and replays

## 🚀 Features in Development

- [ ] Advanced AI behaviors
- [ ] Procedural level generation
- [ ] Multiplayer support
- [ ] Save/Load system
- [ ] Replay system
- [ ] Advanced physics integration
- [ ] More skill and weapon types
- [ ] Boss encounters

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## 📦 Building

```bash
# Build for production
npm run build

# Build in watch mode for development
npm run dev
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT
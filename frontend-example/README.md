# Vital Engine SDK - Frontend Example

This is a TypeScript-based frontend example showcasing the Vital Engine SDK integration.

## Features

- ✅ Fully type-safe TypeScript implementation
- ✅ Entity creation and management
- ✅ All core systems (Movement, Combat, Progression, Economy)
- ✅ Event system with proper type safety
- ✅ Real-time performance with rendering
- ✅ Input handling and player interaction
- ✅ Skills system with passive and active abilities
- ✅ Enemy AI system with multiple states
- ✅ Collection system with magnetic pickup

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Open browser to http://localhost:5173

## Scripts

- `npm run dev` - Start Vite development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run type-check` - Run TypeScript type checking

## Controls

- **WASD**: Move player
- **Mouse**: Aim and auto-fire
- **Click**: Manual fire boost
- **R**: Restart game
- **Q**: Show test menu
- **1-3**: Test individual systems

## Game Elements

- **Green circle**: Player character
- **Red circles**: Enemy entities with AI
- **Cyan circles**: Experience collectibles
- **Yellow projectiles**: Auto-fired bullets
- **Cyan orbs**: Orbiting damage blades

## Performance Expectations

- Maintains 60 FPS with 10+ entities
- Smooth player movement and combat
- Responsive UI updates
- Efficient collision detection

## Architecture

The example demonstrates proper TypeScript patterns:
- Type-safe component access
- Proper event typing
- Interface definitions for game objects
- Strict null checking
- Clean separation of concerns
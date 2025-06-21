# Vital Engine SDK - Frontend Example

This is a TypeScript-based frontend example showcasing the Vital Engine SDK integration with all advanced features.

## Features

### Core Systems
- ✅ Fully type-safe TypeScript implementation
- ✅ Entity creation and management
- ✅ All core systems (Movement, Combat, Progression, Economy)
- ✅ Event system with proper type safety
- ✅ Real-time performance with 60 FPS rendering

### Advanced Features (Phase 3)
- ✅ **Skills System**: Database-driven skills with cooldowns and effects
- ✅ **Enemy AI System**: State machines, pathfinding, and behavior personalities
- ✅ **Collection System**: Magnetic pickups with attraction physics
- ✅ **Spawning System**: Wave-based enemy spawning with patterns
- ✅ **Difficulty System**: Adaptive difficulty with performance tracking
- ✅ **Particle Effects**: Visual feedback for damage, death, and collection

### Visual Enhancements
- ✅ Skill UI with cooldown indicators
- ✅ Wave progress display
- ✅ Difficulty level indicator
- ✅ Particle effects system
- ✅ Health bars and visual feedback
- ✅ Area effect animations

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
- **Space**: Activate Area Blast skill
- **R**: Restart game
- **Q**: Show advanced features test menu
- **1-5**: Test individual systems (Skills, AI, Collection, Spawning, Difficulty)

## Game Elements

### Entities
- **Green circle**: Player character with skills
- **Red circles**: Enemy entities with AI states
  - Light red: Idle state
  - Red: Seeking player
  - Dark red: Attacking
  - Orange: Fleeing
- **Gray circles**: Dead enemies (fade out over 3 seconds)

### Collectibles
- **Cyan circles**: Experience orbs
- **Red circles**: Health pickups
- **Blue circles**: Mana pickups
- **Yellow circles**: Currency items

### Combat
- **Yellow projectiles**: Player bullets
- **Red projectiles**: Enemy bullets
- **Cyan orbs**: Orbiting damage blades
- **Orange rings**: Area blast skill effect

### UI Elements
- **Skills bar**: Bottom left, shows active skills with cooldowns
- **Wave indicator**: Top center, shows current wave and progress
- **Difficulty indicator**: Top right, shows current difficulty level
- **FPS counter**: Top left corner
- **Player stats**: Health, level, XP display

## Performance Expectations

- Maintains 60 FPS with 50+ active entities
- Smooth player movement and combat
- Responsive UI updates with minimal frame drops
- Efficient collision detection using spatial partitioning
- Particle effects without performance impact
- Wave spawning system handles 100+ enemies total

## Architecture

The example demonstrates proper TypeScript patterns:
- Type-safe component access with strict typing
- Proper event typing using SDK event system
- Interface definitions for game objects
- Strict null checking throughout
- Clean separation of concerns (rendering, input, game logic)
- Efficient memory management with object pooling
- Performance-optimized update loops

## SDK Integration Examples

### Skills System
```typescript
const skills = player.getComponent('skills') as SkillsComponent
skills.addSkill({
    id: 'area_blast',
    type: SkillType.ACTIVE,
    cooldown: 3000,
    effects: [{ type: SkillEffectType.DAMAGE, value: 50 }]
})
```

### AI System
```typescript
const ai = enemy.getComponent('enemyAI') as EnemyAIComponent
ai.behaviorType = AIBehaviorType.AGGRESSIVE
ai.currentState = AIBehaviorState.SEEKING
```

### Spawning System
```typescript
const spawner = new SpawnerComponent({ center: { x: 400, y: 300 }, radius: 300 })
spawner.waves = [wave1, wave2, wave3]
spawner.active = true
```
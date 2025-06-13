# Frontend Integration Guide

This guide demonstrates how to integrate the Vital Engine SDK with frontend frameworks for rendering and user interaction.

## Overview

The Vital Engine SDK is **headless** - it provides pure game logic without any rendering or UI. The frontend's responsibility is to:

- **Render** the game world based on engine state
- **Handle input** and send commands to the engine
- **Display UI** for health, inventory, menus, etc.
- **Play audio** and visual effects based on engine events

## Architecture Pattern

```
┌─────────────────┐    Events     ┌─────────────────┐
│   Frontend      │◄──────────────┤  Vital Engine   │
│   (Rendering)   │               │  (Logic Only)   │
│                 ├──────────────►│                 │
└─────────────────┘   Commands    └─────────────────┘
```

## Example Implementation: Canvas + Vanilla JS

This example demonstrates a minimal frontend using HTML5 Canvas and vanilla JavaScript.

### Project Structure

```
frontend-test/
├── index.html
├── src/
│   ├── main.js           # Main game loop and engine integration
│   ├── renderer.js       # Canvas rendering logic
│   ├── input.js          # Input handling
│   └── ui.js             # UI elements (health bars, etc.)
├── assets/
│   └── (sprites, sounds)
└── package.json
```

### 1. Package Setup

```json
{
  "name": "vital-engine-frontend-test",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "vital-engine-sdk": "file:../vital-engine-sdk"
  },
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "devDependencies": {
    "vite": "^4.0.0"
  }
}
```

### 2. HTML Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vital Engine Test</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background: #000;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            font-family: Arial, sans-serif;
        }
        
        #gameContainer {
            position: relative;
        }
        
        #gameCanvas {
            border: 2px solid #333;
            background: #1a1a1a;
        }
        
        #gameUI {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            color: white;
        }
        
        .ui-element {
            position: absolute;
            pointer-events: auto;
        }
        
        #healthBar {
            top: 10px;
            left: 10px;
            width: 200px;
            height: 20px;
            background: #333;
            border: 1px solid #666;
        }
        
        #healthFill {
            height: 100%;
            background: linear-gradient(90deg, #f00, #ff0);
            transition: width 0.3s ease;
        }
        
        #stats {
            top: 40px;
            left: 10px;
            font-size: 14px;
        }
        
        #controls {
            bottom: 10px;
            left: 10px;
            font-size: 12px;
            opacity: 0.7;
        }
    </style>
</head>
<body>
    <div id="gameContainer">
        <canvas id="gameCanvas" width="800" height="600"></canvas>
        <div id="gameUI">
            <div id="healthBar" class="ui-element">
                <div id="healthFill"></div>
            </div>
            <div id="stats" class="ui-element">
                <div>Level: <span id="level">1</span></div>
                <div>XP: <span id="xp">0</span></div>
                <div>Entities: <span id="entityCount">0</span></div>
                <div>FPS: <span id="fps">0</span></div>
            </div>
            <div id="controls" class="ui-element">
                WASD: Move | Mouse: Aim | Click: Attack | R: Restart
            </div>
        </div>
    </div>
    <script type="module" src="src/main.js"></script>
</body>
</html>
```

### 3. Main Game Loop (main.js)

```javascript
import { 
    Engine,
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
    GameEventType
} from 'vital-engine-sdk'

import { Renderer } from './renderer.js'
import { InputHandler } from './input.js'
import { UIManager } from './ui.js'

class GameFrontend {
    constructor() {
        this.canvas = document.getElementById('gameCanvas')
        this.ctx = this.canvas.getContext('2d')
        
        // Initialize engine
        this.engine = new Engine({
            engine: {
                targetFPS: 60,
                fixedTimeStep: false,
                enableEventHistory: true
            }
        })
        
        this.world = this.engine.getWorld()
        this.events = this.engine.getEvents()
        
        // Initialize frontend components
        this.renderer = new Renderer(this.ctx)
        this.input = new InputHandler(this.canvas)
        this.ui = new UIManager()
        
        // Game state
        this.playerId = null
        this.enemyIds = []
        this.lastTime = 0
        this.frameCount = 0
        this.fpsTimer = 0
        
        this.setupSystems()
        this.setupEventListeners()
        this.createPlayer()
        this.createEnemies(10)
        
        // Start game loop
        this.gameLoop()
    }
    
    setupSystems() {
        // Add all systems to the world
        this.world.addSystem(new MovementSystem(this.events))
        this.world.addSystem(new CombatSystem(this.events, this.world))
        this.world.addSystem(new ProgressionSystem(this.events, this.world))
        this.world.addSystem(new EconomySystem(this.events, this.world))
    }
    
    setupEventListeners() {
        // Listen to engine events for visual/audio feedback
        this.events.on(GameEventType.DAMAGE_DEALT, (event) => {
            console.log('Damage dealt:', event.data)
            // Could trigger damage number animation, screen shake, etc.
        })
        
        this.events.on(GameEventType.ENTITY_KILLED, (event) => {
            console.log('Entity killed:', event.data)
            // Could trigger death animation, explosion effect, etc.
        })
        
        this.events.on(GameEventType.LEVEL_UP, (event) => {
            console.log('Level up!', event.data)
            // Could trigger level up animation, sound effect, etc.
        })
        
        this.events.on(GameEventType.EXPERIENCE_GAINED, (event) => {
            console.log('XP gained:', event.data)
            // Could trigger XP pickup animation
        })
        
        // Handle input
        this.input.on('move', (direction) => {
            if (this.playerId) {
                const player = this.world.getEntity(this.playerId)
                if (player) {
                    const movement = player.getComponent('movement')
                    if (movement) {
                        // Set velocity based on input
                        const speed = movement.maxSpeed
                        movement.velocity.x = direction.x * speed
                        movement.velocity.y = direction.y * speed
                    }
                }
            }
        })
        
        this.input.on('attack', (target) => {
            // Auto-targeting is handled by CombatSystem
            // Could trigger attack animation or sound
            console.log('Attack input at:', target)
        })
        
        this.input.on('restart', () => {
            this.restart()
        })
    }
    
    createPlayer() {
        const player = this.world.createEntity()
        this.playerId = player.id
        
        player.addComponent(new TransformComponent(400, 300)) // Center of canvas
        player.addComponent(new HealthComponent(100))
        player.addComponent(new MovementComponent(150))
        player.addComponent(new CombatComponent({
            damage: 25,
            range: 80,
            attackSpeed: 2,
            criticalChance: 0.15,
            criticalMultiplier: 2.0
        }))
        player.addComponent(new ExperienceComponent(1))
        player.addComponent(new InventoryComponent(20))
        
        console.log('Player created with ID:', this.playerId)
    }
    
    createEnemies(count) {
        this.enemyIds = []
        
        for (let i = 0; i < count; i++) {
            const enemy = this.world.createEntity()
            this.enemyIds.push(enemy.id)
            
            // Random position around the edges
            const angle = Math.random() * Math.PI * 2
            const distance = 200 + Math.random() * 200
            const x = 400 + Math.cos(angle) * distance
            const y = 300 + Math.sin(angle) * distance
            
            enemy.addComponent(new TransformComponent(x, y))
            enemy.addComponent(new HealthComponent(30 + Math.random() * 40))
            enemy.addComponent(new MovementComponent(50 + Math.random() * 50))
            
            // Some enemies can attack back
            if (Math.random() < 0.3) {
                enemy.addComponent(new CombatComponent({
                    damage: 5 + Math.random() * 10,
                    range: 60,
                    attackSpeed: 0.5 + Math.random() * 1
                }))
            }
        }
        
        console.log(`Created ${count} enemies`)
    }
    
    restart() {
        // Clear all entities
        this.world.clear()
        
        // Recreate everything
        this.setupSystems()
        this.createPlayer()
        this.createEnemies(10)
        
        console.log('Game restarted')
    }
    
    gameLoop() {
        const currentTime = performance.now()
        const deltaTime = currentTime - this.lastTime
        this.lastTime = currentTime
        
        // Update engine
        this.world.update(deltaTime)
        
        // Update input
        this.input.update()
        
        // Render
        this.renderer.clear()
        this.renderEntities()
        
        // Update UI
        this.updateUI()
        
        // FPS calculation
        this.frameCount++
        this.fpsTimer += deltaTime
        if (this.fpsTimer >= 1000) {
            this.ui.updateFPS(this.frameCount)
            this.frameCount = 0
            this.fpsTimer = 0
        }
        
        // Continue loop
        requestAnimationFrame(() => this.gameLoop())
    }
    
    renderEntities() {
        const entities = this.world.getActiveEntities()
        
        entities.forEach(entity => {
            const transform = entity.getComponent('transform')
            const health = entity.getComponent('health')
            
            if (!transform) return
            
            // Determine entity type and color
            let color = '#fff'
            let size = 8
            
            if (entity.id === this.playerId) {
                color = '#0f0' // Green for player
                size = 12
            } else if (health) {
                color = health.isDead() ? '#666' : '#f00' // Red for enemies, gray for dead
                size = 10
            }
            
            // Render entity
            this.renderer.drawCircle(
                transform.position.x,
                transform.position.y,
                size,
                color
            )
            
            // Render health bar for living entities
            if (health && !health.isDead()) {
                const healthPercent = health.current / health.maximum
                this.renderer.drawHealthBar(
                    transform.position.x,
                    transform.position.y - size - 8,
                    20,
                    4,
                    healthPercent
                )
            }
            
            // Render combat range for player
            if (entity.id === this.playerId) {
                const combat = entity.getComponent('combat')
                if (combat) {
                    this.renderer.drawCircle(
                        transform.position.x,
                        transform.position.y,
                        combat.range,
                        'rgba(0, 255, 0, 0.1)',
                        false // outline only
                    )
                }
            }
        })
    }
    
    updateUI() {
        if (!this.playerId) return
        
        const player = this.world.getEntity(this.playerId)
        if (!player) return
        
        const health = player.getComponent('health')
        const experience = player.getComponent('experience')
        const stats = this.world.getStats()
        
        if (health) {
            this.ui.updateHealth(health.current, health.maximum)
        }
        
        if (experience) {
            this.ui.updateLevel(experience.level)
            this.ui.updateXP(experience.totalXP)
        }
        
        this.ui.updateEntityCount(stats.activeEntityCount)
    }
}

// Start the game when page loads
window.addEventListener('load', () => {
    new GameFrontend()
})
```

### 4. Renderer (renderer.js)

```javascript
export class Renderer {
    constructor(ctx) {
        this.ctx = ctx
        this.canvas = ctx.canvas
    }
    
    clear() {
        this.ctx.fillStyle = '#1a1a1a'
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    }
    
    drawCircle(x, y, radius, color, filled = true) {
        this.ctx.beginPath()
        this.ctx.arc(x, y, radius, 0, Math.PI * 2)
        
        if (filled) {
            this.ctx.fillStyle = color
            this.ctx.fill()
        } else {
            this.ctx.strokeStyle = color
            this.ctx.stroke()
        }
    }
    
    drawHealthBar(x, y, width, height, healthPercent) {
        // Background
        this.ctx.fillStyle = '#333'
        this.ctx.fillRect(x - width/2, y, width, height)
        
        // Health fill
        const fillWidth = width * healthPercent
        const gradient = this.ctx.createLinearGradient(x - width/2, 0, x + width/2, 0)
        gradient.addColorStop(0, '#f00')
        gradient.addColorStop(0.5, '#ff0')
        gradient.addColorStop(1, '#0f0')
        
        this.ctx.fillStyle = gradient
        this.ctx.fillRect(x - width/2, y, fillWidth, height)
        
        // Border
        this.ctx.strokeStyle = '#666'
        this.ctx.strokeRect(x - width/2, y, width, height)
    }
    
    drawText(text, x, y, color = '#fff', font = '14px Arial') {
        this.ctx.font = font
        this.ctx.fillStyle = color
        this.ctx.fillText(text, x, y)
    }
}
```

### 5. Input Handler (input.js)

```javascript
export class InputHandler {
    constructor(canvas) {
        this.canvas = canvas
        this.keys = new Set()
        this.mousePos = { x: 0, y: 0 }
        this.listeners = new Map()
        
        this.setupEventListeners()
    }
    
    setupEventListeners() {
        // Keyboard events
        window.addEventListener('keydown', (e) => {
            this.keys.add(e.code)
        })
        
        window.addEventListener('keyup', (e) => {
            this.keys.delete(e.code)
            
            // Handle single-key actions
            if (e.code === 'KeyR') {
                this.emit('restart')
            }
        })
        
        // Mouse events
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect()
            this.mousePos.x = e.clientX - rect.left
            this.mousePos.y = e.clientY - rect.top
        })
        
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect()
            const x = e.clientX - rect.left
            const y = e.clientY - rect.top
            this.emit('attack', { x, y })
        })
    }
    
    update() {
        // Handle continuous movement
        const direction = { x: 0, y: 0 }
        
        if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) direction.y -= 1
        if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) direction.y += 1
        if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) direction.x -= 1
        if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) direction.x += 1
        
        // Normalize diagonal movement
        if (direction.x !== 0 && direction.y !== 0) {
            const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y)
            direction.x /= length
            direction.y /= length
        }
        
        this.emit('move', direction)
    }
    
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, [])
        }
        this.listeners.get(event).push(callback)
    }
    
    emit(event, data) {
        const callbacks = this.listeners.get(event)
        if (callbacks) {
            callbacks.forEach(callback => callback(data))
        }
    }
}
```

### 6. UI Manager (ui.js)

```javascript
export class UIManager {
    constructor() {
        this.healthFill = document.getElementById('healthFill')
        this.levelElement = document.getElementById('level')
        this.xpElement = document.getElementById('xp')
        this.entityCountElement = document.getElementById('entityCount')
        this.fpsElement = document.getElementById('fps')
    }
    
    updateHealth(current, maximum) {
        const percent = (current / maximum) * 100
        this.healthFill.style.width = `${percent}%`
    }
    
    updateLevel(level) {
        this.levelElement.textContent = level
    }
    
    updateXP(xp) {
        this.xpElement.textContent = xp
    }
    
    updateEntityCount(count) {
        this.entityCountElement.textContent = count
    }
    
    updateFPS(fps) {
        this.fpsElement.textContent = fps
    }
}
```

## Running the Frontend Test

1. **Create the project directory**:
   ```bash
   mkdir frontend-test
   cd frontend-test
   ```

2. **Install dependencies**:
   ```bash
   npm init -y
   npm install vite --save-dev
   npm install file:../vital-engine-sdk
   ```

3. **Create the files** as shown above

4. **Run the development server**:
   ```bash
   npm run dev
   ```

## What This Tests

This frontend implementation validates:

✅ **SDK Integration**: Importing and using the engine
✅ **Entity Management**: Creating/destroying entities
✅ **System Integration**: All core systems working together
✅ **Event System**: Frontend responding to engine events
✅ **Performance**: Real-time rendering with entity updates
✅ **Input Handling**: Player movement and interaction
✅ **State Queries**: Reading entity components for rendering

## Expected Results

When running this frontend test, you should see:

- A green circle (player) in the center
- Red circles (enemies) around the edges
- Player moves with WASD keys
- Player automatically attacks nearby enemies
- Health bars above entities
- UI showing level, XP, entity count, and FPS
- Console logs for game events (damage, kills, level ups)

## Benefits of Frontend Testing Now

1. **API Validation**: Discover if the SDK API is intuitive and complete
2. **Performance Reality Check**: See how the engine performs with actual rendering
3. **Integration Issues**: Find headless/frontend boundary problems early
4. **Development Motivation**: Visual feedback makes development more engaging
5. **Documentation**: Creates real usage examples for other developers

## Recommended Next Steps

1. **Create the frontend test project** to validate current Phase 2 systems
2. **Iterate on API design** based on frontend usage experience
3. **Document any API improvements** needed
4. **Use frontend testing** to guide Phase 3 feature design
5. **Keep the frontend simple** - focus on validating the SDK, not building a full game

This approach will give you confidence that the SDK is working correctly and help identify any API improvements before building the more complex Phase 3 features.
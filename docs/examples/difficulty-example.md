# Difficulty System - Practical Examples

This guide provides practical examples for implementing and using the difficulty system in your game. Follow these examples to quickly integrate dynamic difficulty scaling into your gameplay.

## Table of Contents
1. [Basic Setup](#basic-setup)
2. [Configuring Difficulty Bands](#configuring-difficulty-bands)
3. [Implementing Adaptive Difficulty](#implementing-adaptive-difficulty)
4. [Monitoring Difficulty Changes](#monitoring-difficulty-changes)
5. [Custom Modifiers and Scaling](#custom-modifiers-and-scaling)
6. [Complete Example Game](#complete-example-game)

## Basic Setup

### Creating a Difficulty Manager

First, create a difficulty manager entity that will handle all difficulty-related operations:

```typescript
import { 
  Engine, 
  World, 
  EventSystem,
  DifficultySystem,
  DifficultyComponent,
  DifficultyLevel
} from 'vital-engine-sdk'

// Initialize engine and systems
const engine = new Engine()
const world = engine.getWorld()
const events = engine.getEvents()

// Add difficulty system
const difficultySystem = new DifficultySystem(world, events)
world.addSystem(difficultySystem)

// Create difficulty manager with adaptive difficulty enabled
const difficultyManagerId = difficultySystem.createDifficultyManager(true)

// Get reference to the difficulty component
const difficultyManager = world.getEntity(difficultyManagerId)
const difficultyComponent = difficultyManager.getComponent<DifficultyComponent>('difficulty')
```

### Setting Initial Difficulty

Set the starting difficulty based on player preference or previous sessions:

```typescript
// Set initial difficulty to NORMAL
difficultySystem.setDifficultyLevel(difficultyManagerId, 'NORMAL')

// Or start with EASY for new players
const isNewPlayer = true // Check from save data
if (isNewPlayer) {
  difficultySystem.setDifficultyLevel(difficultyManagerId, 'EASY')
}

// Check current difficulty
const stats = difficultySystem.getDifficultyStats(difficultyManagerId)
console.log(`Starting difficulty: ${stats.currentLevel}`)
```

## Configuring Difficulty Bands

### Custom Difficulty Bands

Replace or modify the default difficulty bands to match your game's needs:

```typescript
import { DifficultyBand, DifficultyModifier } from 'vital-engine-sdk'

// Define custom difficulty bands
const customDifficultyBands: DifficultyBand[] = [
  {
    level: 'EASY',
    minScore: 0,
    maxScore: 75,
    name: 'Beginner',
    description: 'Perfect for learning the game',
    transitionThreshold: 50,
    modifiers: [
      {
        id: 'easy_enemy_health',
        name: 'Weak Enemies',
        description: 'Enemies have 50% less health',
        targetProperty: 'health.maxHealth',
        scalingFunction: {
          type: 'LINEAR',
          baseValue: 0.5,
          scalingFactor: 0
        },
        isActive: true,
        priority: 1
      },
      {
        id: 'easy_enemy_damage',
        name: 'Reduced Damage',
        description: 'Enemies deal 40% less damage',
        targetProperty: 'combat.damage',
        scalingFunction: {
          type: 'LINEAR',
          baseValue: 0.6,
          scalingFactor: 0
        },
        isActive: true,
        priority: 1
      },
      {
        id: 'easy_spawn_rate',
        name: 'Fewer Enemies',
        description: 'Enemies spawn 50% slower',
        targetProperty: 'spawner.spawnRate',
        scalingFunction: {
          type: 'LINEAR',
          baseValue: 0.5,
          scalingFactor: 0
        },
        isActive: true,
        priority: 2
      }
    ]
  },
  {
    level: 'NORMAL',
    minScore: 75,
    maxScore: 200,
    name: 'Standard',
    description: 'The intended game experience',
    transitionThreshold: 40,
    modifiers: [] // No modifiers - baseline difficulty
  },
  {
    level: 'HARD',
    minScore: 200,
    maxScore: 350,
    name: 'Veteran',
    description: 'For experienced players seeking a challenge',
    transitionThreshold: 60,
    modifiers: [
      {
        id: 'hard_enemy_stats',
        name: 'Stronger Enemies',
        description: 'All enemy stats increased',
        targetProperty: 'all',
        scalingFunction: {
          type: 'LINEAR',
          baseValue: 1.3,
          scalingFactor: 0.1
        },
        isActive: true,
        priority: 1
      },
      {
        id: 'hard_spawn_variety',
        name: 'Elite Enemies',
        description: 'Elite enemy variants spawn',
        targetProperty: 'spawner.eliteChance',
        scalingFunction: {
          type: 'STEP',
          baseValue: 0.1,
          scalingFactor: 0.05,
          stepSize: 50
        },
        isActive: true,
        priority: 2
      }
    ]
  }
]

// Apply custom bands to difficulty component
if (difficultyComponent) {
  difficultyComponent.difficultyBands = customDifficultyBands
}
```

### Difficulty Modifiers by Game Type

Different game genres require different difficulty scaling approaches:

```typescript
// Action Game Modifiers
const actionGameModifiers: DifficultyModifier[] = [
  {
    id: 'action_enemy_speed',
    name: 'Enemy Speed Scaling',
    description: 'Enemies move faster at higher difficulties',
    targetProperty: 'movement.speed',
    scalingFunction: {
      type: 'EXPONENTIAL',
      baseValue: 1.0,
      scalingFactor: 0.15 // 15% exponential increase
    },
    isActive: true,
    priority: 1,
    minValue: 0.5,
    maxValue: 2.5
  },
  {
    id: 'action_projectile_speed',
    name: 'Projectile Speed',
    description: 'Enemy projectiles travel faster',
    targetProperty: 'combat.projectileSpeed',
    scalingFunction: {
      type: 'LINEAR',
      baseValue: 1.0,
      scalingFactor: 0.2
    },
    isActive: true,
    priority: 2
  }
]

// Strategy Game Modifiers
const strategyGameModifiers: DifficultyModifier[] = [
  {
    id: 'strategy_resource_cost',
    name: 'Resource Costs',
    description: 'Units cost more resources',
    targetProperty: 'economy.unitCost',
    scalingFunction: {
      type: 'LINEAR',
      baseValue: 1.0,
      scalingFactor: 0.25
    },
    isActive: true,
    priority: 1
  },
  {
    id: 'strategy_ai_intelligence',
    name: 'AI Intelligence',
    description: 'AI makes better decisions',
    targetProperty: 'enemyAI.intelligenceLevel',
    scalingFunction: {
      type: 'STEP',
      baseValue: 1,
      scalingFactor: 1,
      stepSize: 1
    },
    isActive: true,
    priority: 1
  }
]

// Survival Game Modifiers
const survivalGameModifiers: DifficultyModifier[] = [
  {
    id: 'survival_wave_intensity',
    name: 'Wave Intensity',
    description: 'More enemies per wave',
    targetProperty: 'spawner.maxActiveEnemies',
    scalingFunction: {
      type: 'EXPONENTIAL',
      baseValue: 10,
      scalingFactor: 0.3
    },
    isActive: true,
    priority: 1,
    minValue: 5,
    maxValue: 100
  },
  {
    id: 'survival_wave_frequency',
    name: 'Wave Frequency',
    description: 'Less time between waves',
    targetProperty: 'spawner.timeBetweenWaves',
    scalingFunction: {
      type: 'LINEAR',
      baseValue: 1.0,
      scalingFactor: -0.15 // Negative = shorter time
    },
    isActive: true,
    priority: 2,
    minValue: 0.3 // Minimum 30% of original time
  }
]
```

## Implementing Adaptive Difficulty

### Basic Adaptive Setup

Configure adaptive difficulty to automatically adjust based on player performance:

```typescript
// Enable adaptive difficulty
difficultySystem.enableAdaptiveDifficulty(difficultyManagerId, true)

// Configure adaptive settings for balanced gameplay
difficultySystem.configureAdaptiveSettings(difficultyManagerId, {
  adaptationRate: 0.1,              // 10% adjustment per interval
  adaptationInterval: 5000,         // Check every 5 seconds
  performanceWindowSize: 10,        // Track last 10 performance samples
  stabilityThreshold: 0.05,         // 5% variance = stable
  maxAdjustmentPerInterval: 0.2,    // Max 20% change at once
  targetPerformanceRange: {
    min: 0.6,                      // Target 60-80% performance
    max: 0.8
  },
  emergencyAdjustmentThreshold: 0.3 // Double rate if 30% off target
})
```

### Performance Metric Tracking

Track player actions to feed the adaptive algorithm:

```typescript
// Track combat performance
events.on('DAMAGE_DEALT', (event) => {
  difficultySystem.recordPlayerAction(
    difficultyManagerId, 
    'DAMAGE_DEALT', 
    event.data.damage, 
    true // Increment
  )
})

events.on('DAMAGE_TAKEN', (event) => {
  if (event.data.targetId === playerId) {
    difficultySystem.recordPlayerAction(
      difficultyManagerId,
      'DAMAGE_TAKEN',
      event.data.damage,
      true
    )
  }
})

events.on('ENTITY_KILLED', (event) => {
  if (event.data.killerId === playerId) {
    difficultySystem.recordPlayerAction(
      difficultyManagerId,
      'ENEMIES_KILLED',
      1,
      true
    )
  }
})

// Track progression
events.on('LEVEL_UP', (event) => {
  if (event.entityId === playerId) {
    difficultySystem.recordPlayerAction(
      difficultyManagerId,
      'PLAYER_LEVEL',
      event.data.newLevel,
      false // Set value, don't increment
    )
  }
})

// Track survival time
let survivalTimer = 0
setInterval(() => {
  survivalTimer += 1000
  difficultySystem.recordPlayerAction(
    difficultyManagerId,
    'SURVIVAL_TIME',
    1000,
    true
  )
}, 1000)

// Track collection rate
let itemsCollectedThisMinute = 0
events.on('ITEM_COLLECTED', () => {
  itemsCollectedThisMinute++
})

setInterval(() => {
  difficultySystem.recordPlayerAction(
    difficultyManagerId,
    'COLLECTION_RATE',
    itemsCollectedThisMinute,
    false
  )
  itemsCollectedThisMinute = 0
}, 60000) // Every minute
```

### Advanced Adaptive Patterns

Implement sophisticated adaptive difficulty patterns:

```typescript
// Dynamic adaptation based on game phase
function updateAdaptiveSettingsForGamePhase(phase: 'early' | 'mid' | 'late') {
  const settings = {
    early: {
      adaptationRate: 0.05,         // Gentle adjustments early
      adaptationInterval: 10000,    // Slower adaptation
      targetPerformanceRange: { min: 0.5, max: 0.9 } // Wider range
    },
    mid: {
      adaptationRate: 0.1,          // Standard adjustments
      adaptationInterval: 5000,     // Normal speed
      targetPerformanceRange: { min: 0.6, max: 0.8 }
    },
    late: {
      adaptationRate: 0.15,         // Aggressive adjustments
      adaptationInterval: 3000,     // Fast adaptation
      targetPerformanceRange: { min: 0.65, max: 0.75 } // Tighter range
    }
  }
  
  difficultySystem.configureAdaptiveSettings(
    difficultyManagerId, 
    settings[phase]
  )
}

// Conditional adaptation based on player state
function updateAdaptationForPlayerState() {
  const player = world.getEntity(playerId)
  const health = player.getComponent('health')
  const experience = player.getComponent('experience')
  
  // Disable adaptation during boss fights
  if (isInBossFight) {
    difficultySystem.enableAdaptiveDifficulty(difficultyManagerId, false)
    return
  }
  
  // Slower adaptation when player is low health
  if (health.current / health.maximum < 0.3) {
    difficultySystem.configureAdaptiveSettings(difficultyManagerId, {
      adaptationRate: 0.05,
      maxAdjustmentPerInterval: 0.1
    })
  }
  
  // Faster adaptation for high-level players
  if (experience.level > 20) {
    difficultySystem.configureAdaptiveSettings(difficultyManagerId, {
      adaptationInterval: 3000,
      adaptationRate: 0.15
    })
  }
}
```

## Monitoring Difficulty Changes

### Event Handling

Listen for and respond to difficulty changes:

```typescript
// Track difficulty changes
events.on('difficulty_changed', (event: DifficultyChangedEvent) => {
  console.log(`Difficulty changed from ${event.oldLevel} to ${event.newLevel}`)
  console.log(`Current score: ${event.currentScore}`)
  console.log(`Performance score: ${event.performanceScore}`)
  console.log(`Adaptive: ${event.isAdaptive}`)
  
  // Update UI
  updateDifficultyUI(event.newLevel)
  
  // Show notification
  if (event.isAdaptive) {
    showAdaptiveNotification(event.oldLevel, event.newLevel)
  }
  
  // Trigger effects
  if (event.newLevel === 'EXTREME' || event.newLevel === 'NIGHTMARE') {
    triggerIntenseMusicTransition()
    addScreenEffect('difficulty_increase')
  }
  
  // Analytics
  trackDifficultyChange({
    timestamp: event.timestamp,
    from: event.oldLevel,
    to: event.newLevel,
    score: event.currentScore,
    performance: event.performanceScore,
    wasAdaptive: event.isAdaptive
  })
})
```

### Real-time Monitoring Dashboard

Create a debug dashboard to monitor difficulty in real-time:

```typescript
class DifficultyMonitor {
  private updateInterval: number = 1000
  private monitorInterval: NodeJS.Timeout | null = null
  
  constructor(
    private difficultySystem: DifficultySystem,
    private difficultyManagerId: EntityId
  ) {}
  
  start() {
    this.monitorInterval = setInterval(() => {
      this.updateDisplay()
    }, this.updateInterval)
  }
  
  stop() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval)
      this.monitorInterval = null
    }
  }
  
  private updateDisplay() {
    const stats = this.difficultySystem.getDifficultyStats(this.difficultyManagerId)
    if (!stats) return
    
    // Log to console (or update UI)
    console.clear()
    console.log('=== Difficulty Monitor ===')
    console.log(`Current Level: ${stats.currentLevel}`)
    console.log(`Current Score: ${stats.currentScore.toFixed(2)}`)
    console.log(`Target Score: ${stats.targetScore.toFixed(2)}`)
    console.log(`Performance: ${(stats.performanceScore * 100).toFixed(1)}%`)
    console.log(`Stabilized: ${stats.isStabilized ? 'Yes' : 'No'}`)
    console.log(`Adaptive: ${stats.adaptiveEnabled ? 'ON' : 'OFF'}`)
    console.log('\nActive Modifiers:')
    stats.activeModifiers.forEach(mod => console.log(`  - ${mod}`))
    console.log('\nPerformance History:')
    console.log(stats.performanceHistory.map(p => (p * 100).toFixed(0) + '%').join(', '))
  }
}

// Start monitoring
const monitor = new DifficultyMonitor(difficultySystem, difficultyManagerId)
monitor.start()
```

### Performance Tracking

Track difficulty system performance:

```typescript
interface DifficultyMetrics {
  totalChanges: number
  adaptiveChanges: number
  manualChanges: number
  averageTimePerLevel: Map<DifficultyLevel, number>
  levelDistribution: Map<DifficultyLevel, number>
  stabilityPeriods: number[]
}

class DifficultyAnalytics {
  private metrics: DifficultyMetrics = {
    totalChanges: 0,
    adaptiveChanges: 0,
    manualChanges: 0,
    averageTimePerLevel: new Map(),
    levelDistribution: new Map(),
    stabilityPeriods: []
  }
  
  private lastChangeTime: number = Date.now()
  private currentLevelStartTime: number = Date.now()
  private currentLevel: DifficultyLevel = 'NORMAL'
  
  constructor(private events: EventSystem) {
    this.setupListeners()
  }
  
  private setupListeners() {
    this.events.on('difficulty_changed', (event: DifficultyChangedEvent) => {
      // Update metrics
      this.metrics.totalChanges++
      if (event.isAdaptive) {
        this.metrics.adaptiveChanges++
      } else {
        this.metrics.manualChanges++
      }
      
      // Track time spent in previous level
      const timeInLevel = Date.now() - this.currentLevelStartTime
      const currentAvg = this.metrics.averageTimePerLevel.get(this.currentLevel) || 0
      const currentCount = this.metrics.levelDistribution.get(this.currentLevel) || 0
      
      this.metrics.averageTimePerLevel.set(
        this.currentLevel,
        (currentAvg * currentCount + timeInLevel) / (currentCount + 1)
      )
      
      this.metrics.levelDistribution.set(
        this.currentLevel,
        currentCount + 1
      )
      
      // Update current level tracking
      this.currentLevel = event.newLevel
      this.currentLevelStartTime = Date.now()
      this.lastChangeTime = Date.now()
    })
  }
  
  getReport(): string {
    const report = []
    report.push('=== Difficulty Analytics Report ===')
    report.push(`Total Changes: ${this.metrics.totalChanges}`)
    report.push(`Adaptive: ${this.metrics.adaptiveChanges} (${(this.metrics.adaptiveChanges / this.metrics.totalChanges * 100).toFixed(1)}%)`)
    report.push(`Manual: ${this.metrics.manualChanges}`)
    report.push('\nAverage Time per Level:')
    
    for (const [level, avgTime] of this.metrics.averageTimePerLevel) {
      report.push(`  ${level}: ${(avgTime / 1000 / 60).toFixed(1)} minutes`)
    }
    
    report.push('\nLevel Distribution:')
    for (const [level, count] of this.metrics.levelDistribution) {
      report.push(`  ${level}: ${count} times`)
    }
    
    return report.join('\n')
  }
}

// Use analytics
const analytics = new DifficultyAnalytics(events)

// Get report after gameplay
setTimeout(() => {
  console.log(analytics.getReport())
}, 300000) // After 5 minutes
```

## Custom Modifiers and Scaling

### Creating Complex Modifiers

Build sophisticated modifiers with conditions and custom scaling:

```typescript
// Time-based modifier that increases difficulty over time
const timeBasedModifier: DifficultyModifier = {
  id: 'time_pressure',
  name: 'Time Pressure',
  description: 'Difficulty increases with survival time',
  targetProperty: 'all',
  scalingFunction: {
    type: 'CUSTOM',
    baseValue: 1.0,
    scalingFactor: 0.1,
    customFormula: 'base + (input * 0.001 * base)' // 0.1% per second
  },
  isActive: true,
  priority: 10,
  conditions: [{
    metric: 'SURVIVAL_TIME',
    operator: 'GREATER_THAN',
    value: 60000 // Active after 1 minute
  }]
}

// Combo-based modifier
const comboModifier: DifficultyModifier = {
  id: 'combo_multiplier',
  name: 'Combo Difficulty',
  description: 'Higher combos increase enemy aggression',
  targetProperty: 'enemyAI.aggressionLevel',
  scalingFunction: {
    type: 'LOGARITHMIC',
    baseValue: 1.0,
    scalingFactor: 0.3
  },
  isActive: true,
  priority: 5,
  minValue: 1.0,
  maxValue: 3.0,
  conditions: [{
    metric: 'ENEMIES_KILLED',
    operator: 'GREATER_THAN',
    value: 10
  }]
}

// Health-based modifier
const lowHealthModifier: DifficultyModifier = {
  id: 'mercy_modifier',
  name: 'Mercy System',
  description: 'Reduces difficulty when player is low health',
  targetProperty: 'combat.damage',
  scalingFunction: {
    type: 'LINEAR',
    baseValue: 0.7, // 30% damage reduction
    scalingFactor: 0
  },
  isActive: true,
  priority: 100, // High priority
  conditions: [{
    metric: 'DAMAGE_TAKEN',
    operator: 'GREATER_THAN',
    value: 70 // Player has taken 70+ damage
  }]
}

// Add modifiers to specific difficulty levels
difficultySystem.addCustomModifier(difficultyManagerId, timeBasedModifier, 'HARD')
difficultySystem.addCustomModifier(difficultyManagerId, comboModifier, 'EXTREME')
difficultySystem.addCustomModifier(difficultyManagerId, lowHealthModifier) // All levels
```

### Dynamic Modifier Management

Add and remove modifiers based on game state:

```typescript
class DynamicDifficultyManager {
  private activeModifiers: Map<string, DifficultyModifier> = new Map()
  
  constructor(
    private difficultySystem: DifficultySystem,
    private difficultyManagerId: EntityId,
    private events: EventSystem
  ) {
    this.setupEventListeners()
  }
  
  private setupEventListeners() {
    // Add boss modifier during boss fights
    this.events.on('BOSS_SPAWNED', () => {
      const bossModifier: DifficultyModifier = {
        id: 'boss_fight_intensity',
        name: 'Boss Fight',
        description: 'Increased intensity during boss battles',
        targetProperty: 'spawner.spawnRate',
        scalingFunction: {
          type: 'LINEAR',
          baseValue: 1.5,
          scalingFactor: 0
        },
        isActive: true,
        priority: 50
      }
      
      this.difficultySystem.addCustomModifier(
        this.difficultyManagerId,
        bossModifier
      )
      this.activeModifiers.set('boss_fight_intensity', bossModifier)
    })
    
    // Remove boss modifier after boss defeat
    this.events.on('BOSS_DEFEATED', () => {
      this.difficultySystem.removeCustomModifier(
        this.difficultyManagerId,
        'boss_fight_intensity'
      )
      this.activeModifiers.delete('boss_fight_intensity')
    })
    
    // Weekend event modifier
    if (this.isWeekend()) {
      const weekendModifier: DifficultyModifier = {
        id: 'weekend_bonus',
        name: 'Weekend Challenge',
        description: 'Extra rewards but harder enemies',
        targetProperty: 'all',
        scalingFunction: {
          type: 'LINEAR',
          baseValue: 1.25,
          scalingFactor: 0
        },
        isActive: true,
        priority: 20
      }
      
      this.difficultySystem.addCustomModifier(
        this.difficultyManagerId,
        weekendModifier
      )
    }
  }
  
  private isWeekend(): boolean {
    const day = new Date().getDay()
    return day === 0 || day === 6
  }
  
  // Add temporary modifier
  addTemporaryModifier(modifier: DifficultyModifier, durationMs: number) {
    this.difficultySystem.addCustomModifier(
      this.difficultyManagerId,
      modifier
    )
    
    setTimeout(() => {
      this.difficultySystem.removeCustomModifier(
        this.difficultyManagerId,
        modifier.id
      )
    }, durationMs)
  }
  
  // Create power-up based modifiers
  applyPowerUpModifier(powerUpType: string) {
    const powerUpModifiers: Record<string, DifficultyModifier> = {
      'double_damage': {
        id: 'powerup_double_damage_penalty',
        name: 'Double Damage Penalty',
        description: 'Enemies stronger to balance power-up',
        targetProperty: 'health.maxHealth',
        scalingFunction: {
          type: 'LINEAR',
          baseValue: 1.5,
          scalingFactor: 0
        },
        isActive: true,
        priority: 30
      },
      'invincibility': {
        id: 'powerup_invincibility_penalty',
        name: 'Invincibility Penalty',
        description: 'More enemies during invincibility',
        targetProperty: 'spawner.maxActiveEnemies',
        scalingFunction: {
          type: 'LINEAR',
          baseValue: 2.0,
          scalingFactor: 0
        },
        isActive: true,
        priority: 30
      }
    }
    
    const modifier = powerUpModifiers[powerUpType]
    if (modifier) {
      this.addTemporaryModifier(modifier, 30000) // 30 seconds
    }
  }
}
```

## Complete Example Game

Here's a complete example implementing a survival game with full difficulty system integration:

```typescript
import {
  Engine,
  World,
  EventSystem,
  Entity,
  EntityId,
  // Components
  TransformComponent,
  HealthComponent,
  MovementComponent,
  CombatComponent,
  ExperienceComponent,
  DifficultyComponent,
  // Systems
  MovementSystem,
  CombatSystem,
  ProgressionSystem,
  DifficultySystem,
  SpawnerSystem,
  // Types
  DifficultyLevel,
  DifficultyModifier,
  Vector2
} from 'vital-engine-sdk'

class SurvivalGame {
  private engine: Engine
  private world: World
  private events: EventSystem
  private difficultySystem: DifficultySystem
  private difficultyManagerId: EntityId
  private playerId: EntityId
  private isPaused: boolean = false
  private gameTime: number = 0
  
  constructor() {
    this.engine = new Engine({
      engine: {
        targetFPS: 60,
        fixedTimeStep: false
      }
    })
    
    this.world = this.engine.getWorld()
    this.events = this.engine.getEvents()
    
    this.initializeSystems()
    this.setupDifficulty()
    this.createPlayer()
    this.setupEventHandlers()
  }
  
  private initializeSystems() {
    // Add all required systems
    this.world.addSystem(new MovementSystem(this.events))
    this.world.addSystem(new CombatSystem(this.events))
    this.world.addSystem(new ProgressionSystem(this.events, this.world))
    this.world.addSystem(new SpawnerSystem(this.world, this.events))
    
    // Add difficulty system
    this.difficultySystem = new DifficultySystem(this.world, this.events)
    this.world.addSystem(this.difficultySystem)
  }
  
  private setupDifficulty() {
    // Create difficulty manager
    this.difficultyManagerId = this.difficultySystem.createDifficultyManager(true)
    
    // Configure adaptive settings for survival gameplay
    this.difficultySystem.configureAdaptiveSettings(this.difficultyManagerId, {
      adaptationRate: 0.12,
      adaptationInterval: 4000,
      performanceWindowSize: 8,
      stabilityThreshold: 0.06,
      maxAdjustmentPerInterval: 0.25,
      targetPerformanceRange: {
        min: 0.55,
        max: 0.75
      },
      emergencyAdjustmentThreshold: 0.35
    })
    
    // Add survival-specific modifiers
    this.addSurvivalModifiers()
  }
  
  private addSurvivalModifiers() {
    // Wave escalation modifier
    const waveModifier: DifficultyModifier = {
      id: 'wave_escalation',
      name: 'Wave Escalation',
      description: 'Each wave gets progressively harder',
      targetProperty: 'spawner.enemiesPerWave',
      scalingFunction: {
        type: 'EXPONENTIAL',
        baseValue: 5,
        scalingFactor: 0.15
      },
      isActive: true,
      priority: 1,
      minValue: 5,
      maxValue: 50
    }
    
    // Survival time modifier
    const survivalModifier: DifficultyModifier = {
      id: 'survival_scaling',
      name: 'Time-based Scaling',
      description: 'Difficulty increases over time',
      targetProperty: 'all',
      scalingFunction: {
        type: 'CUSTOM',
        baseValue: 1.0,
        scalingFactor: 0.0001,
        customFormula: 'base + (input * 0.0001)' // +1% per 100 seconds
      },
      isActive: true,
      priority: 5,
      conditions: [{
        metric: 'SURVIVAL_TIME',
        operator: 'GREATER_THAN',
        value: 30000 // Active after 30 seconds
      }]
    }
    
    // Low health mercy modifier
    const mercyModifier: DifficultyModifier = {
      id: 'low_health_mercy',
      name: 'Mercy Mode',
      description: 'Easier when critically injured',
      targetProperty: 'combat.damage',
      scalingFunction: {
        type: 'LINEAR',
        baseValue: 0.5,
        scalingFactor: 0
      },
      isActive: false, // Activated conditionally
      priority: 100
    }
    
    // Add modifiers to all difficulty levels
    this.difficultySystem.addCustomModifier(this.difficultyManagerId, waveModifier)
    this.difficultySystem.addCustomModifier(this.difficultyManagerId, survivalModifier)
    this.difficultySystem.addCustomModifier(this.difficultyManagerId, mercyModifier)
  }
  
  private createPlayer() {
    const player = this.world.createEntity()
    this.playerId = player.id
    
    player.addComponent(new TransformComponent(400, 300))
    player.addComponent(new HealthComponent(100))
    player.addComponent(new MovementComponent(200))
    player.addComponent(new CombatComponent({
      damage: 25,
      range: 100,
      attackSpeed: 2.5,
      criticalChance: 0.15,
      criticalMultiplier: 2.0
    }))
    player.addComponent(new ExperienceComponent(1))
  }
  
  private setupEventHandlers() {
    // Track performance metrics
    this.events.on('DAMAGE_DEALT', (event) => {
      if (event.data.sourceId === this.playerId) {
        this.difficultySystem.recordPlayerAction(
          this.difficultyManagerId,
          'DAMAGE_DEALT',
          event.data.damage,
          true
        )
      }
    })
    
    this.events.on('DAMAGE_TAKEN', (event) => {
      if (event.data.targetId === this.playerId) {
        this.difficultySystem.recordPlayerAction(
          this.difficultyManagerId,
          'DAMAGE_TAKEN',
          event.data.damage,
          true
        )
        
        // Check for mercy mode activation
        this.checkMercyMode()
      }
    })
    
    this.events.on('ENTITY_KILLED', (event) => {
      if (event.data.killerId === this.playerId) {
        this.difficultySystem.recordPlayerAction(
          this.difficultyManagerId,
          'ENEMIES_KILLED',
          1,
          true
        )
        
        // Bonus score for kill streaks
        this.updateKillStreak()
      }
    })
    
    this.events.on('LEVEL_UP', (event) => {
      if (event.entityId === this.playerId) {
        this.difficultySystem.recordPlayerAction(
          this.difficultyManagerId,
          'PLAYER_LEVEL',
          event.data.newLevel,
          false
        )
        
        // Increase difficulty slightly on level up
        this.adjustDifficultyForLevel(event.data.newLevel)
      }
    })
    
    // React to difficulty changes
    this.events.on('difficulty_changed', (event) => {
      this.onDifficultyChanged(event)
    })
  }
  
  private checkMercyMode() {
    const player = this.world.getEntity(this.playerId)
    if (!player) return
    
    const health = player.getComponent<HealthComponent>('health')
    if (!health) return
    
    const healthPercent = health.current / health.maximum
    
    // Activate mercy mode at 20% health
    if (healthPercent <= 0.2) {
      const mercyModifier = {
        id: 'low_health_mercy',
        isActive: true
      }
      
      // Update the modifier to be active
      this.difficultySystem.addCustomModifier(
        this.difficultyManagerId,
        mercyModifier as DifficultyModifier
      )
    } else if (healthPercent > 0.5) {
      // Deactivate mercy mode when health recovers
      this.difficultySystem.removeCustomModifier(
        this.difficultyManagerId,
        'low_health_mercy'
      )
    }
  }
  
  private killStreak: number = 0
  private lastKillTime: number = 0
  
  private updateKillStreak() {
    const now = Date.now()
    
    // Reset streak if too much time passed
    if (now - this.lastKillTime > 5000) {
      this.killStreak = 0
    }
    
    this.killStreak++
    this.lastKillTime = now
    
    // Bonus score for streaks
    if (this.killStreak > 5) {
      const bonusScore = this.killStreak * 2
      this.difficultySystem.recordPlayerAction(
        this.difficultyManagerId,
        'SCORE',
        bonusScore,
        true
      )
    }
  }
  
  private adjustDifficultyForLevel(level: number) {
    // Every 5 levels, slightly increase base difficulty
    if (level % 5 === 0) {
      const currentStats = this.difficultySystem.getDifficultyStats(this.difficultyManagerId)
      if (currentStats) {
        const scoreBonus = level * 5
        this.difficultySystem.recordPlayerAction(
          this.difficultyManagerId,
          'SCORE',
          currentStats.currentScore + scoreBonus,
          false
        )
      }
    }
  }
  
  private onDifficultyChanged(event: DifficultyChangedEvent) {
    console.log(`Difficulty changed: ${event.oldLevel} -> ${event.newLevel}`)
    
    // Visual/audio feedback
    this.showDifficultyNotification(event.newLevel, event.isAdaptive)
    
    // Adjust game parameters
    switch (event.newLevel) {
      case 'EASY':
        this.setGameSpeed(0.9)
        this.setMusicIntensity('calm')
        break
      case 'NORMAL':
        this.setGameSpeed(1.0)
        this.setMusicIntensity('normal')
        break
      case 'HARD':
        this.setGameSpeed(1.1)
        this.setMusicIntensity('intense')
        break
      case 'EXTREME':
        this.setGameSpeed(1.2)
        this.setMusicIntensity('extreme')
        this.triggerScreenShake(500)
        break
      case 'NIGHTMARE':
        this.setGameSpeed(1.3)
        this.setMusicIntensity('nightmare')
        this.triggerScreenShake(1000)
        this.showWarningMessage('NIGHTMARE MODE ACTIVATED!')
        break
    }
  }
  
  // Game loop
  public update(deltaTime: number) {
    if (this.isPaused) return
    
    this.gameTime += deltaTime
    
    // Update survival time metric
    this.difficultySystem.recordPlayerAction(
      this.difficultyManagerId,
      'SURVIVAL_TIME',
      deltaTime,
      true
    )
    
    // Update world
    this.world.update(deltaTime)
    
    // Check game over
    this.checkGameOver()
  }
  
  private checkGameOver() {
    const player = this.world.getEntity(this.playerId)
    if (!player) return
    
    const health = player.getComponent<HealthComponent>('health')
    if (health && health.isDead()) {
      this.onGameOver()
    }
  }
  
  private onGameOver() {
    this.isPaused = true
    
    // Get final stats
    const difficultyStats = this.difficultySystem.getDifficultyStats(this.difficultyManagerId)
    const survivalTime = this.gameTime / 1000 // Convert to seconds
    
    console.log('=== GAME OVER ===')
    console.log(`Survival Time: ${survivalTime.toFixed(1)} seconds`)
    console.log(`Final Difficulty: ${difficultyStats?.currentLevel}`)
    console.log(`Final Score: ${difficultyStats?.currentScore.toFixed(0)}`)
    console.log(`Performance: ${(difficultyStats?.performanceScore * 100).toFixed(1)}%`)
  }
  
  // Helper methods (would be implemented in actual game)
  private showDifficultyNotification(level: DifficultyLevel, isAdaptive: boolean) {
    console.log(`UI: Show ${level} notification (adaptive: ${isAdaptive})`)
  }
  
  private setGameSpeed(multiplier: number) {
    console.log(`Game speed set to ${multiplier}x`)
  }
  
  private setMusicIntensity(intensity: string) {
    console.log(`Music intensity: ${intensity}`)
  }
  
  private triggerScreenShake(duration: number) {
    console.log(`Screen shake for ${duration}ms`)
  }
  
  private showWarningMessage(message: string) {
    console.log(`WARNING: ${message}`)
  }
  
  // Public API
  public start() {
    console.log('Starting Survival Game with Adaptive Difficulty')
    this.isPaused = false
  }
  
  public pause() {
    this.isPaused = true
  }
  
  public resume() {
    this.isPaused = false
  }
  
  public setDifficulty(level: DifficultyLevel) {
    this.difficultySystem.setDifficultyLevel(this.difficultyManagerId, level)
  }
  
  public toggleAdaptiveDifficulty() {
    const stats = this.difficultySystem.getDifficultyStats(this.difficultyManagerId)
    if (stats) {
      this.difficultySystem.enableAdaptiveDifficulty(
        this.difficultyManagerId,
        !stats.adaptiveEnabled
      )
    }
  }
}

// Game initialization
const game = new SurvivalGame()
game.start()

// Game loop (would be called by rendering framework)
let lastTime = Date.now()
function gameLoop() {
  const now = Date.now()
  const deltaTime = now - lastTime
  lastTime = now
  
  game.update(deltaTime)
  
  requestAnimationFrame(gameLoop)
}

gameLoop()

// Example player controls
document.addEventListener('keydown', (event) => {
  switch (event.key) {
    case '1':
      game.setDifficulty('EASY')
      break
    case '2':
      game.setDifficulty('NORMAL')
      break
    case '3':
      game.setDifficulty('HARD')
      break
    case '4':
      game.setDifficulty('EXTREME')
      break
    case '5':
      game.setDifficulty('NIGHTMARE')
      break
    case 'a':
      game.toggleAdaptiveDifficulty()
      break
    case 'p':
      game.pause()
      break
    case 'r':
      game.resume()
      break
  }
})
```

This complete example demonstrates:
- Full difficulty system integration
- Performance metric tracking
- Adaptive difficulty configuration
- Custom modifier implementation
- Event handling and responses
- Game state management
- Player feedback systems
- Debug controls

Use this as a template to implement difficulty scaling in your own survival game!
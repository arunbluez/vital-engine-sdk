# Difficulty System Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Core Concepts](#core-concepts)
3. [How Difficulty Levels Work](#how-difficulty-levels-work)
4. [Adaptive Difficulty Mechanics](#adaptive-difficulty-mechanics)
5. [Performance Metrics and Scaling](#performance-metrics-and-scaling)
6. [Integration with Other Systems](#integration-with-other-systems)
7. [Configuration Options](#configuration-options)
8. [API Reference](#api-reference)
9. [Best Practices](#best-practices)

## System Overview

The Difficulty System is a comprehensive game balancing framework that dynamically adjusts game parameters based on player performance. It provides both preset difficulty levels and adaptive difficulty mechanics to ensure optimal player engagement and challenge.

### Purpose

- **Dynamic Game Balance**: Automatically adjust game difficulty to match player skill level
- **Performance-Based Scaling**: Modify enemy stats, spawn rates, and game mechanics based on player performance
- **Flexible Configuration**: Support for both fixed difficulty levels and adaptive systems
- **Extensible Modifiers**: Create custom difficulty modifiers for any game mechanic
- **Real-time Adaptation**: Continuously monitor and adjust difficulty during gameplay

### Key Features

- 5 preset difficulty levels (Easy, Normal, Hard, Extreme, Nightmare)
- Adaptive difficulty algorithm with performance tracking
- Configurable difficulty bands with custom modifiers
- Real-time performance metrics collection
- Smooth difficulty transitions
- Custom scaling functions (linear, exponential, logarithmic, step)
- Integration with all major game systems

## Core Concepts

### Difficulty Levels

The system includes five predefined difficulty levels:

```typescript
type DifficultyLevel = 'EASY' | 'NORMAL' | 'HARD' | 'EXTREME' | 'NIGHTMARE'
```

Each level represents a distinct gameplay experience:
- **EASY**: Relaxed gameplay for new players (50% reduced difficulty)
- **NORMAL**: Standard balanced experience
- **HARD**: Increased challenge for experienced players (+30% difficulty)
- **EXTREME**: Very high difficulty for experts (+80% difficulty)
- **NIGHTMARE**: Maximum difficulty with all modifiers active (+150% difficulty)

### Difficulty Components

The system operates through the `DifficultyComponent`, which tracks:
- Current difficulty level and score
- Performance metrics
- Active modifiers
- Adaptive settings
- Performance history

### Difficulty Modifiers

Modifiers are rules that change game parameters based on difficulty:

```typescript
interface DifficultyModifier {
  id: string
  name: string
  description: string
  targetProperty: string  // e.g., "health.maxHealth", "combat.damage"
  scalingFunction: ScalingFunction
  isActive: boolean
  priority: number
  minValue?: number
  maxValue?: number
  conditions?: DifficultyCondition[]
}
```

## How Difficulty Levels Work

### Difficulty Bands

Each difficulty level is associated with a score range and set of modifiers:

```typescript
interface DifficultyBand {
  level: DifficultyLevel
  minScore: number
  maxScore: number
  name: string
  description: string
  modifiers: DifficultyModifier[]
  transitionThreshold: number
}
```

Default score ranges:
- **EASY**: 0-50
- **NORMAL**: 50-150
- **HARD**: 150-250
- **EXTREME**: 250-400
- **NIGHTMARE**: 400+

### Difficulty Transitions

The system transitions between difficulty levels based on:
1. **Score Thresholds**: When the player's performance score crosses band boundaries
2. **Transition Confidence**: Requires 70% confidence before changing levels
3. **Transition Threshold**: Minimum score difference required for transition

Example transition logic:
```typescript
// Player performing well at NORMAL difficulty
currentScore: 145  // Near upper boundary of NORMAL (50-150)
targetScore: 165   // System wants to increase difficulty
confidence: 0.8    // 80% confident in transition
// Result: Transition to HARD difficulty
```

### Modifier Application

When difficulty changes, the system:
1. Clears existing modifiers
2. Applies new modifiers from the target difficulty band
3. Scales entity properties based on modifier rules
4. Emits difficulty change events

## Adaptive Difficulty Mechanics

### Performance Tracking

The system continuously monitors player performance through metrics:

```typescript
interface PerformanceMetrics {
  survivalTime: number
  playerLevel: number
  enemiesKilled: number
  damageDealt: number
  damageTaken: number
  score: number
  collectionRate: number
  accuracy: number
  averageReactionTime: number
  skillActivations: number
  deathCount: number
}
```

### Adaptive Algorithm

The adaptive difficulty algorithm:

1. **Performance Score Calculation**:
   ```typescript
   performanceScore = (killRate + efficiency + accuracy) / 3
   ```
   Where:
   - Kill Rate: Enemies killed per minute (normalized 0-1)
   - Efficiency: Damage dealt / damage taken ratio (normalized 0-1)
   - Accuracy: Hit rate percentage

2. **Performance Window**:
   - Tracks last 10 performance samples (configurable)
   - Calculates rolling average
   - Detects performance trends

3. **Adjustment Logic**:
   ```typescript
   if (averagePerformance < targetRange.min) {
     // Player struggling - decrease difficulty
     adjustment = negative value * adaptationRate
   } else if (averagePerformance > targetRange.max) {
     // Player excelling - increase difficulty
     adjustment = positive value * adaptationRate
   }
   ```

4. **Emergency Adjustments**:
   - Doubles adjustment rate when performance is critically off-target
   - Prevents frustration or boredom

### Stability Detection

The system detects when difficulty has stabilized:
- Calculates variance in performance history
- Marks as stabilized when variance < stability threshold
- Prevents oscillating difficulty changes

## Performance Metrics and Scaling

### Scaling Metrics

The system tracks various metrics for difficulty calculation:

```typescript
type ScalingMetric = 
  | 'SURVIVAL_TIME'     // How long player survives
  | 'PLAYER_LEVEL'      // Current player level
  | 'ENEMIES_KILLED'    // Total enemies defeated
  | 'DAMAGE_DEALT'      // Total damage output
  | 'DAMAGE_TAKEN'      // Total damage received
  | 'SCORE'            // Overall game score
  | 'COLLECTION_RATE'  // Items collected per minute
```

### Score Calculation

The difficulty score is calculated based on weighted metrics:

```typescript
calculateCurrentScore(): number {
  const timeInMinutes = survivalTime / 60000
  
  let score = 100  // Base score
  score += (enemiesKilled / timeInMinutes) * 10
  score += playerLevel * 15
  score += (damageDealt / timeInMinutes) * 0.01
  score -= (damageTaken / timeInMinutes) * 0.02
  score += accuracy * 50
  score += collectionRate * 20
  score -= deathCount * 25
  
  // Reaction time bonus/penalty
  if (averageReactionTime < 500) score += 20
  else if (averageReactionTime > 2000) score -= 20
  
  return Math.max(score, 0)
}
```

### Scaling Functions

The system supports multiple scaling function types:

```typescript
enum ScalingFunctionType {
  LINEAR = 'LINEAR',           // y = base + (x * factor)
  EXPONENTIAL = 'EXPONENTIAL', // y = base * (1 + factor)^x
  LOGARITHMIC = 'LOGARITHMIC', // y = base + factor * log(x + 1)
  STEP = 'STEP',              // y = base + floor(x/step) * factor
  CUSTOM = 'CUSTOM'           // Custom formula evaluation
}
```

Example scaling applications:
```typescript
// Linear scaling for enemy health
health = baseHealth * (1.0 + difficultyScore * 0.3)

// Exponential scaling for enemy damage
damage = baseDamage * Math.pow(1.5, difficultyLevel)

// Step scaling for spawn rate
spawnRate = baseRate + Math.floor(difficultyScore / 50) * 0.2
```

## Integration with Other Systems

### Combat System Integration

The Difficulty System modifies combat parameters:
- Enemy damage output
- Enemy health pools
- Attack speed and range
- Critical hit chances
- Damage resistance

```typescript
// Example: Scaling enemy damage
if (targetProperty === 'combat.damage') {
  const baseDamage = combat.weapon.damage
  const scaledDamage = modifierValue * baseDamage
  combat.weapon.damage = Math.max(1, Math.round(scaledDamage))
}
```

### Movement System Integration

Difficulty affects movement mechanics:
- Enemy movement speed
- Player movement modifiers
- Dash/dodge cooldowns
- Acceleration rates

### Spawner System Integration

The system controls enemy spawning:
- Spawn rates
- Maximum active enemies
- Time between waves
- Enemy type variety
- Boss spawn frequency

### Enemy AI Integration

AI behavior scales with difficulty:
- Aggression levels
- Target prioritization
- Reaction times
- Tactical complexity

## Configuration Options

### Adaptive Settings

```typescript
interface AdaptiveSettings {
  isEnabled: boolean              // Enable/disable adaptive difficulty
  adaptationRate: number          // How quickly difficulty adjusts (0.1 = 10%)
  adaptationInterval: number      // Time between adaptations (ms)
  performanceWindowSize: number   // Samples to track
  stabilityThreshold: number      // Variance threshold for stability
  maxAdjustmentPerInterval: number // Maximum change per adaptation
  targetPerformanceRange: {       // Ideal performance range
    min: number
    max: number
  }
  emergencyAdjustmentThreshold: number // Threshold for 2x adjustment
}
```

### Default Configuration

```typescript
const defaultAdaptiveSettings: AdaptiveSettings = {
  isEnabled: true,
  adaptationRate: 0.1,              // 10% adjustment rate
  adaptationInterval: 5000,         // Adapt every 5 seconds
  performanceWindowSize: 10,        // Track last 10 samples
  stabilityThreshold: 0.05,         // 5% variance = stable
  maxAdjustmentPerInterval: 0.2,    // Max 20% change
  targetPerformanceRange: {
    min: 0.6,                      // 60% performance floor
    max: 0.8                       // 80% performance ceiling
  },
  emergencyAdjustmentThreshold: 0.3 // 30% off-target = emergency
}
```

### Custom Modifier Configuration

Create custom modifiers for any game mechanic:

```typescript
const customModifier: DifficultyModifier = {
  id: 'custom_reload_speed',
  name: 'Faster Reload',
  description: 'Enemies reload weapons faster',
  targetProperty: 'combat.reloadSpeed',
  scalingFunction: {
    type: 'LINEAR',
    baseValue: 1.0,
    scalingFactor: -0.2  // 20% faster per difficulty level
  },
  isActive: true,
  priority: 2,
  minValue: 0.3,  // Maximum 70% reduction
  conditions: [{
    metric: 'PLAYER_LEVEL',
    operator: 'GREATER_THAN',
    value: 5
  }]
}
```

## API Reference

### DifficultySystem Class

```typescript
class DifficultySystem extends System {
  // Record player actions for metrics
  recordPlayerAction(
    entityId: EntityId,
    metric: ScalingMetric,
    value: number,
    isIncrement?: boolean
  ): void

  // Manually set difficulty level
  setDifficultyLevel(
    entityId: EntityId,
    level: DifficultyLevel
  ): boolean

  // Enable/disable adaptive difficulty
  enableAdaptiveDifficulty(
    entityId: EntityId,
    enabled: boolean
  ): boolean

  // Configure adaptive settings
  configureAdaptiveSettings(
    entityId: EntityId,
    settings: Partial<AdaptiveSettings>
  ): boolean

  // Get current difficulty statistics
  getDifficultyStats(entityId: EntityId): {
    currentLevel: DifficultyLevel
    currentScore: number
    targetScore: number
    performanceScore: number
    isStabilized: boolean
    adaptiveEnabled: boolean
    performanceHistory: number[]
    activeModifiers: string[]
  } | null

  // Create a difficulty manager entity
  createDifficultyManager(adaptiveEnabled?: boolean): EntityId

  // Add custom difficulty modifier
  addCustomModifier(
    entityId: EntityId,
    modifier: DifficultyModifier,
    targetLevel?: DifficultyLevel
  ): boolean

  // Remove custom modifier
  removeCustomModifier(
    entityId: EntityId,
    modifierId: string
  ): boolean
}
```

### DifficultyComponent Methods

```typescript
class DifficultyComponent extends Component {
  // Update performance metrics
  updatePerformanceMetrics(
    metric: ScalingMetric,
    value: number,
    isIncrement?: boolean
  ): void

  // Calculate current difficulty score
  calculateCurrentScore(): number

  // Get difficulty band for score
  getDifficultyBandForScore(score: number): DifficultyBand | null

  // Check if should transition difficulty
  shouldTransitionDifficulty(newScore: number): {
    shouldTransition: boolean
    newLevel?: DifficultyLevel
    confidence: number
  }

  // Calculate modifier value with scaling
  calculateModifierValue(
    modifier: DifficultyModifier,
    inputValue: number
  ): number

  // Get current performance score (0-1)
  getPerformanceScore(): number
}
```

### Events

The system emits difficulty change events:

```typescript
interface DifficultyChangedEvent {
  type: 'difficulty_changed'
  timestamp: number
  entityId: EntityId
  oldLevel: DifficultyLevel
  newLevel: DifficultyLevel
  currentScore: number
  performanceScore: number
  isAdaptive: boolean
}
```

## Best Practices

### 1. Performance Metric Selection

Choose metrics that reflect actual player skill:
```typescript
// Good: Balanced metric tracking
difficultySystem.recordPlayerAction(playerId, 'ENEMIES_KILLED', 1, true)
difficultySystem.recordPlayerAction(playerId, 'DAMAGE_TAKEN', damage, true)
difficultySystem.recordPlayerAction(playerId, 'ACCURACY', hitRate)

// Bad: Only tracking one metric
difficultySystem.recordPlayerAction(playerId, 'SCORE', score)
```

### 2. Adaptive Configuration

Configure adaptive settings based on game type:
```typescript
// Fast-paced action game
difficultySystem.configureAdaptiveSettings(managerId, {
  adaptationInterval: 3000,      // Quick 3-second adaptations
  adaptationRate: 0.15,          // 15% adjustment rate
  performanceWindowSize: 5       // Smaller window for responsiveness
})

// Strategic/puzzle game
difficultySystem.configureAdaptiveSettings(managerId, {
  adaptationInterval: 10000,     // Slower 10-second adaptations
  adaptationRate: 0.05,          // 5% adjustment rate
  performanceWindowSize: 20      // Larger window for stability
})
```

### 3. Custom Modifiers

Create modifiers that enhance gameplay:
```typescript
// Good: Interesting gameplay modifier
const eliteEnemyModifier: DifficultyModifier = {
  id: 'elite_enemy_chance',
  name: 'Elite Enemy Spawns',
  description: 'Chance to spawn elite variants',
  targetProperty: 'spawner.eliteChance',
  scalingFunction: {
    type: 'STEP',
    baseValue: 0,
    scalingFactor: 0.1,
    stepSize: 1  // +10% chance per difficulty level
  },
  isActive: true,
  priority: 3
}

// Bad: Frustrating modifier
const badModifier: DifficultyModifier = {
  id: 'instant_death',
  name: 'One Hit Kill',
  description: 'All damage is lethal',
  targetProperty: 'health.maxHealth',
  scalingFunction: {
    type: 'LINEAR',
    baseValue: 1,
    scalingFactor: -0.99  // Reduces health to 1
  }
}
```

### 4. Difficulty Transitions

Handle transitions smoothly:
```typescript
// Listen for difficulty changes
events.on('difficulty_changed', (event: DifficultyChangedEvent) => {
  // Update UI
  updateDifficultyDisplay(event.newLevel)
  
  // Show transition notification
  if (event.isAdaptive) {
    showNotification(`Difficulty adjusted to ${event.newLevel}`)
  }
  
  // Log for analytics
  logDifficultyChange({
    from: event.oldLevel,
    to: event.newLevel,
    score: event.currentScore,
    performance: event.performanceScore
  })
})
```

### 5. Testing Difficulty Curves

Test difficulty progression thoroughly:
```typescript
// Create test scenarios
function testDifficultyProgression() {
  const testManager = difficultySystem.createDifficultyManager(true)
  
  // Simulate poor performance
  for (let i = 0; i < 10; i++) {
    difficultySystem.recordPlayerAction(testManager, 'DAMAGE_TAKEN', 100, true)
    difficultySystem.recordPlayerAction(testManager, 'DEATH_COUNT', 1, true)
  }
  
  // Check if difficulty decreased
  const stats = difficultySystem.getDifficultyStats(testManager)
  console.assert(stats.currentScore < 100, 'Difficulty should decrease')
  
  // Simulate excellent performance
  for (let i = 0; i < 20; i++) {
    difficultySystem.recordPlayerAction(testManager, 'ENEMIES_KILLED', 10, true)
    difficultySystem.recordPlayerAction(testManager, 'DAMAGE_DEALT', 500, true)
  }
  
  // Check if difficulty increased
  const newStats = difficultySystem.getDifficultyStats(testManager)
  console.assert(newStats.currentScore > stats.currentScore, 'Difficulty should increase')
}
```

### 6. Balancing Guidelines

- **Start at Normal**: Default to NORMAL difficulty for new players
- **Gradual Changes**: Use small adaptation rates (5-15%) to avoid jarring transitions
- **Clear Feedback**: Always communicate difficulty changes to players
- **Override Options**: Allow players to manually set difficulty if desired
- **Recovery Mechanics**: Ensure players can recover from difficulty spikes

### 7. Performance Considerations

Optimize difficulty calculations:
```typescript
// Configure update intervals for performance
const difficultyUpdateInterval = 1000  // Update every second

// Batch metric updates
const metricsBuffer: Array<[ScalingMetric, number]> = []

function flushMetrics() {
  for (const [metric, value] of metricsBuffer) {
    difficultySystem.recordPlayerAction(playerId, metric, value, true)
  }
  metricsBuffer.length = 0
}

// Flush periodically
setInterval(flushMetrics, 500)
```

This comprehensive documentation provides everything developers need to understand and implement the difficulty system in their games, from basic concepts to advanced customization and optimization techniques.
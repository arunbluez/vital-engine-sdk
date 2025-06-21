/**
 * Example: Enemy AI and Spawning System
 * 
 * This example demonstrates how to use the AI and Spawn systems
 * to create a game with intelligent enemies and dynamic spawning.
 */

import {
  Engine,
  World,
  TransformComponent,
  HealthComponent,
  MovementComponent,
  CombatComponent,
  AIComponent,
  AIState,
  AIPersonality,
  SpawnerComponent,
  SpawnPattern,
  SpawnTiming,
  AISystem,
  PathfindingType,
  SpawnSystem,
  MovementSystem,
  CombatSystem,
  SpatialHashGrid,
  Vector2Math,
  BASIC_ENEMIES,
  SPAWN_WAVES,
  createCustomWave,
  type EnemyType
} from '../src'

// Initialize the engine
const engine = new Engine({
  tickRate: 60,
  fixedTimeStep: true
})

// Create spatial grid for efficient proximity queries
const spatialGrid = new SpatialHashGrid({
  cellSize: 100,
  worldBounds: {
    minX: -1000,
    minY: -1000,
    maxX: 1000,
    maxY: 1000
  }
})

// Initialize world
const world = new World()

// Add systems
world.addSystem(new MovementSystem())
world.addSystem(new CombatSystem())
world.addSystem(new AISystem(spatialGrid, {
  pathfindingType: PathfindingType.FLOW_FIELD,
  maxPathfindingPerFrame: 10,
  groupBehaviorEnabled: true
}))
world.addSystem(new SpawnSystem(spatialGrid, {
  maxGlobalEnemies: 500,
  difficultyScaling: true,
  dynamicDifficulty: true
}))

// Create player entity
const player = world.createEntity()
player.addComponent(new TransformComponent(0, 0))
player.addComponent(new HealthComponent(1000))
player.addComponent(new MovementComponent(100))
player.addComponent(new CombatComponent({
  damage: { min: 50, max: 75 },
  attackSpeed: 2.0,
  range: 150,
  criticalChance: 0.3
}))

// Create a basic spawner
const basicSpawner = world.createEntity()
basicSpawner.addComponent(new TransformComponent(0, -300))
const spawnerComponent = new SpawnerComponent({
  center: { x: 0, y: -300 },
  radius: 400
})

// Configure spawner with enemy types
spawnerComponent.spawnTiming = SpawnTiming.WAVE
spawnerComponent.spawnPattern = SpawnPattern.CIRCLE
spawnerComponent.baseSpawnRate = 2.0
spawnerComponent.maxActiveEnemies = 50

// Add basic enemy types to spawner
BASIC_ENEMIES.forEach(enemyType => {
  spawnerComponent.addEnemyType(enemyType)
})

// Add waves to spawner
SPAWN_WAVES.forEach(wave => {
  spawnerComponent.addWave(wave)
})

basicSpawner.addComponent(spawnerComponent)

// Create a boss spawner
const bossSpawner = world.createEntity()
bossSpawner.addComponent(new TransformComponent(0, 400))
const bossSpawnerComponent = new SpawnerComponent({
  center: { x: 0, y: 400 },
  radius: 200
})

bossSpawnerComponent.spawnTiming = SpawnTiming.BOSS
bossSpawnerComponent.spawnPattern = SpawnPattern.PORTAL

// Define a custom boss type
const customBoss: EnemyType = {
  id: 'custom_boss',
  name: 'The Destroyer',
  weight: 1,
  minLevel: 10,
  maxLevel: 99,
  components: [
    {
      type: 'health',
      data: { maximum: 5000 }
    },
    {
      type: 'movement',
      data: { maxSpeed: 40 }
    },
    {
      type: 'combat',
      data: {
        damage: { min: 100, max: 150 },
        attackSpeed: 0.8,
        range: 150,
        criticalChance: 0.4
      }
    },
    {
      type: 'ai',
      data: { personality: AIPersonality.BERSERKER }
    }
  ],
  scalingFactors: {
    health: 10.0,
    damage: 5.0,
    speed: 0.8,
    experience: 50.0
  }
}

bossSpawnerComponent.addEnemyType(customBoss)
bossSpawner.addComponent(bossSpawnerComponent)

// Create some patrol points for enemy AI
const patrolPoints = [
  { x: -200, y: -200 },
  { x: 200, y: -200 },
  { x: 200, y: 200 },
  { x: -200, y: 200 }
]

// Example: Manually create an enemy with custom AI behavior
function createCustomEnemy(position: { x: number; y: number }) {
  const enemy = world.createEntity()
  
  enemy.addComponent(new TransformComponent(position.x, position.y))
  enemy.addComponent(new HealthComponent(200))
  enemy.addComponent(new MovementComponent(60))
  enemy.addComponent(new CombatComponent({
    damage: { min: 15, max: 25 },
    attackSpeed: 1.0,
    range: 80
  }))
  
  // Create AI with custom behavior
  const ai = new AIComponent(AIPersonality.TACTICAL)
  
  // Set patrol path
  patrolPoints.forEach(point => {
    ai.patrolPath.push({ x: point.x, y: point.y })
  })
  
  // Configure AI parameters
  ai.sightRange = 200
  ai.attackRange = 80
  ai.fleeDistance = 400
  ai.fearLevel = 0.3
  ai.aggressionLevel = 0.7
  ai.curiosity = 0.6
  
  // Add custom state transitions
  ai.stateTransitions.push({
    from: AIState.PATROL,
    to: AIState.INVESTIGATE,
    condition: (context) => context.nearbyEnemies > 0 && !context.targetVisible && ai.curiosity > 0.5,
    priority: 3
  })
  
  enemy.addComponent(ai)
  
  // Update spatial grid
  spatialGrid.insert({
    id: enemy.id,
    position: position,
    radius: 50
  })
  
  return enemy
}

// Create some custom enemies
createCustomEnemy({ x: -150, y: 0 })
createCustomEnemy({ x: 150, y: 0 })
createCustomEnemy({ x: 0, y: 150 })

// Game loop
let isRunning = true
let lastTime = Date.now()

function gameLoop() {
  if (!isRunning) return
  
  const currentTime = Date.now()
  const deltaTime = currentTime - lastTime
  lastTime = currentTime
  
  // Update engine
  engine.update(deltaTime)
  
  // Get AI system stats
  const aiSystem = world.getSystem('ai') as AISystem
  const spawnSystem = world.getSystem('spawn') as SpawnSystem
  
  if (aiSystem && spawnSystem) {
    const aiStats = aiSystem.getStats()
    const spawnStats = spawnSystem.getStats()
    
    // Log stats every second
    if (currentTime % 1000 < deltaTime) {
      console.log('AI Stats:', aiStats)
      console.log('Spawn Stats:', spawnStats)
    }
  }
  
  // Continue loop
  requestAnimationFrame(gameLoop)
}

// Handle game events
engine.eventSystem.on('ENEMY_SPAWNED', (event: any) => {
  console.log('Enemy spawned:', event.data)
  
  // Update spatial grid for new enemy
  const entity = world.getEntity(event.data.entityId)
  if (entity) {
    const transform = entity.getComponent('transform') as TransformComponent
    spatialGrid.insert({
      id: event.data.entityId,
      position: transform.position,
      radius: 50
    })
  }
})

engine.eventSystem.on('AI_STATE_CHANGED', (event: any) => {
  console.log(`AI state changed: ${event.data.previousState} -> ${event.data.newState}`)
})

engine.eventSystem.on('BOSS_SPAWNED', (event: any) => {
  console.log('BOSS SPAWNED!', event.data)
})

// Start the game
console.log('Starting AI and Spawning example...')
console.log('The game will spawn enemies in waves and demonstrate AI behaviors.')
gameLoop()

// Stop after 30 seconds for demo
setTimeout(() => {
  isRunning = false
  console.log('Demo completed!')
}, 30000)

export { engine, world }
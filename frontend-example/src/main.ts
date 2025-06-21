import { 
    Engine,
    World,
    Entity,
    EventSystem,
    TransformComponent,
    HealthComponent,
    MovementComponent,
    CombatComponent,
    ExperienceComponent,
    InventoryComponent,
    SkillsComponent,
    CollectibleComponent,
    MagnetComponent,
    EnemyAIComponent,
    DifficultyComponent,
    SpawnerComponent,
    MovementSystem,
    CombatSystem,
    ProgressionSystem,
    EconomySystem,
    SkillSystem,
    EnemySystem,
    CollectionSystem,
    DifficultySystem,
    SpawnSystem,
    AISystem,
    GameEventType,
    AIBehaviorState,
    AIBehaviorType,
    SkillType,
    SkillTargetType,
    SkillEffectType,
    SpawnPattern,
    SpawnTiming,
    PathfindingType,
    DEFAULT_SKILL_DATABASE,
    type EntityDestroyedEventData,
    type CollectibleType,
    type SpawnWave,
    type EnemyType,
    type SkillDatabase
} from 'vital-engine-sdk'

import { Renderer } from './renderer'
import { InputHandler } from './input'
import { UIManager } from './ui'
import type { 
    EntityId, 
    Projectile, 
    OrbitingProjectile, 
    InputDirection, 
    MousePosition,
    PerformanceMetrics 
} from './types'

class GameFrontend {
    private canvas: HTMLCanvasElement
    private ctx: CanvasRenderingContext2D
    private engine: Engine
    private world: World
    private events: EventSystem
    private renderer: Renderer
    private input: InputHandler
    private ui: UIManager
    
    private playerId: EntityId | null = null
    private enemyIds: EntityId[] = []
    private projectiles: Projectile[] = []
    private orbitingProjectiles: OrbitingProjectile[] = []
    
    private lastAutoFireTime: number = 0
    private autoFireCooldown: number = 200
    private lastTime: number = 0
    private frameCount: number = 0
    private fpsTimer: number = 0
    private errorCount: number = 0
    private lastHealTime: number = 0
    private healInterval: number = 1000 // 1 second
    
    private performanceMetrics: PerformanceMetrics = {
        totalSdkTime: 0,
        totalRenderTime: 0,
        totalFrameTime: 0
    }
    
    private areaEffects: Array<{
        x: number
        y: number
        radius: number
        maxRadius: number
        duration: number
        startTime: number
        color: string
    }> = []
    
    private deadEnemies: Map<EntityId, number> = new Map() // Track when enemies died

    constructor() {
        console.log('Starting GameFrontend constructor...')
        
        const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement
        if (!canvas) {
            throw new Error('Canvas element not found')
        }
        this.canvas = canvas
        
        const ctx = canvas.getContext('2d')
        if (!ctx) {
            throw new Error('Cannot get 2D context')
        }
        this.ctx = ctx
        
        console.log('Canvas initialized')
        
        // Initialize engine
        try {
            console.log('Creating Engine...')
            this.engine = new Engine({
                engine: {
                    targetFPS: 60,
                    fixedTimeStep: false,
                    enableEventHistory: true
                }
            })
            console.log('Engine created successfully')
            
            this.world = this.engine.getWorld()
            this.events = this.engine.getEvents()
            console.log('World and events initialized')
        } catch (error) {
            console.error('Error creating engine:', error)
            throw error
        }
        
        // Initialize frontend components
        this.renderer = new Renderer(this.ctx)
        this.input = new InputHandler(this.canvas)
        this.ui = new UIManager()
        
        this.setupSystems()
        this.setupEventListeners()
        this.createPlayer()
        this.createEnemies(15) // Reduced initial enemies since spawner will add more
        this.createCollectibles(8) // More collectibles for testing
        this.createSpawner() // Add dynamic spawning
        
        console.log('🎮 === VITAL ENGINE SDK FRONTEND DEMO ===')
        console.log('✅ Game initialization complete with advanced features!')
        console.log('')
        console.log('🎯 CONTROLS:')
        console.log('  WASD - Move player')
        console.log('  Mouse - Aim (auto-fire)')
        console.log('  Space - Use Area Blast skill')
        console.log('  R - Restart game')
        console.log('  Q - Advanced features testing menu')
        console.log('')
        console.log('🎮 FEATURES ENABLED:')
        console.log('  ✅ Skills System (with database integration)')
        console.log('  ✅ Enemy AI System')
        console.log('  ✅ Collection System') 
        console.log('  ✅ Spawning System (3 waves)')
        console.log('  ✅ Difficulty System (auto-scaling)')
        console.log('  ✅ Advanced AI System')
        console.log('')
        console.log('📊 GAME STATS:')
        console.log('Player ID:', this.playerId)
        console.log('Initial enemies:', this.enemyIds.length)
        console.log('World stats:', this.world.getStats())
        console.log('')
        console.log('🎯 Watch for different colored collectibles:')
        console.log('  🔵 Cyan = Experience')
        console.log('  🔴 Red = Health')
        console.log('  🟦 Blue = Mana') 
        console.log('  🟡 Yellow = Currency')
        console.log('')
        
        // Start the engine
        this.engine.start()
        console.log('Engine started')
        
        // Start game loop
        this.gameLoop()
    }
    
    private setupSystems(): void {
        // Initialize core systems
        this.world.addSystem(new MovementSystem(this.events))
        this.world.addSystem(new CombatSystem(this.events, this.world))
        this.world.addSystem(new ProgressionSystem(this.events, this.world))
        this.world.addSystem(new EconomySystem(this.events, this.world))
        
        // Advanced game systems
        this.world.addSystem(new SkillSystem(this.events, this.world as any))
        this.world.addSystem(new CollectionSystem(this.events, this.world as any))
        this.world.addSystem(new EnemySystem(this.events, this.world as any))
        this.world.addSystem(new DifficultySystem(this.events, this.world as any))
        this.world.addSystem(new SpawnSystem(this.events, this.world as any))
        this.world.addSystem(new AISystem(this.events, this.world as any, {
            pathfindingType: PathfindingType.A_STAR,
            maxPathfindingNodes: 1000,
            enableGroupBehavior: true,
            enableFlocking: false
        }))
        
        console.log('🎮 All systems initialized including advanced features (AI, Spawning, Difficulty, Collection)')
    }
    
    private setupEventListeners(): void {
        // Listen to engine events for visual/audio feedback
        this.events.on(GameEventType.DAMAGE_DEALT, (event) => {
            console.log('Damage dealt:', event.data)
        })
        
        this.events.on(GameEventType.ENTITY_KILLED, (event) => {
            console.log('Entity killed:', event.data)
            // Track when enemy died for cleanup
            const data = event.data as EntityDestroyedEventData
            if (data.entityId && this.enemyIds.includes(data.entityId)) {
                this.deadEnemies.set(data.entityId, Date.now())
            }
        })
        
        this.events.on(GameEventType.LEVEL_UP, (event) => {
            console.log('Level up!', event.data)
        })
        
        this.events.on(GameEventType.EXPERIENCE_GAINED, (event) => {
            console.log('XP gained:', event.data)
        })
        
        // Phase 3: Skills events
        this.events.on('SKILL_EVOLUTION_AVAILABLE', (event) => {
            console.log('🌟 Skill evolution available!', event.data)
        })
        
        this.events.on('SKILL_ACTIVATED', (event) => {
            console.log('⚡ Skill activated:', event.data)
        })
        
        // Additional skill events
        this.events.on('SKILL_EFFECT_APPLIED', (event) => {
            console.log('✨ Skill effect applied:', event.data)
        })
        
        this.events.on('SKILL_LEVEL_UP', (event) => {
            console.log('📈 Skill leveled up:', event.data)
        })
        
        // Collection events
        this.events.on('COLLECTIBLE_COLLECTED', (event) => {
            console.log('💎 Collectible collected:', event.data)
        })
        
        // Difficulty events
        this.events.on('DIFFICULTY_CHANGED', (event) => {
            console.log('📈 Difficulty changed:', event.data)
        })
        
        // Spawn events
        this.events.on('ENEMY_SPAWNED', (event) => {
            console.log('👾 Enemy spawned:', event.data)
        })
        
        this.events.on('WAVE_STARTED', (event) => {
            console.log('🌊 Wave started:', event.data)
        })
        
        this.events.on('WAVE_COMPLETED', (event) => {
            console.log('✅ Wave completed:', event.data)
        })
        
        // Handle input
        this.input.on('move', (direction: InputDirection) => {
            if (this.playerId) {
                const player = this.world.getEntity(this.playerId)
                if (player) {
                    const movement = player.getComponent('movement') as MovementComponent
                    if (movement) {
                        const speed = movement.maxSpeed
                        movement.velocity.x = direction.x * speed
                        movement.velocity.y = direction.y * speed
                    }
                }
            }
        })
        
        this.input.on('attack', (target: MousePosition) => {
            console.log('Click registered at:', target)
            
            if (this.playerId) {
                const player = this.world.getEntity(this.playerId)
                if (player) {
                    const skills = player.getComponent('skills') as SkillsComponent
                    if (skills) {
                        Array.from(skills.skills.values()).forEach(skill => {
                            if (skill.type === 'active') {
                                console.log('🔥 Attempting to activate skill:', skill.name)
                            }
                        })
                    }
                }
            }
        })
        
        this.input.on('restart', () => {
            this.restart()
        })
        
        this.input.on('test_phase3', () => {
            this.showTestMenu()
        })
        
        this.input.on('skill', (skillNumber: number) => {
            switch (skillNumber) {
                case 1:
                    this.testSkillsSystem()
                    break
                case 2:
                    this.testEnemyAI()
                    break
                case 3:
                    this.testCollectionSystem()
                    break
                case 4:
                    this.testSpawningSystem()
                    break
                case 5:
                    this.testDifficultySystem()
                    break
            }
        })
        
        this.input.on('use_skill', (skillId: string) => {
            this.useActiveSkill(skillId)
        })
    }
    
    private createPlayer(): void {
        try {
            const player = this.world.createEntity()
            this.playerId = player.id
            console.log('Created player entity:', player.id)
            
            player.addComponent(new TransformComponent(400, 300))
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
        
        // Add skills component with skill database integration
        try {
            const skills = new SkillsComponent()
            
            // Load skills from the default skill database
            const skillDatabase: SkillDatabase = DEFAULT_SKILL_DATABASE
            
            // Add some starter skills from the database
            const starterSkillIds = ['damage_boost', 'health_regeneration', 'movement_speed']
            
            starterSkillIds.forEach(skillId => {
                const skillTemplate = skillDatabase.skills[skillId]
                if (skillTemplate) {
                    // Convert skill template to actual skill
                    const skill = {
                        id: skillTemplate.id,
                        name: skillTemplate.name,
                        description: skillTemplate.description,
                        type: skillTemplate.type as SkillType,
                        targetType: skillTemplate.targetType as SkillTargetType,
                        level: 1,
                        maxLevel: skillTemplate.maxLevel,
                        cooldown: skillTemplate.cooldown || 0,
                        lastUsed: 0,
                        effects: skillTemplate.effects.map(effect => ({
                            type: effect.type as SkillEffectType,
                            value: effect.baseValue,
                            duration: effect.duration,
                            stackable: effect.stackable || false
                        }))
                    }
                    skills.addSkill(skill)
                    console.log(`Added skill from database: ${skill.name}`)
                }
            })
            
            // Add a custom area blast skill not in database
            skills.addSkill({
                id: 'area_blast',
                name: 'Area Blast',
                description: 'Deal 50 damage to all enemies in range (Press Space)',
                type: SkillType.ACTIVE,
                targetType: SkillTargetType.AREA,
                level: 1,
                maxLevel: 3,
                cooldown: 3000, // 3 second cooldown
                lastUsed: 0,
                effects: [{
                    type: SkillEffectType.DAMAGE,
                    value: 50,
                    stackable: false
                }]
            })
            
            player.addComponent(skills)
            console.log('Added skills component with database skills:', Array.from(skills.skills.keys()))
        } catch (error) {
            console.error('Failed to add skills component:', error)
        }
        
        // Add magnet component
        try {
            const magnet = new MagnetComponent()
            player.addComponent(magnet)
        } catch (error) {
            console.error('Failed to add magnet component:', error)
        }
        
        // Add difficulty component to track game progression
        try {
            const difficulty = new DifficultyComponent()
            player.addComponent(difficulty)
            console.log('Added difficulty component to player')
        } catch (error) {
            console.error('Failed to add difficulty component:', error)
        }
        
        this.createOrbitingProjectiles()
        } catch (error) {
            console.error('Error creating player:', error)
        }
    }
    
    private createEnemies(count: number): void {
        this.enemyIds = []
        
        for (let i = 0; i < count; i++) {
            const enemy = this.world.createEntity()
            this.enemyIds.push(enemy.id)
            
            const angle = Math.random() * Math.PI * 2
            const distance = 200 + Math.random() * 200
            const x = 400 + Math.cos(angle) * distance
            const y = 300 + Math.sin(angle) * distance
            
            enemy.addComponent(new TransformComponent(x, y))
            enemy.addComponent(new HealthComponent(30 + Math.random() * 40))
            enemy.addComponent(new MovementComponent(50 + Math.random() * 50))
            
            try {
                const ai = new EnemyAIComponent()
                ai.targetEntityId = this.playerId as number
                ai.currentState = AIBehaviorState.IDLE
                ai.detectionRange = 300
                ai.attackRange = 80 // Increased attack range
                ai.aggressionLevel = 0.7
                ai.behaviorType = AIBehaviorType.AGGRESSIVE
                // Initialize lastAttackTime properly
                // Use lastActionTime which is the proper property name
                ai.lastActionTime = 0
                enemy.addComponent(ai)
                console.log(`Added AI to enemy ${enemy.id}, targeting player ${this.playerId}, state: ${ai.currentState}`)
            } catch (error) {
                console.error('Failed to add AI component:', error)
            }
            
            if (Math.random() < 0.8) { // 80% chance enemies can attack
                const combat = new CombatComponent({
                    damage: 5 + Math.random() * 10,
                    range: 60,
                    attackSpeed: 0.5 + Math.random() * 1
                })
                enemy.addComponent(combat)
                console.log(`Enemy ${enemy.id} has combat: damage=${combat.weapon.damage}, attackSpeed=${combat.weapon.attackSpeed}`)
            } else {
                console.log(`Enemy ${enemy.id} has no combat ability`)
            }
        }
    }
    
    private createCollectibles(count: number): void {
        for (let i = 0; i < count; i++) {
            const collectible = this.world.createEntity()
            
            const angle = Math.random() * Math.PI * 2
            const distance = 150 + Math.random() * 300
            const x = 400 + Math.cos(angle) * distance
            const y = 300 + Math.sin(angle) * distance
            
            collectible.addComponent(new TransformComponent(x, y))
            
            try {
                // Use proper CollectibleType enum values
                const types: CollectibleType[] = ['CURRENCY', 'EXPERIENCE', 'HEALTH', 'MANA'] as CollectibleType[]
                const randomType = types[Math.floor(Math.random() * types.length)]
                const value = randomType === 'EXPERIENCE' ? 15 : 
                              randomType === 'HEALTH' ? 25 :
                              randomType === 'MANA' ? 20 : 5
                
                const collectibleComp = new CollectibleComponent(randomType, value)
                collectible.addComponent(collectibleComp)
                console.log(`Created ${randomType} collectible with value ${value}`)
            } catch (error) {
                console.error('Failed to create collectible component:', error)
            }
        }
    }
    
    private createSpawner(): void {
        try {
            const spawner = this.world.createEntity()
            spawner.addComponent(new TransformComponent(400, 300)) // Center of screen
            
            const spawnerComp = new SpawnerComponent()
            
            // Define enemy types for spawning
            const basicEnemy: EnemyType = {
                name: 'Basic Enemy',
                health: 40,
                damage: 8,
                speed: 60,
                xpReward: 10,
                spawnWeight: 1.0
            }
            
            const fastEnemy: EnemyType = {
                name: 'Fast Enemy', 
                health: 25,
                damage: 6,
                speed: 100,
                xpReward: 15,
                spawnWeight: 0.7
            }
            
            const tankEnemy: EnemyType = {
                name: 'Tank Enemy',
                health: 80,
                damage: 15,
                speed: 30,
                xpReward: 25,
                spawnWeight: 0.3
            }
            
            // Create spawn waves
            const wave1: SpawnWave = {
                enemyTypes: [basicEnemy],
                spawnCount: 3,
                spawnInterval: 2000, // 2 seconds between spawns
                duration: 10000, // 10 seconds total
                startDelay: 5000 // Start after 5 seconds
            }
            
            const wave2: SpawnWave = {
                enemyTypes: [basicEnemy, fastEnemy],
                spawnCount: 5,
                spawnInterval: 1500,
                duration: 15000,
                startDelay: 20000 // Start after first wave
            }
            
            const wave3: SpawnWave = {
                enemyTypes: [basicEnemy, fastEnemy, tankEnemy],
                spawnCount: 4,
                spawnInterval: 3000,
                duration: 20000,
                startDelay: 40000
            }
            
            spawnerComp.waves = [wave1, wave2, wave3]
            spawnerComp.pattern = SpawnPattern.WAVE_BASED
            spawnerComp.timing = SpawnTiming.TIMED
            spawnerComp.spawnRadius = 300 // Spawn enemies 300 pixels from center
            spawnerComp.maxEnemies = 25 // Maximum enemies on screen
            spawnerComp.isActive = true
            
            spawner.addComponent(spawnerComp)
            console.log('🌊 Spawner created with 3 waves of enemies')
            
        } catch (error) {
            console.error('Failed to create spawner:', error)
        }
    }
    
    private restart(): void {
        this.world.clear()
        this.projectiles = []
        this.orbitingProjectiles = []
        this.deadEnemies.clear()
        this.enemyIds = []
        this.areaEffects = []
        
        this.setupSystems()
        this.createPlayer()
        this.createEnemies(10)
        this.createCollectibles(8)
        this.createSpawner()
        
        console.log('Game restarted with new features')
    }
    
    private gameLoop = (): void => {
        const frameStartTime = performance.now()
        const currentTime = frameStartTime
        const deltaTime = currentTime - this.lastTime
        this.lastTime = currentTime
        
        // Update game mechanics
        this.updateAutoFire(currentTime)
        this.updateProjectiles(deltaTime) 
        this.updateOrbitingProjectiles(deltaTime)
        this.updateHealthRegeneration(currentTime)
        this.cleanupDeadEnemies(currentTime)
        // Enemy AI is now handled by the EnemySystem
        this.updateEnemyAI()
        
        // Time the SDK update
        const sdkStartTime = performance.now()
        
        try {
            this.world.update(deltaTime)
        } catch (error) {
            this.errorCount++
            if (this.errorCount <= 5) {
                console.error(`💥 Error during world.update() (${this.errorCount}/5):`, error)
                if (this.errorCount === 5) {
                    console.warn('🚫 Further errors will be suppressed')
                }
            }
        }
        
        const sdkTime = performance.now() - sdkStartTime
        
        // Update input
        this.input.update()
        
        // Time the rendering
        const renderStartTime = performance.now()
        this.renderer.clear()
        this.renderEntities()
        this.renderProjectiles()
        this.renderOrbitingProjectiles()
        this.renderAreaEffects()
        const renderTime = performance.now() - renderStartTime
        
        // Update UI less frequently
        if (this.frameCount % 2 === 0) {
            this.updateUI()
        }
        
        // FPS calculation and performance monitoring
        this.frameCount++
        this.fpsTimer += deltaTime
        const frameTime = performance.now() - frameStartTime
        
        if (this.frameCount === 1) {
            this.performanceMetrics = {
                totalSdkTime: 0,
                totalRenderTime: 0,
                totalFrameTime: 0
            }
        }
        
        this.performanceMetrics.totalSdkTime += sdkTime
        this.performanceMetrics.totalRenderTime += renderTime  
        this.performanceMetrics.totalFrameTime += frameTime
        
        if (this.fpsTimer >= 1000) {
            const fps = this.frameCount
            this.ui.updateFPS(fps)
            
            const avgSdkTime = this.performanceMetrics.totalSdkTime / this.frameCount
            const avgRenderTime = this.performanceMetrics.totalRenderTime / this.frameCount
            const avgFrameTime = this.performanceMetrics.totalFrameTime / this.frameCount
            
            if (avgFrameTime < 10 && fps < 50) {
                console.warn(`🎮 FRAME RATE CAPPED: System limiting FPS to ${fps}`)
            }
            
            if (fps < 45) {
                console.warn(`⚠️ BOTTLENECK - Frame: ${avgFrameTime.toFixed(2)}ms`)
                if (avgSdkTime > 8) {
                    console.warn(`🐌 SDK slow: ${avgSdkTime.toFixed(2)}ms`)
                }
                if (avgRenderTime > 8) {
                    console.warn(`🎨 Rendering slow: ${avgRenderTime.toFixed(2)}ms`)
                }
            }
            
            this.frameCount = 0
            this.fpsTimer = 0
        }
        
        this.renderCursor()
        
        requestAnimationFrame(this.gameLoop)
    }
    
    private renderEntities(): void {
        const entities = this.world.getActiveEntities()
        
        entities.forEach((entity: Entity) => {
            const transform = entity.getComponent('transform') as TransformComponent
            const health = entity.getComponent('health') as HealthComponent | undefined
            
            if (!transform) return
            
            let color = '#fff'
            let size = 8
            
            if (entity.id === this.playerId) {
                color = '#0f0'
                size = 12
            } else if (entity.hasComponent('collectible')) {
                const collectible = entity.getComponent('collectible') as CollectibleComponent
                if (collectible) {
                    switch (collectible.collectibleType) {
                        case 'EXPERIENCE':
                            color = '#00ffff' // Cyan for experience
                            size = 6
                            break
                        case 'HEALTH':
                            color = '#ff0000' // Red for health
                            size = 7
                            break
                        case 'MANA':
                            color = '#0066ff' // Blue for mana
                            size = 7
                            break
                        case 'CURRENCY':
                            color = '#ffff00' // Yellow for currency
                            size = 8
                            break
                        default:
                            color = '#ffffff' // White for unknown
                            size = 6
                    }
                } else {
                    color = '#ffff00'
                    size = 8
                }
            } else if (entity.hasComponent('enemyAI')) {
                const ai = entity.getComponent('enemyAI') as EnemyAIComponent
                if (health && health.isDead()) {
                    // Check if enemy is tracked as dead
                    const deathTime = this.deadEnemies.get(entity.id)
                    if (deathTime) {
                        const elapsed = Date.now() - deathTime
                        const fadeProgress = Math.min(elapsed / 3000, 1) // 3 second fade
                        const alpha = 1 - fadeProgress
                        color = `rgba(102, 102, 102, ${alpha})` // Fading gray
                    } else {
                        color = '#666' // Gray for dead
                        // Track it as dead if not already
                        this.deadEnemies.set(entity.id, Date.now())
                    }
                    size = 10
                } else if (ai) {
                    switch (ai.currentState) {
                        case 'seeking':
                            color = '#ff4444'
                            break
                        case 'attacking':
                            color = '#ff0000'
                            break
                        case 'fleeing':
                            color = '#ffaa00'
                            break
                        case 'idle':
                            color = '#ff8888'
                            break
                        default:
                            color = '#f00'
                    }
                    size = 10
                } else {
                    color = '#f00'
                    size = 10
                }
            } else if (health) {
                color = health.isDead() ? '#666' : '#f00'
                size = 10
            }
            
            this.renderer.drawCircle(
                transform.position.x,
                transform.position.y,
                size,
                color
            )
            
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
            
            if (entity.id === this.playerId) {
                const combat = entity.getComponent('combat') as CombatComponent
                if (combat) {
                    this.renderer.drawCircle(
                        transform.position.x,
                        transform.position.y,
                        80, // Default combat range
                        'rgba(0, 255, 0, 0.1)',
                        false
                    )
                }
                
                const magnet = entity.getComponent('magnet') as MagnetComponent
                if (magnet && magnet.magneticField) {
                    this.renderer.drawCircle(
                        transform.position.x,
                        transform.position.y,
                        magnet.magneticField.range,
                        'rgba(0, 255, 255, 0.1)',
                        false
                    )
                }
                
                // Visual indicator for active skills
                const skills = entity.getComponent('skills') as SkillsComponent
                if (skills && skills.activeEffects.length > 0) {
                    // Draw a pulsing aura around player when skills are active
                    const pulse = Math.sin(Date.now() * 0.003) * 0.3 + 0.7
                    this.renderer.drawCircle(
                        transform.position.x,
                        transform.position.y,
                        20,
                        `rgba(255, 215, 0, ${0.3 * pulse})`,
                        true
                    )
                }
            }
        })
    }
    
    private cleanupDeadEnemies(currentTime: number): void {
        const deathDuration = 3000 // 3 seconds before disappearing
        
        for (const [enemyId, deathTime] of this.deadEnemies.entries()) {
            if (currentTime - deathTime > deathDuration) {
                // Remove from world
                const enemy = this.world.getEntity(enemyId)
                if (enemy) {
                    this.world.destroyEntity(enemyId)
                    console.log(`Removed dead enemy ${enemyId}`)
                }
                
                // Remove from tracking
                this.deadEnemies.delete(enemyId)
                const index = this.enemyIds.indexOf(enemyId)
                if (index > -1) {
                    this.enemyIds.splice(index, 1)
                }
            }
        }
    }
    
    private updateHealthRegeneration(currentTime: number): void {
        if (!this.playerId) return
        
        // Check if enough time has passed for healing
        if (currentTime - this.lastHealTime < this.healInterval) return
        
        const player = this.world.getEntity(this.playerId)
        if (!player) return
        
        const health = player.getComponent('health') as HealthComponent
        const skills = player.getComponent('skills') as SkillsComponent
        
        if (!health || !skills) return
        
        // Check if player has regeneration skill
        const regenSkill = skills.skills.get('regeneration')
        if (!regenSkill) return
        
        // Apply healing
        const healAmount = regenSkill.effects[0].value * regenSkill.level
        if (health.current < health.maximum) {
            health.heal(healAmount)
            console.log(`🌟 Regenerated ${healAmount} HP (${health.current}/${health.maximum})`)
        }
        
        this.lastHealTime = currentTime
    }
    
    private updateEnemyAI(): void {
        if (!this.playerId) return
        
        const player = this.world.getEntity(this.playerId)
        if (!player) return
        
        const playerTransform = player.getComponent('transform') as TransformComponent
        if (!playerTransform) return
        
        // Update ALL enemies since EnemySystem doesn't seem to be working
        this.enemyIds.forEach(enemyId => {
            const enemy = this.world.getEntity(enemyId)
            if (!enemy) return
            
            const enemyTransform = enemy.getComponent('transform') as TransformComponent
            const enemyMovement = enemy.getComponent('movement') as MovementComponent
            const enemyHealth = enemy.getComponent('health') as HealthComponent
            const enemyAI = enemy.getComponent('enemyAI') as EnemyAIComponent
            const enemyCombat = enemy.getComponent('combat') as CombatComponent
            
            if (!enemyTransform || !enemyMovement || !enemyHealth) return
            
            if (enemyHealth.isDead()) {
                enemyMovement.velocity.x = 0
                enemyMovement.velocity.y = 0
                if (enemyAI) {
                    enemyAI.currentState = AIBehaviorState.DEAD
                }
                return
            }
            
            const dx = playerTransform.position.x - enemyTransform.position.x
            const dy = playerTransform.position.y - enemyTransform.position.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            
            if (distance > 0) {
                // Update AI state based on distance
                if (enemyAI) {
                    const attackRange = enemyAI.attackRange || 60
                    const detectionRange = enemyAI.detectionRange || 300
                    
                    if (distance <= attackRange) {
                        enemyAI.currentState = AIBehaviorState.ATTACKING
                        
                        // Initialize attack timer if needed
                        if (enemyAI.lastActionTime === undefined || enemyAI.lastActionTime === null) {
                            enemyAI.lastActionTime = 0
                        }
                        
                        // Attack logic - create projectile
                        const currentTime = Date.now()
                        const attackCooldown = enemyCombat ? (1000 / enemyCombat.weapon.attackSpeed) : 2000
                        const timeSinceLastAttack = currentTime - enemyAI.lastActionTime
                        
                        if (enemyCombat && timeSinceLastAttack > attackCooldown) {
                            console.log(`Enemy ${enemyId} attacking! Distance: ${distance.toFixed(1)}, Cooldown: ${attackCooldown}ms, Time since last: ${timeSinceLastAttack}ms`)
                            
                            // Create enemy projectile
                            this.createProjectile(
                                enemyTransform.position.x,
                                enemyTransform.position.y,
                                playerTransform.position.x,
                                playerTransform.position.y,
                                enemyId,
                                true // isEnemy flag
                            )
                            enemyAI.lastActionTime = currentTime
                            console.log(`Enemy ${enemyId} fired projectile! Total projectiles: ${this.projectiles.length}`)
                        } else if (enemyCombat && this.frameCount % 60 === 0) {
                            // Log every second why enemy isn't firing
                            console.log(`Enemy ${enemyId} not firing - cooldown not met. Time left: ${attackCooldown - timeSinceLastAttack}ms`)
                        }
                    } else if (distance <= detectionRange) {
                        enemyAI.currentState = AIBehaviorState.SEEKING
                    } else {
                        enemyAI.currentState = AIBehaviorState.IDLE
                    }
                } else if (enemyCombat && distance <= 80) {
                    // Enemy has no AI but has combat - still let them attack
                    // Track attack time for non-AI enemies
                    interface EnemyAttackState {
                        lastAttackTime?: number
                    }
                    const attackState = enemy as unknown as EnemyAttackState
                    if (!attackState.lastAttackTime) {
                        attackState.lastAttackTime = 0
                    }
                    
                    const currentTime = Date.now()
                    const attackCooldown = 1000 / enemyCombat.weapon.attackSpeed
                    
                    if (currentTime - attackState.lastAttackTime! > attackCooldown) {
                        console.log(`Non-AI enemy ${enemyId} attacking!`)
                        this.createProjectile(
                            enemyTransform.position.x,
                            enemyTransform.position.y,
                            playerTransform.position.x,
                            playerTransform.position.y,
                            enemyId,
                            true
                        )
                        attackState.lastAttackTime = currentTime
                    }
                }
                
                // Move towards player if in detection range
                const detectionRange = enemyAI?.detectionRange || 300
                if (distance <= detectionRange) {
                    const speed = enemyAI && enemyAI.currentState === 'attacking' ? 
                        enemyMovement.maxSpeed * 0.5 : // Slower when attacking
                        enemyMovement.maxSpeed * 0.7   // Normal speed when seeking
                    
                    const dirX = (dx / distance) * speed
                    const dirY = (dy / distance) * speed
                    enemyMovement.velocity.x = dirX
                    enemyMovement.velocity.y = dirY
                } else {
                    // Stop moving if out of range
                    enemyMovement.velocity.x = 0
                    enemyMovement.velocity.y = 0
                }
            }
        })
    }
    
    private updateAutoFire(currentTime: number): void {
        if (currentTime - this.lastAutoFireTime < this.autoFireCooldown) {
            return
        }
        
        if (!this.playerId) return
        
        const player = this.world.getEntity(this.playerId)
        if (!player) return
        
        const transform = player.getComponent('transform') as TransformComponent
        if (!transform) return
        
        const mousePos = this.input.getMousePosition()
        
        if (this.projectiles.length < 8) {
            this.createProjectile(
                transform.position.x,
                transform.position.y,
                mousePos.x,
                mousePos.y,
                this.playerId
            )
        }
        
        this.lastAutoFireTime = currentTime
    }
    
    private createOrbitingProjectiles(): void {
        for (let i = 0; i < 3; i++) {
            const orb: OrbitingProjectile = {
                id: `orb_${i}`,
                angle: (i * 2 * Math.PI) / 3,
                orbitRadius: 60,
                rotationSpeed: 2,
                damage: 30,
                size: 8
            }
            this.orbitingProjectiles.push(orb)
        }
    }
    
    private updateOrbitingProjectiles(deltaTime: number): void {
        if (!this.playerId) return
        
        const player = this.world.getEntity(this.playerId)
        if (!player) return
        
        const playerTransform = player.getComponent('transform') as TransformComponent
        if (!playerTransform) return
        
        this.orbitingProjectiles.forEach(orb => {
            orb.angle += orb.rotationSpeed * (deltaTime / 1000)
            
            orb.x = playerTransform.position.x + Math.cos(orb.angle) * orb.orbitRadius
            orb.y = playerTransform.position.y + Math.sin(orb.angle) * orb.orbitRadius
            
            for (let j = 0; j < this.enemyIds.length; j++) {
                const enemyId = this.enemyIds[j]
                const enemy = this.world.getEntity(enemyId)
                if (!enemy) continue
                
                const enemyTransform = enemy.getComponent('transform') as TransformComponent
                const enemyHealth = enemy.getComponent('health') as HealthComponent
                
                if (!enemyTransform || !enemyHealth || enemyHealth.isDead()) continue
                
                const dx = orb.x! - enemyTransform.position.x
                const dy = orb.y! - enemyTransform.position.y
                const distanceSquared = dx * dx + dy * dy
                const hitRadiusSquared = (orb.size + 10) * (orb.size + 10)
                
                if (distanceSquared < hitRadiusSquared) {
                    const now = Date.now()
                    if (!orb.lastHitTime || now - orb.lastHitTime > 500) {
                        enemyHealth.takeDamage(orb.damage, performance.now())
                        orb.lastHitTime = now
                        
                        if (enemyHealth.isDead() && Math.random() < 0.1) {
                            console.log('Orb kill!')
                            
                            if (this.events) {
                                this.events.emit('EXPERIENCE_GAINED', {
                                    entityId: this.playerId,
                                    amount: 15,
                                    source: 'orb_kill'
                                })
                            }
                        }
                    }
                }
            }
        })
    }
    
    private renderOrbitingProjectiles(): void {
        this.orbitingProjectiles.forEach(orb => {
            if (orb.x !== undefined && orb.y !== undefined) {
                this.renderer.drawCircle(orb.x, orb.y, orb.size, '#00ffff', true)
                this.renderer.drawCircle(orb.x, orb.y, orb.size + 2, '#ffffff', false)
            }
        })
    }
    
    private renderAreaEffects(): void {
        const currentTime = Date.now()
        
        // Update and render area effects
        for (let i = this.areaEffects.length - 1; i >= 0; i--) {
            const effect = this.areaEffects[i]
            const elapsed = currentTime - effect.startTime
            
            if (elapsed > effect.duration) {
                this.areaEffects.splice(i, 1)
                continue
            }
            
            // Calculate animation progress
            const progress = elapsed / effect.duration
            effect.radius = effect.maxRadius * progress
            
            // Fade out as it expands
            const alpha = 1 - progress
            
            // Draw expanding ring
            this.ctx.strokeStyle = `rgba(255, 102, 0, ${alpha})`
            this.ctx.lineWidth = 3
            this.ctx.beginPath()
            this.ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2)
            this.ctx.stroke()
            
            // Inner glow
            this.ctx.strokeStyle = `rgba(255, 200, 0, ${alpha * 0.5})`
            this.ctx.lineWidth = 5
            this.ctx.beginPath()
            this.ctx.arc(effect.x, effect.y, effect.radius * 0.8, 0, Math.PI * 2)
            this.ctx.stroke()
        }
    }

    private createProjectile(
        fromX: number, 
        fromY: number, 
        toX: number, 
        toY: number, 
        ownerId: EntityId,
        isEnemy: boolean = false
    ): void {
        const dx = toX - fromX
        const dy = toY - fromY
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        if (distance === 0) return
        
        const dirX = dx / distance
        const dirY = dy / distance
        
        const projectile: Projectile = {
            id: Date.now() + Math.random(),
            x: fromX,
            y: fromY,
            velocityX: dirX * (isEnemy ? 300 : 600), // Enemy bullets are slower
            velocityY: dirY * (isEnemy ? 300 : 600),
            ownerId: ownerId,
            damage: isEnemy ? 10 : 25, // Enemy bullets do less damage
            lifetime: 2000,
            age: 0,
            isEnemy: isEnemy
        }
        
        this.projectiles.push(projectile)
    }
    
    private updateProjectiles(deltaTime: number): void {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i]
            
            projectile.x += projectile.velocityX * (deltaTime / 1000)
            projectile.y += projectile.velocityY * (deltaTime / 1000)
            projectile.age += deltaTime
            
            if (projectile.age > projectile.lifetime) {
                this.projectiles.splice(i, 1)
                continue
            }
            
            if (projectile.x < 0 || projectile.x > 800 || projectile.y < 0 || projectile.y > 600) {
                this.projectiles.splice(i, 1)
                continue
            }
            
            let hit = false
            
            // Check collision based on projectile type
            if (projectile.isEnemy) {
                // Enemy projectile - check collision with player
                if (this.playerId) {
                    const player = this.world.getEntity(this.playerId)
                    if (player) {
                        const playerTransform = player.getComponent('transform') as TransformComponent
                        const playerHealth = player.getComponent('health') as HealthComponent
                        
                        if (playerTransform && playerHealth && !playerHealth.isDead()) {
                            const dx = projectile.x - playerTransform.position.x
                            const dy = projectile.y - playerTransform.position.y
                            const distanceSquared = dx * dx + dy * dy
                            
                            if (distanceSquared < 225) { // 15^2 = 225
                                playerHealth.takeDamage(projectile.damage, performance.now())
                                this.projectiles.splice(i, 1)
                                hit = true
                                console.log(`Player hit by enemy projectile! Damage: ${projectile.damage}`)
                            }
                        }
                    }
                }
            } else {
                // Player projectile - check collision with enemies
                for (let j = 0; j < this.enemyIds.length && !hit; j++) {
                    const enemyId = this.enemyIds[j]
                    const enemy = this.world.getEntity(enemyId)
                    if (!enemy) continue
                    
                    const enemyTransform = enemy.getComponent('transform') as TransformComponent
                    const enemyHealth = enemy.getComponent('health') as HealthComponent
                    
                    if (!enemyTransform || !enemyHealth || enemyHealth.isDead()) continue
                    
                    const dx = projectile.x - enemyTransform.position.x
                    const dy = projectile.y - enemyTransform.position.y
                    const distanceSquared = dx * dx + dy * dy
                    
                    if (distanceSquared < 225) {
                        enemyHealth.takeDamage(projectile.damage, performance.now())
                        
                        this.projectiles.splice(i, 1)
                        hit = true
                        
                        if (enemyHealth.isDead() && Math.random() < 0.2) {
                            console.log('Enemy killed!')
                            
                            if (this.events) {
                                this.events.emit('EXPERIENCE_GAINED', {
                                    entityId: projectile.ownerId,
                                    amount: 10,
                                    source: 'enemy_kill'
                                })
                            }
                        }
                    }
                }
            }
        }
    }
    
    private renderProjectiles(): void {
        this.projectiles.forEach(projectile => {
            const color = projectile.isEnemy ? '#ff0066' : '#ffff00' // Red for enemy, yellow for player
            const size = projectile.isEnemy ? 4 : 3 // Enemy bullets slightly bigger
            this.renderer.drawCircle(projectile.x, projectile.y, size, color, true)
            
            // Add glow effect for enemy projectiles
            if (projectile.isEnemy) {
                this.renderer.drawCircle(projectile.x, projectile.y, size + 2, 'rgba(255, 0, 102, 0.3)', true)
            }
        })
    }
    
    private renderCursor(): void {
        const mousePos = this.input.getMousePosition()
        
        this.renderer.drawCrosshair(mousePos.x, mousePos.y, 8, '#fff')
        
        if (this.playerId) {
            const player = this.world.getEntity(this.playerId)
            if (player) {
                const transform = player.getComponent('transform') as TransformComponent
                if (transform) {
                    this.renderer.drawLine(
                        transform.position.x,
                        transform.position.y,
                        mousePos.x,
                        mousePos.y,
                        'rgba(255, 255, 255, 0.3)',
                        1
                    )
                }
            }
        }
    }

    private updateUI(): void {
        if (!this.playerId) return
        
        const player = this.world.getEntity(this.playerId)
        if (!player) return
        
        const health = player.getComponent('health') as HealthComponent
        const experience = player.getComponent('experience') as ExperienceComponent
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
    
    private showTestMenu(): void {
        console.clear()
        console.log('🧪 === ADVANCED FEATURES TESTING MENU ===')
        console.log('Press a number to test each feature individually:')
        console.log('1️⃣  Test Skills System')
        console.log('2️⃣  Test Enemy AI System') 
        console.log('3️⃣  Test Collection System')
        console.log('4️⃣  Test Spawning System')
        console.log('5️⃣  Test Difficulty System')
        console.log('==========================================')
    }
    
    private testSkillsSystem(): void {
        console.clear()
        console.log('🎯 === TESTING SKILLS SYSTEM ===')
        console.log('Skills System with Database Integration enabled!')
        
        const player = this.world.getEntity(this.playerId!)
        if (player) {
            console.log('🔍 Player components:', player.getComponentTypes())
            const skills = player.getComponent('skills') as SkillsComponent
            if (skills) {
                console.log('✅ Skills System is working!')
                console.log(`Player has ${skills.skills.size} skills loaded from database:`)
                Array.from(skills.skills.values()).forEach(skill => {
                    console.log(`   - ${skill.name}: ${skill.description}`)
                    console.log(`     Type: ${skill.type}, Level: ${skill.level}/${skill.maxLevel}`)
                    console.log(`     Effects: ${skill.effects.length}`)
                })
                console.log(`Active effects: ${skills.activeEffects.length}`)
                console.log('')
                console.log('🌟 Skill Database Features:')
                console.log('  - Skills loaded from DEFAULT_SKILL_DATABASE')
                console.log('  - Configurable templates with evolution paths')
                console.log('  - Automatic effect application')
                console.log('  - Skill progression and leveling')
                console.log('')
                console.log('👀 Skills should apply passive effects automatically')
                console.log('💡 Expected: Damage boost, health regen, movement speed')
                console.log('⚡ Press Space to use Area Blast active skill!')
            } else {
                console.log('❌ No skills component found')
            }
        }
        console.log('Press Q for menu, or 2/3/4/5 for other tests')
    }
    
    private testEnemyAI(): void {
        console.clear()
        console.log('🤖 === TESTING ENEMY AI SYSTEM ===')
        console.log('Enemy AI System is already enabled!')
        
        const allEnemies = this.world.getActiveEntities().filter((e: Entity) => 
            e.hasComponent('health') && e.id !== this.playerId
        )
        const enemiesWithAI = allEnemies.filter((e: Entity) => e.hasComponent('enemyAI'))
        
        console.log(`🔍 Diagnostics:`)
        console.log(`  Total enemies: ${allEnemies.length}`)
        console.log(`  Enemies with AI: ${enemiesWithAI.length}`)
        
        if (enemiesWithAI.length > 0) {
            console.log(`✅ Enemy AI System enabled!`)
            const firstEnemy = enemiesWithAI[0]
            console.log('🔍 First enemy components:', firstEnemy.getComponentTypes())
            const ai = firstEnemy.getComponent('enemyAI') as EnemyAIComponent
            if (ai) {
                console.log(`  AI state: ${ai.currentState}`)
                console.log(`  AI target: ${ai.targetEntityId}`)
                console.log(`  Player ID: ${this.playerId}`)
            }
            console.log('👀 Watch the red circles - they should start moving and changing colors')
            console.log('🎮 Move your player (green circle) around to see AI reactions')
        } else {
            console.log('❌ No enemies have AI components!')
        }
        console.log('Press Q for menu, or 1/3 for other tests')
    }
    
    private useActiveSkill(skillId: string): void {
        if (!this.playerId) return
        
        const player = this.world.getEntity(this.playerId)
        if (!player) return
        
        const skills = player.getComponent('skills') as SkillsComponent
        if (!skills) return
        
        const skill = skills.skills.get(skillId)
        if (!skill || skill.type !== SkillType.ACTIVE) {
            console.log('Skill not found or not active:', skillId)
            return
        }
        
        // Check cooldown
        const currentTime = Date.now()
        if (currentTime - skill.lastUsed < skill.cooldown) {
            const remaining = Math.ceil((skill.cooldown - (currentTime - skill.lastUsed)) / 1000)
            console.log(`Skill on cooldown! ${remaining}s remaining`)
            return
        }
        
        console.log(`🔥 Activating skill: ${skill.name}`)
        
        // For area blast, manually damage all enemies in range
        if (skillId === 'area_blast') {
            const playerTransform = player.getComponent('transform') as TransformComponent
            if (!playerTransform) return
            
            const range = 150 // Fixed range for area blast
            const damage = skill.effects[0].value
            
            // Visual effect - create expanding ring
            this.createAreaBlastEffect(playerTransform.position.x, playerTransform.position.y, range)
            
            // Damage all enemies in range
            let enemiesHit = 0
            this.enemyIds.forEach(enemyId => {
                const enemy = this.world.getEntity(enemyId)
                if (!enemy) return
                
                const enemyTransform = enemy.getComponent('transform') as TransformComponent
                const enemyHealth = enemy.getComponent('health') as HealthComponent
                
                if (!enemyTransform || !enemyHealth || enemyHealth.isDead()) return
                
                // Check distance
                const dx = enemyTransform.position.x - playerTransform.position.x
                const dy = enemyTransform.position.y - playerTransform.position.y
                const distance = Math.sqrt(dx * dx + dy * dy)
                
                if (distance <= range) {
                    enemyHealth.takeDamage(damage, currentTime)
                    enemiesHit++
                    
                    // Emit damage event
                    this.events.emit(GameEventType.DAMAGE_DEALT, {
                        attackerId: this.playerId,
                        targetId: enemyId,
                        damage: damage,
                        damageType: 'magical',
                        timestamp: currentTime
                    })
                }
            })
            
            // Update skill cooldown
            skill.lastUsed = currentTime
            
            console.log(`Area Blast hit ${enemiesHit} enemies!`)
            
            // Emit skill activated event
            this.events.emit('SKILL_ACTIVATED', {
                entityId: this.playerId,
                skillId: skillId,
                targets: enemiesHit,
                timestamp: currentTime
            })
        }
    }
    
    private createAreaBlastEffect(x: number, y: number, range: number): void {
        // Store effect data for rendering
        if (!this.areaEffects) {
            this.areaEffects = []
        }
        
        this.areaEffects.push({
            x,
            y,
            radius: 0,
            maxRadius: range,
            duration: 500, // 0.5 seconds
            startTime: Date.now(),
            color: '#ff6600'
        })
    }
    
    private testCollectionSystem(): void {
        console.clear()
        console.log('🧲 === TESTING COLLECTION SYSTEM ===')
        console.log('Collection System is already enabled!')
        
        const player = this.world.getEntity(this.playerId!)
        const collectibles = this.world.getActiveEntities().filter((e: Entity) => 
            e.hasComponent('collectible')
        )
        console.log(`🔍 Diagnostics:`)
        console.log(`  Total collectibles: ${collectibles.length}`)
        
        if (player) {
            console.log('🔍 Player components:', player.getComponentTypes())
            const magnet = player.getComponent('magnet') as MagnetComponent
            if (magnet) {
                console.log('✅ Collection System enabled!')
                console.log(`  Magnet range: ${magnet.magneticField.range}`)
                console.log(`  Magnet strength: ${magnet.magneticField.strength}`)
                console.log(`  Magnet active: ${magnet.isActive}`)
                
                if (collectibles.length > 0) {
                    const firstCollectible = collectibles[0]
                    console.log('🔍 First collectible components:', firstCollectible.getComponentTypes())
                    const collectibleComp = firstCollectible.getComponent('collectible') as CollectibleComponent
                    if (collectibleComp) {
                        console.log(`  Type: ${collectibleComp.collectibleType}`)
                        console.log(`  Rarity: ${collectibleComp.rarity}`)
                    }
                }
                
                console.log('🎮 Move near cyan circles (collectibles)')
                console.log('👀 They should move toward you and disappear when collected')
            } else {
                console.log('❌ No magnet component found on player')
            }
        }
        console.log('Press Q for menu, or 1/2/4/5 for other tests')
    }
    
    private testSpawningSystem(): void {
        console.clear()
        console.log('🌊 === TESTING SPAWNING SYSTEM ===')
        console.log('Spawning System is already enabled!')
        
        const spawners = this.world.getActiveEntities().filter((e: Entity) => 
            e.hasComponent('spawner')
        )
        
        console.log(`🔍 Diagnostics:`)
        console.log(`  Active spawners: ${spawners.length}`)
        
        if (spawners.length > 0) {
            console.log('✅ Spawning System enabled!')
            const firstSpawner = spawners[0]
            console.log('🔍 First spawner components:', firstSpawner.getComponentTypes())
            const spawnerComp = firstSpawner.getComponent('spawner') as SpawnerComponent
            if (spawnerComp) {
                console.log(`  Wave count: ${spawnerComp.waves.length}`)
                console.log(`  Pattern: ${spawnerComp.pattern}`)
                console.log(`  Max enemies: ${spawnerComp.maxEnemies}`)
                console.log(`  Active: ${spawnerComp.isActive}`)
                console.log(`  Current wave: ${spawnerComp.currentWaveIndex}`)
            }
            console.log('👀 Watch for new enemies to spawn in waves!')
            console.log('🎮 Enemies should appear at regular intervals')
        } else {
            console.log('❌ No spawners found!')
        }
        console.log('Press Q for menu, or 1/2/3/5 for other tests')
    }
    
    private testDifficultySystem(): void {
        console.clear()
        console.log('📈 === TESTING DIFFICULTY SYSTEM ===')
        console.log('Difficulty System is already enabled!')
        
        const player = this.world.getEntity(this.playerId!)
        if (player) {
            const difficulty = player.getComponent('difficulty') as DifficultyComponent
            if (difficulty) {
                console.log('✅ Difficulty System enabled!')
                console.log(`  Current level: ${difficulty.currentLevel}`)
                console.log(`  Time survived: ${difficulty.timeSurvived}ms`)
                console.log(`  Enemies killed: ${difficulty.enemiesKilled}`)
                console.log(`  Level progression rate: ${difficulty.levelProgressionRate}`)
                console.log(`  Next level threshold: ${difficulty.nextLevelThreshold}`)
                
                console.log('📊 Current modifiers:')
                difficulty.currentModifiers.forEach((modifier, index) => {
                    console.log(`    ${index + 1}. ${modifier.name}: ${modifier.value} (${modifier.type})`)
                })
                
                console.log('👀 Difficulty increases over time and with enemy kills!')
                console.log('🎮 Enemy stats will scale up as difficulty increases')
            } else {
                console.log('❌ No difficulty component found on player')
            }
        }
        console.log('Press Q for menu, or 1/2/3/4 for other tests')
    }
}

// Start the game when page loads
window.addEventListener('load', () => {
    console.log('Window loaded, starting game...')
    try {
        new GameFrontend()
    } catch (error) {
        console.error('Failed to start game:', error)
    }
})

// Also try DOMContentLoaded as a fallback
window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM content loaded')
})
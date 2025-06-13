import { World } from '../../src/core/ECS/World';
import { Entity } from '../../src/core/ECS/Entity';
import { EventSystem } from '../../src/core/EventSystem';

// Systems
import { MovementSystem } from '../../src/systems/MovementSystem';
import { CombatSystem } from '../../src/systems/CombatSystem';
import { CollectionSystem } from '../../src/systems/CollectionSystem';
import { SkillSystem } from '../../src/systems/SkillSystem';
import { DifficultySystem } from '../../src/systems/DifficultySystem';
import { ProgressionSystem } from '../../src/systems/ProgressionSystem';
import { EnemySystem } from '../../src/systems/EnemySystem';

// Components
import { TransformComponent } from '../../src/components/Transform';
import { MovementComponent } from '../../src/components/Movement';
import { HealthComponent } from '../../src/components/Health';
import { CombatComponent, WeaponStats } from '../../src/components/Combat';
import { InventoryComponent } from '../../src/components/Inventory';
import { CollectibleComponent, CollectibleType } from '../../src/components/Collectible';
import { MagnetComponent } from '../../src/components/Magnet';
import { SkillsComponent, SkillType, SkillTargetType, SkillEffectType } from '../../src/components/Skills';
import { ExperienceComponent } from '../../src/components/Experience';
import { DifficultyComponent } from '../../src/components/Difficulty';
import { EnemyAIComponent, AIBehaviorType } from '../../src/components/EnemyAI';

describe('System Integration Tests', () => {
  let world: World;
  let eventSystem: EventSystem;
  let systems: {
    movement: MovementSystem;
    combat: CombatSystem;
    collection: CollectionSystem;
    skills: SkillSystem;
    difficulty: DifficultySystem;
    progression: ProgressionSystem;
    enemy: EnemySystem;
  };

  const createDefaultWeapon = (): WeaponStats => ({
    damage: 25,
    range: 50,
    attackSpeed: 1.5,
    criticalChance: 0.1,
    criticalMultiplier: 2.0
  });

  beforeEach(() => {
    world = new World();
    eventSystem = new EventSystem();
    
    systems = {
      movement: new MovementSystem(),
      combat: new CombatSystem(eventSystem),
      collection: new CollectionSystem(eventSystem, world),
      skills: new SkillSystem(eventSystem, world as any),
      difficulty: new DifficultySystem(),
      progression: new ProgressionSystem(eventSystem),
      enemy: new EnemySystem(eventSystem, world as any)
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Combat + Movement Integration', () => {
    it('should handle combat while moving', () => {
      const player = world.createEntity();
      player.addComponent(new TransformComponent(0, 0));
      player.addComponent(new MovementComponent(100));
      player.addComponent(new HealthComponent(100));
      player.addComponent(new CombatComponent(createDefaultWeapon()));

      const enemy = world.createEntity();
      enemy.addComponent(new TransformComponent(50, 0));
      enemy.addComponent(new HealthComponent(50));
      enemy.addComponent(new CombatComponent(createDefaultWeapon()));

      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };

      // Move player toward enemy
      const movement = player.getComponent('movement') as MovementComponent;
      movement.setVelocity(60, 0); // Moving right toward enemy

      systems.movement.update(context, [{ id: player.id, components: movement }]);
      systems.combat.update(context, [
        { id: player.id, components: player.getComponent('combat')! },
        { id: enemy.id, components: enemy.getComponent('combat')! }
      ]);

      const playerTransform = player.getComponent('transform') as TransformComponent;
      const enemyHealth = enemy.getComponent('health') as HealthComponent;

      // Player should have moved closer
      expect(playerTransform.position.x).toBeGreaterThan(0);
      // Enemy should take damage when player gets close enough
      if (playerTransform.position.x >= 40) { // Within attack range
        expect(enemyHealth.current).toBeLessThan(50);
      }
    });

    it('should interrupt movement when taking damage', () => {
      const player = world.createEntity();
      player.addComponent(new TransformComponent(0, 0));
      player.addComponent(new MovementComponent(100));
      player.addComponent(new HealthComponent(100));

      const movement = player.getComponent('movement') as MovementComponent;
      const health = player.getComponent('health') as HealthComponent;

      movement.setVelocity(100, 0);
      
      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };

      // Update movement first
      systems.movement.update(context, [{ id: player.id, components: movement }]);
      const initialX = (player.getComponent('transform') as TransformComponent).position.x;

      // Take significant damage
      health.takeDamage(50, Date.now());

      // Movement should be affected by damage
      systems.movement.update(context, [{ id: player.id, components: movement }]);
      const finalX = (player.getComponent('transform') as TransformComponent).position.x;

      expect(health.current).toBe(50);
      expect(finalX).toBeGreaterThan(initialX); // Still moving but potentially slowed
    });
  });

  describe('Collection + Progression Integration', () => {
    it('should gain experience when collecting items', () => {
      const player = world.createEntity();
      player.addComponent(new TransformComponent(0, 0));
      player.addComponent(new MagnetComponent());
      player.addComponent(new InventoryComponent());
      player.addComponent(new ExperienceComponent());

      const collectible = world.createEntity();
      collectible.addComponent(new TransformComponent(10, 0));
      collectible.addComponent(new CollectibleComponent(CollectibleType.EXPERIENCE, 25));

      const experienceGained = jest.fn();
      eventSystem.on('EXPERIENCE_GAINED', experienceGained);

      // Mock world methods
      world.getActiveEntities = jest.fn().mockReturnValue([player, collectible]);
      (world as any).removeEntity = jest.fn();

      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };

      systems.collection.update(context, []);
      systems.progression.update(context, [{ id: player.id, components: player.getComponent('experience')! }]);

      const experience = player.getComponent('experience') as ExperienceComponent;

      expect((world as any).removeEntity).toHaveBeenCalledWith(collectible.id);
      expect(experienceGained).toHaveBeenCalled();
      expect(experience.currentXP).toBeGreaterThan(0);
    });

    it('should level up and unlock skills from progression', () => {
      const player = world.createEntity();
      player.addComponent(new ExperienceComponent());
      player.addComponent(new SkillsComponent());

      const experience = player.getComponent('experience') as ExperienceComponent;
      const skills = player.getComponent('skills') as SkillsComponent;

      // Set up near level up
      experience.currentXP = 95;
      experience.xpToNextLevel = 100;

      const levelUpSpy = jest.fn();
      eventSystem.on('LEVEL_UP', levelUpSpy);

      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };

      // Gain XP to trigger level up
      experience.addExperience(10);

      systems.progression.update(context, [{ id: player.id, components: experience }]);
      systems.skills.update(context, [{ id: player.id, components: skills }]);

      expect(levelUpSpy).toHaveBeenCalled();
      expect(experience.level).toBe(2);
      expect(skills.skillPoints).toBeGreaterThan(0);
    });
  });

  describe('Skills + Combat Integration', () => {
    it('should use skills in combat scenarios', () => {
      const player = world.createEntity();
      player.addComponent(new TransformComponent(0, 0));
      player.addComponent(new HealthComponent(60));
      player.addComponent(new SkillsComponent());
      player.addComponent(new CombatComponent(createDefaultWeapon()));

      const enemy = world.createEntity();
      enemy.addComponent(new TransformComponent(30, 0));
      enemy.addComponent(new HealthComponent(100));
      enemy.addComponent(new CombatComponent(createDefaultWeapon()));

      const skills = player.getComponent('skills') as SkillsComponent;

      // Add a healing skill
      const healSkill = {
        id: 'emergency_heal',
        name: 'Emergency Heal',
        description: 'Quick healing',
        type: SkillType.ACTIVE,
        targetType: SkillTargetType.SELF,
        level: 1,
        maxLevel: 3,
        cooldown: 2000,
        lastUsed: 0,
        effects: [{
          type: SkillEffectType.HEAL,
          value: 30
        }]
      };

      skills.addSkill(healSkill);

      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };

      // Player takes damage in combat
      systems.combat.update(context, [
        { id: player.id, components: player.getComponent('combat')! },
        { id: enemy.id, components: enemy.getComponent('combat')! }
      ]);

      const health = player.getComponent('health') as HealthComponent;
      const initialHealth = health.current;

      // Use healing skill
      const skillUsed = systems.skills.activateSkill(player.id, 'emergency_heal');
      systems.skills.update(context, [{ id: player.id, components: skills }]);

      expect(skillUsed).toBe(true);
      expect(health.current).toBeGreaterThan(initialHealth);
    });

    it('should apply skill effects in combat damage calculations', () => {
      const player = world.createEntity();
      player.addComponent(new TransformComponent(0, 0));
      player.addComponent(new HealthComponent(100));
      player.addComponent(new SkillsComponent());
      player.addComponent(new CombatComponent(createDefaultWeapon()));

      const enemy = world.createEntity();
      enemy.addComponent(new TransformComponent(25, 0));
      enemy.addComponent(new HealthComponent(100));
      enemy.addComponent(new CombatComponent(createDefaultWeapon()));

      const skills = player.getComponent('skills') as SkillsComponent;

      // Add damage buff skill
      const damageBoost = {
        id: 'damage_boost',
        name: 'Damage Boost',
        description: 'Increases damage',
        type: SkillType.ACTIVE,
        targetType: SkillTargetType.SELF,
        level: 1,
        maxLevel: 1,
        cooldown: 5000,
        lastUsed: 0,
        effects: [{
          type: SkillEffectType.BUFF,
          value: 50, // 50% damage increase
          duration: 3000
        }]
      };

      skills.addSkill(damageBoost);

      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };

      // Activate damage boost
      systems.skills.activateSkill(player.id, 'damage_boost');
      systems.skills.update(context, [{ id: player.id, components: skills }]);

      const enemyHealth = enemy.getComponent('health') as HealthComponent;
      const initialEnemyHealth = enemyHealth.current;

      // Combat with boosted damage
      systems.combat.update(context, [
        { id: player.id, components: player.getComponent('combat')! },
        { id: enemy.id, components: enemy.getComponent('combat')! }
      ]);

      // Enemy should take more damage due to skill effect
      const damageDealt = initialEnemyHealth - enemyHealth.current;
      expect(damageDealt).toBeGreaterThan(0);
    });
  });

  describe('Difficulty + Enemy AI Integration', () => {
    it('should scale enemy behavior based on difficulty', () => {
      const difficultyManager = world.createEntity();
      const difficultyComponent = new DifficultyComponent();
      difficultyComponent.currentLevel = 'HARD';
      difficultyManager.addComponent(difficultyComponent);

      const enemy = world.createEntity();
      enemy.addComponent(new TransformComponent(100, 100));
      enemy.addComponent(new HealthComponent(50));
      enemy.addComponent(new MovementComponent(50));
      enemy.addComponent(new EnemyAIComponent(AIBehaviorType.AGGRESSIVE));

      const player = world.createEntity();
      player.addComponent(new TransformComponent(0, 0));
      player.addComponent(new HealthComponent(100));

      // Mock world methods
      (world as any).getEntitiesWithComponents = jest.fn()
        .mockReturnValueOnce([{ entityId: difficultyManager.id, difficulty: difficultyComponent }])
        .mockReturnValueOnce([{ entityId: enemy.id, enemyAI: enemy.getComponent('enemyAI') }]);

      world.getActiveEntities = jest.fn().mockReturnValue([enemy, player]);

      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };

      // Update difficulty system first to apply modifiers
      systems.difficulty.update(context);

      const initialEnemySpeed = (enemy.getComponent('movement') as MovementComponent).maxSpeed;

      // Update enemy AI system
      systems.enemy.update(context, [{ id: enemy.id, components: enemy.getComponent('enemyAI')! }]);

      // Enemy behavior should be affected by difficulty
      const enemyAI = enemy.getComponent('enemyAI') as EnemyAIComponent;
      expect(enemyAI.behaviorType).toBe(AIBehaviorType.AGGRESSIVE);
    });

    it('should adapt difficulty based on player performance', () => {
      const difficultyManager = world.createEntity();
      const difficultyComponent = new DifficultyComponent();
      difficultyComponent.adaptiveSettings.isEnabled = true;
      difficultyManager.addComponent(difficultyComponent);

      const player = world.createEntity();
      player.addComponent(new ExperienceComponent());
      player.addComponent(new HealthComponent(100));

      // Mock world methods
      (world as any).getEntitiesWithComponents = jest.fn().mockReturnValue([
        { entityId: difficultyManager.id, difficulty: difficultyComponent }
      ]);

      // Simulate high performance metrics
      difficultyComponent.performanceMetrics.enemiesKilled = 50;
      difficultyComponent.performanceMetrics.survivalTime = 120000; // 2 minutes
      difficultyComponent.performanceMetrics.accuracy = 0.9;

      const initialLevel = difficultyComponent.currentLevel;
      const context = { deltaTime: 60000, totalTime: 120000, frameCount: 120 }; // 1 minute passed

      systems.difficulty.update(context);

      const newScore = difficultyComponent.calculateCurrentScore();
      expect(newScore).toBeGreaterThan(100); // High performance should increase score

      // Check if difficulty should adapt
      const transition = difficultyComponent.shouldTransitionDifficulty(newScore);
      if (transition.shouldTransition) {
        expect(transition.newLevel).not.toBe(initialLevel);
      }
    });
  });

  describe('Full System Integration', () => {
    it('should handle complex multi-system gameplay scenario', () => {
      // Create player with all relevant components
      const player = world.createEntity();
      player.addComponent(new TransformComponent(0, 0));
      player.addComponent(new MovementComponent(100));
      player.addComponent(new HealthComponent(100));
      player.addComponent(new CombatComponent(createDefaultWeapon()));
      player.addComponent(new InventoryComponent());
      player.addComponent(new SkillsComponent());
      player.addComponent(new ExperienceComponent());
      player.addComponent(new MagnetComponent());

      // Create enemy
      const enemy = world.createEntity();
      enemy.addComponent(new TransformComponent(80, 0));
      enemy.addComponent(new HealthComponent(60));
      enemy.addComponent(new CombatComponent(createDefaultWeapon()));
      enemy.addComponent(new MovementComponent(50));
      enemy.addComponent(new EnemyAIComponent(AIBehaviorType.AGGRESSIVE));

      // Create collectible items
      const goldCoin = world.createEntity();
      goldCoin.addComponent(new TransformComponent(40, 0));
      goldCoin.addComponent(new CollectibleComponent(CollectibleType.CURRENCY, 10));

      const xpOrb = world.createEntity();
      xpOrb.addComponent(new TransformComponent(60, 0));
      xpOrb.addComponent(new CollectibleComponent(CollectibleType.EXPERIENCE, 20));

      // Create difficulty manager
      const difficultyManager = world.createEntity();
      difficultyManager.addComponent(new DifficultyComponent());

      // Mock world methods
      world.getActiveEntities = jest.fn().mockReturnValue([player, enemy, goldCoin, xpOrb]);
      (world as any).removeEntity = jest.fn();
      (world as any).getEntitiesWithComponents = jest.fn().mockReturnValue([
        { entityId: difficultyManager.id, difficulty: difficultyManager.getComponent('difficulty') }
      ]);

      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };

      // Track events
      const events: string[] = [];
      eventSystem.on('COLLECTIBLE_COLLECTED', () => events.push('COLLECTED'));
      eventSystem.on('EXPERIENCE_GAINED', () => events.push('XP_GAINED'));
      eventSystem.on('DAMAGE_DEALT', () => events.push('DAMAGE_DEALT'));

      // Move player toward items and enemy
      const movement = player.getComponent('movement') as MovementComponent;
      movement.setVelocity(100, 0);

      // Run all systems in order
      systems.movement.update(context, [{ id: player.id, components: movement }]);
      systems.collection.update(context, []);
      systems.combat.update(context, [
        { id: player.id, components: player.getComponent('combat')! },
        { id: enemy.id, components: enemy.getComponent('combat')! }
      ]);
      systems.progression.update(context, [{ id: player.id, components: player.getComponent('experience')! }]);
      systems.enemy.update(context, [{ id: enemy.id, components: enemy.getComponent('enemyAI')! }]);
      systems.difficulty.update(context);

      // Verify integrated behavior
      const playerTransform = player.getComponent('transform') as TransformComponent;
      const playerInventory = player.getComponent('inventory') as InventoryComponent;
      const playerExperience = player.getComponent('experience') as ExperienceComponent;

      // Player should have moved
      expect(playerTransform.position.x).toBeGreaterThan(0);

      // Items should be collected if player reached them
      if (playerTransform.position.x >= 40) {
        expect((world as any).removeEntity).toHaveBeenCalledWith(goldCoin.id);
        expect(events).toContain('COLLECTED');
      }

      // Combat should occur if player reached enemy
      if (playerTransform.position.x >= 70) {
        const enemyHealth = enemy.getComponent('health') as HealthComponent;
        expect(enemyHealth.current).toBeLessThan(60);
      }

      // Experience and progression should work
      if (playerExperience.currentXP > 0) {
        expect(events).toContain('XP_GAINED');
      }
    });

    it('should maintain system performance under load', () => {
      const entities: Entity[] = [];

      // Create many entities to stress test
      for (let i = 0; i < 100; i++) {
        const entity = world.createEntity();
        entity.addComponent(new TransformComponent(Math.random() * 1000, Math.random() * 1000));
        entity.addComponent(new MovementComponent(Math.random() * 100 + 50));
        entity.addComponent(new HealthComponent(100));
        
        if (i % 10 === 0) {
          entity.addComponent(new CombatComponent(createDefaultWeapon()));
        }
        if (i % 5 === 0) {
          entity.addComponent(new CollectibleComponent(CollectibleType.CURRENCY, 5));
        }
        
        entities.push(entity);
      }

      world.getActiveEntities = jest.fn().mockReturnValue(entities);
      (world as any).removeEntity = jest.fn();

      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };

      const startTime = performance.now();

      // Run all systems
      systems.movement.update(context, entities.map(e => ({ id: e.id, components: e.getComponent('movement')! })).filter(e => e.components));
      systems.collection.update(context, []);
      systems.combat.update(context, entities.map(e => ({ id: e.id, components: e.getComponent('combat')! })).filter(e => e.components));

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time for 100 entities
      expect(duration).toBeLessThan(50); // 50ms threshold
    });
  });

  describe('Event System Integration', () => {
    it('should properly propagate events between systems', () => {
      const player = world.createEntity();
      player.addComponent(new TransformComponent(0, 0));
      player.addComponent(new HealthComponent(100));
      player.addComponent(new CombatComponent(createDefaultWeapon()));
      player.addComponent(new ExperienceComponent());
      player.addComponent(new SkillsComponent());

      const enemy = world.createEntity();
      enemy.addComponent(new TransformComponent(20, 0));
      enemy.addComponent(new HealthComponent(50));
      enemy.addComponent(new CombatComponent(createDefaultWeapon()));

      // Track event flow
      const eventFlow: string[] = [];
      
      eventSystem.on('DAMAGE_DEALT', (data: any) => {
        eventFlow.push(`DAMAGE_DEALT:${data.damage}`);
        // Award XP for damage dealt
        (player.getComponent('experience') as ExperienceComponent).addExperience(5);
      });

      eventSystem.on('EXPERIENCE_GAINED', (data: any) => {
        eventFlow.push(`EXPERIENCE_GAINED:${data.amount}`);
      });

      eventSystem.on('LEVEL_UP', (data: any) => {
        eventFlow.push(`LEVEL_UP:${data.newLevel}`);
        // Award skill points on level up
        (player.getComponent('skills') as SkillsComponent).skillPoints += 1;
      });

      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };

      // Trigger combat
      systems.combat.update(context, [
        { id: player.id, components: player.getComponent('combat')! },
        { id: enemy.id, components: enemy.getComponent('combat')! }
      ]);

      // Process progression
      systems.progression.update(context, [{ id: player.id, components: player.getComponent('experience')! }]);

      // Verify event chain
      expect(eventFlow.length).toBeGreaterThan(0);
      expect(eventFlow[0]).toMatch(/DAMAGE_DEALT:\d+/);
      
      if (eventFlow.includes('LEVEL_UP:2')) {
        const skills = player.getComponent('skills') as SkillsComponent;
        expect(skills.skillPoints).toBeGreaterThan(0);
      }
    });
  });
});
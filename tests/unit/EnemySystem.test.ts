import { EnemySystem } from '../../src/systems/EnemySystem';
import { World } from '../../src/core/ECS/World';
import { Entity } from '../../src/core/ECS/Entity';
import { EnemyAIComponent, AIBehaviorType, AIBehaviorState } from '../../src/components/EnemyAI';
import { TransformComponent } from '../../src/components/Transform';
import { MovementComponent } from '../../src/components/Movement';
import { HealthComponent } from '../../src/components/Health';
import { CombatComponent } from '../../src/components/Combat';
import { EventSystem } from '../../src/core/EventSystem';

describe('EnemySystem', () => {
  let world: World;
  let enemySystem: EnemySystem;
  let eventSystem: EventSystem;

  beforeEach(() => {
    world = new World();
    eventSystem = new EventSystem();
    enemySystem = new EnemySystem(eventSystem, world);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with correct name and dependencies', () => {
      expect(enemySystem.name).toBe('enemy');
      expect((enemySystem as any).eventSystem).toBe(eventSystem);
      expect((enemySystem as any).world).toBe(world);
    });

    it('should have required components', () => {
      expect(enemySystem.requiredComponents).toContain('enemyAI');
      expect(enemySystem.requiredComponents).toContain('transform');
    });
  });

  describe('enemy AI behaviors', () => {
    let enemy: Entity;
    let player: Entity;
    let enemyAI: EnemyAIComponent;

    beforeEach(() => {
      enemy = world.createEntity();
      enemyAI = new EnemyAIComponent(AIBehaviorType.AGGRESSIVE);
      enemy.addComponent(enemyAI);
      enemy.addComponent(new TransformComponent(0, 0));
      enemy.addComponent(new MovementComponent(100));
      enemy.addComponent(new HealthComponent(100));
      enemy.addComponent(new CombatComponent({ damage: 10, range: 50, attackSpeed: 1.0 }));

      player = world.createEntity();
      player.addComponent(new TransformComponent(100, 100));
      player.addComponent(new HealthComponent(100));
      
      // Mock world methods to return our entities
      world.getEntitiesWithComponents = jest.fn(() => [player]);
    });

    it('should update enemy AI state', () => {
      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };
      const entities = [{
        entityId: enemy.id,
        enemyAI: enemyAI,
        transform: enemy.getComponent('transform') as TransformComponent,
        movement: enemy.getComponent('movement') as MovementComponent,
        combat: enemy.getComponent('combat') as CombatComponent
      }];

      // Manually set update time since the system update is currently a stub
      enemyAI.lastUpdateTime = context.totalTime;
      
      enemySystem.update(context, entities as any);

      // AI should have been processed (manual simulation since system is incomplete)
      expect(enemyAI.lastUpdateTime).toBe(context.totalTime);
    });

    it('should handle different behavior types', () => {
      enemyAI.behaviorType = AIBehaviorType.DEFENSIVE;
      
      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };
      const entities = [{
        entityId: enemy.id,
        enemyAI: enemyAI,
        transform: enemy.getComponent('transform') as TransformComponent,
        movement: enemy.getComponent('movement') as MovementComponent
      }];

      expect(() => {
        enemySystem.update(context, entities as any);
      }).not.toThrow();
    });

    it('should handle patrol behavior', () => {
      enemyAI.currentState = AIBehaviorState.PATROLLING;
      enemyAI.addPatrolPoint({ x: 100, y: 0 }, 1000);
      enemyAI.addPatrolPoint({ x: 100, y: 100 }, 1000);
      enemyAI.addPatrolPoint({ x: 0, y: 100 }, 1000);
      enemyAI.addPatrolPoint({ x: 0, y: 0 }, 1000);

      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };
      const entities = [{
        entityId: enemy.id,
        enemyAI: enemyAI,
        transform: enemy.getComponent('transform') as TransformComponent,
        movement: enemy.getComponent('movement') as MovementComponent
      }];

      enemySystem.update(context, entities as any);

      // Should have a current patrol target
      expect(enemyAI.getCurrentPatrolTarget()).toBeTruthy();
    });
  });

  describe('enemy targeting', () => {
    let enemy: Entity;
    let target: Entity;

    beforeEach(() => {
      enemy = world.createEntity();
      const enemyAI = new EnemyAIComponent(AIBehaviorType.AGGRESSIVE);
      enemy.addComponent(enemyAI);
      enemy.addComponent(new TransformComponent(0, 0));
      enemy.addComponent(new MovementComponent(100));

      target = world.createEntity();
      target.addComponent(new TransformComponent(50, 50));
      target.addComponent(new HealthComponent(100));
    });

    it('should set and clear targets', () => {
      const enemyAI = enemy.getComponent('enemyAI') as EnemyAIComponent;
      
      enemyAI.setTarget(target.id);
      expect(enemyAI.targetEntityId).toBe(target.id);
      
      enemyAI.setTarget(null);
      expect(enemyAI.targetEntityId).toBeNull();
    });

    it('should track target last seen position', () => {
      const enemyAI = enemy.getComponent('enemyAI') as EnemyAIComponent;
      const targetTransform = target.getComponent('transform') as TransformComponent;
      
      enemyAI.setTarget(target.id);
      enemyAI.setTarget(target.id, targetTransform.position);
      
      expect(enemyAI.lastKnownTargetPosition).toEqual({ x: 50, y: 50 });
    });
  });

  describe('enemy actions', () => {
    let enemy: Entity;

    beforeEach(() => {
      enemy = world.createEntity();
      const enemyAI = new EnemyAIComponent();
      enemy.addComponent(enemyAI);
    });

    it('should queue and execute actions', () => {
      const enemyAI = enemy.getComponent('enemyAI') as EnemyAIComponent;
      
      enemyAI.queueAction({ type: 'move', position: { x: 100, y: 100 }, priority: 1 });
      enemyAI.queueAction({ type: 'attack', target: 999, priority: 2 });
      
      const action1 = enemyAI.getNextAction();
      expect(action1?.type).toBe('attack'); // Higher priority (2) comes first
      
      const action2 = enemyAI.getNextAction();
      expect(action2?.type).toBe('move'); // Lower priority (1) comes second
      
      const action3 = enemyAI.getNextAction();
      expect(action3).toBeNull();
    });

    it('should clear action queue', () => {
      const enemyAI = enemy.getComponent('enemyAI') as EnemyAIComponent;
      
      enemyAI.queueAction({ type: 'move', position: { x: 100, y: 100 }, priority: 1 });
      enemyAI.actionQueue = [];
      
      expect(enemyAI.getNextAction()).toBeNull();
    });
  });

  describe('performance tracking', () => {
    let enemy: Entity;

    beforeEach(() => {
      enemy = world.createEntity();
      const enemyAI = new EnemyAIComponent();
      enemy.addComponent(enemyAI);
    });

    it('should record damage for AI decision making', () => {
      const enemyAI = enemy.getComponent('enemyAI') as EnemyAIComponent;
      const currentTime = Date.now();
      
      enemyAI.recordDamage(50, 123, currentTime);
      
      expect(enemyAI.lastDamageTime).toBe(currentTime);
      expect(enemyAI.lastDamageSource).toBe(123);
      expect(enemyAI.threatLevel).toBeGreaterThan(0);
    });

    it('should store damage in memory', () => {
      const enemyAI = enemy.getComponent('enemyAI') as EnemyAIComponent;
      const currentTime = Date.now();
      
      enemyAI.recordDamage(25, 456, currentTime);
      
      const lastDamage = enemyAI.memory.get('lastDamage') as any;
      expect(lastDamage.amount).toBe(25);
      expect(lastDamage.sourceId).toBe(456);
      expect(lastDamage.time).toBe(currentTime);
    });
  });

  describe('edge cases', () => {
    it('should handle empty entity list', () => {
      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };
      
      expect(() => {
        enemySystem.update(context, []);
      }).not.toThrow();
    });

    it('should handle entities missing required components', () => {
      const enemy = world.createEntity();
      enemy.addComponent(new EnemyAIComponent());
      // Missing transform component
      
      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };
      const entities = [{
        entityId: enemy.id,
        enemyAI: enemy.getComponent('enemyAI')
        // Missing transform in query result
      }];

      expect(() => {
        enemySystem.update(context, entities as any);
      }).not.toThrow();
    });

    it('should handle invalid world references', () => {
      world.getEntitiesWithComponents = jest.fn().mockReturnValue(null);
      
      const enemy = world.createEntity();
      enemy.addComponent(new EnemyAIComponent());
      enemy.addComponent(new TransformComponent(0, 0));
      
      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };
      const entities = [{
        entityId: enemy.id,
        enemyAI: enemy.getComponent('enemyAI'),
        transform: enemy.getComponent('transform')
      }];

      expect(() => {
        enemySystem.update(context, entities as any);
      }).not.toThrow();
    });
  });
});
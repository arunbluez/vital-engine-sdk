import { CombatSystem } from '../../src/systems/CombatSystem';
import { World } from '../../src/core/ECS/World';
import { Entity } from '../../src/core/ECS/Entity';
import { HealthComponent } from '../../src/components/Health';
import { CombatComponent, WeaponStats } from '../../src/components/Combat';
import { TransformComponent } from '../../src/components/Transform';
import { EventSystem } from '../../src/core/EventSystem';
import { GameEventType } from '../../src/types/Events';

describe('CombatSystem', () => {
  let world: World;
  let combatSystem: CombatSystem;
  let eventSystem: EventSystem;

  beforeEach(() => {
    world = new World();
    eventSystem = new EventSystem();
    combatSystem = new CombatSystem(eventSystem, world);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createCombatQuery = (entity: Entity): any => ({
    id: entity.id,
    components: {
      transform: entity.getComponent('transform'),
      combat: entity.getComponent('combat')
    }
  });

  describe('initialization', () => {
    it('should initialize with correct name and dependencies', () => {
      expect(combatSystem.name).toBe('combat');
      expect((combatSystem as any).eventSystem).toBe(eventSystem);
      expect((combatSystem as any).world).toBe(world);
    });
  });

  describe('combat mechanics', () => {
    let attacker: Entity;
    let target: Entity;
    let attackerWeapon: WeaponStats;
    let targetWeapon: WeaponStats;

    beforeEach(() => {
      attacker = world.createEntity();
      target = world.createEntity();

      attackerWeapon = {
        damage: 10,
        range: 50,
        attackSpeed: 1.0
      };

      targetWeapon = {
        damage: 5,
        range: 50,
        attackSpeed: 1.0
      };

      attacker.addComponent(new HealthComponent(100));
      attacker.addComponent(new CombatComponent(attackerWeapon));
      attacker.addComponent(new TransformComponent(0, 0));

      target.addComponent(new HealthComponent(100));
      target.addComponent(new CombatComponent(targetWeapon));
      target.addComponent(new TransformComponent(30, 0));
    });

    it('should deal damage when attacking within range', () => {
      const attackerCombat = attacker.getComponent('combat') as CombatComponent;
      const targetHealth = target.getComponent('health') as HealthComponent;

      attackerCombat.setTarget(target.id);

      // Simulate update cycle (use enough time to pass cooldown)
      const context = { deltaTime: 16, totalTime: 1100, frameCount: 1 };
      combatSystem.update(context, [createCombatQuery(attacker)]);

      // Check if damage was dealt
      expect(targetHealth.current).toBeLessThan(100);
    });

    it('should not attack if target is out of range', () => {
      const attackerCombat = attacker.getComponent('combat') as CombatComponent;
      const targetHealth = target.getComponent('health') as HealthComponent;
      const targetTransform = target.getComponent('transform') as TransformComponent;

      // Move target out of range
      targetTransform.setPosition(100, 0);
      attackerCombat.setTarget(target.id);

      const context = { deltaTime: 16, totalTime: 1100, frameCount: 1 };
      combatSystem.update(context, [createCombatQuery(attacker)]);

      expect(targetHealth.current).toBe(100);
    });

    it('should respect attack cooldown', () => {
      const attackerCombat = attacker.getComponent('combat') as CombatComponent;
      const targetHealth = target.getComponent('health') as HealthComponent;

      attackerCombat.setTarget(target.id);

      // First attack
      const context1 = { deltaTime: 16, totalTime: 16, frameCount: 1 };
      combatSystem.update(context1, [createCombatQuery(attacker)]);
      const healthAfterFirst = targetHealth.current;

      // Immediate second update (should not attack due to cooldown)
      const context2 = { deltaTime: 16, totalTime: 32, frameCount: 2 };
      combatSystem.update(context2, [createCombatQuery(attacker)]);
      
      expect(targetHealth.current).toBe(healthAfterFirst);

      // Wait for cooldown and attack again
      const context3 = { deltaTime: 1100, totalTime: 1132, frameCount: 3 };
      combatSystem.update(context3, [createCombatQuery(attacker)]);
      
      expect(targetHealth.current).toBeLessThan(healthAfterFirst);
    });

    it('should emit damage events', () => {
      const damageSpy = jest.fn();
      eventSystem.on(GameEventType.DAMAGE_DEALT, damageSpy);

      const attackerCombat = attacker.getComponent('combat') as CombatComponent;
      attackerCombat.setTarget(target.id);

      const context = { deltaTime: 16, totalTime: 1100, frameCount: 1 };
      combatSystem.update(context, [createCombatQuery(attacker)]);

      expect(damageSpy).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          sourceId: attacker.id,
          targetId: target.id,
          damage: expect.any(Number)
        })
      }));
    });

    it('should emit entity killed event when target dies', () => {
      const killSpy = jest.fn();
      eventSystem.on(GameEventType.ENTITY_KILLED, killSpy);

      const attackerCombat = attacker.getComponent('combat') as CombatComponent;
      const targetHealth = target.getComponent('health') as HealthComponent;
      
      // Set target health low
      targetHealth.takeDamage(95);
      attackerCombat.setTarget(target.id);

      const context = { deltaTime: 16, totalTime: 1100, frameCount: 1 };
      combatSystem.update(context, [createCombatQuery(attacker)]);

      expect(killSpy).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          killerId: attacker.id,
          entityId: target.id
        })
      }));
    });
  });

  describe('critical hits', () => {
    it('should calculate critical damage correctly', () => {
      const attacker = world.createEntity();
      const target = world.createEntity();

      const weapon: WeaponStats = {
        damage: 10,
        range: 50,
        attackSpeed: 1.0,
        criticalChance: 1.0, // 100% crit chance for testing
        criticalMultiplier: 2.0
      };

      attacker.addComponent(new CombatComponent(weapon));
      attacker.addComponent(new TransformComponent(0, 0));
      attacker.addComponent(new HealthComponent(100));

      target.addComponent(new HealthComponent(100));
      target.addComponent(new TransformComponent(30, 0));

      const attackerCombat = attacker.getComponent('combat') as CombatComponent;
      const targetHealth = target.getComponent('health') as HealthComponent;

      attackerCombat.setTarget(target.id);

      const context = { deltaTime: 16, totalTime: 1100, frameCount: 1 };
      combatSystem.update(context, [createCombatQuery(attacker)]);

      // Should deal critical damage (20 instead of 10)
      expect(targetHealth.current).toBe(80);
    });
  });

  describe('auto-attack behavior', () => {
    it('should auto-attack when enabled', () => {
      const attacker = world.createEntity();
      const target = world.createEntity();

      const weapon: WeaponStats = {
        damage: 10,
        range: 50,
        attackSpeed: 2.0 // 2 attacks per second
      };

      attacker.addComponent(new CombatComponent(weapon, true)); // auto-attack enabled
      attacker.addComponent(new TransformComponent(0, 0));
      attacker.addComponent(new HealthComponent(100));

      target.addComponent(new HealthComponent(100));
      target.addComponent(new TransformComponent(30, 0));

      const attackerCombat = attacker.getComponent('combat') as CombatComponent;
      attackerCombat.setTarget(target.id);

      // Simulate multiple updates
      let totalTime = 0;
      for (let i = 0; i < 5; i++) {
        totalTime += 600;
        const context = { deltaTime: 600, totalTime, frameCount: i + 1 };
        combatSystem.update(context, [createCombatQuery(attacker)]);
      }

      const targetHealth = target.getComponent('health') as HealthComponent;
      expect(targetHealth.current).toBeLessThan(100);
    });

    it('should not auto-attack when disabled', () => {
      const attacker = world.createEntity();
      const target = world.createEntity();

      const weapon: WeaponStats = {
        damage: 10,
        range: 50,
        attackSpeed: 1.0
      };

      attacker.addComponent(new CombatComponent(weapon, false)); // auto-attack disabled
      attacker.addComponent(new TransformComponent(0, 0));
      attacker.addComponent(new HealthComponent(100));

      target.addComponent(new HealthComponent(100));
      target.addComponent(new TransformComponent(30, 0));

      const attackerCombat = attacker.getComponent('combat') as CombatComponent;
      attackerCombat.setTarget(target.id);

      const context = { deltaTime: 16, totalTime: 1100, frameCount: 1 };
      combatSystem.update(context, [createCombatQuery(attacker)]);

      const targetHealth = target.getComponent('health') as HealthComponent;
      expect(targetHealth.current).toBe(100); // No damage without manual attack
    });
  });

  describe('weapon updates', () => {
    it('should update weapon stats dynamically', () => {
      const attacker = world.createEntity();
      const initialWeapon: WeaponStats = {
        damage: 10,
        range: 50,
        attackSpeed: 1.0
      };

      attacker.addComponent(new CombatComponent(initialWeapon));
      const combat = attacker.getComponent('combat') as CombatComponent;

      combat.updateWeapon({ damage: 20 });
      expect(combat.weapon.damage).toBe(20);
      expect(combat.weapon.range).toBe(50); // Unchanged
    });
  });

  describe('edge cases', () => {
    it('should handle missing components gracefully', () => {
      const attacker = world.createEntity();
      attacker.addComponent(new CombatComponent({ damage: 10, range: 50, attackSpeed: 1.0 }));
      // Missing transform and health

      expect(() => {
        const context = { deltaTime: 16, totalTime: 1100, frameCount: 1 };
        combatSystem.update(context, [createCombatQuery(attacker)]);
      }).not.toThrow();
    });

    it('should handle invalid targets', () => {
      const attacker = world.createEntity();
      attacker.addComponent(new CombatComponent({ damage: 10, range: 50, attackSpeed: 1.0 }));
      attacker.addComponent(new TransformComponent(0, 0));
      attacker.addComponent(new HealthComponent(100));

      const combat = attacker.getComponent('combat') as CombatComponent;
      combat.setTarget(999); // Non-existent entity

      expect(() => {
        const context = { deltaTime: 16, totalTime: 1100, frameCount: 1 };
        combatSystem.update(context, [createCombatQuery(attacker)]);
      }).not.toThrow();
    });

    it('should handle self-targeting', () => {
      const attacker = world.createEntity();
      attacker.addComponent(new CombatComponent({ damage: 10, range: 50, attackSpeed: 1.0 }));
      attacker.addComponent(new TransformComponent(0, 0));
      attacker.addComponent(new HealthComponent(100));

      const combat = attacker.getComponent('combat') as CombatComponent;
      combat.setTarget(attacker.id);

      const context = { deltaTime: 16, totalTime: 1100, frameCount: 1 };
      combatSystem.update(context, [createCombatQuery(attacker)]);

      const health = attacker.getComponent('health') as HealthComponent;
      expect(health.current).toBe(100); // Should not damage self
    });
  });
});
import { ProgressionSystem } from '../../src/systems/ProgressionSystem';
import { World } from '../../src/core/ECS/World';
import { Entity } from '../../src/core/ECS/Entity';
import { ExperienceComponent } from '../../src/components/Experience';
import { HealthComponent } from '../../src/components/Health';
import { CombatComponent, WeaponStats } from '../../src/components/Combat';
import { EventSystem } from '../../src/core/EventSystem';
import { GameEventType } from '../../src/types/Events';

describe('ProgressionSystem', () => {
  let world: World;
  let progressionSystem: ProgressionSystem;
  let eventSystem: EventSystem;

  beforeEach(() => {
    world = new World();
    eventSystem = new EventSystem();
    progressionSystem = new ProgressionSystem(eventSystem, world);
    progressionSystem.initialize();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with correct name and dependencies', () => {
      expect(progressionSystem.name).toBe('progression');
      expect((progressionSystem as any).eventSystem).toBe(eventSystem);
      expect((progressionSystem as any).world).toBe(world);
    });

    it('should register event listeners', () => {
      const onSpy = jest.spyOn(eventSystem, 'on');
      const newSystem = new ProgressionSystem(eventSystem, world);
      newSystem.initialize();

      expect(onSpy).toHaveBeenCalledWith(GameEventType.ENTITY_KILLED, expect.any(Function));
    });
  });

  describe('experience system', () => {
    let player: Entity;
    let experience: ExperienceComponent;

    beforeEach(() => {
      player = world.createEntity();
      experience = new ExperienceComponent(1);
      player.addComponent(experience);
    });

    it('should add experience points', () => {
      const initialXP = experience.totalXP;
      const levels = experience.addExperience(150);

      expect(experience.totalXP).toBe(initialXP + 150);
      expect(levels.length).toBeGreaterThan(0); // Should level up
      expect(experience.level).toBe(2);
    });

    it('should calculate XP to next level correctly', () => {
      experience.setLevel(5);
      const xpNeeded = experience.getXPToNextLevel();

      // Formula: 100 * level^1.5
      const expected = 100 * Math.pow(6, 1.5) - experience.currentXP;
      expect(xpNeeded).toBeCloseTo(expected, 1);
    });

    it('should track level progress', () => {
      experience.addExperience(50);
      const progress = experience.getLevelProgress();

      expect(progress).toBeGreaterThan(0);
      expect(progress).toBeLessThan(1);
    });

    it('should handle multiple level ups', () => {
      const levels = experience.addExperience(1000);

      expect(levels.length).toBeGreaterThan(1);
      expect(experience.level).toBeGreaterThan(2);
    });
  });

  describe('kill experience rewards', () => {
    let player: Entity;
    let enemy: Entity;

    beforeEach(() => {
      player = world.createEntity();
      player.addComponent(new ExperienceComponent(1));

      enemy = world.createEntity();
    });

    it('should award experience for kills', () => {
      const experienceSpy = jest.fn();
      eventSystem.on(GameEventType.EXPERIENCE_GAINED, experienceSpy);

      eventSystem.emit(GameEventType.ENTITY_KILLED, {
        killerEntityId: player.id,
        victimEntityId: enemy.id,
        victimType: 'enemy_goblin'
      });

      expect(experienceSpy).toHaveBeenCalledWith({
        entityId: player.id,
        amount: expect.any(Number),
        source: 'combat',
        sourceDetails: { enemyType: 'enemy_goblin' }
      });
    });

    it('should scale experience based on enemy type', () => {
      const experienceSpy = jest.fn();
      eventSystem.on(GameEventType.EXPERIENCE_GAINED, experienceSpy);

      // Regular enemy
      eventSystem.emit(GameEventType.ENTITY_KILLED, {
        killerEntityId: player.id,
        victimEntityId: enemy.id,
        victimType: 'enemy_goblin'
      });

      const regularXP = experienceSpy.mock.calls[0][0].amount;

      // Boss enemy
      eventSystem.emit(GameEventType.ENTITY_KILLED, {
        killerEntityId: player.id,
        victimEntityId: enemy.id,
        victimType: 'boss_dragon'
      });

      const bossXP = experienceSpy.mock.calls[1][0].amount;

      expect(bossXP).toBeGreaterThan(regularXP);
    });
  });

  describe('level up events', () => {
    let player: Entity;

    beforeEach(() => {
      player = world.createEntity();
      player.addComponent(new ExperienceComponent(1));
      player.addComponent(new HealthComponent(100));
      player.addComponent(new CombatComponent({ damage: 10, range: 50, attackSpeed: 1.0 }));
    });

    it('should emit level up event', () => {
      const levelUpSpy = jest.fn();
      eventSystem.on(GameEventType.LEVEL_UP, levelUpSpy);

      const experience = player.getComponent('experience') as ExperienceComponent;
      experience.addExperience(200);

      // Process level ups
      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };
      progressionSystem.update(context, []);

      expect(levelUpSpy).toHaveBeenCalledWith({
        entityId: player.id,
        newLevel: 2,
        previousLevel: 1
      });
    });

    it('should increase stats on level up', () => {
      const health = player.getComponent('health') as HealthComponent;
      const combat = player.getComponent('combat') as CombatComponent;

      const initialMaxHealth = health.maximum;
      const initialDamage = combat.weapon.damage;

      const experience = player.getComponent('experience') as ExperienceComponent;
      experience.addExperience(200);

      // Process level ups
      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };
      progressionSystem.update(context, []);

      // Stats should increase
      expect(health.maximum).toBeGreaterThan(initialMaxHealth);
      expect(combat.weapon.damage).toBeGreaterThan(initialDamage);
    });
  });

  describe('edge cases', () => {
    it('should handle entities without experience component', () => {
      const entity = world.createEntity();

      expect(() => {
        eventSystem.emit(GameEventType.ENTITY_KILLED, {
          killerEntityId: entity.id,
          victimEntityId: 999,
          victimType: 'enemy_goblin'
        });
      }).not.toThrow();
    });

    it('should handle invalid entity IDs', () => {
      expect(() => {
        eventSystem.emit(GameEventType.ENTITY_KILLED, {
          killerEntityId: 999,
          victimEntityId: 998,
          victimType: 'enemy_goblin'
        });
      }).not.toThrow();
    });

    it('should handle negative experience values gracefully', () => {
      const player = world.createEntity();
      const experience = new ExperienceComponent(5);
      player.addComponent(experience);

      // Try to add negative experience
      const levels = experience.addExperience(-100);

      expect(levels).toEqual([]);
      expect(experience.level).toBe(5); // Level unchanged
    });
  });
});
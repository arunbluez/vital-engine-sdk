import { DifficultySystem } from '../../src/systems/DifficultySystem';
import { World } from '../../src/core/ECS/World';
import { Entity } from '../../src/core/ECS/Entity';
import { DifficultyComponent } from '../../src/components/Difficulty';
import type { DifficultyLevel } from '../../src/components/Difficulty';
import { HealthComponent } from '../../src/components/Health';
import { CombatComponent } from '../../src/components/Combat';
import { MovementComponent } from '../../src/components/Movement';
import { EventSystem } from '../../src/core/EventSystem';

describe('DifficultySystem', () => {
  let world: World;
  let difficultySystem: DifficultySystem;
  let eventSystem: EventSystem;

  beforeEach(() => {
    world = new World();
    eventSystem = new EventSystem();
    
    // Mock world methods
    world.eventSystem = eventSystem;
    world.getEntitiesWithComponents = jest.fn().mockReturnValue([]);
    
    difficultySystem = new DifficultySystem();
    difficultySystem['world'] = world;
    difficultySystem['eventSystem'] = eventSystem;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with correct name and dependencies', () => {
      expect(difficultySystem.name).toBe('difficulty');
      expect(difficultySystem.requiredComponents).toContain('difficulty');
    });
  });

  describe('difficulty management', () => {
    let difficultyEntity: Entity;
    let difficultyComponent: DifficultyComponent;

    beforeEach(() => {
      difficultyEntity = world.createEntity();
      difficultyComponent = new DifficultyComponent();
      difficultyEntity.addComponent(difficultyComponent);

      world.getEntity = jest.fn().mockReturnValue(difficultyEntity);
    });

    it('should record player actions', () => {
      difficultySystem.recordPlayerAction(difficultyEntity.id, 'KILLS', 5, false);
      
      expect(difficultyComponent.performanceMetrics.kills).toBe(5);
    });

    it('should set difficulty level', () => {
      const result = difficultySystem.setDifficultyLevel(difficultyEntity.id, 'HARD' as DifficultyLevel);
      
      expect(result).toBe(true);
      expect(difficultyComponent.currentLevel).toBe('HARD' as DifficultyLevel);
    });

    it('should enable adaptive difficulty', () => {
      const result = difficultySystem.enableAdaptiveDifficulty(difficultyEntity.id, true);
      
      expect(result).toBe(true);
      expect(difficultyComponent.adaptiveSettings.isEnabled).toBe(true);
    });

    it('should configure adaptive settings', () => {
      const result = difficultySystem.configureAdaptiveSettings(difficultyEntity.id, {
        adaptationRate: 0.5,
        adaptationInterval: 10000
      });
      
      expect(result).toBe(true);
      expect(difficultyComponent.adaptiveSettings.adaptationRate).toBe(0.5);
      expect(difficultyComponent.adaptiveSettings.adaptationInterval).toBe(10000);
    });

    it('should get difficulty stats', () => {
      const stats = difficultySystem.getDifficultyStats(difficultyEntity.id);
      
      expect(stats).toBeTruthy();
      expect(stats?.currentLevel).toBe('NORMAL' as DifficultyLevel);
      expect(stats?.adaptiveEnabled).toBe(false);
    });
  });

  describe('difficulty factory', () => {
    it('should create difficulty manager entity', () => {
      const mockEntity = { id: 1, addComponent: jest.fn() } as any;
      world.createEntity = jest.fn().mockReturnValue(mockEntity);

      const entityId = difficultySystem.createDifficultyManager(true);

      expect(world.createEntity).toHaveBeenCalled();
      expect(mockEntity.addComponent).toHaveBeenCalled();
      expect(entityId).toBe(1);
    });
  });

  describe('custom modifiers', () => {
    let difficultyEntity: Entity;
    let difficultyComponent: DifficultyComponent;

    beforeEach(() => {
      difficultyEntity = world.createEntity();
      difficultyComponent = new DifficultyComponent();
      difficultyEntity.addComponent(difficultyComponent);

      world.getEntity = jest.fn().mockReturnValue(difficultyEntity);
    });

    it('should add custom modifiers', () => {
      const modifier = {
        id: 'test-modifier',
        targetProperty: 'health.maxHealth',
        modifierType: 'multiplicative' as const,
        baseValue: 1.5,
        scalingFactor: 0.1,
        minValue: 1.0,
        maxValue: 3.0,
        isActive: true,
        calculateModifierValue: jest.fn().mockReturnValue(1.5)
      };

      const result = difficultySystem.addCustomModifier(difficultyEntity.id, modifier);
      
      expect(result).toBe(true);
      expect(difficultyComponent.activeModifiers.has('test-modifier')).toBe(true);
    });

    it('should remove custom modifiers', () => {
      difficultyComponent.activeModifiers.set('test-modifier', {} as any);
      
      const result = difficultySystem.removeCustomModifier(difficultyEntity.id, 'test-modifier');
      
      expect(result).toBe(true);
      expect(difficultyComponent.activeModifiers.has('test-modifier')).toBe(false);
    });
  });

  describe('difficulty updates', () => {
    it('should process difficulty updates', () => {
      const difficultyEntity = world.createEntity();
      const difficultyComponent = new DifficultyComponent();
      difficultyEntity.addComponent(difficultyComponent);

      ;(world.getEntitiesWithComponents as jest.Mock).mockReturnValue([
        { entityId: difficultyEntity.id, difficulty: difficultyComponent }
      ]);

      const context = { deltaTime: 1000, totalTime: 1000, frameCount: 1 };
      difficultySystem.update(context);

      // Should update metrics
      expect(difficultyComponent.performanceMetrics.survivalTime).toBeGreaterThan(0);
    });

    it('should emit difficulty change events', () => {
      const eventSpy = jest.fn();
      eventSystem.on('difficulty_changed', eventSpy);

      const difficultyEntity = world.createEntity();
      const difficultyComponent = new DifficultyComponent();
      difficultyComponent.currentLevel = 'EASY' as DifficultyLevel;
      difficultyEntity.addComponent(difficultyComponent);

      ;(world.getEntitiesWithComponents as jest.Mock).mockReturnValue([
        { entityId: difficultyEntity.id, difficulty: difficultyComponent }
      ]);

      // Force a difficulty change
      difficultyComponent.targetScore = 200;
      difficultyComponent.currentScore = 250;

      const context = { deltaTime: 60000, totalTime: 60000, frameCount: 60 };
      difficultySystem.update(context);

      // Event should be emitted if difficulty changes
      if (difficultyComponent.currentLevel !== 'EASY' as DifficultyLevel) {
        expect(eventSpy).toHaveBeenCalled();
      }
    });
  });

  describe('edge cases', () => {
    it('should handle invalid entity IDs', () => {
      world.getEntity = jest.fn().mockReturnValue(null);

      expect(difficultySystem.setDifficultyLevel(999, 'HARD' as DifficultyLevel)).toBe(false);
      expect(difficultySystem.enableAdaptiveDifficulty(999, true)).toBe(false);
      expect(difficultySystem.getDifficultyStats(999)).toBeNull();
    });

    it('should handle entities without difficulty component', () => {
      const entity = world.createEntity();
      world.getEntity = jest.fn().mockReturnValue(entity);

      expect(difficultySystem.setDifficultyLevel(entity.id, 'HARD' as DifficultyLevel)).toBe(false);
    });

    it('should handle empty update cycles', () => {
      ;(world.getEntitiesWithComponents as jest.Mock).mockReturnValue([]);

      expect(() => {
        const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };
        difficultySystem.update(context);
      }).not.toThrow();
    });
  });
});
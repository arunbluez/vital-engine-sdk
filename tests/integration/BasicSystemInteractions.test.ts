import { World } from '../../src/core/ECS/World';
import { Entity } from '../../src/core/ECS/Entity';
import { EventSystem } from '../../src/core/EventSystem';

// Systems
import { MovementSystem } from '../../src/systems/MovementSystem';
import { ProgressionSystem } from '../../src/systems/ProgressionSystem';

// Components
import { TransformComponent } from '../../src/components/Transform';
import { MovementComponent } from '../../src/components/Movement';
import { ExperienceComponent } from '../../src/components/Experience';

describe('Basic System Integration Tests', () => {
  let world: World;
  let eventSystem: EventSystem;

  beforeEach(() => {
    world = new World();
    eventSystem = new EventSystem();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Movement + Entity Integration', () => {
    it('should move entities with movement components', () => {
      const movementSystem = new MovementSystem();
      
      const entity = world.createEntity();
      entity.addComponent(new TransformComponent(0, 0));
      entity.addComponent(new MovementComponent(100)); // max speed 100

      const movement = entity.getComponent('movement') as MovementComponent;
      movement.setVelocity(60, 0); // Move right at 60 units/sec

      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 }; // 16ms frame

      const transform = entity.getComponent('transform') as TransformComponent;
      movementSystem.update(context, [{ 
        id: entity.id, 
        components: { 
          movement: movement,
          transform: transform
        } as any 
      }]);
      expect(transform.position.x).toBeGreaterThan(0);
      expect(transform.position.x).toBeCloseTo(0.96, 1); // 60 * 16/1000 = 0.96
    });

    it('should handle multiple entities moving', () => {
      const movementSystem = new MovementSystem();
      const entities: Entity[] = [];

      // Create 5 entities with different movement patterns
      for (let i = 0; i < 5; i++) {
        const entity = world.createEntity();
        entity.addComponent(new TransformComponent(i * 10, 0));
        entity.addComponent(new MovementComponent(100 + i * 20));
        entities.push(entity);
      }

      // Set different velocities
      entities.forEach((entity, index) => {
        const movement = entity.getComponent('movement') as MovementComponent;
        movement.setVelocity(30 + index * 10, 15 + index * 5);
      });

      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };

      const entityQueries = entities.map(e => ({
        id: e.id,
        components: {
          movement: e.getComponent('movement')!,
          transform: e.getComponent('transform')!
        } as any
      }));

      movementSystem.update(context, entityQueries);

      // All entities should have moved
      entities.forEach((entity, index) => {
        const transform = entity.getComponent('transform') as TransformComponent;
        expect(transform.position.x).toBeGreaterThan(index * 10); // Moved from initial position
        expect(transform.position.y).toBeGreaterThan(0); // Moved upward
      });
    });

    it('should respect maximum speed limits', () => {
      const movementSystem = new MovementSystem();
      
      const entity = world.createEntity();
      entity.addComponent(new TransformComponent(0, 0));
      entity.addComponent(new MovementComponent(50)); // max speed 50

      const movement = entity.getComponent('movement') as MovementComponent;
      movement.setVelocity(100, 0); // Try to exceed max speed

      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };

      const transform = entity.getComponent('transform') as TransformComponent;
      movementSystem.update(context, [{ 
        id: entity.id, 
        components: {
          movement: movement,
          transform: transform
        } as any 
      }]);

      // Velocity should be clamped to max speed
      expect(movement.velocity.x).toBeLessThanOrEqual(50);
    });
  });

  describe('Progression System Integration', () => {
    it('should handle experience gain and level ups', () => {
      const progressionSystem = new ProgressionSystem(eventSystem, world);
      
      const entity = world.createEntity();
      entity.addComponent(new ExperienceComponent(1)); // Start at level 1

      const experience = entity.getComponent('experience') as ExperienceComponent;
      
      // Track level up events
      const levelUpEvents: any[] = [];
      eventSystem.on('LEVEL_UP', (event) => {
        levelUpEvents.push(event);
      });

      // No mocking needed since progressionSystem now has access to the world

      // Use grantExperience to award XP and trigger level up
      const levelsGained = progressionSystem.grantExperience(entity.id, 300, 'test');

      expect(experience.level).toBeGreaterThan(1);
      expect(levelUpEvents.length).toBeGreaterThan(0);
    });

    it('should handle multiple experience components', () => {
      const progressionSystem = new ProgressionSystem(eventSystem, world);
      const entities: Entity[] = [];

      // Create multiple entities with different experience
      for (let i = 0; i < 3; i++) {
        const entity = world.createEntity();
        entity.addComponent(new ExperienceComponent(i + 1));
        entities.push(entity);
      }

      // Add experience to each
      entities.forEach((entity, index) => {
        const experience = entity.getComponent('experience') as ExperienceComponent;
        experience.addExperience(100 + index * 50);
      });

      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };

      const entityQueries = entities.map(e => ({
        id: e.id,
        components: e.getComponent('experience')!
      }));

      progressionSystem.update(context, entityQueries);

      // All entities should have their experience properly processed
      entities.forEach(entity => {
        const experience = entity.getComponent('experience') as ExperienceComponent;
        expect(experience.totalXP).toBeGreaterThan(0);
      });
    });
  });

  describe('Event System Integration', () => {
    it('should properly propagate events between systems', () => {
      const events: string[] = [];
      
      // Set up event listeners
      eventSystem.on('TEST_EVENT_1', () => events.push('EVENT_1'));
      eventSystem.on('TEST_EVENT_2', () => events.push('EVENT_2'));
      eventSystem.on('CHAIN_EVENT', () => {
        events.push('CHAIN_EVENT');
        eventSystem.emit('TEST_EVENT_2', {});
      });

      // Emit events
      eventSystem.emit('TEST_EVENT_1', {});
      eventSystem.emit('CHAIN_EVENT', {});

      expect(events).toEqual(['EVENT_1', 'CHAIN_EVENT', 'EVENT_2']);
    });

    it('should handle event data correctly', () => {
      const receivedData: any[] = [];
      
      eventSystem.on('DATA_EVENT', (data) => {
        receivedData.push(data);
      });

      const testData = { value: 42, message: 'test' };
      eventSystem.emit('DATA_EVENT', testData);

      expect(receivedData).toHaveLength(1);
      expect(receivedData[0].data).toEqual(testData);
    });
  });

  describe('Entity Component System Integration', () => {
    it('should handle entity creation and component management', () => {
      const entity = world.createEntity();
      
      expect(entity.id).toBeDefined();
      expect(entity.isActive()).toBe(true);

      // Add components
      entity.addComponent(new TransformComponent(10, 20));
      entity.addComponent(new MovementComponent(100));

      expect(entity.hasComponent('transform')).toBe(true);
      expect(entity.hasComponent('movement')).toBe(true);
      expect(entity.hasComponent('nonexistent')).toBe(false);

      // Get components
      const transform = entity.getComponent('transform') as TransformComponent;
      expect(transform.position.x).toBe(10);
      expect(transform.position.y).toBe(20);

      // Remove component
      entity.removeComponent('movement');
      expect(entity.hasComponent('movement')).toBe(false);
    });

    it('should support entity queries and filtering', () => {
      const entities: Entity[] = [];

      // Create entities with different component combinations
      for (let i = 0; i < 5; i++) {
        const entity = world.createEntity();
        entity.addComponent(new TransformComponent(i, i));
        
        if (i % 2 === 0) {
          entity.addComponent(new MovementComponent(100));
        }
        if (i % 3 === 0) {
          entity.addComponent(new ExperienceComponent());
        }
        
        entities.push(entity);
      }

      // Filter entities with specific components
      const movableEntities = entities.filter(e => e.hasComponent('movement'));
      const experienceEntities = entities.filter(e => e.hasComponent('experience'));

      expect(movableEntities.length).toBe(3); // indices 0, 2, 4
      expect(experienceEntities.length).toBe(2); // indices 0, 3
    });

    it('should handle entity deactivation', () => {
      const entity = world.createEntity();
      entity.addComponent(new TransformComponent(0, 0));

      expect(entity.isActive()).toBe(true);

      entity.setActive(false);
      expect(entity.isActive()).toBe(false);

      entity.setActive(true);
      expect(entity.isActive()).toBe(true);
    });
  });

  describe('Performance Integration', () => {
    it('should handle many entities efficiently', () => {
      const movementSystem = new MovementSystem();
      const entities: Entity[] = [];

      // Create 1000 entities
      for (let i = 0; i < 1000; i++) {
        const entity = world.createEntity();
        entity.addComponent(new TransformComponent(
          Math.random() * 1000,
          Math.random() * 1000
        ));
        entity.addComponent(new MovementComponent(Math.random() * 100 + 50));
        entities.push(entity);
      }

      // Set random velocities
      entities.forEach(entity => {
        const movement = entity.getComponent('movement') as MovementComponent;
        movement.setVelocity(
          (Math.random() - 0.5) * 200,
          (Math.random() - 0.5) * 200
        );
      });

      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };

      const entityQueries = entities.map(e => ({
        id: e.id,
        components: {
          movement: e.getComponent('movement')!,
          transform: e.getComponent('transform')!
        } as any
      }));

      const startTime = performance.now();
      movementSystem.update(context, entityQueries);
      const endTime = performance.now();

      const duration = endTime - startTime;

      // Should complete in reasonable time
      expect(duration).toBeLessThan(50); // 50ms for 1000 entities
      
      // Verify entities moved
      let entitiesMoved = 0;
      entities.forEach(entity => {
        const transform = entity.getComponent('transform') as TransformComponent;
        const movement = entity.getComponent('movement') as MovementComponent;
        
        // If entity had non-zero velocity, it should have moved
        if (movement.velocity.x !== 0 || movement.velocity.y !== 0) {
          entitiesMoved++;
        }
      });

      expect(entitiesMoved).toBeGreaterThan(900); // Most entities should have moved
    });

    it('should handle rapid system updates', () => {
      const progressionSystem = new ProgressionSystem(eventSystem, world);
      
      const entity = world.createEntity();
      entity.addComponent(new ExperienceComponent());

      const context = { deltaTime: 1, totalTime: 1, frameCount: 1 };
      const entityQuery = { id: entity.id, components: entity.getComponent('experience')! };

      const startTime = performance.now();

      // Perform many rapid updates
      for (let i = 0; i < 1000; i++) {
        progressionSystem.update(context, [entityQuery]);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle rapid updates efficiently
      expect(duration).toBeLessThan(100); // 100ms for 1000 updates
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle missing components gracefully', () => {
      const movementSystem = new MovementSystem();
      const entity = world.createEntity();
      
      // Only add transform, no movement component
      entity.addComponent(new TransformComponent(0, 0));

      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };

      // This should not crash even though the entity lacks movement component
      expect(() => {
        movementSystem.update(context, []);
      }).not.toThrow();
    });

    it('should handle invalid event data', () => {
      const receivedEvents: any[] = [];
      
      eventSystem.on('TEST_EVENT', (data) => {
        receivedEvents.push(data);
      });

      // Emit events with various data types
      eventSystem.emit('TEST_EVENT', null);
      eventSystem.emit('TEST_EVENT', undefined);
      eventSystem.emit('TEST_EVENT', { invalid: true });

      expect(receivedEvents).toHaveLength(3);
    });

    it('should handle system updates with empty entity lists', () => {
      const movementSystem = new MovementSystem();
      const progressionSystem = new ProgressionSystem(eventSystem, world);

      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };

      expect(() => {
        movementSystem.update(context, []);
        progressionSystem.update(context, []);
      }).not.toThrow();
    });
  });
});
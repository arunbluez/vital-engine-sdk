import { SimpleCollectionSystem } from '../../src/systems/SimpleCollectionSystem';
import { World } from '../../src/core/ECS/World';
import { Entity } from '../../src/core/ECS/Entity';
import { TransformComponent } from '../../src/components/Transform';
import { CollectibleComponent, CollectibleType } from '../../src/components/Collectible';
import { MagnetComponent } from '../../src/components/Magnet';
import { EventSystem } from '../../src/core/EventSystem';

describe('SimpleCollectionSystem', () => {
  let world: World;
  let simpleCollectionSystem: SimpleCollectionSystem;
  let eventSystem: EventSystem;

  beforeEach(() => {
    world = new World();
    eventSystem = new EventSystem();
    simpleCollectionSystem = new SimpleCollectionSystem(eventSystem, world);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with correct name and dependencies', () => {
      expect(simpleCollectionSystem.name).toBe('collection');
      expect((simpleCollectionSystem as any).eventSystem).toBe(eventSystem);
      expect((simpleCollectionSystem as any).world).toBe(world);
    });

    it('should have required components', () => {
      expect(simpleCollectionSystem.requiredComponents).toContain('transform');
    });
  });

  describe('basic collection', () => {
    let collector: Entity;
    let collectible: Entity;

    beforeEach(() => {
      collector = world.createEntity();
      collector.addComponent(new TransformComponent(0, 0));
      collector.addComponent(new MagnetComponent());

      collectible = world.createEntity();
      collectible.addComponent(new TransformComponent(20, 0));
      collectible.addComponent(new CollectibleComponent(CollectibleType.CURRENCY, 10));
    });

    it('should collect items within collection radius', () => {
      const collectionSpy = jest.fn();
      eventSystem.on('COLLECTIBLE_COLLECTED', collectionSpy);

      // Mock world methods
      world.getActiveEntities = jest.fn().mockReturnValue([collector, collectible]);
      world.removeEntity = jest.fn();

      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };
      simpleCollectionSystem.update(context, []);

      expect(world.removeEntity).toHaveBeenCalledWith(collectible.id);
      expect(collectionSpy).toHaveBeenCalledWith({
        collectorId: collector.id,
        collectibleId: collectible.id,
        timestamp: expect.any(Number)
      });
    });

    it('should not collect items outside radius', () => {
      const collectionSpy = jest.fn();
      eventSystem.on('COLLECTIBLE_COLLECTED', collectionSpy);

      // Move collectible far away
      (collectible.getComponent('transform') as TransformComponent).setPosition(100, 0);

      world.getActiveEntities = jest.fn().mockReturnValue([collector, collectible]);
      world.removeEntity = jest.fn();

      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };
      simpleCollectionSystem.update(context, []);

      expect(world.removeEntity).not.toHaveBeenCalled();
      expect(collectionSpy).not.toHaveBeenCalled();
    });
  });

  describe('magnetic attraction', () => {
    let collector: Entity;
    let collectible: Entity;

    beforeEach(() => {
      collector = world.createEntity();
      collector.addComponent(new TransformComponent(0, 0));
      const magnet = new MagnetComponent();
      magnet.magneticField.range = 100;
      magnet.magneticField.strength = 50;
      collector.addComponent(magnet);

      collectible = world.createEntity();
      collectible.addComponent(new TransformComponent(60, 0));
      collectible.addComponent(new CollectibleComponent(CollectibleType.CURRENCY, 10));
    });

    it('should attract items within magnet range', () => {
      const initialX = 60;
      const collectibleTransform = collectible.getComponent('transform') as TransformComponent;

      world.getActiveEntities = jest.fn().mockReturnValue([collector, collectible]);

      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };
      simpleCollectionSystem.update(context, []);

      // Collectible should move closer to collector
      expect(collectibleTransform.position.x).toBeLessThan(initialX);
      expect(collectibleTransform.position.x).toBeGreaterThan(0);
    });

    it('should not attract items outside magnet range', () => {
      (collectible.getComponent('transform') as TransformComponent).setPosition(150, 0);
      const collectibleTransform = collectible.getComponent('transform') as TransformComponent;
      const initialX = collectibleTransform.position.x;

      world.getActiveEntities = jest.fn().mockReturnValue([collector, collectible]);

      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };
      simpleCollectionSystem.update(context, []);

      expect(collectibleTransform.position.x).toBe(initialX);
    });

    it('should apply attraction force based on distance', () => {
      const collectibleTransform = collectible.getComponent('transform') as TransformComponent;
      
      world.getActiveEntities = jest.fn().mockReturnValue([collector, collectible]);

      // First update - far distance
      const context1 = { deltaTime: 16, totalTime: 16, frameCount: 1 };
      simpleCollectionSystem.update(context1, []);
      const movement1 = 60 - collectibleTransform.position.x;

      // Move closer and update again
      collectibleTransform.setPosition(30, 0);
      const context2 = { deltaTime: 16, totalTime: 32, frameCount: 2 };
      simpleCollectionSystem.update(context2, []);
      const movement2 = 30 - collectibleTransform.position.x;

      // Closer items should experience stronger attraction
      expect(movement2).toBeGreaterThan(movement1);
    });
  });

  describe('performance', () => {
    it('should handle many entities efficiently', () => {
      const collectors: Entity[] = [];
      const collectibles: Entity[] = [];

      // Create 10 collectors
      for (let i = 0; i < 10; i++) {
        const collector = world.createEntity();
        collector.addComponent(new TransformComponent(i * 100, 0));
        collector.addComponent(new MagnetComponent());
        collectors.push(collector);
      }

      // Create 100 collectibles
      for (let i = 0; i < 100; i++) {
        const collectible = world.createEntity();
        collectible.addComponent(new TransformComponent(
          Math.random() * 1000,
          Math.random() * 1000
        ));
        collectible.addComponent(new CollectibleComponent(CollectibleType.CURRENCY, 10));
        collectibles.push(collectible);
      }

      world.getActiveEntities = jest.fn().mockReturnValue([...collectors, ...collectibles]);
      world.removeEntity = jest.fn();

      const startTime = performance.now();
      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };
      simpleCollectionSystem.update(context, []);
      const endTime = performance.now();

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(16); // One frame
    });
  });

  describe('edge cases', () => {
    it('should handle empty entity list', () => {
      world.getActiveEntities = jest.fn().mockReturnValue([]);

      expect(() => {
        const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };
        simpleCollectionSystem.update(context, []);
      }).not.toThrow();
    });

    it('should handle collectors without magnet component', () => {
      const collector = world.createEntity();
      collector.addComponent(new TransformComponent(0, 0));
      // No magnet component

      const collectible = world.createEntity();
      collectible.addComponent(new TransformComponent(10, 0));
      collectible.addComponent(new CollectibleComponent(CollectibleType.CURRENCY, 10));

      world.getActiveEntities = jest.fn().mockReturnValue([collector, collectible]);

      expect(() => {
        const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };
        simpleCollectionSystem.update(context, []);
      }).not.toThrow();
    });

    it('should handle collectibles without transform', () => {
      const collector = world.createEntity();
      collector.addComponent(new TransformComponent(0, 0));
      collector.addComponent(new MagnetComponent());

      const collectible = world.createEntity();
      collectible.addComponent(new CollectibleComponent(CollectibleType.CURRENCY, 10));
      // No transform component

      world.getActiveEntities = jest.fn().mockReturnValue([collector, collectible]);

      expect(() => {
        const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };
        simpleCollectionSystem.update(context, []);
      }).not.toThrow();
    });

    it('should handle missing world methods gracefully', () => {
      const collector = world.createEntity();
      collector.addComponent(new TransformComponent(0, 0));
      collector.addComponent(new MagnetComponent());

      const collectible = world.createEntity();
      collectible.addComponent(new TransformComponent(10, 0));
      collectible.addComponent(new CollectibleComponent(CollectibleType.CURRENCY, 10));

      // Don't mock world methods - let them be undefined
      world.getActiveEntities = undefined as any;
      world.removeEntity = undefined as any;

      expect(() => {
        const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };
        simpleCollectionSystem.update(context, []);
      }).not.toThrow();
    });
  });
});
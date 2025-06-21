import { CollectionSystem } from '../../src/systems/CollectionSystem';
import { World } from '../../src/core/ECS/World';
import { Entity } from '../../src/core/ECS/Entity';
import { TransformComponent } from '../../src/components/Transform';
import { CollectibleComponent, CollectibleType, CollectibleRarity } from '../../src/components/Collectible';
import { MagnetComponent } from '../../src/components/Magnet';
import { EventSystem } from '../../src/core/EventSystem';

describe('CollectionSystem', () => {
  let world: World;
  let collectionSystem: CollectionSystem;
  let eventSystem: EventSystem;

  beforeEach(() => {
    world = new World();
    eventSystem = new EventSystem();
    collectionSystem = new CollectionSystem(eventSystem, world);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with correct name and dependencies', () => {
      expect(collectionSystem.name).toBe('collection');
      expect((collectionSystem as any).eventSystem).toBe(eventSystem);
      expect((collectionSystem as any).world).toBe(world);
    });

    it('should have required components', () => {
      expect(collectionSystem.requiredComponents).toContain('transform');
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
      eventSystem.on('collection', collectionSpy);

      const magnet = collector.getComponent('magnet') as MagnetComponent;
      magnet.magneticField.range = 50;

      // Mock world methods
      world.getEntity = jest.fn((id) => {
        if (id === collector.id) return collector;
        if (id === collectible.id) return collectible;
        return null;
      });

      world.removeEntity = jest.fn();

      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };
      
      // Mock entities with proper structure
      const entities = [
        { id: collector.id, hasComponent: (type: string) => collector.hasComponent(type), getComponent: (type: string) => collector.getComponent(type) },
        { id: collectible.id, hasComponent: (type: string) => collectible.hasComponent(type), getComponent: (type: string) => collectible.getComponent(type) }
      ];

      collectionSystem.update(context, entities as any);

      expect(collectionSpy).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          type: 'collection',
          collectorEntityId: collector.id,
          collectibleEntityId: collectible.id
        })
      }));
    });

    it('should not collect items outside range', () => {
      const collectionSpy = jest.fn();
      eventSystem.on('collection', collectionSpy);

      (collectible.getComponent('transform') as TransformComponent).setPosition(200, 0);

      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };
      const entities = [
        { id: collector.id, hasComponent: (type: string) => collector.hasComponent(type), getComponent: (type: string) => collector.getComponent(type) },
        { id: collectible.id, hasComponent: (type: string) => collectible.hasComponent(type), getComponent: (type: string) => collectible.getComponent(type) }
      ];

      collectionSystem.update(context, entities as any);

      expect(collectionSpy).not.toHaveBeenCalled();
    });
  });

  describe('magnet functionality', () => {
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

      // Mock world methods
      world.getEntity = jest.fn((id) => {
        if (id === collector.id) return collector;
        if (id === collectible.id) return collectible;
        return null;
      });

      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };
      const entities = [
        { id: collector.id, hasComponent: (type: string) => collector.hasComponent(type), getComponent: (type: string) => collector.getComponent(type) },
        { id: collectible.id, hasComponent: (type: string) => collectible.hasComponent(type), getComponent: (type: string) => collectible.getComponent(type) }
      ];

      collectionSystem.update(context, entities as any);

      // Item should move closer due to magnetic attraction
      expect(collectibleTransform.position.x).toBeLessThan(initialX);
    });
  });

  describe('collection filters', () => {
    let collector: Entity;
    let collectible: Entity;

    beforeEach(() => {
      collector = world.createEntity();
      collector.addComponent(new TransformComponent(0, 0));
      const magnet = new MagnetComponent();
      magnet.magneticField.range = 100;
      collector.addComponent(magnet);

      collectible = world.createEntity();
      collectible.addComponent(new TransformComponent(20, 0));
      const collectibleComp = new CollectibleComponent(CollectibleType.CURRENCY, 100);
      collectible.addComponent(collectibleComp);
    });

    it('should respect collection filters', () => {
      const magnet = collector.getComponent('magnet') as MagnetComponent;
      magnet.collectionFilters = [{
        targetType: 'SPECIFIC_TYPES' as any,
        minRarity: 'rare',
        priority: 1
      }];

      const collectionSpy = jest.fn();
      eventSystem.on('collection', collectionSpy);

      world.getEntity = jest.fn((id) => {
        if (id === collector.id) return collector;
        if (id === collectible.id) return collectible;
        return null;
      });

      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };
      const entities = [
        { id: collector.id, hasComponent: (type: string) => collector.hasComponent(type), getComponent: (type: string) => collector.getComponent(type) },
        { id: collectible.id, hasComponent: (type: string) => collectible.hasComponent(type), getComponent: (type: string) => collectible.getComponent(type) }
      ];

      collectionSystem.update(context, entities as any);

      // Should not collect 'gold' when filter only allows 'gems'
      expect(collectionSpy).not.toHaveBeenCalled();
    });
  });

  describe('collection stats', () => {
    it('should track collection statistics', () => {
      const collector = world.createEntity();
      collector.addComponent(new TransformComponent(0, 0));
      const magnet = new MagnetComponent();
      collector.addComponent(magnet);

      world.getEntity = jest.fn().mockReturnValue(collector);

      const stats = collectionSystem.getCollectionStats(collector.id);
      
      expect(stats).toBeTruthy();
      expect(stats?.totalCollected).toBe(0);
      expect(stats?.totalValue).toBe(0);
      expect(stats?.collectedByType).toBeInstanceOf(Map);
    });
  });

  describe('factory methods', () => {
    it('should create collectible entities', () => {
      const mockEntity = { id: 1, addComponent: jest.fn() } as any;
      world.createEntity = jest.fn().mockReturnValue(mockEntity);

      const entityId = collectionSystem.createCollectible(
        { x: 100, y: 200 },
        'coin',
        'COMMON',
        10,
        ['currency'],
        5000
      );

      expect(world.createEntity).toHaveBeenCalled();
      expect(mockEntity.addComponent).toHaveBeenCalledTimes(2); // Transform and Collectible
      expect(entityId).toBe(1);
    });

    it('should create magnetic collector entities', () => {
      const mockEntity = { id: 2, addComponent: jest.fn() } as any;
      world.createEntity = jest.fn().mockReturnValue(mockEntity);

      const entityId = collectionSystem.createMagneticCollector(
        { x: 0, y: 0 },
        150,
        75,
        'UNIFORM'
      );

      expect(world.createEntity).toHaveBeenCalled();
      expect(mockEntity.addComponent).toHaveBeenCalledTimes(2); // Transform and Magnet
      expect(entityId).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('should handle entities without required components', () => {
      const invalidCollector = world.createEntity();
      invalidCollector.addComponent(new TransformComponent(0, 0));
      // Missing magnet component

      const invalidCollectible = world.createEntity();
      invalidCollectible.addComponent(new CollectibleComponent(CollectibleType.EXPERIENCE));
      // Missing transform component

      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };
      const entities = [
        { id: invalidCollector.id, hasComponent: (type: string) => invalidCollector.hasComponent(type), getComponent: (type: string) => invalidCollector.getComponent(type) },
        { id: invalidCollectible.id, hasComponent: (type: string) => invalidCollectible.hasComponent(type), getComponent: (type: string) => invalidCollectible.getComponent(type) }
      ];

      expect(() => {
        collectionSystem.update(context, entities as any);
      }).not.toThrow();
    });

    it('should handle null world entity lookups', () => {
      const collector = world.createEntity();
      collector.addComponent(new TransformComponent(0, 0));
      collector.addComponent(new MagnetComponent());

      world.getEntity = jest.fn().mockReturnValue(null);

      const stats = collectionSystem.getCollectionStats(999);
      expect(stats).toBeNull();
    });
  });
});
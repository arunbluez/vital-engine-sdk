import { CollectionSystem } from '../../src/systems/CollectionSystem';
import { World } from '../../src/core/ECS/World';
import { Entity } from '../../src/core/ECS/Entity';
import { TransformComponent } from '../../src/components/Transform';
import { CollectibleComponent, CollectibleType, CollectibleRarity, CollectionBehavior } from '../../src/components/Collectible';
import { MagnetComponent, MagnetTargetType, MagnetFieldType, MagnetTrigger } from '../../src/components/Magnet';
import { MovementComponent } from '../../src/components/Movement';
import { HealthComponent } from '../../src/components/Health';
import { ExperienceComponent } from '../../src/components/Experience';
import { InventoryComponent } from '../../src/components/Inventory';
import { EventSystem } from '../../src/core/EventSystem';
import { Vector2Math } from '../../src/utils/Math';

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

    it('should initialize spatial grid with correct configuration', () => {
      const spatialGrid = (collectionSystem as any).spatialGrid;
      expect(spatialGrid).toBeDefined();
      expect(spatialGrid.cellSize).toBe(100);
    });
  });

  describe('basic collection mechanics', () => {
    let collector: Entity;
    let collectible: Entity;

    beforeEach(() => {
      collector = world.createEntity();
      collector.addComponent(new TransformComponent(0, 0));
      const magnet = new MagnetComponent();
      magnet.magneticField.range = 100;
      magnet.collectionRadius = 30;
      collector.addComponent(magnet);

      collectible = world.createEntity();
      collectible.addComponent(new TransformComponent(20, 0));
      collectible.addComponent(new CollectibleComponent(CollectibleType.CURRENCY, 10));
      collectible.addComponent(new MovementComponent());
    });

    it('should collect items within collection radius', () => {
      const collectionSpy = jest.fn();
      eventSystem.on('COLLECTIBLE_COLLECTED', collectionSpy);

      world.removeEntity = jest.fn();

      const context = { deltaTime: 16, timestamp: Date.now(), totalTime: 0, frameCount: 0 };
      const entities = [collector, collectible];

      collectionSystem.update(context, entities as any);

      expect(collectionSpy).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          collectorId: collector.id,
          type: CollectibleType.CURRENCY,
          value: 10,
          rarity: CollectibleRarity.COMMON
        })
      }));
      expect(world.removeEntity).toHaveBeenCalledWith(collectible.id);
    });

    it('should respect collection behavior types', () => {
      const manualCollectible = world.createEntity();
      manualCollectible.addComponent(new TransformComponent(20, 0)); // Within collection range
      const manualComponent = new CollectibleComponent(CollectibleType.WEAPON, 1);
      manualComponent.collectionBehavior = CollectionBehavior.MANUAL;
      manualCollectible.addComponent(manualComponent);

      const collectionSpy = jest.fn();
      eventSystem.on('COLLECTIBLE_COLLECTED', collectionSpy);

      world.removeEntity = jest.fn();

      const context = { deltaTime: 16, timestamp: Date.now(), totalTime: 0, frameCount: 0 };
      const entities = [collector, manualCollectible];

      collectionSystem.update(context, entities as any);

      // Manual collection items should not be collected automatically
      expect(collectionSpy).not.toHaveBeenCalled();
      expect(world.removeEntity).not.toHaveBeenCalled();
    });

    it('should handle proximity collection behavior', () => {
      const proximityCollectible = world.createEntity();
      proximityCollectible.addComponent(new TransformComponent(45, 0));
      const proximityComponent = new CollectibleComponent(CollectibleType.HEALTH, 50);
      proximityComponent.collectionBehavior = CollectionBehavior.PROXIMITY;
      proximityCollectible.addComponent(proximityComponent);

      const collectionSpy = jest.fn();
      eventSystem.on('COLLECTIBLE_COLLECTED', collectionSpy);

      world.removeEntity = jest.fn();

      const context = { deltaTime: 16, timestamp: Date.now(), totalTime: 0, frameCount: 0 };
      const entities = [collector, proximityCollectible];

      collectionSystem.update(context, entities as any);

      // Proximity items have larger collection radius (50)
      expect(collectionSpy).toHaveBeenCalled();
    });
  });

  describe('magnetism and attraction', () => {
    let collector: Entity;
    let collectible: Entity;

    beforeEach(() => {
      collector = world.createEntity();
      collector.addComponent(new TransformComponent(0, 0));
      const magnet = new MagnetComponent(150, 100);
      magnet.magneticField.range = 150;
      magnet.magneticField.strength = 100;
      magnet.collectionRadius = 30;
      collector.addComponent(magnet);

      collectible = world.createEntity();
      collectible.addComponent(new TransformComponent(100, 0));
      const collectibleComp = new CollectibleComponent(CollectibleType.EXPERIENCE, 25);
      collectibleComp.magnetismConfig.enabled = true;
      collectibleComp.magnetismConfig.maxSpeed = 200;
      collectible.addComponent(collectibleComp);
      collectible.addComponent(new MovementComponent());
    });

    it('should attract items within magnet range', () => {
      const initialDistance = 100;
      const collectibleTransform = collectible.getComponent('transform') as TransformComponent;
      const movement = collectible.getComponent('movement') as MovementComponent;

      const context = { deltaTime: 16, timestamp: Date.now(), totalTime: 0, frameCount: 0 };
      const entities = [collector, collectible];

      collectionSystem.update(context, entities as any);

      // Movement should have velocity towards collector
      expect(movement.velocity.x).toBeLessThan(0); // Moving left towards collector
      expect(Math.abs(movement.velocity.x)).toBeGreaterThan(0);
    });

    it('should respect maximum attraction speed', () => {
      const movement = collectible.getComponent('movement') as MovementComponent;
      const collectibleComp = collectible.getComponent('collectible') as CollectibleComponent;
      collectibleComp.magnetismConfig.maxSpeed = 50;

      // Apply very strong force
      const magnet = collector.getComponent('magnet') as MagnetComponent;
      magnet.magneticField.strength = 1000;

      const context = { deltaTime: 16, timestamp: Date.now(), totalTime: 0, frameCount: 0 };
      const entities = [collector, collectible];

      collectionSystem.update(context, entities as any);

      const speed = Vector2Math.magnitude(movement.velocity);
      expect(speed).toBeLessThanOrEqual(50);
    });

    it('should handle different magnetic field types', () => {
      const magnet = collector.getComponent('magnet') as MagnetComponent;
      magnet.magneticField.type = MagnetFieldType.PULSE;
      magnet.pulseInterval = 1000;
      magnet.pulseDuration = 500;
      magnet.pulseStrength = 2.0;

      const context = { deltaTime: 16, timestamp: Date.now(), totalTime: 0, frameCount: 0 };
      const entities = [collector, collectible];

      // Test pulse activation
      collectionSystem.update(context, entities as any);

      // Pulse should modify attraction strength
      expect(magnet.isPulsing).toBeDefined();
    });

    it('should not attract items with disabled magnetism', () => {
      const collectibleComp = collectible.getComponent('collectible') as CollectibleComponent;
      collectibleComp.magnetismConfig.enabled = false;

      const movement = collectible.getComponent('movement') as MovementComponent;
      movement.velocity = { x: 0, y: 0 };

      const context = { deltaTime: 16, timestamp: Date.now(), totalTime: 0, frameCount: 0 };
      const entities = [collector, collectible];

      collectionSystem.update(context, entities as any);

      expect(movement.velocity.x).toBe(0);
      expect(movement.velocity.y).toBe(0);
    });
  });

  describe('collection filters and targeting', () => {
    let collector: Entity;

    beforeEach(() => {
      collector = world.createEntity();
      collector.addComponent(new TransformComponent(0, 0));
      const magnet = new MagnetComponent();
      magnet.magneticField.range = 200;
      collector.addComponent(magnet);
    });

    it('should filter collectibles by type', () => {
      const magnet = collector.getComponent('magnet') as MagnetComponent;
      // Clear default filters
      magnet.collectionFilters = [];
      magnet.addFilter({
        targetType: MagnetTargetType.EXPERIENCE,
        priority: 1
      });

      const expOrb = world.createEntity();
      expOrb.addComponent(new TransformComponent(50, 0));
      expOrb.addComponent(new CollectibleComponent(CollectibleType.EXPERIENCE, 100));
      expOrb.addComponent(new MovementComponent());

      const coin = world.createEntity();
      coin.addComponent(new TransformComponent(50, 50));
      coin.addComponent(new CollectibleComponent(CollectibleType.CURRENCY, 50));
      coin.addComponent(new MovementComponent());

      const collectionSpy = jest.fn();
      eventSystem.on('COLLECTIBLE_COLLECTED', collectionSpy);

      world.removeEntity = jest.fn();

      const context = { deltaTime: 16, timestamp: Date.now(), totalTime: 0, frameCount: 0 };
      const entities = [collector, expOrb, coin];

      // Place collector at origin for testing
      const collectorTransform = collector.getComponent('transform') as TransformComponent;
      collectorTransform.position = { x: 0, y: 0 };

      // Move experience orb very close to collector (within collection radius)
      const expTransform = expOrb.getComponent('transform') as TransformComponent;
      expTransform.position = { x: 20, y: 0 };

      // Keep coin farther away (outside collection radius)
      const coinTransform = coin.getComponent('transform') as TransformComponent;
      coinTransform.position = { x: 100, y: 100 };

      collectionSystem.update(context, entities as any);

      // Should only attract/collect experience orb due to filter
      // Note: With the filter, coin shouldn't be collected even if close
      expect(collectionSpy).toHaveBeenCalledTimes(1);
      expect(collectionSpy).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          type: CollectibleType.EXPERIENCE
        })
      }));
    });

    it('should filter by rarity', () => {
      const magnet = collector.getComponent('magnet') as MagnetComponent;
      // Clear default filters
      magnet.collectionFilters = [];
      magnet.addFilter({
        targetType: MagnetTargetType.RARE_ONLY,
        priority: 1
      });

      const commonItem = world.createEntity();
      commonItem.addComponent(new TransformComponent(20, 0));
      commonItem.addComponent(new CollectibleComponent(CollectibleType.CURRENCY, 10, CollectibleRarity.COMMON));
      commonItem.addComponent(new MovementComponent());

      const rareItem = world.createEntity();
      rareItem.addComponent(new TransformComponent(20, 20));
      rareItem.addComponent(new CollectibleComponent(CollectibleType.CURRENCY, 100, CollectibleRarity.RARE));
      rareItem.addComponent(new MovementComponent());

      const collectionSpy = jest.fn();
      eventSystem.on('COLLECTIBLE_COLLECTED', collectionSpy);

      world.removeEntity = jest.fn();

      const context = { deltaTime: 16, timestamp: Date.now(), totalTime: 0, frameCount: 0 };
      const entities = [collector, commonItem, rareItem];

      collectionSystem.update(context, entities as any);

      // Should only collect rare item based on filter
      // Check that only one collection happened
      expect(collectionSpy).toHaveBeenCalledTimes(1);
      
      // Verify it was the rare item that was collected
      const collectionCall = collectionSpy.mock.calls[0][0];
      expect(collectionCall.data.rarity).toBe(CollectibleRarity.RARE);
      
      // And that the correct entity was removed
      expect(world.removeEntity).toHaveBeenCalledTimes(1);
    });
  });

  describe('collection priority system', () => {
    let collector: Entity;

    beforeEach(() => {
      collector = world.createEntity();
      collector.addComponent(new TransformComponent(0, 0));
      collector.addComponent(new MagnetComponent());
      collector.addComponent(new HealthComponent(100, 25)); // Low health (25/100 = 25%)
    });

    it('should prioritize health pickups when health is low', () => {
      const healthPack = world.createEntity();
      healthPack.addComponent(new TransformComponent(25, 0));
      const healthCollectible = new CollectibleComponent(CollectibleType.HEALTH, 50);
      healthCollectible.updatePriority = 1;
      healthPack.addComponent(healthCollectible);

      const coin = world.createEntity();
      coin.addComponent(new TransformComponent(25, 0));
      const coinCollectible = new CollectibleComponent(CollectibleType.CURRENCY, 100);
      coinCollectible.updatePriority = 1;
      coin.addComponent(coinCollectible);

      // Add entities to cache first
      (collectionSystem as any).collectibleCache.set(healthPack.id, {
        entity: healthPack,
        collectible: healthCollectible,
        transform: healthPack.getComponent('transform')
      });
      
      (collectionSystem as any).collectibleCache.set(coin.id, {
        entity: coin,
        collectible: coinCollectible,
        transform: coin.getComponent('transform')
      });

      // Get prioritized items
      const prioritized = (collectionSystem as any).prioritizeCollectibles(
        [healthPack.id, coin.id],
        { x: 0, y: 0 },
        collector
      );

      // Health should have 3x priority when health < 30%
      expect(prioritized.length).toBe(2);
      expect(prioritized[0].entityId).toBe(healthPack.id);
      expect(prioritized[0].priority).toBe(3); // Base 1 * 3 for low health
      expect(prioritized[1].priority).toBe(1); // Currency stays at base priority
    });

    it('should prioritize by rarity', () => {
      const commonItem = world.createEntity();
      commonItem.addComponent(new TransformComponent(25, 0));
      commonItem.addComponent(new CollectibleComponent(CollectibleType.CURRENCY, 10, CollectibleRarity.COMMON));
      
      const legendaryItem = world.createEntity();
      legendaryItem.addComponent(new TransformComponent(25, 0));
      legendaryItem.addComponent(new CollectibleComponent(CollectibleType.CURRENCY, 100, CollectibleRarity.LEGENDARY));

      (collectionSystem as any).collectibleCache.set(commonItem.id, {
        entity: commonItem,
        collectible: commonItem.getComponent('collectible'),
        transform: commonItem.getComponent('transform')
      });

      (collectionSystem as any).collectibleCache.set(legendaryItem.id, {
        entity: legendaryItem,
        collectible: legendaryItem.getComponent('collectible'),
        transform: legendaryItem.getComponent('transform')
      });

      const prioritized = (collectionSystem as any).prioritizeCollectibles(
        [commonItem.id, legendaryItem.id],
        { x: 0, y: 0 },
        collector
      );

      // Legendary should have 5x priority
      expect(prioritized[0].entityId).toBe(legendaryItem.id);
      expect(prioritized[0].priority).toBe(5); // Base 1 * 5 for legendary
    });
  });

  describe('collection effects', () => {
    let collector: Entity;

    beforeEach(() => {
      collector = world.createEntity();
      collector.addComponent(new TransformComponent(0, 0));
      collector.addComponent(new MagnetComponent());
      collector.addComponent(new ExperienceComponent());
      collector.addComponent(new InventoryComponent());
      collector.addComponent(new HealthComponent(50, 100));
    });

    it('should apply experience bonus from magnet', () => {
      const magnet = collector.getComponent('magnet') as MagnetComponent;
      magnet.experienceBonus = 0.5; // 50% bonus

      const expOrb = world.createEntity();
      expOrb.addComponent(new TransformComponent(0, 0));
      expOrb.addComponent(new CollectibleComponent(CollectibleType.EXPERIENCE, 100));

      const experience = collector.getComponent('experience') as ExperienceComponent;
      const initialXP = experience.currentXP;

      (collectionSystem as any).collectItem(collector, expOrb, Date.now());

      // Should gain 150 XP (100 base + 50% bonus)
      expect(experience.currentXP).toBe(initialXP + 150);
    });

    it('should apply currency bonus from magnet', () => {
      const magnet = collector.getComponent('magnet') as MagnetComponent;
      magnet.currencyBonus = 1.0; // 100% bonus

      const coin = world.createEntity();
      coin.addComponent(new TransformComponent(0, 0));
      coin.addComponent(new CollectibleComponent(CollectibleType.CURRENCY, 50));

      const inventory = collector.getComponent('inventory') as InventoryComponent;
      const initialGold = inventory.getResource('gold');

      (collectionSystem as any).collectItem(collector, coin, Date.now());

      // Should gain 100 gold (50 base + 100% bonus)
      expect(inventory.getResource('gold')).toBe(initialGold + 100);
    });

    it('should heal when collecting health items', () => {
      const healthPack = world.createEntity();
      healthPack.addComponent(new TransformComponent(0, 0));
      healthPack.addComponent(new CollectibleComponent(CollectibleType.HEALTH, 30));

      const health = collector.getComponent('health') as HealthComponent;
      const initialHealth = health.current;

      // Make sure eventSystem is properly set
      (collectionSystem as any).eventSystem = { emit: jest.fn() };
      (collectionSystem as any).collectItem(collector, healthPack, Date.now());

      expect(health.current).toBe(Math.min(initialHealth + 30, health.maximum));
    });

    it('should emit powerup event for powerup collectibles', () => {
      const powerupSpy = jest.fn();
      eventSystem.on('POWERUP_COLLECTED', powerupSpy);

      const powerup = world.createEntity();
      powerup.addComponent(new TransformComponent(0, 0));
      const powerupComp = new CollectibleComponent(CollectibleType.POWER_UP, 1);
      powerupComp.metadata.powerupType = 'speed_boost';
      powerupComp.metadata.duration = 10000;
      powerup.addComponent(powerupComp);

      (collectionSystem as any).collectItem(collector, powerup, Date.now());

      expect(powerupSpy).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          collectorId: collector.id,
          powerupType: 'speed_boost',
          duration: 10000
        })
      }));
    });
  });

  describe('collection chains', () => {
    it('should create and track collection chains', () => {
      const positions = [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 40, y: 0 }
      ];

      world.createEntity = jest.fn(() => {
        const entity = new Entity(Date.now());
        entity.addComponent = jest.fn();
        entity.getComponent = jest.fn().mockReturnValue(new CollectibleComponent(CollectibleType.EXPERIENCE, 10));
        return entity;
      });

      world.getEntity = jest.fn((id) => {
        const entity = new Entity(id);
        entity.getComponent = jest.fn().mockReturnValue(new CollectibleComponent(CollectibleType.EXPERIENCE, 10));
        return entity;
      });

      const chainIds = collectionSystem.createCollectibleChain(
        positions,
        CollectibleType.EXPERIENCE,
        10,
        0.1
      );

      expect(chainIds).toHaveLength(3);
      expect((collectionSystem as any).activeChains.size).toBe(1);
    });

    it('should complete chains and emit event', () => {
      const chainCompleteSpy = jest.fn();
      eventSystem.on('CHAIN_COMPLETED', chainCompleteSpy);

      const chainId = 'test_chain_123';
      (collectionSystem as any).activeChains.set(chainId, {
        collected: 2,
        total: 3,
        lastCollectionTime: Date.now(),
        bonusMultiplier: 0.3
      });

      (collectionSystem as any).updateChainCollection(chainId, 0.1);

      expect(chainCompleteSpy).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          chainId,
          itemsCollected: 3,
          totalBonus: 0.4
        })
      }));
      expect((collectionSystem as any).activeChains.has(chainId)).toBe(false);
    });

    it('should expire incomplete chains after timeout', () => {
      const oldChainId = 'old_chain';
      const newChainId = 'new_chain';
      const currentTime = Date.now();

      (collectionSystem as any).activeChains.set(oldChainId, {
        collected: 1,
        total: 3,
        lastCollectionTime: currentTime - 15000, // 15 seconds ago
        bonusMultiplier: 0.1
      });

      (collectionSystem as any).activeChains.set(newChainId, {
        collected: 1,
        total: 3,
        lastCollectionTime: currentTime - 5000, // 5 seconds ago
        bonusMultiplier: 0.1
      });

      (collectionSystem as any).updateChains(currentTime);

      // Old chain should be removed (>10s timeout)
      expect((collectionSystem as any).activeChains.has(oldChainId)).toBe(false);
      // New chain should remain
      expect((collectionSystem as any).activeChains.has(newChainId)).toBe(true);
    });
  });

  describe('lifetime management', () => {
    it('should remove expired collectibles', () => {
      const collectible = world.createEntity();
      collectible.addComponent(new TransformComponent(50, 0));
      const collectibleComp = new CollectibleComponent(CollectibleType.EXPERIENCE, 10);
      collectibleComp.lifetime = 1000; // 1 second
      collectibleComp.spawnTime = Date.now() - 2000; // Spawned 2 seconds ago
      collectible.addComponent(collectibleComp);

      world.removeEntity = jest.fn();
      const expireSpy = jest.fn();
      eventSystem.on('COLLECTIBLE_EXPIRED', expireSpy);

      (collectionSystem as any).collectibleCache.set(collectible.id, {
        entity: collectible,
        collectible: collectibleComp,
        transform: collectible.getComponent('transform')
      });

      const context = { deltaTime: 16, timestamp: Date.now(), totalTime: 0, frameCount: 0 };
      const entities = [collectible];

      collectionSystem.update(context, entities as any);

      expect(world.removeEntity).toHaveBeenCalledWith(collectible.id);
      expect(expireSpy).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          entityId: collectible.id
        })
      }));
    });

    it('should auto-collect items after delay', () => {
      const collector = world.createEntity();
      collector.addComponent(new TransformComponent(0, 0));
      collector.addComponent(new MagnetComponent());

      const collectible = world.createEntity();
      collectible.addComponent(new TransformComponent(200, 0)); // Far away
      const collectibleComp = new CollectibleComponent(CollectibleType.CURRENCY, 50);
      collectibleComp.collectionBehavior = CollectionBehavior.AUTOMATIC;
      collectibleComp.autoCollectDelay = 100; // 100ms
      collectibleComp.spawnTime = Date.now() - 200; // Should auto-collect
      collectible.addComponent(collectibleComp);

      const collectionSpy = jest.fn();
      eventSystem.on('COLLECTIBLE_COLLECTED', collectionSpy);

      (collectionSystem as any).magnetCache.set(collector.id, {
        entity: collector,
        magnet: collector.getComponent('magnet'),
        transform: collector.getComponent('transform')
      });

      (collectionSystem as any).collectibleCache.set(collectible.id, {
        entity: collectible,
        collectible: collectibleComp,
        transform: collectible.getComponent('transform')
      });

      const context = { deltaTime: 16, timestamp: Date.now(), totalTime: 0, frameCount: 0 };
      const entities = [collector, collectible];

      collectionSystem.update(context, entities as any);

      // Should auto-collect to nearest collector
      expect(collectionSpy).toHaveBeenCalled();
    });
  });

  describe('magnet activation triggers', () => {
    let collector: Entity;

    beforeEach(() => {
      collector = world.createEntity();
      collector.addComponent(new TransformComponent(0, 0));
      const magnet = new MagnetComponent();
      magnet.trigger = MagnetTrigger.MANUAL;
      magnet.activationDuration = 5000;
      magnet.activationCooldown = 10000;
      collector.addComponent(magnet);
    });

    it('should activate magnet manually', () => {
      // Update system to populate caches
      const context = { deltaTime: 16, timestamp: Date.now(), totalTime: 0, frameCount: 0 };
      collectionSystem.update(context, [collector] as any);

      const currentTime = Date.now();
      const result = collectionSystem.activateMagnet(collector.id, currentTime);

      const magnet = collector.getComponent('magnet') as MagnetComponent;
      
      expect(result).toBe(true);
      expect(magnet.manuallyActivated).toBe(true);
      expect(magnet.lastActivationTime).toBe(currentTime);
    });

    it('should respect activation cooldown', () => {
      const currentTime = Date.now();
      collectionSystem.activateMagnet(collector.id, currentTime);

      // Try to activate again immediately
      const result = collectionSystem.activateMagnet(collector.id, currentTime + 100);

      expect(result).toBe(false); // Should fail due to cooldown
    });

    it('should trigger magnet on specific events', () => {
      const magnet = collector.getComponent('magnet') as MagnetComponent;
      magnet.trigger = MagnetTrigger.ON_KILL;
      magnet.lastActivationTime = 0; // Ensure cooldown has passed
      magnet.activationCooldown = 1000; // Set a cooldown

      (collectionSystem as any).magnetCache.set(collector.id, {
        entity: collector,
        magnet,
        transform: collector.getComponent('transform')
      });

      const currentTime = Date.now();
      // First attempt should work since cooldown has passed
      collectionSystem.triggerMagnetActivation(collector.id, MagnetTrigger.ON_KILL, currentTime);

      expect(magnet.stats.activationCount).toBe(1);
      expect(magnet.lastActivationTime).toBe(currentTime);
    });
  });

  describe('performance optimization', () => {
    it('should use spatial partitioning for efficient queries', () => {
      // Create many collectibles
      const collectibles = [];
      for (let i = 0; i < 100; i++) {
        const collectible = world.createEntity();
        collectible.addComponent(new TransformComponent(i * 10, 0));
        collectible.addComponent(new CollectibleComponent(CollectibleType.EXPERIENCE, 1));
        collectibles.push(collectible);
      }

      const context = { deltaTime: 16, timestamp: Date.now(), totalTime: 0, frameCount: 0 };
      const entities = collectibles;

      collectionSystem.update(context, entities as any);

      const spatialGrid = (collectionSystem as any).spatialGrid;
      const stats = spatialGrid.getStats();
      expect(stats.entityCount).toBeGreaterThan(0);
    });

    it('should limit magnet updates per frame', () => {
      const collector = world.createEntity();
      collector.addComponent(new TransformComponent(0, 0));
      const magnet = new MagnetComponent();
      magnet.maxUpdatesPerFrame = 5;
      collector.addComponent(magnet);

      // Create many collectibles
      const collectibles = [];
      for (let i = 0; i < 20; i++) {
        const collectible = world.createEntity();
        collectible.addComponent(new TransformComponent(50 + i, 0));
        collectible.addComponent(new CollectibleComponent(CollectibleType.EXPERIENCE, 1));
        collectible.addComponent(new MovementComponent());
        collectibles.push(collectible);
      }

      const context = { deltaTime: 16, timestamp: Date.now(), totalTime: 0, frameCount: 0 };
      const entities = [collector, ...collectibles];

      collectionSystem.update(context, entities as any);

      // Should process at most maxUpdatesPerFrame items
      expect(magnet.currentUpdates).toBeLessThanOrEqual(5);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle missing components gracefully', () => {
      const incompleteCollector = world.createEntity();
      incompleteCollector.addComponent(new TransformComponent(0, 0));
      // Missing magnet

      const incompleteCollectible = world.createEntity();
      incompleteCollectible.addComponent(new CollectibleComponent(CollectibleType.EXPERIENCE, 10));
      // Missing transform

      const context = { deltaTime: 16, timestamp: Date.now(), totalTime: 0, frameCount: 0 };
      const entities = [incompleteCollector, incompleteCollectible];

      expect(() => {
        collectionSystem.update(context, entities as any);
      }).not.toThrow();
    });

    it('should handle null world entity lookups', () => {
      world.getEntity = jest.fn().mockReturnValue(null);

      const stats = collectionSystem.getCollectionStats(999);
      expect(stats).toBeNull();
    });

    it('should handle collectibles with stack sizes', () => {
      const collector = world.createEntity();
      collector.addComponent(new TransformComponent(0, 0));
      collector.addComponent(new MagnetComponent());
      collector.addComponent(new InventoryComponent());

      const stackedItem = world.createEntity();
      stackedItem.addComponent(new TransformComponent(0, 0));
      const collectibleComp = new CollectibleComponent(CollectibleType.CURRENCY, 10);
      collectibleComp.currentStack = 5;
      collectibleComp.stackSize = 10;
      stackedItem.addComponent(collectibleComp);

      const inventory = collector.getComponent('inventory') as InventoryComponent;
      const initialGold = inventory.getResource('gold');

      (collectionSystem as any).collectItem(collector, stackedItem, Date.now());

      // Should collect value * stack size
      expect(inventory.getResource('gold')).toBe(initialGold + 50);
    });

    it('should handle collection requirements', () => {
      const collector = world.createEntity();
      collector.addComponent(new TransformComponent(0, 0));
      collector.addComponent(new MagnetComponent());
      const experience = new ExperienceComponent();
      experience.level = 5;
      collector.addComponent(experience);

      const restrictedItem = world.createEntity();
      restrictedItem.addComponent(new TransformComponent(0, 0));
      const collectibleComp = new CollectibleComponent(CollectibleType.WEAPON, 1);
      collectibleComp.requirements = [{
        type: 'level',
        value: 10,
        operator: '>='
      }];
      restrictedItem.addComponent(collectibleComp);

      const collectionSpy = jest.fn();
      eventSystem.on('COLLECTIBLE_COLLECTED', collectionSpy);

      const context = { deltaTime: 16, timestamp: Date.now(), totalTime: 0, frameCount: 0 };
      const entities = [collector, restrictedItem];

      collectionSystem.update(context, entities as any);

      // Should not collect due to level requirement
      expect(collectionSpy).not.toHaveBeenCalled();
    });
  });

  describe('statistics tracking', () => {
    it('should track collection statistics', () => {
      const collector = world.createEntity();
      collector.addComponent(new TransformComponent(0, 0));
      const magnet = new MagnetComponent();
      collector.addComponent(magnet);

      (collectionSystem as any).magnetCache.set(collector.id, {
        entity: collector,
        magnet,
        transform: collector.getComponent('transform')
      });

      // Simulate some collections
      magnet.stats.totalItemsCollected = 10;
      magnet.stats.mostValuableItemCollected = 500;
      magnet.stats.averageCollectionTime = 250;

      const stats = collectionSystem.getCollectionStats(collector.id);

      expect(stats).toEqual(expect.objectContaining({
        totalCollected: 10,
        totalValue: 500,
        collectionRate: 250,
        activeCollectibles: 0
      }));
    });

    it('should track system-wide statistics', () => {
      const systemStats = collectionSystem.getStats();

      expect(systemStats).toEqual(expect.objectContaining({
        totalCollected: 0,
        totalValue: 0,
        chainCompletions: 0,
        collectionsByType: expect.any(Map)
      }));
    });
  });
});
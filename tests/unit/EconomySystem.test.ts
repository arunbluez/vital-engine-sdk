import { EconomySystem } from '../../src/systems/EconomySystem';
import { World } from '../../src/core/ECS/World';
import { Entity } from '../../src/core/ECS/Entity';
import { InventoryComponent } from '../../src/components/Inventory';
import { EventSystem } from '../../src/core/EventSystem';
import { GameEventType } from '../../src/types/Events';

describe('EconomySystem', () => {
  let world: World;
  let economySystem: EconomySystem;
  let eventSystem: EventSystem;

  beforeEach(() => {
    world = new World();
    eventSystem = new EventSystem();
    economySystem = new EconomySystem(eventSystem, world);
    economySystem.initialize();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with correct name and dependencies', () => {
      expect(economySystem.name).toBe('economy');
      expect((economySystem as any).eventSystem).toBe(eventSystem);
      expect((economySystem as any).world).toBe(world);
    });

    it('should have default drop tables', () => {
      expect((economySystem as any).resourceDrops.has('basic_enemy')).toBe(true);
      expect((economySystem as any).resourceDrops.has('elite_enemy')).toBe(true);
      expect((economySystem as any).resourceDrops.has('boss_enemy')).toBe(true);
    });
  });

  describe('resource dropping', () => {
    let entity: Entity;

    beforeEach(() => {
      entity = world.createEntity();
      entity.addComponent(new InventoryComponent(100));
    });

    it('should drop resources based on drop table', () => {
      const resourceSpy = jest.fn();
      eventSystem.on(GameEventType.RESOURCE_GAINED, resourceSpy);

      // Mock Math.random to ensure drops
      const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.1);

      const drops = economySystem.dropResources(entity.id, 'basic_enemy');

      expect(drops.length).toBeGreaterThan(0);
      expect(resourceSpy).toHaveBeenCalled();

      mockRandom.mockRestore();
    });

    it('should respect drop chances', () => {
      // Register a test drop table with no guaranteed drops
      economySystem.registerDropTable('test_enemy', [
        { type: 'rare_item', amount: 1, chance: 0.01 }
      ]);

      // Mock Math.random to prevent drops (higher than 0.01)
      const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.99);

      const drops = economySystem.dropResources(entity.id, 'test_enemy');

      expect(drops.length).toBe(0);

      mockRandom.mockRestore();
    });

    it('should handle non-existent drop tables', () => {
      const drops = economySystem.dropResources(entity.id, 'non_existent');
      expect(drops).toEqual([]);
    });
  });

  describe('resource transfers', () => {
    let sender: Entity;
    let receiver: Entity;

    beforeEach(() => {
      sender = world.createEntity();
      receiver = world.createEntity();
      sender.addComponent(new InventoryComponent(100));
      receiver.addComponent(new InventoryComponent(100));
    });

    it('should transfer resources between entities', () => {
      const senderInventory = sender.getComponent('inventory') as InventoryComponent;
      senderInventory.addResource('gold', 100);

      const transferSpy = jest.fn();
      eventSystem.on(GameEventType.RESOURCE_TRANSFERRED, transferSpy);

      const success = economySystem.transferResource(sender.id, receiver.id, 'gold', 50);

      expect(success).toBe(true);
      expect(senderInventory.getResource('gold')).toBe(50);

      const receiverInventory = receiver.getComponent('inventory') as InventoryComponent;
      expect(receiverInventory.getResource('gold')).toBe(50);

      expect(transferSpy).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          fromEntityId: sender.id,
          toEntityId: receiver.id,
          resourceType: 'gold',
          amount: 50
        })
      }));
    });

    it('should fail if sender has insufficient resources', () => {
      const senderInventory = sender.getComponent('inventory') as InventoryComponent;
      senderInventory.addResource('gold', 10);

      const success = economySystem.transferResource(sender.id, receiver.id, 'gold', 50);

      expect(success).toBe(false);
      expect(senderInventory.getResource('gold')).toBe(10);
    });

    it('should fail if entities are invalid', () => {
      expect(economySystem.transferResource(999, receiver.id, 'gold', 50)).toBe(false);
      expect(economySystem.transferResource(sender.id, 999, 'gold', 50)).toBe(false);
    });
  });

  describe('item transfers', () => {
    let sender: Entity;
    let receiver: Entity;

    beforeEach(() => {
      sender = world.createEntity();
      receiver = world.createEntity();
      sender.addComponent(new InventoryComponent(10));
      receiver.addComponent(new InventoryComponent(10));
    });

    it('should transfer items between entities', () => {
      const senderInventory = sender.getComponent('inventory') as InventoryComponent;
      senderInventory.addItem({ type: 'health_potion', quantity: 5 });

      const transferSpy = jest.fn();
      eventSystem.on('ITEM_TRANSFERRED', transferSpy);

      const success = economySystem.transferItem(sender.id, receiver.id, 'health_potion', 3);

      expect(success).toBe(true);
      expect(senderInventory.getItemQuantity('health_potion')).toBe(2);

      const receiverInventory = receiver.getComponent('inventory') as InventoryComponent;
      expect(receiverInventory.getItemQuantity('health_potion')).toBe(3);

      expect(transferSpy).toHaveBeenCalled();
    });

    it('should fail if sender has insufficient items', () => {
      const senderInventory = sender.getComponent('inventory') as InventoryComponent;
      senderInventory.addItem({ type: 'health_potion', quantity: 1 });

      const success = economySystem.transferItem(sender.id, receiver.id, 'health_potion', 3);

      expect(success).toBe(false);
      expect(senderInventory.getItemQuantity('health_potion')).toBe(1);
    });

    it('should fail if receiver has no space', () => {
      const senderInventory = sender.getComponent('inventory') as InventoryComponent;
      const receiverInventory = receiver.getComponent('inventory') as InventoryComponent;
      
      // Fill receiver inventory
      for (let i = 0; i < 10; i++) {
        receiverInventory.addItem({ type: `item_${i}`, quantity: 1 });
      }

      senderInventory.addItem({ type: 'health_potion', quantity: 5 });

      const success = economySystem.transferItem(sender.id, receiver.id, 'health_potion', 3);

      expect(success).toBe(false);
      expect(senderInventory.getItemQuantity('health_potion')).toBe(5);
    });
  });

  describe('shop system', () => {
    let player: Entity;

    beforeEach(() => {
      player = world.createEntity();
      player.addComponent(new InventoryComponent(10));
      
      // Register shop items
      economySystem.registerShopItem('health_potion', {
        itemType: 'health_potion',
        cost: { gold: 50 },
        stock: 10
      });
      
      economySystem.registerShopItem('sword', {
        itemType: 'sword',
        cost: { gold: 100, gems: 5 }
      });
    });

    it('should purchase items from shop', () => {
      const inventory = player.getComponent('inventory') as InventoryComponent;
      inventory.addResource('gold', 100);

      const purchaseSpy = jest.fn();
      eventSystem.on(GameEventType.ITEM_PURCHASED, purchaseSpy);

      const success = economySystem.purchaseItem(player.id, 'health_potion');

      expect(success).toBe(true);
      expect(inventory.getResource('gold')).toBe(50);
      expect(inventory.getItemQuantity('health_potion')).toBe(1);

      expect(purchaseSpy).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          entityId: player.id,
          itemType: 'health_potion',
          cost: { gold: 50 }
        })
      }));
    });

    it('should fail if insufficient resources', () => {
      const inventory = player.getComponent('inventory') as InventoryComponent;
      inventory.addResource('gold', 25);

      const success = economySystem.purchaseItem(player.id, 'health_potion');

      expect(success).toBe(false);
      expect(inventory.getResource('gold')).toBe(25);
      expect(inventory.getItemQuantity('health_potion')).toBe(0);
    });

    it('should handle multiple resource costs', () => {
      const inventory = player.getComponent('inventory') as InventoryComponent;
      inventory.addResource('gold', 100);
      inventory.addResource('gems', 5);

      const success = economySystem.purchaseItem(player.id, 'sword');

      expect(success).toBe(true);
      expect(inventory.getResource('gold')).toBe(0);
      expect(inventory.getResource('gems')).toBe(0);
      expect(inventory.getItemQuantity('sword')).toBe(1);
    });

    it('should respect stock limits', () => {
      const inventory = player.getComponent('inventory') as InventoryComponent;
      inventory.addResource('gold', 1000);

      // Buy all stock
      for (let i = 0; i < 10; i++) {
        economySystem.purchaseItem(player.id, 'health_potion');
      }

      // Try to buy one more
      const success = economySystem.purchaseItem(player.id, 'health_potion');
      expect(success).toBe(false);
    });

    it('should fail if no inventory space', () => {
      const inventory = player.getComponent('inventory') as InventoryComponent;
      inventory.addResource('gold', 1000);
      
      // Fill inventory
      for (let i = 0; i < 10; i++) {
        inventory.addItem({ type: `item_${i}`, quantity: 1 });
      }

      const success = economySystem.purchaseItem(player.id, 'health_potion');
      expect(success).toBe(false);
    });
  });

  describe('net worth calculation', () => {
    let player: Entity;

    beforeEach(() => {
      player = world.createEntity();
      player.addComponent(new InventoryComponent(100));
    });

    it('should calculate net worth based on valuation table', () => {
      const inventory = player.getComponent('inventory') as InventoryComponent;
      inventory.addResource('gold', 100);
      inventory.addResource('gems', 10);
      inventory.addItem({ type: 'sword', quantity: 2 });
      inventory.addItem({ type: 'health_potion', quantity: 5 });

      const valuationTable = {
        gold: 1,
        gems: 10,
        sword: 50,
        health_potion: 25
      };

      const netWorth = economySystem.calculateNetWorth(player.id, valuationTable);

      expect(netWorth).toBe(100 + 100 + 100 + 125); // 425
    });

    it('should handle missing valuations', () => {
      const inventory = player.getComponent('inventory') as InventoryComponent;
      inventory.addResource('gold', 100);
      inventory.addItem({ type: 'unknown_item', quantity: 5 });

      const valuationTable = {
        gold: 1
      };

      const netWorth = economySystem.calculateNetWorth(player.id, valuationTable);

      expect(netWorth).toBe(100); // Only valued items counted
    });

    it('should return 0 for invalid entities', () => {
      const netWorth = economySystem.calculateNetWorth(999, {});
      expect(netWorth).toBe(0);
    });
  });

  describe('drop table registration', () => {
    it('should register custom drop tables', () => {
      economySystem.registerDropTable('custom_enemy', [
        { type: 'gold', amount: 50, chance: 1.0 },
        { type: 'rare_gem', amount: 1, chance: 0.1 }
      ]);

      const entity = world.createEntity();
      entity.addComponent(new InventoryComponent(100));

      const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.05);
      const drops = economySystem.dropResources(entity.id, 'custom_enemy');

      expect(drops).toHaveLength(2);
      expect(drops[0]).toEqual({ type: 'gold', quantity: 50 });
      expect(drops[1]).toEqual({ type: 'rare_gem', quantity: 1 });

      mockRandom.mockRestore();
    });
  });

  describe('event handling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it('should handle entity killed events', () => {
      const killer = world.createEntity();
      const victim = world.createEntity();
      killer.addComponent(new InventoryComponent(100));

      const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.1);

      eventSystem.emit(GameEventType.ENTITY_KILLED, {
        killerEntityId: killer.id,
        victimEntityId: victim.id,
        victimType: 'enemy_goblin'
      });

      // Give event time to process
      jest.runAllTimers();

      mockRandom.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should handle entities without inventory', () => {
      const entity = world.createEntity();
      
      expect(economySystem.transferResource(entity.id, entity.id, 'gold', 50)).toBe(false);
      expect(economySystem.transferItem(entity.id, entity.id, 'item', 1)).toBe(false);
      expect(economySystem.purchaseItem(entity.id, 'health_potion')).toBe(false);
      expect(economySystem.calculateNetWorth(entity.id, {})).toBe(0);
    });

    it('should handle invalid shop items', () => {
      const player = world.createEntity();
      player.addComponent(new InventoryComponent(10));

      expect(economySystem.purchaseItem(player.id, 'non_existent')).toBe(false);
    });
  });
});
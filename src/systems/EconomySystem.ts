import { System } from '../core/ECS/System'
import type { 
  EntityQuery, 
  SystemUpdateContext, 
  ComponentType 
} from '../types/CoreTypes'
import type { InventoryComponent, ItemStack } from '../components/Inventory'
import { GameEventType } from '../types/Events'

type EconomyEntityQuery = EntityQuery & {
  components: {
    inventory: InventoryComponent
  }
}

export interface ResourceDrop {
  type: string
  amount: number
  chance: number
}

export interface ShopItem {
  itemType: string
  cost: Record<string, number>
  stock?: number
  metadata?: Record<string, unknown>
}

/**
 * Economy system handles resource management, item collection, and trading
 */
export class EconomySystem extends System {
  readonly name = 'economy'
  readonly requiredComponents: ComponentType[] = ['inventory']

  private eventSystem?: any
  private world?: any
  private resourceDrops: Map<string, ResourceDrop[]> = new Map()
  private shopItems: Map<string, ShopItem> = new Map()

  constructor(eventSystem?: any, world?: any) {
    super()
    this.eventSystem = eventSystem
    this.world = world
    this.initializeDropTables()
  }

  private initializeDropTables(): void {
    // Default enemy drop tables
    this.resourceDrops.set('basic_enemy', [
      { type: 'gold', amount: 5, chance: 1.0 },
      { type: 'xp_gem', amount: 1, chance: 0.3 },
    ])

    this.resourceDrops.set('elite_enemy', [
      { type: 'gold', amount: 15, chance: 1.0 },
      { type: 'xp_gem', amount: 3, chance: 0.7 },
      { type: 'rare_material', amount: 1, chance: 0.1 },
    ])
  }

  update(_context: SystemUpdateContext, _entities: EntityQuery[]): void {
    // Economy system mainly reacts to events
    // Could be used for passive resource generation if needed
  }

  initialize(): void {
    if (this.eventSystem) {
      this.eventSystem.on(GameEventType.ENTITY_KILLED, this.handleEntityKilled.bind(this))
    }
  }

  private handleEntityKilled(event: any): void {
    const { killerId, entityId: _entityId } = event.data

    if (!killerId) return

    // Drop resources based on killed entity type
    this.dropResources(killerId, 'basic_enemy') // This would be determined by entity type
  }

  /**
   * Drops resources for an entity based on drop table
   */
  dropResources(entityId: number, dropTableKey: string): ItemStack[] {
    const drops = this.resourceDrops.get(dropTableKey)
    if (!drops) {
      return []
    }

    const entities = this.getEntitiesWithInventory()
    const entity = entities.find(e => e.id === entityId)

    if (!entity) {
      return []
    }

    const droppedItems: ItemStack[] = []

    drops.forEach(drop => {
      if (Math.random() < drop.chance) {
        const success = entity.components.inventory.addResource(drop.type, drop.amount)
        
        if (success) {
          droppedItems.push({
            type: drop.type,
            quantity: drop.amount,
          })

          if (this.eventSystem) {
            this.eventSystem.emit(GameEventType.RESOURCE_GAINED, {
              entityId,
              resourceType: drop.type,
              amount: drop.amount,
              source: dropTableKey,
              timestamp: Date.now(),
            })
          }
        }
      }
    })

    return droppedItems
  }

  /**
   * Transfers resources between entities
   */
  transferResource(
    fromEntityId: number,
    toEntityId: number,
    resourceType: string,
    amount: number
  ): boolean {
    const entities = this.getEntitiesWithInventory()
    const fromEntity = entities.find(e => e.id === fromEntityId)
    const toEntity = entities.find(e => e.id === toEntityId)

    if (!fromEntity || !toEntity) {
      return false
    }

    // Check if sender has enough resources
    if (!fromEntity.components.inventory.hasResource(resourceType, amount)) {
      return false
    }

    // Perform the transfer
    const removed = fromEntity.components.inventory.removeResource(resourceType, amount)
    if (!removed) {
      return false
    }

    toEntity.components.inventory.addResource(resourceType, amount)

    if (this.eventSystem) {
      this.eventSystem.emit('RESOURCE_TRANSFERRED', {
        fromEntityId,
        toEntityId,
        resourceType,
        amount,
        timestamp: Date.now(),
      })
    }

    return true
  }

  /**
   * Transfers items between entities
   */
  transferItem(
    fromEntityId: number,
    toEntityId: number,
    itemType: string,
    quantity: number,
    metadata?: Record<string, unknown>
  ): boolean {
    const entities = this.getEntitiesWithInventory()
    const fromEntity = entities.find(e => e.id === fromEntityId)
    const toEntity = entities.find(e => e.id === toEntityId)

    if (!fromEntity || !toEntity) {
      return false
    }

    // Check if sender has the item
    if (!fromEntity.components.inventory.hasItem(itemType, quantity, metadata)) {
      return false
    }

    // Check if receiver has space
    if (toEntity.components.inventory.isFull()) {
      return false
    }

    // Perform the transfer
    const removed = fromEntity.components.inventory.removeItem(itemType, quantity, metadata)
    if (!removed) {
      return false
    }

    const added = toEntity.components.inventory.addItem({
      type: itemType,
      quantity,
      metadata,
    })

    if (!added) {
      // Rollback if failed to add
      fromEntity.components.inventory.addItem({
        type: itemType,
        quantity,
        metadata,
      })
      return false
    }

    if (this.eventSystem) {
      this.eventSystem.emit('ITEM_TRANSFERRED', {
        fromEntityId,
        toEntityId,
        itemType,
        quantity,
        metadata,
        timestamp: Date.now(),
      })
    }

    return true
  }

  /**
   * Purchases an item from the shop
   */
  purchaseItem(entityId: number, shopItemKey: string): boolean {
    const shopItem = this.shopItems.get(shopItemKey)
    if (!shopItem) {
      return false
    }

    // Check stock
    if (shopItem.stock !== undefined && shopItem.stock <= 0) {
      return false
    }

    const entities = this.getEntitiesWithInventory()
    const entity = entities.find(e => e.id === entityId)

    if (!entity) {
      return false
    }

    // Check if player has enough resources
    for (const [resourceType, cost] of Object.entries(shopItem.cost)) {
      if (!entity.components.inventory.hasResource(resourceType, cost)) {
        return false
      }
    }

    // Check if player has inventory space
    if (entity.components.inventory.isFull()) {
      return false
    }

    // Deduct costs
    for (const [resourceType, cost] of Object.entries(shopItem.cost)) {
      entity.components.inventory.removeResource(resourceType, cost)
    }

    // Add item to inventory
    const success = entity.components.inventory.addItem({
      type: shopItem.itemType,
      quantity: 1,
      metadata: shopItem.metadata,
    })

    if (!success) {
      // Rollback costs if item couldn't be added
      for (const [resourceType, cost] of Object.entries(shopItem.cost)) {
        entity.components.inventory.addResource(resourceType, cost)
      }
      return false
    }

    // Update stock
    if (shopItem.stock !== undefined) {
      shopItem.stock--
    }

    if (this.eventSystem) {
      this.eventSystem.emit('ITEM_PURCHASED', {
        entityId,
        itemType: shopItem.itemType,
        cost: shopItem.cost,
        timestamp: Date.now(),
      })
    }

    return true
  }

  /**
   * Registers a new drop table
   */
  registerDropTable(key: string, drops: ResourceDrop[]): void {
    this.resourceDrops.set(key, drops)
  }

  /**
   * Registers a shop item
   */
  registerShopItem(key: string, item: ShopItem): void {
    this.shopItems.set(key, item)
  }

  /**
   * Gets the total value of an entity's resources
   */
  calculateNetWorth(entityId: number, valuationTable: Record<string, number>): number {
    const entities = this.getEntitiesWithInventory()
    const entity = entities.find(e => e.id === entityId)

    if (!entity) {
      return 0
    }

    let totalValue = 0

    // Calculate resource values
    entity.components.inventory.resources.forEach((amount, resourceType) => {
      const value = valuationTable[resourceType] ?? 0
      totalValue += amount * value
    })

    // Calculate item values
    entity.components.inventory.items.forEach(item => {
      const value = valuationTable[item.type] ?? 0
      totalValue += item.quantity * value
    })

    return totalValue
  }

  /**
   * Helper to get all entities with inventory components
   */
  private getEntitiesWithInventory(): EconomyEntityQuery[] {
    if (!this.world) {
      return []
    }

    const entities = this.world.getEntitiesWithComponents(['inventory'])
    return entities.map((entity: any) => ({
      id: entity.id,
      components: {
        inventory: entity.getComponent('inventory')
      }
    }))
  }
}
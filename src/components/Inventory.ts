import { Component } from '../core/ECS/Component'

export interface ResourceType {
  name: string
  stackSize: number
  value: number
}

export interface ItemStack {
  type: string
  quantity: number
  metadata?: Record<string, unknown>
}

/**
 * Inventory component for entities that can carry items and resources
 */
export class InventoryComponent extends Component {
  readonly type = 'inventory'
  
  resources: Map<string, number>
  items: ItemStack[]
  maxSlots: number

  constructor(maxSlots: number = 20) {
    super()
    this.resources = new Map()
    this.items = []
    this.maxSlots = maxSlots
  }

  /**
   * Adds a resource amount
   */
  addResource(resourceType: string, amount: number): number {
    const current = this.resources.get(resourceType) ?? 0
    const newAmount = current + amount
    this.resources.set(resourceType, newAmount)
    return newAmount
  }

  /**
   * Removes a resource amount
   */
  removeResource(resourceType: string, amount: number): boolean {
    const current = this.resources.get(resourceType) ?? 0
    if (current < amount) {
      return false
    }
    
    const newAmount = current - amount
    if (newAmount <= 0) {
      this.resources.delete(resourceType)
    } else {
      this.resources.set(resourceType, newAmount)
    }
    
    return true
  }

  /**
   * Gets the amount of a resource
   */
  getResource(resourceType: string): number {
    return this.resources.get(resourceType) ?? 0
  }

  /**
   * Checks if the inventory has enough of a resource
   */
  hasResource(resourceType: string, amount: number): boolean {
    return this.getResource(resourceType) >= amount
  }

  /**
   * Adds an item to the inventory
   */
  addItem(item: ItemStack): boolean {
    // Try to stack with existing items
    const existingItem = this.items.find(
      (existing) => 
        existing.type === item.type && 
        JSON.stringify(existing.metadata) === JSON.stringify(item.metadata)
    )

    if (existingItem) {
      existingItem.quantity += item.quantity
      return true
    }

    // Add as new item if there's space
    if (this.items.length < this.maxSlots) {
      this.items.push({ ...item })
      return true
    }

    return false
  }

  /**
   * Removes an item from the inventory
   */
  removeItem(itemType: string, quantity: number, metadata?: Record<string, unknown>): boolean {
    const itemIndex = this.items.findIndex(
      (item) => 
        item.type === itemType && 
        JSON.stringify(item.metadata) === JSON.stringify(metadata)
    )

    if (itemIndex === -1) {
      return false
    }

    const item = this.items[itemIndex]
    if (item.quantity < quantity) {
      return false
    }

    item.quantity -= quantity
    if (item.quantity <= 0) {
      this.items.splice(itemIndex, 1)
    }

    return true
  }

  /**
   * Gets the quantity of an item
   */
  getItemQuantity(itemType: string, metadata?: Record<string, unknown>): number {
    const item = this.items.find(
      (item) => 
        item.type === itemType && 
        JSON.stringify(item.metadata) === JSON.stringify(metadata)
    )
    return item?.quantity ?? 0
  }

  /**
   * Checks if the inventory has an item
   */
  hasItem(itemType: string, quantity: number = 1, metadata?: Record<string, unknown>): boolean {
    return this.getItemQuantity(itemType, metadata) >= quantity
  }

  /**
   * Gets the number of free slots
   */
  getFreeSlots(): number {
    return this.maxSlots - this.items.length
  }

  /**
   * Checks if the inventory is full
   */
  isFull(): boolean {
    return this.items.length >= this.maxSlots
  }

  /**
   * Clears all items and resources
   */
  clear(): void {
    this.items.length = 0
    this.resources.clear()
  }

  clone(): Component {
    const clone = new InventoryComponent(this.maxSlots)
    
    // Clone resources
    this.resources.forEach((amount, type) => {
      clone.resources.set(type, amount)
    })

    // Clone items
    clone.items = this.items.map(item => ({
      type: item.type,
      quantity: item.quantity,
      metadata: item.metadata ? { ...item.metadata } : undefined,
    }))

    return clone
  }

  serialize(): Record<string, unknown> {
    return {
      resources: Object.fromEntries(this.resources),
      items: this.items.map(item => ({ ...item })),
      maxSlots: this.maxSlots,
    }
  }

  deserialize(data: Record<string, unknown>): void {
    const resources = data.resources as Record<string, number>
    const items = data.items as ItemStack[]
    
    this.resources.clear()
    Object.entries(resources).forEach(([type, amount]) => {
      this.resources.set(type, amount)
    })

    this.items = items.map(item => ({ ...item }))
    this.maxSlots = data.maxSlots as number
  }
}
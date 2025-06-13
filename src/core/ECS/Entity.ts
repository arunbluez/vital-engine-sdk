import type {
  EntityId,
  ComponentType,
  ComponentMap,
  EntitySnapshot,
} from '../../types/CoreTypes'
import { Component, ComponentRegistry } from './Component'
import type { Poolable } from '../../utils/Pooling'

/**
 * Entity class representing a game object in the ECS architecture.
 * Entities are containers for components and have a unique identifier.
 */
export class Entity implements Poolable {
  private static nextId: EntityId = 1
  private _components: ComponentMap = new Map()
  private _active: boolean = true
  public id: EntityId

  constructor(id?: EntityId) {
    this.id = id ?? Entity.nextId++
  }

  /**
   * Adds a component to the entity
   */
  addComponent<T extends Component>(component: T): Entity {
    if (this._components.has(component.type)) {
      throw new Error(
        `Entity ${this.id} already has component of type "${component.type}"`
      )
    }
    this._components.set(component.type, component)
    return this
  }

  /**
   * Removes a component from the entity
   */
  removeComponent(componentType: ComponentType): Entity {
    const component = this._components.get(componentType)
    if (component) {
      this._components.delete(componentType)
      // Return component to pool
      ComponentRegistry.release(component)
    }
    return this
  }

  /**
   * Gets a component by type
   */
  getComponent<T extends Component>(componentType: ComponentType): T | null {
    return (this._components.get(componentType) as T) ?? null
  }

  /**
   * Checks if the entity has a component
   */
  hasComponent(componentType: ComponentType): boolean {
    return this._components.has(componentType)
  }

  /**
   * Checks if the entity has all specified components
   */
  hasComponents(componentTypes: ComponentType[]): boolean {
    return componentTypes.every((type) => this._components.has(type))
  }

  /**
   * Gets all components on the entity
   */
  getComponents(): Component[] {
    return Array.from(this._components.values()) as Component[]
  }

  /**
   * Gets all component types on the entity
   */
  getComponentTypes(): ComponentType[] {
    return Array.from(this._components.keys())
  }

  /**
   * Activates or deactivates the entity
   */
  setActive(active: boolean): void {
    this._active = active
  }

  /**
   * Checks if the entity is active
   */
  isActive(): boolean {
    return this._active
  }

  /**
   * Creates a snapshot of the entity state
   */
  snapshot(): EntitySnapshot {
    const components: Record<ComponentType, Component> = {}
    this._components.forEach((component, type) => {
      components[type] = component.clone()
    })

    return {
      id: this.id,
      components,
      active: this._active,
    }
  }

  /**
   * Clears all components from the entity
   */
  clear(): void {
    // Return all components to their pools
    this._components.forEach((component) => {
      ComponentRegistry.release(component)
    })
    this._components.clear()
  }

  /**
   * Resets the entity for reuse (Poolable interface)
   */
  reset(): void {
    this.clear()
    this._active = true
  }

  /**
   * Sets the entity ID (used when acquiring from pool)
   */
  setId(id: EntityId): void {
    this.id = id
  }

  /**
   * Resets the entity ID counter (mainly for testing)
   */
  static resetIdCounter(): void {
    Entity.nextId = 1
  }

  /**
   * Gets the next entity ID without incrementing
   */
  static getNextId(): EntityId {
    return Entity.nextId
  }

  /**
   * Increments and returns the next entity ID
   */
  static generateId(): EntityId {
    return Entity.nextId++
  }
}

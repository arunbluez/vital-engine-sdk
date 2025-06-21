import type {
  Component as IComponent,
  ComponentType,
} from '../../types/CoreTypes'
import {
  ObjectPool,
  type PoolFactory,
  type Poolable,
} from '../../utils/Pooling'

/**
 * Base class for all components in the ECS architecture.
 * Components are pure data containers with no logic.
 */
export abstract class Component implements IComponent, Poolable {
  abstract readonly type: ComponentType

  /**
   * Creates a deep clone of the component
   */
  abstract clone(): Component

  /**
   * Serializes the component to a plain object
   */
  abstract serialize(): Record<string, unknown>

  /**
   * Deserializes data into the component
   */
  abstract deserialize(data: Record<string, unknown>): void

  /**
   * Resets the component for reuse (Poolable interface)
   * Default implementation calls deserialize with empty object
   */
  reset(): void {
    this.deserialize({})
  }
}

/**
 * Component registry for managing component types
 */
export class ComponentRegistry {
  private static components = new Map<ComponentType, typeof Component>()
  private static componentPools = new Map<
    ComponentType,
    ObjectPool<Component>
  >()
  private static poolingEnabled = true

  /**
   * Registers a component type
   */
  static register<T extends Component>(
    type: ComponentType,
    componentClass: new (...args: unknown[]) => T,
    poolConfig?: { initialSize?: number; maxSize?: number }
  ): void {
    if (ComponentRegistry.components.has(type)) {
      throw new Error(`Component type "${type}" is already registered`)
    }
    ComponentRegistry.components.set(type, componentClass as typeof Component)

    // Create component pool if pooling is enabled
    if (ComponentRegistry.poolingEnabled) {
      const factory: PoolFactory<Component> = {
        create: () => new componentClass() as Component,
        reset: (component: Component) => component.reset(),
      }

      const pool = new ObjectPool(factory, {
        initialSize: poolConfig?.initialSize ?? 50,
        maxSize: poolConfig?.maxSize ?? 1000,
        autoResize: true,
        enableMetrics: true,
      })

      ComponentRegistry.componentPools.set(type, pool)
    }
  }

  /**
   * Creates a component instance from type and data
   */
  static create(
    type: ComponentType,
    data?: Record<string, unknown>
  ): Component {
    const ComponentClass = ComponentRegistry.components.get(type)
    if (!ComponentClass) {
      throw new Error(`Unknown component type: ${type}`)
    }

    let component: Component

    // Try to get from pool if pooling is enabled
    if (ComponentRegistry.poolingEnabled) {
      const pool = ComponentRegistry.componentPools.get(type)
      if (pool) {
        component = pool.acquire()
      } else {
        // No pool, create directly
        const Constructor = ComponentClass as new (
          ...args: unknown[]
        ) => Component
        component = new Constructor()
      }
    } else {
      // Pooling disabled, create directly
      const Constructor = ComponentClass as new (
        ...args: unknown[]
      ) => Component
      component = new Constructor()
    }

    if (data) {
      component.deserialize(data)
    }
    return component
  }

  /**
   * Checks if a component type is registered
   */
  static has(type: ComponentType): boolean {
    return ComponentRegistry.components.has(type)
  }

  /**
   * Gets all registered component types
   */
  static getTypes(): ComponentType[] {
    return Array.from(ComponentRegistry.components.keys())
  }

  /**
   * Returns a component to the pool
   */
  static release(component: Component): void {
    if (!ComponentRegistry.poolingEnabled) {
      return
    }

    const pool = ComponentRegistry.componentPools.get(component.type)
    if (pool) {
      pool.release(component)
    }
  }

  /**
   * Enables or disables component pooling
   */
  static setPoolingEnabled(enabled: boolean): void {
    ComponentRegistry.poolingEnabled = enabled
  }

  /**
   * Gets pool statistics for a component type
   */
  static getPoolStats(type: ComponentType) {
    const pool = ComponentRegistry.componentPools.get(type)
    return pool ? pool.getStatistics(type) : null
  }

  /**
   * Gets pool statistics for all component types
   */
  static getAllPoolStats() {
    const stats = new Map()
    ComponentRegistry.componentPools.forEach((pool, type) => {
      stats.set(type, pool.getStatistics(type))
    })
    return stats
  }

  /**
   * Pre-warms component pools
   */
  static prewarmPools(sizes: Map<ComponentType, number>): void {
    sizes.forEach((size, type) => {
      const pool = ComponentRegistry.componentPools.get(type)
      if (pool) {
        pool.prewarm(size)
      }
    })
  }

  /**
   * Clears all registered components (mainly for testing)
   */
  static clear(): void {
    // Clear all pools first
    ComponentRegistry.componentPools.forEach((pool) => pool.clear())
    ComponentRegistry.componentPools.clear()
    ComponentRegistry.components.clear()
  }
}

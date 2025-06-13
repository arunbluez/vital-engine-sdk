import type {
  System as ISystem,
  SystemName,
  ComponentType,
  EntityQuery,
  SystemUpdateContext,
  SystemSnapshot,
} from '../../types/CoreTypes'
import { BatchProcessor, type BatchConfig } from '../../utils/BatchProcessor'

/**
 * Base class for all systems in the ECS architecture.
 * Systems contain the game logic and operate on entities with specific components.
 */
export abstract class System implements ISystem {
  abstract readonly name: SystemName
  abstract readonly requiredComponents: ComponentType[]

  private _enabled: boolean = true
  private _entityCount: number = 0
  private _lastUpdateTime: number = 0
  private _batchProcessor: BatchProcessor<EntityQuery> | null = null
  protected batchConfig: BatchConfig = {
    batchSize: 100,
    maxBatchTime: 2,
    enableParallelProcessing: false
  }

  /**
   * Main update method called each frame
   */
  abstract update(context: SystemUpdateContext, entities: EntityQuery[]): void

  /**
   * Batch update method for processing entities in batches
   * Override this method to implement batch processing logic
   */
  protected updateBatch?(context: SystemUpdateContext, batch: EntityQuery[]): void

  /**
   * Processes entities using batch processing
   */
  protected processBatches(context: SystemUpdateContext, entities: EntityQuery[]): void {
    if (!this._batchProcessor) {
      this._batchProcessor = new BatchProcessor(this.batchConfig)
    }

    if (this.updateBatch) {
      this._batchProcessor.processBatchesSync(entities, (batch) => {
        this.updateBatch!(context, batch)
      })

      // Adjust batch size based on performance
      this._batchProcessor.adjustBatchSize(this.batchConfig.maxBatchTime)
    } else {
      // Fallback to regular update if updateBatch is not implemented
      this.update(context, entities)
    }
  }

  /**
   * Optional initialization method
   */
  initialize?(): void

  /**
   * Optional cleanup method
   */
  destroy?(): void

  /**
   * Enables or disables the system
   */
  setEnabled(enabled: boolean): void {
    this._enabled = enabled
  }

  /**
   * Gets whether the system is enabled
   */
  get enabled(): boolean {
    return this._enabled
  }

  /**
   * Updates internal metrics (called by World)
   */
  updateMetrics(entityCount: number, updateTime: number): void {
    this._entityCount = entityCount
    this._lastUpdateTime = updateTime
  }

  /**
   * Creates a snapshot of the system state
   */
  snapshot(): SystemSnapshot {
    const batchMetrics = this._batchProcessor?.getMetrics()
    return {
      name: this.name,
      enabled: this._enabled,
      entityCount: this._entityCount,
      updateTime: this._lastUpdateTime,
      batchMetrics: batchMetrics ? {
        batchesProcessed: batchMetrics.batchesProcessed,
        averageBatchTime: batchMetrics.averageBatchTime,
        currentBatchSize: this.batchConfig.batchSize
      } : undefined
    }
  }

  /**
   * Helper method to check if an entity has all required components
   */
  protected hasRequiredComponents(componentTypes: Set<ComponentType>): boolean {
    return this.requiredComponents.every((type) => componentTypes.has(type))
  }

  /**
   * Sets batch processing configuration
   */
  setBatchConfig(config: Partial<BatchConfig>): void {
    this.batchConfig = { ...this.batchConfig, ...config }
    if (this._batchProcessor) {
      this._batchProcessor = new BatchProcessor(this.batchConfig)
    }
  }

  /**
   * Gets batch processing metrics
   */
  getBatchMetrics() {
    return this._batchProcessor?.getMetrics() ?? null
  }
}

/**
 * System registry for managing system types
 */
export class SystemRegistry {
  private static systems = new Map<SystemName, typeof System>()

  /**
   * Registers a system type
   */
  static register<T extends System>(
    name: SystemName,
    systemClass: new (...args: unknown[]) => T
  ): void {
    if (SystemRegistry.systems.has(name)) {
      throw new Error(`System "${name}" is already registered`)
    }
    SystemRegistry.systems.set(name, systemClass as typeof System)
  }

  /**
   * Creates a system instance
   */
  static create(name: SystemName, ...args: unknown[]): System {
    const SystemClass = SystemRegistry.systems.get(name)
    if (!SystemClass) {
      throw new Error(`Unknown system: ${name}`)
    }
    // Type assertion is safe here as we control the registry
    const Constructor = SystemClass as new (...args: unknown[]) => System
    return new Constructor(...args)
  }

  /**
   * Checks if a system is registered
   */
  static has(name: SystemName): boolean {
    return SystemRegistry.systems.has(name)
  }

  /**
   * Gets all registered system names
   */
  static getNames(): SystemName[] {
    return Array.from(SystemRegistry.systems.keys())
  }

  /**
   * Clears all registered systems (mainly for testing)
   */
  static clear(): void {
    SystemRegistry.systems.clear()
  }
}

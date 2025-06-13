/**
 * Batch processing utilities for optimizing system updates
 */

export interface BatchConfig {
  batchSize: number
  maxBatchTime: number // milliseconds
  enableParallelProcessing?: boolean
}

export interface BatchMetrics {
  totalItems: number
  batchesProcessed: number
  averageBatchTime: number
  maxBatchTime: number
  minBatchTime: number
}

/**
 * Generic batch processor for handling large arrays of items efficiently
 */
export class BatchProcessor<T> {
  private config: BatchConfig
  private metrics: BatchMetrics = {
    totalItems: 0,
    batchesProcessed: 0,
    averageBatchTime: 0,
    maxBatchTime: 0,
    minBatchTime: Infinity
  }

  constructor(config: Partial<BatchConfig> = {}) {
    this.config = {
      batchSize: config.batchSize ?? 100,
      maxBatchTime: config.maxBatchTime ?? 2, // 2ms default
      enableParallelProcessing: config.enableParallelProcessing ?? false
    }
  }

  /**
   * Processes items in batches with time slicing
   */
  async processBatches<R>(
    items: T[],
    processor: (batch: T[]) => R | Promise<R>
  ): Promise<R[]> {
    const results: R[] = []
    const startTime = performance.now()
    
    this.metrics.totalItems = items.length
    this.metrics.batchesProcessed = 0

    for (let i = 0; i < items.length; i += this.config.batchSize) {
      const batchStart = performance.now()
      const batch = items.slice(i, Math.min(i + this.config.batchSize, items.length))
      
      const result = await processor(batch)
      results.push(result)
      
      const batchTime = performance.now() - batchStart
      this.updateMetrics(batchTime)
      
      // Yield to event loop if batch took too long
      if (batchTime > this.config.maxBatchTime && i + this.config.batchSize < items.length) {
        await this.yieldToEventLoop()
      }
    }

    return results
  }

  /**
   * Processes items in batches synchronously
   */
  processBatchesSync<R>(
    items: T[],
    processor: (batch: T[]) => R
  ): R[] {
    const results: R[] = []
    
    this.metrics.totalItems = items.length
    this.metrics.batchesProcessed = 0

    for (let i = 0; i < items.length; i += this.config.batchSize) {
      const batchStart = performance.now()
      const batch = items.slice(i, Math.min(i + this.config.batchSize, items.length))
      
      const result = processor(batch)
      results.push(result)
      
      const batchTime = performance.now() - batchStart
      this.updateMetrics(batchTime)
    }

    return results
  }

  /**
   * Processes items with a callback for each batch
   */
  forEach(
    items: T[],
    callback: (item: T, index: number, batch: T[]) => void
  ): void {
    this.processBatchesSync(items, (batch) => {
      batch.forEach((item, localIndex, arr) => {
        const globalIndex = items.indexOf(item)
        callback(item, globalIndex, arr)
      })
    })
  }

  /**
   * Maps items in batches
   */
  map<R>(
    items: T[],
    mapper: (item: T, index: number) => R
  ): R[] {
    const results: R[] = []
    
    this.processBatchesSync(items, (batch) => {
      return batch.map((item, localIndex) => {
        const globalIndex = items.indexOf(item)
        return mapper(item, globalIndex)
      })
    }).forEach(batchResults => results.push(...batchResults))
    
    return results
  }

  /**
   * Filters items in batches
   */
  filter(
    items: T[],
    predicate: (item: T, index: number) => boolean
  ): T[] {
    const results: T[] = []
    
    this.processBatchesSync(items, (batch) => {
      return batch.filter((item, localIndex) => {
        const globalIndex = items.indexOf(item)
        return predicate(item, globalIndex)
      })
    }).forEach(batchResults => results.push(...batchResults))
    
    return results
  }

  /**
   * Reduces items in batches
   */
  reduce<R>(
    items: T[],
    reducer: (accumulator: R, item: T, index: number) => R,
    initialValue: R
  ): R {
    let accumulator = initialValue
    
    this.processBatchesSync(items, (batch) => {
      batch.forEach((item, localIndex) => {
        const globalIndex = items.indexOf(item)
        accumulator = reducer(accumulator, item, globalIndex)
      })
      return accumulator
    })
    
    return accumulator
  }

  /**
   * Updates batch size dynamically based on performance
   */
  adjustBatchSize(targetTime: number = 2): void {
    if (this.metrics.averageBatchTime > targetTime) {
      // Decrease batch size
      this.config.batchSize = Math.max(10, Math.floor(this.config.batchSize * 0.8))
    } else if (this.metrics.averageBatchTime < targetTime * 0.5) {
      // Increase batch size
      this.config.batchSize = Math.min(1000, Math.floor(this.config.batchSize * 1.2))
    }
  }

  /**
   * Gets current metrics
   */
  getMetrics(): BatchMetrics {
    return { ...this.metrics }
  }

  /**
   * Resets metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalItems: 0,
      batchesProcessed: 0,
      averageBatchTime: 0,
      maxBatchTime: 0,
      minBatchTime: Infinity
    }
  }

  /**
   * Updates metrics after processing a batch
   */
  private updateMetrics(batchTime: number): void {
    this.metrics.batchesProcessed++
    this.metrics.maxBatchTime = Math.max(this.metrics.maxBatchTime, batchTime)
    this.metrics.minBatchTime = Math.min(this.metrics.minBatchTime, batchTime)
    
    // Update rolling average
    const prevAvg = this.metrics.averageBatchTime
    const prevCount = this.metrics.batchesProcessed - 1
    this.metrics.averageBatchTime = (prevAvg * prevCount + batchTime) / this.metrics.batchesProcessed
  }

  /**
   * Yields control to the event loop
   */
  private yieldToEventLoop(): Promise<void> {
    return new Promise(resolve => {
      if (typeof setImmediate !== 'undefined') {
        setImmediate(resolve)
      } else {
        setTimeout(resolve, 0)
      }
    })
  }
}

/**
 * Cache-friendly batch processor that optimizes for CPU cache locality
 */
export class CacheFriendlyBatchProcessor<T> extends BatchProcessor<T> {
  /**
   * Processes items in a cache-friendly manner by grouping related data
   */
  processCacheFriendly<K, R>(
    items: T[],
    keyExtractor: (item: T) => K,
    processor: (group: T[]) => R
  ): Map<K, R> {
    // Group items by key for better cache locality
    const groups = new Map<K, T[]>()
    
    items.forEach(item => {
      const key = keyExtractor(item)
      const group = groups.get(key) ?? []
      group.push(item)
      groups.set(key, group)
    })
    
    // Process each group
    const results = new Map<K, R>()
    groups.forEach((group, key) => {
      results.set(key, processor(group))
    })
    
    return results
  }
}

/**
 * Global batch processor instance
 */
export const globalBatchProcessor = new BatchProcessor({
  batchSize: 100,
  maxBatchTime: 2,
  enableParallelProcessing: false
})
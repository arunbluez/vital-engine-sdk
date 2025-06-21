/**
 * Memory management utilities for garbage collection optimization
 */

// Type declarations for browser APIs not in standard TypeScript definitions
declare global {
  interface IdleDeadline {
    timeRemaining(): number
    readonly didTimeout: boolean
  }

  function requestIdleCallback(
    callback: (deadline: IdleDeadline) => void,
    options?: { timeout?: number }
  ): number

  function cancelIdleCallback(id: number): void
}

export interface MemoryStats {
  totalJSHeapSize?: number
  usedJSHeapSize?: number
  jsHeapSizeLimit?: number
  allocations: number
  deallocations: number
  gcCount: number
  lastGCTime: number
}

export interface GCConfig {
  enabled: boolean
  minInterval: number // Minimum time between GC hints (ms)
  memoryThreshold: number // Memory usage threshold to trigger GC (bytes)
  idleGCDelay: number // Delay before GC during idle time (ms)
}

/**
 * Memory manager for optimizing garbage collection and memory usage
 */
export class MemoryManager {
  private stats: MemoryStats = {
    allocations: 0,
    deallocations: 0,
    gcCount: 0,
    lastGCTime: 0,
  }

  private config: GCConfig = {
    enabled: true,
    minInterval: 30000, // 30 seconds
    memoryThreshold: 100 * 1024 * 1024, // 100MB
    idleGCDelay: 1000, // 1 second
  }

  private idleCallbackId: number | null = null
  private gcHintSupported: boolean = false
  private memoryApiSupported: boolean = false

  constructor(config?: Partial<GCConfig>) {
    if (config) {
      this.config = { ...this.config, ...config }
    }

    // Check for GC hint support
    if (typeof globalThis !== 'undefined' && 'gc' in globalThis) {
      this.gcHintSupported = true
    }

    // Check for performance.memory API
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      this.memoryApiSupported = true
    }

    // Setup idle GC if available
    if (typeof requestIdleCallback !== 'undefined') {
      this.setupIdleGC()
    }
  }

  /**
   * Records an allocation
   */
  recordAllocation(count: number = 1): void {
    this.stats.allocations += count
  }

  /**
   * Records a deallocation
   */
  recordDeallocation(count: number = 1): void {
    this.stats.deallocations += count
  }

  /**
   * Updates memory statistics
   */
  updateMemoryStats(): MemoryStats {
    if (this.memoryApiSupported) {
      // @ts-ignore - memory is not in standard TypeScript definitions
      const memory = performance.memory
      this.stats.totalJSHeapSize = memory.totalJSHeapSize
      this.stats.usedJSHeapSize = memory.usedJSHeapSize
      this.stats.jsHeapSizeLimit = memory.jsHeapSizeLimit
    }
    return { ...this.stats }
  }

  /**
   * Suggests garbage collection if appropriate
   */
  suggestGC(): boolean {
    if (!this.config.enabled || !this.gcHintSupported) {
      return false
    }

    const now = Date.now()
    if (now - this.stats.lastGCTime < this.config.minInterval) {
      return false
    }

    // Check memory threshold
    if (this.memoryApiSupported) {
      // @ts-ignore
      const memory = performance.memory
      if (memory.usedJSHeapSize > this.config.memoryThreshold) {
        this.performGC()
        return true
      }
    }

    return false
  }

  /**
   * Performs garbage collection if available
   */
  private performGC(): void {
    if (this.gcHintSupported) {
      try {
        // @ts-ignore - gc is not in standard TypeScript definitions
        globalThis.gc()
        this.stats.gcCount++
        this.stats.lastGCTime = Date.now()
      } catch (error) {
        console.warn('GC hint failed:', error)
      }
    }
  }

  /**
   * Sets up idle-time garbage collection
   */
  private setupIdleGC(): void {
    const idleCallback = (deadline: IdleDeadline) => {
      if (deadline.timeRemaining() > 10 && this.shouldRunIdleGC()) {
        this.performGC()
      }

      // Schedule next idle callback
      this.idleCallbackId = requestIdleCallback(idleCallback, {
        timeout: this.config.idleGCDelay,
      })
    }

    this.idleCallbackId = requestIdleCallback(idleCallback)
  }

  /**
   * Determines if idle GC should run
   */
  private shouldRunIdleGC(): boolean {
    if (!this.config.enabled || !this.gcHintSupported) {
      return false
    }

    const now = Date.now()
    if (now - this.stats.lastGCTime < this.config.minInterval) {
      return false
    }

    // Run idle GC if there have been significant allocations
    const netAllocations = this.stats.allocations - this.stats.deallocations
    return netAllocations > 1000
  }

  /**
   * Cancels idle GC callback
   */
  cancelIdleGC(): void {
    if (
      this.idleCallbackId !== null &&
      typeof cancelIdleCallback !== 'undefined'
    ) {
      cancelIdleCallback(this.idleCallbackId)
      this.idleCallbackId = null
    }
  }

  /**
   * Gets memory statistics
   */
  getStats(): MemoryStats {
    return this.updateMemoryStats()
  }

  /**
   * Resets statistics
   */
  resetStats(): void {
    this.stats.allocations = 0
    this.stats.deallocations = 0
    this.stats.gcCount = 0
  }

  /**
   * Sets GC configuration
   */
  setConfig(config: Partial<GCConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Cleans up resources
   */
  destroy(): void {
    this.cancelIdleGC()
  }
}

/**
 * Object recycler for temporary objects
 */
export class ObjectRecycler<T> {
  private objects: T[] = []
  private createFn: () => T
  private resetFn: (obj: T) => void
  private maxSize: number

  constructor(
    createFn: () => T,
    resetFn: (obj: T) => void,
    maxSize: number = 100
  ) {
    this.createFn = createFn
    this.resetFn = resetFn
    this.maxSize = maxSize
  }

  /**
   * Gets a recycled object or creates a new one
   */
  get(): T {
    if (this.objects.length > 0) {
      return this.objects.pop()!
    }
    return this.createFn()
  }

  /**
   * Returns an object for recycling
   */
  recycle(obj: T): void {
    if (this.objects.length < this.maxSize) {
      this.resetFn(obj)
      this.objects.push(obj)
    }
  }

  /**
   * Clears all recycled objects
   */
  clear(): void {
    this.objects.length = 0
  }

  /**
   * Gets the number of recycled objects
   */
  getSize(): number {
    return this.objects.length
  }
}

/**
 * Memory-efficient array operations
 */
export class ArrayPool<T> {
  private pools: Map<number, T[][]> = new Map()
  private maxPoolSize: number = 50

  /**
   * Gets an array of specified size
   */
  get(size: number): T[] {
    let sizePool = this.pools.get(size)
    if (!sizePool) {
      sizePool = []
      this.pools.set(size, sizePool)
    }

    if (sizePool.length > 0) {
      return sizePool.pop()!
    }

    return new Array(size)
  }

  /**
   * Returns an array to the pool
   */
  release(array: T[]): void {
    const size = array.length
    let sizePool = this.pools.get(size)

    if (!sizePool) {
      sizePool = []
      this.pools.set(size, sizePool)
    }

    if (sizePool.length < this.maxPoolSize) {
      // Clear array
      array.length = 0
      array.length = size
      sizePool.push(array)
    }
  }

  /**
   * Clears all pools
   */
  clear(): void {
    this.pools.clear()
  }
}

/**
 * Global memory manager instance
 */
export const globalMemoryManager = new MemoryManager()

/**
 * Common object recyclers
 */
export const CommonRecyclers = {
  arrays: new ArrayPool(),

  vector2: new ObjectRecycler(
    () => ({ x: 0, y: 0 }),
    (v) => {
      v.x = 0
      v.y = 0
    }
  ),

  vector3: new ObjectRecycler(
    () => ({ x: 0, y: 0, z: 0 }),
    (v) => {
      v.x = 0
      v.y = 0
      v.z = 0
    }
  ),

  bounds: new ObjectRecycler(
    () => ({ minX: 0, minY: 0, maxX: 0, maxY: 0 }),
    (b) => {
      b.minX = 0
      b.minY = 0
      b.maxX = 0
      b.maxY = 0
    }
  ),
}

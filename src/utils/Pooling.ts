/**
 * Object pooling system for performance optimization
 */

export interface Poolable {
  reset(): void
}

export interface PoolFactory<T> {
  create(): T
  reset(item: T): void
}

export interface PoolStatistics {
  name: string
  size: number
  created: number
  acquired: number
  released: number
  hitRate: number
  missRate: number
  averageAcquireTime: number
  averageReleaseTime: number
  memoryUsage: number
}

export interface PoolConfig {
  initialSize?: number
  maxSize?: number
  autoResize?: boolean
  resizeThreshold?: number
  resizeIncrement?: number
  enableMetrics?: boolean
}

/**
 * Generic object pool for reusing objects and reducing garbage collection
 */
export class ObjectPool<T extends Poolable> {
  private pool: T[] = []
  private factory: PoolFactory<T>
  private maxSize: number
  private created: number = 0
  private acquired: number = 0
  private released: number = 0
  private hits: number = 0
  private misses: number = 0
  private totalAcquireTime: number = 0
  private totalReleaseTime: number = 0
  private config: Required<PoolConfig>
  private lastResizeCheck: number = 0
  private resizeInterval: number = 5000 // Check every 5 seconds

  constructor(factory: PoolFactory<T>, config: PoolConfig = {}) {
    this.factory = factory
    this.config = {
      initialSize: config.initialSize ?? 10,
      maxSize: config.maxSize ?? 1000,
      autoResize: config.autoResize ?? true,
      resizeThreshold: config.resizeThreshold ?? 0.8,
      resizeIncrement: config.resizeIncrement ?? 0.5,
      enableMetrics: config.enableMetrics ?? true
    }
    this.maxSize = this.config.maxSize

    // Pre-populate pool
    for (let i = 0; i < this.config.initialSize; i++) {
      this.pool.push(this.createNew())
    }
  }

  /**
   * Gets an object from the pool or creates a new one
   */
  acquire(): T {
    const startTime = this.config.enableMetrics ? performance.now() : 0
    this.acquired++

    // Check if auto-resize is needed
    if (this.config.autoResize) {
      this.checkAutoResize()
    }

    let item: T
    if (this.pool.length > 0) {
      item = this.pool.pop()!
      this.hits++
    } else {
      this.misses++
      if (this.created < this.maxSize) {
        item = this.createNew()
      } else {
        // Pool exhausted, create new but don't track
        item = this.factory.create()
      }
    }

    if (this.config.enableMetrics) {
      this.totalAcquireTime += performance.now() - startTime
    }

    return item
  }

  /**
   * Returns an object to the pool
   */
  release(item: T): void {
    const startTime = this.config.enableMetrics ? performance.now() : 0
    this.released++

    if (this.pool.length < this.maxSize) {
      this.factory.reset(item)
      item.reset()
      this.pool.push(item)
    }

    if (this.config.enableMetrics) {
      this.totalReleaseTime += performance.now() - startTime
    }
  }

  /**
   * Releases multiple objects at once
   */
  releaseMany(items: T[]): void {
    items.forEach(item => this.release(item))
  }

  /**
   * Gets the current pool size
   */
  getSize(): number {
    return this.pool.length
  }

  /**
   * Gets the total number of objects created
   */
  getTotalCreated(): number {
    return this.created
  }

  /**
   * Clears the pool
   */
  clear(): void {
    this.pool.length = 0
  }

  /**
   * Pre-warms the pool to a specific size
   */
  prewarm(size: number): void {
    const needed = Math.min(size - this.pool.length, this.maxSize - this.created)
    for (let i = 0; i < needed; i++) {
      this.pool.push(this.createNew())
    }
  }

  private createNew(): T {
    this.created++
    return this.factory.create()
  }

  private checkAutoResize(): void {
    const now = Date.now()
    if (now - this.lastResizeCheck < this.resizeInterval) {
      return
    }
    this.lastResizeCheck = now

    const hitRate = this.hits / (this.hits + this.misses)
    if (hitRate < this.config.resizeThreshold && this.maxSize < this.config.maxSize) {
      // Increase pool size
      const newSize = Math.min(
        Math.floor(this.maxSize * (1 + this.config.resizeIncrement)),
        this.config.maxSize
      )
      const increment = newSize - this.maxSize
      this.maxSize = newSize

      // Pre-create some objects
      const preCreate = Math.min(increment / 2, 50)
      for (let i = 0; i < preCreate && this.created < this.maxSize; i++) {
        this.pool.push(this.createNew())
      }
    }
  }

  /**
   * Gets detailed statistics about pool performance
   */
  getStatistics(name: string): PoolStatistics {
    const hitRate = this.hits + this.misses > 0 ? this.hits / (this.hits + this.misses) : 0
    const missRate = 1 - hitRate
    const avgAcquireTime = this.acquired > 0 ? this.totalAcquireTime / this.acquired : 0
    const avgReleaseTime = this.released > 0 ? this.totalReleaseTime / this.released : 0

    return {
      name,
      size: this.pool.length,
      created: this.created,
      acquired: this.acquired,
      released: this.released,
      hitRate,
      missRate,
      averageAcquireTime: avgAcquireTime,
      averageReleaseTime: avgReleaseTime,
      memoryUsage: this.estimateMemoryUsage()
    }
  }

  /**
   * Estimates memory usage of pooled objects
   */
  private estimateMemoryUsage(): number {
    // This is a rough estimate - actual memory usage depends on object complexity
    // Assume average object size of 1KB for estimation
    return this.pool.length * 1024
  }

  /**
   * Resets pool statistics
   */
  resetStatistics(): void {
    this.acquired = 0
    this.released = 0
    this.hits = 0
    this.misses = 0
    this.totalAcquireTime = 0
    this.totalReleaseTime = 0
  }
}

/**
 * Pool manager for managing multiple object pools
 */
export class PoolManager {
  private pools = new Map<string, ObjectPool<any>>()
  private globalStats = {
    totalAcquired: 0,
    totalReleased: 0,
    totalMemoryUsage: 0
  }

  /**
   * Registers a new pool
   */
  registerPool<T extends Poolable>(
    name: string,
    factory: PoolFactory<T>,
    config?: PoolConfig
  ): void {
    if (this.pools.has(name)) {
      throw new Error(`Pool "${name}" already registered`)
    }

    this.pools.set(name, new ObjectPool(factory, config))
  }

  /**
   * Gets a pool by name
   */
  getPool<T extends Poolable>(name: string): ObjectPool<T> | null {
    return this.pools.get(name) ?? null
  }

  /**
   * Acquires an object from a named pool
   */
  acquire<T extends Poolable>(name: string): T {
    const pool = this.pools.get(name)
    if (!pool) {
      throw new Error(`Pool "${name}" not found`)
    }
    this.globalStats.totalAcquired++
    return pool.acquire() as T
  }

  /**
   * Releases an object to a named pool
   */
  release<T extends Poolable>(name: string, item: T): void {
    const pool = this.pools.get(name)
    if (!pool) {
      throw new Error(`Pool "${name}" not found`)
    }
    this.globalStats.totalReleased++
    pool.release(item)
  }

  /**
   * Gets statistics for all pools
   */
  getStats(): Map<string, PoolStatistics> {
    const stats = new Map<string, PoolStatistics>()
    let totalMemory = 0
    
    this.pools.forEach((pool, name) => {
      const poolStats = pool.getStatistics(name)
      stats.set(name, poolStats)
      totalMemory += poolStats.memoryUsage
    })

    this.globalStats.totalMemoryUsage = totalMemory
    return stats
  }

  /**
   * Gets global pool manager statistics
   */
  getGlobalStats(): typeof this.globalStats {
    return { ...this.globalStats }
  }

  /**
   * Generates a performance report for all pools
   */
  generateReport(): string {
    const stats = this.getStats()
    let report = 'Pool Manager Performance Report\n'
    report += '================================\n\n'

    stats.forEach((stat, name) => {
      report += `Pool: ${name}\n`
      report += `  Size: ${stat.size}/${stat.created} (current/total)\n`
      report += `  Performance: ${(stat.hitRate * 100).toFixed(2)}% hit rate\n`
      report += `  Timing: ${stat.averageAcquireTime.toFixed(3)}ms acquire, ${stat.averageReleaseTime.toFixed(3)}ms release\n`
      report += `  Memory: ~${(stat.memoryUsage / 1024).toFixed(2)}KB\n\n`
    })

    report += `Global Stats:\n`
    report += `  Total Acquired: ${this.globalStats.totalAcquired}\n`
    report += `  Total Released: ${this.globalStats.totalReleased}\n`
    report += `  Total Memory: ~${(this.globalStats.totalMemoryUsage / 1024 / 1024).toFixed(2)}MB\n`

    return report
  }

  /**
   * Resets statistics for all pools
   */
  resetAllStatistics(): void {
    this.pools.forEach(pool => pool.resetStatistics())
    this.globalStats.totalAcquired = 0
    this.globalStats.totalReleased = 0
    this.globalStats.totalMemoryUsage = 0
  }

  /**
   * Clears all pools
   */
  clearAll(): void {
    this.pools.forEach(pool => pool.clear())
  }

  /**
   * Removes a pool
   */
  removePool(name: string): void {
    const pool = this.pools.get(name)
    if (pool) {
      pool.clear()
      this.pools.delete(name)
    }
  }
}

/**
 * Global pool manager instance
 */
export const globalPoolManager = new PoolManager()

/**
 * Common pool factories for frequently used objects
 */
export const CommonPools = {
  Vector2: {
    name: 'Vector2',
    factory: {
      create: () => ({ x: 0, y: 0, reset: function() { this.x = 0; this.y = 0 } }),
      reset: (v: any) => { v.x = 0; v.y = 0 }
    }
  },
  Vector3: {
    name: 'Vector3',
    factory: {
      create: () => ({ x: 0, y: 0, z: 0, reset: function() { this.x = 0; this.y = 0; this.z = 0 } }),
      reset: (v: any) => { v.x = 0; v.y = 0; v.z = 0 }
    }
  },
  Rectangle: {
    name: 'Rectangle',
    factory: {
      create: () => ({ x: 0, y: 0, width: 0, height: 0, reset: function() { this.x = 0; this.y = 0; this.width = 0; this.height = 0 } }),
      reset: (r: any) => { r.x = 0; r.y = 0; r.width = 0; r.height = 0 }
    }
  }
}

/**
 * Initialize common pools
 */
export function initializeCommonPools(): void {
  Object.values(CommonPools).forEach(pool => {
    globalPoolManager.registerPool(pool.name, pool.factory, {
      initialSize: 100,
      maxSize: 5000,
      autoResize: true
    })
  })
}
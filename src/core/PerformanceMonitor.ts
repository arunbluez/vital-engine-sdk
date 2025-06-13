/**
 * Performance monitoring and automatic quality adjustment system
 */

export interface PerformanceMetrics {
  fps: number
  frameTime: number
  updateTime: number
  renderTime: number
  memoryUsage: number
  entityCount: number
  componentCount: number
  systemMetrics: Map<string, SystemMetrics>
}

export interface SystemMetrics {
  name: string
  updateTime: number
  entityCount: number
  averageUpdateTime: number
  maxUpdateTime: number
}

export interface QualitySettings {
  maxEntities: number
  maxParticles: number
  updateRate: number
  physicsSteps: number
  spatialPartitioningEnabled: boolean
  batchProcessingEnabled: boolean
  objectPoolingEnabled: boolean
}

export interface PerformanceThresholds {
  targetFPS: number
  minFPS: number
  maxFrameTime: number
  maxMemoryUsage: number
  adjustmentInterval: number
}

/**
 * Performance monitor that tracks game performance and adjusts quality settings
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    fps: 60,
    frameTime: 0,
    updateTime: 0,
    renderTime: 0,
    memoryUsage: 0,
    entityCount: 0,
    componentCount: 0,
    systemMetrics: new Map()
  }

  private frameTimeHistory: number[] = []
  private historySize: number = 60
  private lastFrameTime: number = 0
  private frameCount: number = 0
  private lastFPSUpdate: number = 0
  private enabled: boolean = true

  private qualitySettings: QualitySettings = {
    maxEntities: 10000,
    maxParticles: 1000,
    updateRate: 60,
    physicsSteps: 1,
    spatialPartitioningEnabled: true,
    batchProcessingEnabled: true,
    objectPoolingEnabled: true
  }

  private thresholds: PerformanceThresholds = {
    targetFPS: 60,
    minFPS: 30,
    maxFrameTime: 33.33, // 30 FPS
    maxMemoryUsage: 512 * 1024 * 1024, // 512MB
    adjustmentInterval: 5000 // 5 seconds
  }

  private lastQualityAdjustment: number = 0
  private qualityLevel: number = 1.0 // 0.0 to 1.0

  constructor(config?: Partial<PerformanceThresholds>) {
    if (config) {
      this.thresholds = { ...this.thresholds, ...config }
    }
  }

  /**
   * Starts frame timing
   */
  beginFrame(): void {
    this.lastFrameTime = performance.now()
  }

  /**
   * Ends frame timing and updates metrics
   */
  endFrame(): void {
    if (!this.enabled) return

    const now = performance.now()
    const frameTime = now - this.lastFrameTime
    
    // Update frame time history
    this.frameTimeHistory.push(frameTime)
    if (this.frameTimeHistory.length > this.historySize) {
      this.frameTimeHistory.shift()
    }

    // Update metrics
    this.metrics.frameTime = frameTime
    this.frameCount++

    // Update FPS every second
    if (now - this.lastFPSUpdate >= 1000) {
      this.metrics.fps = this.frameCount / ((now - this.lastFPSUpdate) / 1000)
      this.frameCount = 0
      this.lastFPSUpdate = now
    }

    // Check for quality adjustment
    if (now - this.lastQualityAdjustment >= this.thresholds.adjustmentInterval) {
      this.adjustQuality()
      this.lastQualityAdjustment = now
    }
  }

  /**
   * Records system update time
   */
  recordSystemUpdate(systemName: string, updateTime: number, entityCount: number): void {
    let metrics = this.metrics.systemMetrics.get(systemName)
    
    if (!metrics) {
      metrics = {
        name: systemName,
        updateTime: 0,
        entityCount: 0,
        averageUpdateTime: 0,
        maxUpdateTime: 0
      }
      this.metrics.systemMetrics.set(systemName, metrics)
    }

    metrics.updateTime = updateTime
    metrics.entityCount = entityCount
    metrics.maxUpdateTime = Math.max(metrics.maxUpdateTime, updateTime)
    
    // Update rolling average
    const alpha = 0.1 // Smoothing factor
    metrics.averageUpdateTime = metrics.averageUpdateTime * (1 - alpha) + updateTime * alpha
  }

  /**
   * Updates entity and component counts
   */
  updateEntityStats(entityCount: number, componentCount: number): void {
    this.metrics.entityCount = entityCount
    this.metrics.componentCount = componentCount
  }

  /**
   * Updates memory usage
   */
  updateMemoryUsage(): void {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      // @ts-ignore - memory is not in standard TypeScript definitions
      this.metrics.memoryUsage = performance.memory.usedJSHeapSize
    }
  }

  /**
   * Adjusts quality settings based on performance
   */
  private adjustQuality(): void {
    const avgFrameTime = this.getAverageFrameTime()
    const currentFPS = 1000 / avgFrameTime

    if (currentFPS < this.thresholds.minFPS) {
      // Performance is poor, reduce quality
      this.decreaseQuality()
    } else if (currentFPS > this.thresholds.targetFPS * 0.95) {
      // Performance is good, try increasing quality
      this.increaseQuality()
    }
  }

  /**
   * Decreases quality settings
   */
  private decreaseQuality(): void {
    this.qualityLevel = Math.max(0.1, this.qualityLevel - 0.1)

    // Adjust settings based on quality level
    this.qualitySettings.maxEntities = Math.floor(10000 * this.qualityLevel)
    this.qualitySettings.maxParticles = Math.floor(1000 * this.qualityLevel)
    
    if (this.qualityLevel < 0.7) {
      this.qualitySettings.physicsSteps = Math.max(1, Math.floor(2 * this.qualityLevel))
    }

    if (this.qualityLevel < 0.5) {
      this.qualitySettings.batchProcessingEnabled = false
    }

    this.onQualityChanged()
  }

  /**
   * Increases quality settings
   */
  private increaseQuality(): void {
    this.qualityLevel = Math.min(1.0, this.qualityLevel + 0.05)

    // Adjust settings based on quality level
    this.qualitySettings.maxEntities = Math.floor(10000 * this.qualityLevel)
    this.qualitySettings.maxParticles = Math.floor(1000 * this.qualityLevel)
    
    if (this.qualityLevel >= 0.5) {
      this.qualitySettings.batchProcessingEnabled = true
    }

    if (this.qualityLevel >= 0.7) {
      this.qualitySettings.physicsSteps = 2
    }

    this.onQualityChanged()
  }

  /**
   * Called when quality settings change
   */
  private onQualityChanged(): void {
    // This can be overridden or emit an event
    console.log(`Quality adjusted to ${(this.qualityLevel * 100).toFixed(0)}%`)
  }

  /**
   * Gets average frame time
   */
  getAverageFrameTime(): number {
    if (this.frameTimeHistory.length === 0) return 16.67

    const sum = this.frameTimeHistory.reduce((a, b) => a + b, 0)
    return sum / this.frameTimeHistory.length
  }

  /**
   * Gets current metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  /**
   * Gets current quality settings
   */
  getQualitySettings(): QualitySettings {
    return { ...this.qualitySettings }
  }

  /**
   * Gets current quality level (0.0 to 1.0)
   */
  getQualityLevel(): number {
    return this.qualityLevel
  }

  /**
   * Sets quality level manually
   */
  setQualityLevel(level: number): void {
    this.qualityLevel = Math.max(0, Math.min(1, level))
    this.adjustQuality()
  }

  /**
   * Enables or disables performance monitoring
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  /**
   * Generates a performance report
   */
  generateReport(): string {
    const metrics = this.getMetrics()
    const quality = this.getQualitySettings()
    
    let report = 'Performance Report\n'
    report += '==================\n\n'
    
    report += 'Frame Metrics:\n'
    report += `  FPS: ${metrics.fps.toFixed(1)}\n`
    report += `  Frame Time: ${metrics.frameTime.toFixed(2)}ms\n`
    report += `  Average Frame Time: ${this.getAverageFrameTime().toFixed(2)}ms\n\n`
    
    report += 'Entity Metrics:\n'
    report += `  Entity Count: ${metrics.entityCount}\n`
    report += `  Component Count: ${metrics.componentCount}\n\n`
    
    report += 'System Performance:\n'
    metrics.systemMetrics.forEach((system, name) => {
      report += `  ${name}:\n`
      report += `    Update Time: ${system.updateTime.toFixed(2)}ms\n`
      report += `    Average: ${system.averageUpdateTime.toFixed(2)}ms\n`
      report += `    Max: ${system.maxUpdateTime.toFixed(2)}ms\n`
      report += `    Entities: ${system.entityCount}\n`
    })
    
    report += '\nQuality Settings:\n'
    report += `  Quality Level: ${(this.qualityLevel * 100).toFixed(0)}%\n`
    report += `  Max Entities: ${quality.maxEntities}\n`
    report += `  Max Particles: ${quality.maxParticles}\n`
    report += `  Physics Steps: ${quality.physicsSteps}\n`
    report += `  Batch Processing: ${quality.batchProcessingEnabled}\n`
    report += `  Spatial Partitioning: ${quality.spatialPartitioningEnabled}\n`
    report += `  Object Pooling: ${quality.objectPoolingEnabled}\n`
    
    if (metrics.memoryUsage > 0) {
      report += `\nMemory Usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB\n`
    }
    
    return report
  }

  /**
   * Resets all metrics
   */
  reset(): void {
    this.frameTimeHistory = []
    this.frameCount = 0
    this.lastFPSUpdate = 0
    this.metrics.systemMetrics.clear()
    this.qualityLevel = 1.0
    this.lastQualityAdjustment = 0
  }
}

/**
 * Global performance monitor instance
 */
export const globalPerformanceMonitor = new PerformanceMonitor()
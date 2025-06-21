/**
 * Performance profiling and debugging tools
 */

export interface ProfilerMark {
  name: string
  startTime: number
  endTime?: number
  duration?: number
  metadata?: Record<string, any>
}

export interface ProfilerFrame {
  frameNumber: number
  startTime: number
  endTime: number
  duration: number
  marks: ProfilerMark[]
}

export interface ProfilerReport {
  totalFrames: number
  totalDuration: number
  averageFrameTime: number
  minFrameTime: number
  maxFrameTime: number
  markStats: Map<string, MarkStatistics>
}

export interface MarkStatistics {
  name: string
  count: number
  totalTime: number
  averageTime: number
  minTime: number
  maxTime: number
}

export interface ProfilerConfig {
  enabled: boolean
  maxFrames: number
  captureStackTraces: boolean
  autoReport: boolean
  reportInterval: number
}

/**
 * Performance profiler for detailed performance analysis
 */
export class Profiler {
  private config: ProfilerConfig = {
    enabled: false,
    maxFrames: 1000,
    captureStackTraces: false,
    autoReport: false,
    reportInterval: 60000, // 1 minute
  }

  private frames: ProfilerFrame[] = []
  private currentFrame: ProfilerFrame | null = null
  private activeMarks: Map<string, ProfilerMark> = new Map()
  private markStacks: Map<string, ProfilerMark[]> = new Map()
  private lastReportTime: number = 0

  constructor(config?: Partial<ProfilerConfig>) {
    if (config) {
      this.config = { ...this.config, ...config }
    }
  }

  /**
   * Starts profiling if enabled
   */
  start(): void {
    this.config.enabled = true
    this.lastReportTime = Date.now()
  }

  /**
   * Stops profiling
   */
  stop(): void {
    this.config.enabled = false
    if (this.currentFrame) {
      this.endFrame()
    }
  }

  /**
   * Begins a new frame
   */
  beginFrame(frameNumber: number): void {
    if (!this.config.enabled) return

    if (this.currentFrame) {
      this.endFrame()
    }

    this.currentFrame = {
      frameNumber,
      startTime: performance.now(),
      endTime: 0,
      duration: 0,
      marks: [],
    }

    // Check for auto reporting
    if (this.config.autoReport) {
      const now = Date.now()
      if (now - this.lastReportTime >= this.config.reportInterval) {
        console.log(this.generateReport())
        this.lastReportTime = now
      }
    }
  }

  /**
   * Ends the current frame
   */
  endFrame(): void {
    if (!this.config.enabled || !this.currentFrame) return

    this.currentFrame.endTime = performance.now()
    this.currentFrame.duration =
      this.currentFrame.endTime - this.currentFrame.startTime

    // Close any unclosed marks
    this.activeMarks.forEach((mark, name) => {
      console.warn(`Unclosed profiler mark: ${name}`)
      this.endMark(name)
    })

    this.frames.push(this.currentFrame)

    // Maintain frame limit
    if (this.frames.length > this.config.maxFrames) {
      this.frames.shift()
    }

    this.currentFrame = null
  }

  /**
   * Begins a performance mark
   */
  beginMark(name: string, metadata?: Record<string, any>): void {
    if (!this.config.enabled || !this.currentFrame) return

    const mark: ProfilerMark = {
      name,
      startTime: performance.now(),
      metadata,
    }

    // Support nested marks
    if (this.activeMarks.has(name)) {
      let stack = this.markStacks.get(name)
      if (!stack) {
        stack = []
        this.markStacks.set(name, stack)
      }
      stack.push(this.activeMarks.get(name)!)
    }

    this.activeMarks.set(name, mark)
  }

  /**
   * Ends a performance mark
   */
  endMark(name: string): void {
    if (!this.config.enabled || !this.currentFrame) return

    const mark = this.activeMarks.get(name)
    if (!mark) {
      console.warn(`Trying to end non-existent mark: ${name}`)
      return
    }

    mark.endTime = performance.now()
    mark.duration = mark.endTime - mark.startTime

    this.currentFrame.marks.push(mark)
    this.activeMarks.delete(name)

    // Check for nested marks
    const stack = this.markStacks.get(name)
    if (stack && stack.length > 0) {
      const parentMark = stack.pop()!
      this.activeMarks.set(name, parentMark)
    }
  }

  /**
   * Measures a function execution
   */
  measure<T>(name: string, fn: () => T, metadata?: Record<string, any>): T {
    this.beginMark(name, metadata)
    try {
      return fn()
    } finally {
      this.endMark(name)
    }
  }

  /**
   * Measures an async function execution
   */
  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    this.beginMark(name, metadata)
    try {
      return await fn()
    } finally {
      this.endMark(name)
    }
  }

  /**
   * Creates a scoped profiler for a specific subsystem
   */
  createScope(prefix: string): ScopedProfiler {
    return new ScopedProfiler(this, prefix)
  }

  /**
   * Generates a performance report
   */
  generateReport(): string {
    const stats = this.calculateStatistics()

    let report = 'Performance Profile Report\n'
    report += '=========================\n\n'

    report += 'Frame Statistics:\n'
    report += `  Total Frames: ${stats.totalFrames}\n`
    report += `  Total Duration: ${stats.totalDuration.toFixed(2)}ms\n`
    report += `  Average Frame: ${stats.averageFrameTime.toFixed(2)}ms\n`
    report += `  Min Frame: ${stats.minFrameTime.toFixed(2)}ms\n`
    report += `  Max Frame: ${stats.maxFrameTime.toFixed(2)}ms\n\n`

    report += 'Mark Statistics:\n'
    const sortedMarks = Array.from(stats.markStats.values()).sort(
      (a, b) => b.totalTime - a.totalTime
    )

    sortedMarks.forEach((mark) => {
      report += `  ${mark.name}:\n`
      report += `    Count: ${mark.count}\n`
      report += `    Total: ${mark.totalTime.toFixed(2)}ms\n`
      report += `    Average: ${mark.averageTime.toFixed(2)}ms\n`
      report += `    Min: ${mark.minTime.toFixed(2)}ms\n`
      report += `    Max: ${mark.maxTime.toFixed(2)}ms\n`
    })

    return report
  }

  /**
   * Calculates statistics from profiling data
   */
  private calculateStatistics(): ProfilerReport {
    const markStats = new Map<string, MarkStatistics>()

    let totalDuration = 0
    let minFrameTime = Infinity
    let maxFrameTime = 0

    this.frames.forEach((frame) => {
      totalDuration += frame.duration
      minFrameTime = Math.min(minFrameTime, frame.duration)
      maxFrameTime = Math.max(maxFrameTime, frame.duration)

      frame.marks.forEach((mark) => {
        if (!mark.duration) return

        let stats = markStats.get(mark.name)
        if (!stats) {
          stats = {
            name: mark.name,
            count: 0,
            totalTime: 0,
            averageTime: 0,
            minTime: Infinity,
            maxTime: 0,
          }
          markStats.set(mark.name, stats)
        }

        stats.count++
        stats.totalTime += mark.duration
        stats.minTime = Math.min(stats.minTime, mark.duration)
        stats.maxTime = Math.max(stats.maxTime, mark.duration)
      })
    })

    // Calculate averages
    markStats.forEach((stats) => {
      stats.averageTime = stats.totalTime / stats.count
    })

    return {
      totalFrames: this.frames.length,
      totalDuration,
      averageFrameTime:
        this.frames.length > 0 ? totalDuration / this.frames.length : 0,
      minFrameTime: minFrameTime === Infinity ? 0 : minFrameTime,
      maxFrameTime,
      markStats,
    }
  }

  /**
   * Exports profiling data
   */
  exportData(): ProfilerFrame[] {
    return [...this.frames]
  }

  /**
   * Clears profiling data
   */
  clear(): void {
    this.frames = []
    this.currentFrame = null
    this.activeMarks.clear()
    this.markStacks.clear()
  }

  /**
   * Gets current configuration
   */
  getConfig(): ProfilerConfig {
    return { ...this.config }
  }

  /**
   * Updates configuration
   */
  setConfig(config: Partial<ProfilerConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

/**
 * Scoped profiler for subsystems
 */
export class ScopedProfiler {
  constructor(
    private profiler: Profiler,
    private prefix: string
  ) {}

  beginMark(name: string, metadata?: Record<string, any>): void {
    this.profiler.beginMark(`${this.prefix}.${name}`, metadata)
  }

  endMark(name: string): void {
    this.profiler.endMark(`${this.prefix}.${name}`)
  }

  measure<T>(name: string, fn: () => T, metadata?: Record<string, any>): T {
    return this.profiler.measure(`${this.prefix}.${name}`, fn, metadata)
  }

  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    return this.profiler.measureAsync(`${this.prefix}.${name}`, fn, metadata)
  }
}

/**
 * Debug utilities
 */
export class DebugUtils {
  /**
   * Logs object state with proper formatting
   */
  static logState(name: string, state: any): void {
    console.group(`%c${name} State`, 'color: #4CAF50; font-weight: bold')
    console.log(state)
    console.groupEnd()
  }

  /**
   * Creates a debug checkpoint
   */
  static checkpoint(name: string, data?: any): void {
    const timestamp = new Date().toISOString()
    console.log(
      `%c[CHECKPOINT] ${name} @ ${timestamp}`,
      'color: #FF9800; font-weight: bold',
      data
    )
  }

  /**
   * Measures and logs execution time
   */
  static timed<T>(name: string, fn: () => T): T {
    const start = performance.now()
    try {
      const result = fn()
      const duration = performance.now() - start
      console.log(
        `%c[TIMED] ${name}: ${duration.toFixed(2)}ms`,
        'color: #2196F3'
      )
      return result
    } catch (error) {
      const duration = performance.now() - start
      console.error(
        `%c[TIMED] ${name}: ${duration.toFixed(2)}ms (FAILED)`,
        'color: #F44336',
        error
      )
      throw error
    }
  }

  /**
   * Creates a conditional breakpoint
   */
  static conditionalBreak(condition: boolean, message?: string): void {
    if (condition) {
      console.warn(
        `%c[BREAK] ${message || 'Conditional breakpoint hit'}`,
        'color: #E91E63; font-weight: bold'
      )
      debugger
    }
  }

  /**
   * Validates object structure
   */
  static validate(
    obj: any,
    schema: Record<string, string>,
    throwOnError: boolean = true
  ): boolean {
    const errors: string[] = []

    for (const [key, expectedType] of Object.entries(schema)) {
      const actualType = typeof obj[key]
      if (actualType !== expectedType) {
        errors.push(
          `Property '${key}' expected ${expectedType} but got ${actualType}`
        )
      }
    }

    if (errors.length > 0) {
      const message = `Validation failed:\\n${errors.join('\\n')}`
      if (throwOnError) {
        throw new Error(message)
      } else {
        console.error(message)
        return false
      }
    }

    return true
  }
}

/**
 * Global profiler instance
 */
export const globalProfiler = new Profiler({
  enabled: false,
  maxFrames: 1000,
  captureStackTraces: false,
  autoReport: false,
  reportInterval: 60000,
})

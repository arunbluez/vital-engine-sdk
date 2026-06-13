import { World } from './ECS/World'
import { EventSystem } from './EventSystem'
import { RandomService } from './RandomService'
import { StateHasher } from './StateHasher'
import type { SimulationClock } from './SimulationClock'
import { InputQueue } from '../input/InputQueue'
import type { UnstampedInputCommand } from '../input/InputCommand'
import { PerformanceMonitor } from './PerformanceMonitor'
import { globalProfiler } from './Profiler'
import { globalMemoryManager, initializeCommonPools } from '../utils'
import type {
  GameState,
  EngineConfig,
  GameConfig,
  UpdateCallback,
} from '../types/GameTypes'
import { GameEventType } from '../types/Events'

/**
 * Main game engine class that manages the game loop, systems, and state.
 * This is the primary entry point for using the game engine SDK.
 */
export class Engine {
  private world: World
  private eventSystem: EventSystem
  private performanceMonitor: PerformanceMonitor
  private state: GameState
  private config: Required<EngineConfig>
  private updateCallbacks: Set<UpdateCallback> = new Set()
  private animationFrameId: NodeJS.Timeout | number | null = null
  private lastUpdateTime: number = 0
  private accumulator: number = 0
  private random: RandomService
  private inputQueue: InputQueue = new InputQueue()
  private hashTraceInterval: number = 0

  constructor(config: GameConfig = {}) {
    this.world = new World(config.engine?.tickRate ?? 30)
    this.eventSystem = new EventSystem()
    // Root deterministic PRNG. Defaults to a fixed seed so the engine is
    // deterministic out of the box.
    this.random = new RandomService(config.engine?.seed ?? 0)
    this.performanceMonitor = new PerformanceMonitor({
      targetFPS: config.engine?.targetFPS ?? 60,
      minFPS: 30,
      maxFrameTime: 33.33,
      adjustmentInterval: 5000,
    })

    // Apply default engine configuration
    this.config = {
      targetFPS: 60,
      fixedTimeStep: true,
      maxDeltaTime: 100,
      enableEventHistory: false,
      eventHistorySize: 1000,
      debug: false,
      seed: 0,
      tickRate: 30,
      configVersion: '1.0.0',
      ...config.engine,
    }

    // Initialize game state
    this.state = {
      running: false,
      paused: false,
      timeScale: 1.0,
      currentTime: 0,
      deltaTime: 0,
      frameCount: 0,
    }

    // Configure event system
    if (this.config.enableEventHistory) {
      this.eventSystem.setHistoryEnabled(true, this.config.eventHistorySize)
    }

    // Initialize common object pools
    initializeCommonPools()

    // Setup memory management
    globalMemoryManager.setConfig({
      enabled: true,
      minInterval: 30000,
      memoryThreshold: 100 * 1024 * 1024,
    })

    // Configure profiler for debug mode
    if (this.config.debug) {
      globalProfiler.setConfig({
        enabled: true,
        autoReport: true,
        reportInterval: 60000,
      })
    }
  }

  /**
   * Gets the ECS world instance
   */
  getWorld(): World {
    return this.world
  }

  /**
   * Gets the event system instance
   */
  getEvents(): EventSystem {
    return this.eventSystem
  }

  /**
   * Gets the seeded deterministic PRNG. With no argument returns the root
   * stream; with a `streamId` returns a memoized independent child stream
   * (e.g. 'combat', 'spawn', 'loot'). Decoupling streams keeps consumption
   * order in one domain from shifting another's sequence.
   */
  getRandom(streamId?: string): RandomService {
    return streamId ? this.random.fork(streamId) : this.random
  }

  /**
   * Gets the deterministic simulation clock (tick / simTimeMs).
   */
  getClock(): SimulationClock {
    return this.world.getClock()
  }

  /**
   * Gets the input command queue. Frontends enqueue commands here instead of
   * mutating component state directly.
   */
  getInputQueue(): InputQueue {
    return this.inputQueue
  }

  /**
   * Convenience: enqueue an input command for the next tick boundary.
   */
  enqueueInput(command: UnstampedInputCommand): void {
    this.inputQueue.enqueue(command)
  }

  /**
   * The seed this engine was constructed with.
   */
  getSeed(): number {
    return this.config.seed
  }

  /**
   * The game balance/config version (replay determinism gate).
   */
  getConfigVersion(): string {
    return this.config.configVersion
  }

  /**
   * Simulation tick rate (ticks per second).
   */
  getTickRate(): number {
    return this.config.tickRate
  }

  /**
   * Render interpolation factor in [0, 1): how far the accumulator is between
   * the last simulated tick and the next. Use to interpolate rendered
   * positions when rendering faster than the simulation rate.
   */
  getInterpolationAlpha(): number {
    return this.accumulator / this.getClock().fixedDeltaMs
  }

  /**
   * Advances the simulation by exactly one fixed tick: flushes the input queue
   * for the current tick, applies the commands, and steps the world. This is
   * the deterministic stepping primitive used by headless simulation and
   * replay.
   */
  step(): void {
    const tick = this.getClock().tick
    const commands = this.inputQueue.flush(tick)
    this.world.step(commands)
    // Inputs captured from here on target the upcoming tick boundary.
    this.inputQueue.advanceStampTo(this.getClock().tick)

    this.state.deltaTime = this.getClock().fixedDeltaMs
    this.state.currentTime = this.getClock().simTimeMs
    this.state.frameCount = this.getClock().tick

    if (
      this.hashTraceInterval > 0 &&
      this.getClock().tick % this.hashTraceInterval === 0
    ) {
      this.eventSystem.emit('STATE_HASH', {
        tick: this.getClock().tick,
        hash: this.computeStateHash(),
      })
    }

    this.updateCallbacks.forEach((callback) => {
      callback(this.getClock().fixedDeltaMs)
    })
  }

  /**
   * Advances the simulation by `count` fixed ticks (headless convenience).
   */
  stepN(count: number): void {
    for (let i = 0; i < count; i++) {
      this.step()
    }
  }

  /**
   * Computes a canonical hash of the current world state, folding in every
   * PRNG stream's state. Used for replay verification and desync detection.
   */
  computeStateHash(): string {
    return StateHasher.hash(this.world, this.random.getStreamStates())
  }

  /**
   * Enables periodic state-hash tracing: every `everyNTicks` ticks the engine
   * emits a `STATE_HASH` event `{ tick, hash }`. Comparing two runs' traces
   * localizes a divergence to the exact tick. Pass 0 to disable.
   */
  enableHashTrace(everyNTicks: number): void {
    this.hashTraceInterval = Math.max(0, Math.floor(everyNTicks))
  }

  /**
   * Gets the performance monitor instance
   */
  getPerformanceMonitor(): PerformanceMonitor {
    return this.performanceMonitor
  }

  /**
   * Gets the current game state
   */
  getState(): Readonly<GameState> {
    return { ...this.state }
  }

  /**
   * Starts the game engine
   */
  start(): void {
    if (this.state.running) {
      return
    }

    this.state.running = true
    this.state.paused = false
    this.lastUpdateTime = performance.now()

    this.eventSystem.emit(GameEventType.GAME_STARTED, {
      timestamp: this.state.currentTime,
    })

    this.startGameLoop()
  }

  /**
   * Stops the game engine
   */
  stop(): void {
    if (!this.state.running) {
      return
    }

    this.state.running = false

    if (this.animationFrameId !== null) {
      if (
        typeof (
          globalThis as unknown as {
            cancelAnimationFrame?: (id: number) => void
          }
        ).cancelAnimationFrame !== 'undefined'
      ) {
        ;(
          globalThis as unknown as {
            cancelAnimationFrame: (id: number) => void
          }
        ).cancelAnimationFrame(this.animationFrameId as number)
      } else {
        clearTimeout(this.animationFrameId as NodeJS.Timeout)
      }
      this.animationFrameId = null
    }

    this.eventSystem.emit(GameEventType.GAME_ENDED, {
      timestamp: this.state.currentTime,
      frameCount: this.state.frameCount,
    })
  }

  /**
   * Pauses the game engine
   */
  pause(): void {
    if (!this.state.running || this.state.paused) {
      return
    }

    this.state.paused = true

    this.eventSystem.emit(GameEventType.GAME_PAUSED, {
      timestamp: this.state.currentTime,
    })
  }

  /**
   * Resumes the game engine
   */
  resume(): void {
    if (!this.state.running || !this.state.paused) {
      return
    }

    this.state.paused = false
    this.lastUpdateTime = performance.now()

    this.eventSystem.emit(GameEventType.GAME_RESUMED, {
      timestamp: this.state.currentTime,
    })
  }

  /**
   * Sets the time scale for the game
   */
  setTimeScale(scale: number): void {
    this.state.timeScale = Math.max(0, scale)
  }

  /**
   * Registers an update callback
   */
  onUpdate(callback: UpdateCallback): () => void {
    this.updateCallbacks.add(callback)
    return () => {
      this.updateCallbacks.delete(callback)
    }
  }

  /**
   * Manually updates the engine (for testing or server-side usage)
   */
  update(deltaTime: number): void {
    if (!this.state.running || this.state.paused) {
      return
    }

    this.performanceMonitor.beginFrame()
    globalProfiler.beginFrame(this.state.frameCount)

    const scaledDelta = deltaTime * this.state.timeScale
    this.state.deltaTime = scaledDelta
    this.state.currentTime += scaledDelta
    this.state.frameCount++

    // Update the world
    globalProfiler.beginMark('world.update')
    const updateStart = performance.now()
    this.world.update(scaledDelta)
    const updateTime = performance.now() - updateStart
    globalProfiler.endMark('world.update')

    // Update performance metrics
    const worldStats = this.world.getStats()
    this.performanceMonitor.updateEntityStats(
      worldStats.entityCount,
      worldStats.componentCount
    )
    this.performanceMonitor.recordSystemUpdate(
      'world',
      updateTime,
      worldStats.entityCount
    )

    // Call update callbacks
    globalProfiler.beginMark('callbacks')
    this.updateCallbacks.forEach((callback) => {
      callback(scaledDelta)
    })
    globalProfiler.endMark('callbacks')

    this.performanceMonitor.endFrame()
    globalProfiler.endFrame()

    // Update memory stats and suggest GC if needed
    globalMemoryManager.updateMemoryStats()
    globalMemoryManager.suggestGC()

    // Apply quality adjustments if needed
    const qualitySettings = this.performanceMonitor.getQualitySettings()
    if (qualitySettings.maxEntities < worldStats.entityCount) {
      // Emit warning about entity limit
      this.eventSystem.emit(GameEventType.PERFORMANCE_WARNING, {
        type: 'entity_limit_exceeded',
        limit: qualitySettings.maxEntities,
        current: worldStats.entityCount,
      })
    }
  }

  /**
   * Resets the engine to initial state
   */
  reset(): void {
    this.stop()

    // Clear world
    this.world.clear()

    // Clear event system
    this.eventSystem.clear()
    this.eventSystem.clearHistory()

    // Reset performance monitor
    this.performanceMonitor.reset()

    // Reset state
    this.state = {
      running: false,
      paused: false,
      timeScale: 1.0,
      currentTime: 0,
      deltaTime: 0,
      frameCount: 0,
    }

    this.accumulator = 0
    this.updateCallbacks.clear()
    this.inputQueue.clear()

    // Re-seed the PRNG so a reset run reproduces the original sequence.
    this.random = new RandomService(this.config.seed)
  }

  /**
   * Destroys the engine and cleans up resources
   */
  destroy(): void {
    this.stop()
    this.reset()

    // Clean up memory management
    globalMemoryManager.destroy()
  }

  /**
   * Gets engine statistics
   */
  getStats(): {
    fps: number
    frameTime: number
    worldStats: ReturnType<World['getStats']>
    eventStats: ReturnType<EventSystem['getStats']>
    performanceMetrics: ReturnType<PerformanceMonitor['getMetrics']>
    qualitySettings: ReturnType<PerformanceMonitor['getQualitySettings']>
  } {
    const performanceMetrics = this.performanceMonitor.getMetrics()

    return {
      fps: performanceMetrics.fps,
      frameTime: performanceMetrics.frameTime,
      worldStats: this.world.getStats(),
      eventStats: this.eventSystem.getStats(),
      performanceMetrics,
      qualitySettings: this.performanceMonitor.getQualitySettings(),
    }
  }

  /**
   * Generates a performance report
   */
  generatePerformanceReport(): string {
    return this.performanceMonitor.generateReport()
  }

  /**
   * Sets the quality level manually (0.0 to 1.0)
   */
  setQualityLevel(level: number): void {
    this.performanceMonitor.setQualityLevel(level)
  }

  /**
   * Main game loop
   */
  private startGameLoop(): void {
    const targetFrameTime = 1000 / this.config.targetFPS

    const gameLoop = (currentTime: number): void => {
      if (!this.state.running) {
        return
      }

      if (
        typeof (
          globalThis as unknown as {
            requestAnimationFrame?: (callback: (time: number) => void) => number
          }
        ).requestAnimationFrame !== 'undefined'
      ) {
        this.animationFrameId = (
          globalThis as unknown as {
            requestAnimationFrame: (callback: (time: number) => void) => number
          }
        ).requestAnimationFrame(gameLoop)
      } else {
        // Node.js fallback
        const delay = Math.max(0, targetFrameTime - (Date.now() - currentTime))
        this.animationFrameId = setTimeout(
          () => gameLoop(Date.now()),
          delay
        ) as unknown as number
      }

      if (this.state.paused) {
        return
      }

      // Calculate delta time
      const rawDeltaTime = currentTime - this.lastUpdateTime
      this.lastUpdateTime = currentTime

      // Cap delta time to prevent spiral of death
      const deltaTime = Math.min(rawDeltaTime, this.config.maxDeltaTime)

      if (this.config.fixedTimeStep) {
        // Fixed timestep with interpolation (accumulator pattern). Logic runs
        // at the simulation tick rate; render can run faster and interpolate
        // using getInterpolationAlpha().
        const fixedDeltaMs = this.getClock().fixedDeltaMs
        this.accumulator += deltaTime

        // Guard against the spiral of death after a long stall.
        const maxSteps = Math.ceil(this.config.maxDeltaTime / fixedDeltaMs) + 1
        let steps = 0
        while (this.accumulator >= fixedDeltaMs && steps < maxSteps) {
          this.step()
          this.accumulator -= fixedDeltaMs
          steps++
        }
      } else {
        // Variable timestep (non-deterministic legacy mode).
        this.update(deltaTime)
      }
    }

    if (
      typeof (
        globalThis as unknown as {
          requestAnimationFrame?: (callback: (time: number) => void) => number
        }
      ).requestAnimationFrame !== 'undefined'
    ) {
      this.animationFrameId = (
        globalThis as unknown as {
          requestAnimationFrame: (callback: (time: number) => void) => number
        }
      ).requestAnimationFrame(gameLoop)
    } else {
      // Start with immediate execution for Node.js
      setImmediate(() => gameLoop(Date.now()))
    }
  }
}

/**
 * Factory function to create a new engine instance
 */
export function createEngine(config?: GameConfig): Engine {
  return new Engine(config)
}

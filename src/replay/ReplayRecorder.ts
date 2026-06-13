import type { Engine } from '../core/Engine'
import { ENGINE_VERSION, REPLAY_FORMAT_VERSION } from '../version'
import type { ReplayData } from './ReplayData'
import type { InputCommand } from '../input/InputCommand'

/**
 * Records a run into a `ReplayData` by capturing the engine's seed, config,
 * input log, duration, and final state hash. The input log is the engine's own
 * `InputQueue` history — recording adds no per-tick overhead.
 */
export class ReplayRecorder {
  private engine: Engine
  private startTick = 0
  private startLogLength = 0
  private recording = false

  constructor(engine: Engine) {
    this.engine = engine
  }

  /**
   * Begins recording from the current tick. Commands already flushed before
   * this point are excluded.
   */
  start(): void {
    this.startTick = this.engine.getClock().tick
    this.startLogLength = this.engine.getInputQueue().getLog().length
    this.recording = true
  }

  /**
   * Stops recording and returns the captured replay. Command ticks are
   * normalized so the run starts at tick 0.
   */
  stop(metadata?: Record<string, unknown>): ReplayData {
    if (!this.recording) {
      throw new Error('ReplayRecorder.stop called before start')
    }
    this.recording = false

    const fullLog = this.engine.getInputQueue().getLog()
    const commands: InputCommand[] = fullLog
      .slice(this.startLogLength)
      .map((c) => ({ ...c, tick: c.tick - this.startTick }))

    return {
      version: REPLAY_FORMAT_VERSION,
      engineVersion: ENGINE_VERSION,
      configVersion: this.engine.getConfigVersion(),
      seed: this.engine.getSeed(),
      tickRate: this.engine.getTickRate(),
      durationTicks: this.engine.getClock().tick - this.startTick,
      commands,
      finalStateHash: this.engine.computeStateHash(),
      metadata,
    }
  }

  isRecording(): boolean {
    return this.recording
  }
}

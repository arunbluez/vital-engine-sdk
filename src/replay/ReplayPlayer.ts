import type { Engine } from '../core/Engine'
import { ENGINE_VERSION } from '../version'
import type { ReplayData } from './ReplayData'
import type { InputCommand } from '../input/InputCommand'

/** Emitted when a replay's config/engine version does not match the engine. */
export const REPLAY_MISMATCH_EVENT = 'REPLAY_MISMATCH'

function majorOf(version: string): string {
  return version.split('.')[0] ?? version
}

/**
 * Replays a recorded run on a freshly-constructed engine: same seed/config,
 * commands fed at the recorded tick boundaries. Use `runToEnd` for headless
 * verification (anti-cheat) or `stepTo` for forward scrubbing.
 *
 * The supplied engine must be fresh (tick 0) and built with the replay's seed
 * and the matching systems.
 */
export class ReplayPlayer {
  private engine: Engine
  private replay: ReplayData
  private commandsByTick: Map<number, InputCommand[]> = new Map()
  private compatible: boolean

  constructor(engine: Engine, replay: ReplayData) {
    this.engine = engine
    this.replay = replay

    for (const cmd of replay.commands) {
      const list = this.commandsByTick.get(cmd.tick) ?? []
      list.push(cmd)
      this.commandsByTick.set(cmd.tick, list)
    }

    this.compatible = this.checkCompatibility()
  }

  private checkCompatibility(): boolean {
    const reasons: string[] = []
    if (this.replay.configVersion !== this.engine.getConfigVersion()) {
      reasons.push(
        `configVersion ${this.replay.configVersion} != ${this.engine.getConfigVersion()}`
      )
    }
    if (majorOf(this.replay.engineVersion) !== majorOf(ENGINE_VERSION)) {
      reasons.push(
        `engineVersion major ${this.replay.engineVersion} != ${ENGINE_VERSION}`
      )
    }
    if (this.replay.seed !== this.engine.getSeed()) {
      reasons.push(`seed ${this.replay.seed} != ${this.engine.getSeed()}`)
    }
    if (reasons.length > 0) {
      this.engine
        .getEvents()
        .emit(REPLAY_MISMATCH_EVENT, { reasons, replay: this.replay })
      return false
    }
    return true
  }

  /**
   * Whether the replay is compatible with the engine it was constructed with.
   * Incompatible replays will not reproduce the original state.
   */
  isCompatible(): boolean {
    return this.compatible
  }

  /**
   * Advances playback forward to `targetTick` (clamped to the replay
   * duration), feeding recorded commands at each tick boundary. Forward-only:
   * scrubbing backward requires a fresh engine.
   */
  stepTo(targetTick: number): void {
    const end = Math.min(targetTick, this.replay.durationTicks)
    while (this.engine.getClock().tick < end) {
      const tick = this.engine.getClock().tick
      const commands = this.commandsByTick.get(tick)
      if (commands) {
        const queue = this.engine.getInputQueue()
        for (const cmd of commands) {
          queue.inject(cmd)
        }
      }
      this.engine.step()
    }
  }

  /**
   * Runs the full replay headlessly and verifies it against the recorded final
   * hash. This is the anti-cheat primitive: a submitted score is only accepted
   * if `verified` is true.
   */
  runToEnd(): { stateHash: string; verified: boolean } {
    this.stepTo(this.replay.durationTicks)
    const stateHash = this.engine.computeStateHash()
    return {
      stateHash,
      verified: this.compatible && stateHash === this.replay.finalStateHash,
    }
  }
}

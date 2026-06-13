import {
  quantizeAxis,
  type InputCommand,
  type UnstampedInputCommand,
} from './InputCommand'

/**
 * InputQueue — buffers tick-stamped commands and releases them at tick
 * boundaries.
 *
 * Frontends `enqueue` raw commands continuously; the simulation `flush`es one
 * tick at a time. Analog `MOVE` inputs are quantized on enqueue, and at most
 * one `MOVE` survives per tick (last write wins) so a 120Hz touch stream does
 * not bloat a 30Hz simulation log.
 */
export class InputQueue {
  /** Commands grouped by the tick they apply on. */
  private commandsByTick: Map<number, InputCommand[]> = new Map()
  /** Full ordered history of flushed commands (for ReplayRecorder). */
  private log: InputCommand[] = []
  /** The tick that newly-enqueued commands are stamped with. */
  private stampTick: number = 0

  /**
   * Sets the tick that subsequent `enqueue` calls will stamp commands with.
   * The engine advances this to the next tick after each step so inputs
   * captured during a frame apply on the upcoming tick boundary.
   */
  advanceStampTo(tick: number): void {
    this.stampTick = tick
  }

  /**
   * The tick that the next enqueued command will be stamped with.
   */
  getStampTick(): number {
    return this.stampTick
  }

  /**
   * Enqueues a command, stamping it with the current target tick. Analog
   * `MOVE` inputs are quantized and coalesced (one per tick, last wins).
   */
  enqueue(cmd: UnstampedInputCommand): void {
    const tick = this.stampTick
    const list = this.commandsByTick.get(tick) ?? []

    if (cmd.type === 'MOVE') {
      const stamped: InputCommand = {
        tick,
        type: 'MOVE',
        dx: quantizeAxis(cmd.dx),
        dy: quantizeAxis(cmd.dy),
      }
      // Coalesce: replace any existing MOVE for this tick.
      const existingIndex = list.findIndex((c) => c.type === 'MOVE')
      if (existingIndex >= 0) {
        list[existingIndex] = stamped
      } else {
        list.push(stamped)
      }
    } else {
      list.push({ ...cmd, tick } as InputCommand)
    }

    this.commandsByTick.set(tick, list)
  }

  /**
   * Injects a fully-stamped command directly (used by ReplayPlayer to feed a
   * recorded log). Bypasses quantization/coalescing — the command is assumed
   * already canonical.
   */
  inject(cmd: InputCommand): void {
    const list = this.commandsByTick.get(cmd.tick) ?? []
    list.push(cmd)
    this.commandsByTick.set(cmd.tick, list)
  }

  /**
   * Returns and removes the commands for `tick`, appending them to the log in
   * a stable order (MOVE first, then others in enqueue order).
   */
  flush(tick: number): InputCommand[] {
    const commands = this.commandsByTick.get(tick) ?? []
    this.commandsByTick.delete(tick)
    for (const cmd of commands) {
      this.log.push(cmd)
    }
    return commands
  }

  /**
   * The full ordered command history (everything flushed so far).
   */
  getLog(): InputCommand[] {
    return this.log.slice()
  }

  /**
   * Clears all pending commands, history, and resets the stamp tick.
   */
  clear(): void {
    this.commandsByTick.clear()
    this.log.length = 0
    this.stampTick = 0
  }
}

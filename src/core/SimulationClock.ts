/**
 * SimulationClock — the deterministic time source for the simulation.
 *
 * All game logic timing must derive from the integer `tick` counter rather
 * than wall-clock time (`Date.now()`, `performance.now()`). Wall-clock time
 * differs per device and per run and is therefore non-reproducible.
 *
 * `simTimeMs` is *derived* as `tick * fixedDeltaMs` and never accumulated by
 * repeated float addition, so it is exact for any tick on any platform.
 */
export class SimulationClock {
  /** Logic updates per second (e.g. 30). */
  readonly tickRate: number
  /** Milliseconds per fixed step — `1000 / tickRate`, computed once. */
  readonly fixedDeltaMs: number
  /** Current tick index (integer, starts at 0). */
  tick: number = 0

  constructor(tickRate: number = 30) {
    if (tickRate <= 0 || !Number.isFinite(tickRate)) {
      throw new Error(`SimulationClock: tickRate must be > 0 (got ${tickRate})`)
    }
    this.tickRate = tickRate
    this.fixedDeltaMs = 1000 / tickRate
  }

  /**
   * Simulation time in milliseconds, derived from the tick counter. Never
   * accumulated — always `tick * fixedDeltaMs`.
   */
  get simTimeMs(): number {
    return this.tick * this.fixedDeltaMs
  }

  /**
   * Advances the clock by exactly one tick.
   */
  advance(): void {
    this.tick++
  }

  /**
   * Resets the clock to tick 0.
   */
  reset(): void {
    this.tick = 0
  }
}

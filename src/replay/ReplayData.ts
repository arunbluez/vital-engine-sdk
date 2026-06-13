import type { InputCommand } from '../input/InputCommand'

/**
 * A complete, self-contained recording of a deterministic run. Combined with
 * the engine's seeded simulation, `(seed, configVersion, commands)` reproduces
 * the exact world state — verified against `finalStateHash`.
 */
export interface ReplayData {
  /** Replay format version (see REPLAY_FORMAT_VERSION). */
  version: number
  /** SDK semver that produced this replay. Mismatched majors are refused. */
  engineVersion: string
  /**
   * Game balance/config identifier. Determinism is `f(seed, configVersion,
   * inputs)`; a mismatch means old replays diverge, so playback is gated on it.
   */
  configVersion: string
  /** Simulation seed. */
  seed: number
  /** Simulation tick rate (ticks per second). */
  tickRate: number
  /** Number of ticks the run lasted. */
  durationTicks: number
  /** Ordered input commands, with ticks relative to the start of the run. */
  commands: InputCommand[]
  /** Canonical state hash at the final tick — the verification target. */
  finalStateHash: string
  /** Display-only metadata (score, kills). Never trusted, never simulated. */
  metadata?: Record<string, unknown>
}

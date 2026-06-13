/**
 * Core game type definitions
 */

export interface Vector2 {
  x: number
  y: number
}

export interface Rectangle {
  x: number
  y: number
  width: number
  height: number
}

export interface Circle {
  x: number
  y: number
  radius: number
}

export interface GameState {
  running: boolean
  paused: boolean
  timeScale: number
  currentTime: number
  deltaTime: number
  frameCount: number
}

export interface EngineConfig {
  targetFPS?: number
  fixedTimeStep?: boolean
  maxDeltaTime?: number
  enableEventHistory?: boolean
  eventHistorySize?: number
  debug?: boolean
  /**
   * Seed for the deterministic PRNG. Identical seeds reproduce identical
   * random sequences across runs and platforms. Defaults to a fixed value so
   * the engine is deterministic out of the box.
   */
  seed?: number
  /**
   * Simulation logic rate in ticks per second (fixed timestep). Defaults to
   * 30. Render can run faster with interpolation.
   */
  tickRate?: number
  /**
   * Game balance/config identifier. Determinism is `f(seed, configVersion,
   * inputs)`: if balance values change, old replays diverge, so replays are
   * gated on a matching configVersion. Defaults to '1.0.0'.
   */
  configVersion?: string
}

export interface GameConfig {
  engine?: EngineConfig
  [key: string]: unknown
}

export interface InputState {
  movement: Vector2
  actions: Set<string>
  mousePosition?: Vector2
}

export type UpdateCallback = (deltaTime: number) => void
export type RenderCallback = (state: GameState) => void

export type CollectibleType = 'experience' | 'currency' | 'health' | 'powerup' | 'item'

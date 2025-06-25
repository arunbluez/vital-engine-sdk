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

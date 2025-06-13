// EntityId is exported from vital-engine-sdk
import type { EntityId, Vector2 } from 'vital-engine-sdk'
export type { EntityId }

// Use Vector2 from SDK instead of custom Position/Velocity
export type Position = Vector2
export type Velocity = Vector2

export interface Projectile {
  id: number
  x: number
  y: number
  velocityX: number
  velocityY: number
  ownerId: EntityId
  damage: number
  lifetime: number
  age: number
  isEnemy?: boolean
}

export interface OrbitingProjectile {
  id: string
  angle: number
  orbitRadius: number
  rotationSpeed: number
  damage: number
  size: number
  x?: number
  y?: number
  lastHitTime?: number
}

export interface InputDirection {
  x: number
  y: number
}

export interface MousePosition {
  x: number
  y: number
}

export interface PerformanceMetrics {
  totalSdkTime: number
  totalRenderTime: number
  totalFrameTime: number
}

export type InputEventType = 'move' | 'attack' | 'restart' | 'test_phase3' | 'skill' | 'use_skill'

export interface InputEventMap {
  move: (direction: InputDirection) => void
  attack: (target: MousePosition) => void
  restart: () => void
  test_phase3: () => void
  skill: (skillNumber: number) => void
  use_skill: (skillId: string) => void
}
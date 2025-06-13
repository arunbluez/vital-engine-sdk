import { Component } from '../core/ECS/Component'
import type { Vector2 } from '../types/GameTypes'

/**
 * Movement component for entities that can move
 */
export class MovementComponent extends Component {
  readonly type = 'movement'
  
  velocity: Vector2
  acceleration: Vector2
  maxSpeed: number
  friction: number

  constructor(
    maxSpeed: number = 100,
    friction: number = 0.8,
    velocityX: number = 0,
    velocityY: number = 0
  ) {
    super()
    this.velocity = { x: velocityX, y: velocityY }
    this.acceleration = { x: 0, y: 0 }
    this.maxSpeed = maxSpeed
    this.friction = friction
  }

  /**
   * Sets the velocity
   */
  setVelocity(x: number, y: number): void {
    this.velocity.x = x
    this.velocity.y = y
  }

  /**
   * Adds to the velocity
   */
  addVelocity(x: number, y: number): void {
    this.velocity.x += x
    this.velocity.y += y
  }

  /**
   * Sets the acceleration
   */
  setAcceleration(x: number, y: number): void {
    this.acceleration.x = x
    this.acceleration.y = y
  }

  /**
   * Adds to the acceleration
   */
  addAcceleration(x: number, y: number): void {
    this.acceleration.x += x
    this.acceleration.y += y
  }

  /**
   * Gets the current speed (magnitude of velocity)
   */
  getSpeed(): number {
    return Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y)
  }

  /**
   * Gets the direction of movement (normalized velocity)
   */
  getDirection(): Vector2 {
    const speed = this.getSpeed()
    if (speed === 0) {
      return { x: 0, y: 0 }
    }
    return {
      x: this.velocity.x / speed,
      y: this.velocity.y / speed,
    }
  }

  /**
   * Stops all movement
   */
  stop(): void {
    this.velocity.x = 0
    this.velocity.y = 0
    this.acceleration.x = 0
    this.acceleration.y = 0
  }

  /**
   * Applies force to the entity
   */
  applyForce(forceX: number, forceY: number): void {
    this.acceleration.x += forceX
    this.acceleration.y += forceY
  }

  /**
   * Applies impulse (immediate change to velocity)
   */
  applyImpulse(impulseX: number, impulseY: number): void {
    this.velocity.x += impulseX
    this.velocity.y += impulseY
  }

  clone(): Component {
    const clone = new MovementComponent(
      this.maxSpeed,
      this.friction,
      this.velocity.x,
      this.velocity.y
    )
    clone.acceleration.x = this.acceleration.x
    clone.acceleration.y = this.acceleration.y
    return clone
  }

  serialize(): Record<string, unknown> {
    return {
      velocity: { x: this.velocity.x, y: this.velocity.y },
      acceleration: { x: this.acceleration.x, y: this.acceleration.y },
      maxSpeed: this.maxSpeed,
      friction: this.friction,
    }
  }

  deserialize(data: Record<string, unknown>): void {
    const velocity = data.velocity as { x: number; y: number } | undefined
    const acceleration = data.acceleration as { x: number; y: number } | undefined
    
    this.velocity.x = velocity?.x !== undefined ? velocity.x : 0
    this.velocity.y = velocity?.y !== undefined ? velocity.y : 0
    this.acceleration.x = acceleration?.x !== undefined ? acceleration.x : 0
    this.acceleration.y = acceleration?.y !== undefined ? acceleration.y : 0
    this.maxSpeed = data.maxSpeed !== undefined ? data.maxSpeed as number : 100
    this.friction = data.friction !== undefined ? data.friction as number : 0.8
  }

  reset(): void {
    this.velocity.x = 0
    this.velocity.y = 0
    this.acceleration.x = 0
    this.acceleration.y = 0
    this.maxSpeed = 100
    this.friction = 0.8
  }
}
import { Component } from '../core/ECS/Component'
import type { Vector2 } from '../types/GameTypes'

/**
 * Transform component for entity position, rotation, and scale
 */
export class TransformComponent extends Component {
  readonly type = 'transform'

  position: Vector2
  rotation: number
  scale: Vector2

  constructor(
    x: number = 0,
    y: number = 0,
    rotation: number = 0,
    scaleX: number = 1,
    scaleY: number = 1
  ) {
    super()
    this.position = { x, y }
    this.rotation = rotation
    this.scale = { x: scaleX, y: scaleY }
  }

  /**
   * Sets the position
   */
  setPosition(x: number, y: number): void {
    this.position.x = x
    this.position.y = y
  }

  /**
   * Translates the position by a delta
   */
  translate(dx: number, dy: number): void {
    this.position.x += dx
    this.position.y += dy
  }

  /**
   * Rotates by a delta angle (in radians)
   */
  rotate(angle: number): void {
    this.rotation += angle
  }

  /**
   * Sets the scale
   */
  setScale(x: number, y: number): void {
    this.scale.x = x
    this.scale.y = y
  }

  /**
   * Gets the forward vector based on rotation
   */
  getForward(): Vector2 {
    return {
      x: Math.cos(this.rotation),
      y: Math.sin(this.rotation),
    }
  }

  /**
   * Gets the right vector based on rotation
   */
  getRight(): Vector2 {
    return {
      x: Math.sin(this.rotation),
      y: -Math.cos(this.rotation),
    }
  }

  clone(): Component {
    return new TransformComponent(
      this.position.x,
      this.position.y,
      this.rotation,
      this.scale.x,
      this.scale.y
    )
  }

  serialize(): Record<string, unknown> {
    return {
      position: { x: this.position.x, y: this.position.y },
      rotation: this.rotation,
      scale: { x: this.scale.x, y: this.scale.y },
    }
  }

  deserialize(data: Record<string, unknown>): void {
    if (data.position) {
      const position = data.position as { x: number; y: number }
      this.position.x = position.x ?? 0
      this.position.y = position.y ?? 0
    } else {
      this.position.x = 0
      this.position.y = 0
    }

    this.rotation = (data.rotation as number) ?? 0

    if (data.scale) {
      const scale = data.scale as { x: number; y: number }
      this.scale.x = scale.x ?? 1
      this.scale.y = scale.y ?? 1
    } else {
      this.scale.x = 1
      this.scale.y = 1
    }
  }

  /**
   * Resets the component to default values
   */
  reset(): void {
    this.position.x = 0
    this.position.y = 0
    this.rotation = 0
    this.scale.x = 1
    this.scale.y = 1
  }
}

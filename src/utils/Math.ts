import type { Vector2, Circle, Rectangle } from '../types/GameTypes'

export type { Vector2, Circle, Rectangle }

/**
 * Math utilities for game calculations
 */

/**
 * Vector2 math operations
 */
export class Vector2Math {
  static create(x: number = 0, y: number = 0): Vector2 {
    return { x, y }
  }

  static clone(v: Vector2): Vector2 {
    return { x: v.x, y: v.y }
  }

  static add(a: Vector2, b: Vector2): Vector2 {
    return { x: a.x + b.x, y: a.y + b.y }
  }

  static subtract(a: Vector2, b: Vector2): Vector2 {
    return { x: a.x - b.x, y: a.y - b.y }
  }

  static multiply(v: Vector2, scalar: number): Vector2 {
    return { x: v.x * scalar, y: v.y * scalar }
  }

  static divide(v: Vector2, scalar: number): Vector2 {
    if (scalar === 0) {
      throw new Error('Division by zero')
    }
    return { x: v.x / scalar, y: v.y / scalar }
  }

  static magnitude(v: Vector2): number {
    return Math.sqrt(v.x * v.x + v.y * v.y)
  }

  static magnitudeSquared(v: Vector2): number {
    return v.x * v.x + v.y * v.y
  }

  static normalize(v: Vector2): Vector2 {
    const mag = Vector2Math.magnitude(v)
    if (mag === 0) {
      return { x: 0, y: 0 }
    }
    return Vector2Math.divide(v, mag)
  }

  static distance(a: Vector2, b: Vector2): number {
    const dx = b.x - a.x
    const dy = b.y - a.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  static distanceSquared(a: Vector2, b: Vector2): number {
    const dx = b.x - a.x
    const dy = b.y - a.y
    return dx * dx + dy * dy
  }

  static dot(a: Vector2, b: Vector2): number {
    return a.x * b.x + a.y * b.y
  }

  static angle(v: Vector2): number {
    return Math.atan2(v.y, v.x)
  }

  static angleBetween(a: Vector2, b: Vector2): number {
    return Math.atan2(b.y - a.y, b.x - a.x)
  }

  static rotate(v: Vector2, angle: number): Vector2 {
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    return {
      x: v.x * cos - v.y * sin,
      y: v.x * sin + v.y * cos,
    }
  }

  static lerp(a: Vector2, b: Vector2, t: number): Vector2 {
    const clampedT = Math.max(0, Math.min(1, t))
    return {
      x: a.x + (b.x - a.x) * clampedT,
      y: a.y + (b.y - a.y) * clampedT,
    }
  }

  static equals(a: Vector2, b: Vector2, epsilon: number = 0.0001): boolean {
    return Math.abs(a.x - b.x) < epsilon && Math.abs(a.y - b.y) < epsilon
  }
}

/**
 * Collision detection utilities
 */
export class CollisionDetection {
  /**
   * Check if two circles intersect
   */
  static circleToCircle(a: Circle, b: Circle): boolean {
    const distSq = Vector2Math.distanceSquared(a, b)
    const radiusSum = a.radius + b.radius
    return distSq < radiusSum * radiusSum
  }

  /**
   * Check if a circle and rectangle intersect
   */
  static circleToRectangle(circle: Circle, rect: Rectangle): boolean {
    // Find the closest point on the rectangle to the circle center
    const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width))
    const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height))

    // Calculate the distance between the circle's center and closest point
    const distX = circle.x - closestX
    const distY = circle.y - closestY
    const distSq = distX * distX + distY * distY

    return distSq < circle.radius * circle.radius
  }

  /**
   * Check if two rectangles intersect
   */
  static rectangleToRectangle(a: Rectangle, b: Rectangle): boolean {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    )
  }

  /**
   * Check if a point is inside a circle
   */
  static pointInCircle(point: Vector2, circle: Circle): boolean {
    const distSq = Vector2Math.distanceSquared(point, circle)
    return distSq < circle.radius * circle.radius
  }

  /**
   * Check if a point is inside a rectangle
   */
  static pointInRectangle(point: Vector2, rect: Rectangle): boolean {
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    )
  }

  /**
   * Get the overlap between two circles
   */
  static getCircleOverlap(a: Circle, b: Circle): Vector2 | null {
    const distance = Vector2Math.distance(a, b)
    const radiusSum = a.radius + b.radius

    if (distance >= radiusSum) {
      return null
    }

    const direction = Vector2Math.normalize(Vector2Math.subtract(b, a))
    const overlap = radiusSum - distance

    return Vector2Math.multiply(direction, overlap)
  }
}

/**
 * Common math utilities
 */
export class MathUtils {
  static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
  }

  static lerp(a: number, b: number, t: number): number {
    return a + (b - a) * MathUtils.clamp(t, 0, 1)
  }

  static smoothstep(edge0: number, edge1: number, x: number): number {
    const t = MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1)
    return t * t * (3 - 2 * t)
  }

  static radiansToDegrees(radians: number): number {
    return radians * (180 / Math.PI)
  }

  static degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180)
  }

  static randomRange(min: number, max: number): number {
    return Math.random() * (max - min) + min
  }

  static randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  static isPowerOfTwo(value: number): boolean {
    return (value & (value - 1)) === 0 && value !== 0
  }

  static nextPowerOfTwo(value: number): number {
    if (value <= 0) return 1
    value--
    value |= value >> 1
    value |= value >> 2
    value |= value >> 4
    value |= value >> 8
    value |= value >> 16
    return value + 1
  }
}

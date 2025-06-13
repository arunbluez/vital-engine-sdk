import { Component } from '../core/ECS/Component'

/**
 * Health component for entities that can take damage
 */
export class HealthComponent extends Component {
  readonly type = 'health'
  
  current: number
  maximum: number
  regeneration: number
  lastDamageTime: number

  constructor(
    maximum: number = 100,
    current?: number,
    regeneration: number = 0
  ) {
    super()
    this.maximum = maximum
    this.current = current ?? maximum
    this.regeneration = regeneration
    this.lastDamageTime = 0
  }

  /**
   * Takes damage and returns actual damage dealt
   */
  takeDamage(amount: number, timestamp: number = Date.now()): number {
    const actualDamage = Math.min(amount, this.current)
    this.current -= actualDamage
    this.lastDamageTime = timestamp
    return actualDamage
  }

  /**
   * Heals for an amount and returns actual healing done
   */
  heal(amount: number): number {
    const actualHealing = Math.min(amount, this.maximum - this.current)
    this.current += actualHealing
    return actualHealing
  }

  /**
   * Sets health to maximum
   */
  fullHeal(): void {
    this.current = this.maximum
  }

  /**
   * Checks if the entity is dead
   */
  isDead(): boolean {
    return this.current <= 0
  }

  /**
   * Checks if the entity is at full health
   */
  isFullHealth(): boolean {
    return this.current >= this.maximum
  }

  /**
   * Gets health as a percentage (0-1)
   */
  getHealthPercentage(): number {
    return this.maximum > 0 ? this.current / this.maximum : 0
  }

  /**
   * Sets the maximum health and optionally adjusts current health
   */
  setMaximum(newMaximum: number, maintainPercentage: boolean = false): void {
    if (maintainPercentage && this.maximum > 0) {
      const percentage = this.getHealthPercentage()
      this.maximum = newMaximum
      this.current = newMaximum * percentage
    } else {
      this.maximum = newMaximum
      this.current = Math.min(this.current, newMaximum)
    }
  }

  /**
   * Applies regeneration over time
   */
  regenerate(deltaTime: number): number {
    if (this.regeneration <= 0 || this.isFullHealth()) {
      return 0
    }

    const regenAmount = this.regeneration * (deltaTime / 1000)
    return this.heal(regenAmount)
  }

  clone(): Component {
    const clone = new HealthComponent(this.maximum, this.current, this.regeneration)
    clone.lastDamageTime = this.lastDamageTime
    return clone
  }

  serialize(): Record<string, unknown> {
    return {
      current: this.current,
      maximum: this.maximum,
      regeneration: this.regeneration,
      lastDamageTime: this.lastDamageTime,
    }
  }

  deserialize(data: Record<string, unknown>): void {
    this.current = data.current !== undefined ? data.current as number : 100
    this.maximum = data.maximum !== undefined ? data.maximum as number : 100
    this.regeneration = data.regeneration !== undefined ? data.regeneration as number : 0
    this.lastDamageTime = data.lastDamageTime !== undefined ? data.lastDamageTime as number : 0
  }

  reset(): void {
    this.current = 100
    this.maximum = 100
    this.regeneration = 0
    this.lastDamageTime = 0
  }
}
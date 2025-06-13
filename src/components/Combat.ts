import { Component } from '../core/ECS/Component'
import type { EntityId } from '../types/CoreTypes'

export interface WeaponStats {
  damage: number
  range: number
  attackSpeed: number // attacks per second
  projectileSpeed?: number
  piercing?: number
  criticalChance?: number
  criticalMultiplier?: number
}

/**
 * Combat component for entities that can attack
 */
export class CombatComponent extends Component {
  readonly type = 'combat'
  
  weapon: WeaponStats
  lastAttackTime: number
  targetId: EntityId | null
  autoAttack: boolean

  constructor(weapon: WeaponStats, autoAttack: boolean = true) {
    super()
    this.weapon = { ...weapon }
    this.lastAttackTime = 0
    this.targetId = null
    this.autoAttack = autoAttack
  }

  /**
   * Checks if the entity can attack (cooldown finished)
   */
  canAttack(currentTime: number = Date.now()): boolean {
    const attackCooldown = 1000 / this.weapon.attackSpeed // ms between attacks
    return currentTime - this.lastAttackTime >= attackCooldown
  }

  /**
   * Performs an attack and updates the last attack time
   */
  attack(currentTime: number = Date.now()): void {
    this.lastAttackTime = currentTime
  }

  /**
   * Sets the current target
   */
  setTarget(targetId: EntityId | null): void {
    this.targetId = targetId
  }

  /**
   * Calculates damage with critical hit chance
   */
  calculateDamage(): number {
    let damage = this.weapon.damage

    // Apply critical hit
    if (this.weapon.criticalChance && this.weapon.criticalMultiplier) {
      if (Math.random() < this.weapon.criticalChance) {
        damage *= this.weapon.criticalMultiplier
      }
    }

    return damage
  }

  /**
   * Gets the attack cooldown in milliseconds
   */
  getAttackCooldown(): number {
    return 1000 / this.weapon.attackSpeed
  }

  /**
   * Gets the remaining cooldown time
   */
  getRemainingCooldown(currentTime: number = Date.now()): number {
    const cooldown = this.getAttackCooldown()
    const elapsed = currentTime - this.lastAttackTime
    return Math.max(0, cooldown - elapsed)
  }

  /**
   * Updates weapon stats
   */
  updateWeapon(newStats: Partial<WeaponStats>): void {
    this.weapon = { ...this.weapon, ...newStats }
  }

  clone(): Component {
    const clone = new CombatComponent({ ...this.weapon }, this.autoAttack)
    clone.lastAttackTime = this.lastAttackTime
    clone.targetId = this.targetId
    return clone
  }

  serialize(): Record<string, unknown> {
    return {
      weapon: { ...this.weapon },
      lastAttackTime: this.lastAttackTime,
      targetId: this.targetId,
      autoAttack: this.autoAttack,
    }
  }

  deserialize(data: Record<string, unknown>): void {
    const weapon = data.weapon as WeaponStats | undefined
    if (weapon) {
      this.weapon = { ...weapon }
    } else {
      // Default weapon stats
      this.weapon = {
        damage: 10,
        range: 50,
        attackSpeed: 1,
        projectileSpeed: undefined,
        piercing: undefined,
        criticalChance: undefined,
        criticalMultiplier: undefined
      }
    }
    this.lastAttackTime = data.lastAttackTime !== undefined ? data.lastAttackTime as number : 0
    this.targetId = data.targetId !== undefined ? data.targetId as EntityId | null : null
    this.autoAttack = data.autoAttack !== undefined ? data.autoAttack as boolean : true
  }

  reset(): void {
    this.weapon = {
      damage: 10,
      range: 50,
      attackSpeed: 1,
      projectileSpeed: undefined,
      piercing: undefined,
      criticalChance: undefined,
      criticalMultiplier: undefined
    }
    this.lastAttackTime = 0
    this.targetId = null
    this.autoAttack = true
  }
}
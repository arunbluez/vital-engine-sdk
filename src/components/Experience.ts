import { Component } from '../core/ECS/Component'

/**
 * Experience component for entities that can gain XP and level up
 */
export class ExperienceComponent extends Component {
  readonly type = 'experience'

  level: number
  currentXP: number
  xpToNextLevel: number
  totalXP: number

  constructor(level: number = 1) {
    super()
    this.level = level
    this.currentXP = 0
    this.totalXP = 0
    this.xpToNextLevel = this.calculateXPRequirement(level + 1)
  }

  /**
   * Adds experience and handles level ups
   */
  addExperience(amount: number): number[] {
    const levelsGained: number[] = []

    this.currentXP += amount
    this.totalXP += amount

    // Check for level ups
    while (this.currentXP >= this.xpToNextLevel) {
      this.currentXP -= this.xpToNextLevel
      this.level++
      levelsGained.push(this.level)
      this.xpToNextLevel = this.calculateXPRequirement(this.level + 1)
    }

    return levelsGained
  }

  /**
   * Gets the progress to the next level (0-1)
   */
  getLevelProgress(): number {
    return this.xpToNextLevel > 0 ? this.currentXP / this.xpToNextLevel : 1
  }

  /**
   * Calculates XP requirement for a given level
   * Uses a scaling formula: baseXP * level^1.5
   */
  private calculateXPRequirement(level: number): number {
    const baseXP = 100
    return Math.floor(baseXP * Math.pow(level, 1.5))
  }

  /**
   * Gets the XP requirement for the next level
   */
  getXPToNextLevel(): number {
    return this.xpToNextLevel - this.currentXP
  }

  /**
   * Sets the level directly (for testing or cheats)
   */
  setLevel(newLevel: number): void {
    if (newLevel < 1) return

    this.level = newLevel
    this.currentXP = 0
    this.xpToNextLevel = this.calculateXPRequirement(newLevel + 1)
  }

  clone(): Component {
    const clone = new ExperienceComponent(this.level)
    clone.currentXP = this.currentXP
    clone.totalXP = this.totalXP
    clone.xpToNextLevel = this.xpToNextLevel
    return clone
  }

  serialize(): Record<string, unknown> {
    return {
      level: this.level,
      currentXP: this.currentXP,
      xpToNextLevel: this.xpToNextLevel,
      totalXP: this.totalXP,
    }
  }

  deserialize(data: Record<string, unknown>): void {
    this.level = data.level as number
    this.currentXP = data.currentXP as number
    this.xpToNextLevel = data.xpToNextLevel as number
    this.totalXP = data.totalXP as number
  }
}

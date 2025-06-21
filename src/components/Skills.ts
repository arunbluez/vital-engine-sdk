import { Component } from '../core/ECS/Component'
import type { EntityId } from '../types/CoreTypes'

/**
 * Skill type definitions
 */
export enum SkillType {
  ACTIVE = 'active',
  PASSIVE = 'passive',
  EVOLUTION = 'evolution'
}

export enum SkillTargetType {
  SELF = 'self',
  ENEMIES = 'enemies',
  ALLIES = 'allies',
  AREA = 'area',
  PROJECTILE = 'projectile'
}

export enum SkillEffectType {
  DAMAGE = 'damage',
  HEAL = 'heal',
  BUFF = 'buff',
  DEBUFF = 'debuff',
  MOVEMENT = 'movement',
  PROJECTILE_CREATE = 'projectile_create',
  ATTRIBUTE_MODIFY = 'attribute_modify'
}

/**
 * Skill effect definition
 */
export interface SkillEffect {
  type: SkillEffectType
  value: number
  duration?: number // For temporary effects (ms)
  radius?: number // For area effects
  chance?: number // Probability of effect (0-1)
  stackable?: boolean // Can stack with other instances
  metadata?: Record<string, unknown> // Additional effect data
}

/**
 * Individual skill definition
 */
export interface Skill {
  id: string
  name: string
  description: string
  type: SkillType
  targetType: SkillTargetType
  level: number
  maxLevel: number
  cooldown: number // Milliseconds
  lastUsed: number // Timestamp
  manaCost?: number
  effects: SkillEffect[]
  requirements?: SkillRequirement[]
  evolveInto?: string[] // Evolution target skill IDs
  metadata?: Record<string, unknown> // Additional skill data
}

/**
 * Skill requirement for unlock/evolution
 */
export interface SkillRequirement {
  type: 'level' | 'skill' | 'stat' | 'achievement'
  value: number | string
  operator: '>' | '>=' | '=' | '<' | '<='
}

/**
 * Active effect on an entity
 */
export interface ActiveEffect {
  id: string
  skillId: string
  sourceEntityId: EntityId
  effect: SkillEffect
  startTime: number
  endTime?: number // Undefined for permanent effects
  stacks: number
}

/**
 * Skills component for entities that can use abilities
 */
export class SkillsComponent extends Component {
  readonly type = 'skills'
  
  public skills: Map<string, Skill> = new Map()
  public activeEffects: ActiveEffect[] = []
  public skillPoints: number = 0
  public selectedSkills: string[] = [] // Skills available for use
  public evolutionProgress: Map<string, number> = new Map() // Evolution requirements progress

  constructor(skillPoints: number = 0) {
    super()
    this.skillPoints = skillPoints
  }

  /**
   * Adds a skill to the entity
   */
  addSkill(skill: Skill): boolean {
    if (this.skills.has(skill.id)) {
      return false
    }
    
    this.skills.set(skill.id, { ...skill, lastUsed: 0 })
    return true
  }

  /**
   * Removes a skill from the entity
   */
  removeSkill(skillId: string): boolean {
    return this.skills.delete(skillId)
  }

  /**
   * Gets a skill by ID
   */
  getSkill(skillId: string): Skill | null {
    return this.skills.get(skillId) ?? null
  }

  /**
   * Upgrades a skill level
   */
  upgradeSkill(skillId: string): boolean {
    const skill = this.skills.get(skillId)
    if (!skill || skill.level >= skill.maxLevel || this.skillPoints <= 0) {
      return false
    }

    skill.level++
    this.skillPoints--
    
    // Scale effects with level
    skill.effects.forEach(effect => {
      if (effect.type === SkillEffectType.DAMAGE || 
          effect.type === SkillEffectType.HEAL ||
          effect.type === SkillEffectType.ATTRIBUTE_MODIFY) {
        effect.value *= 1.1 // 10% increase per level
      }
      if (effect.duration) {
        effect.duration *= 1.05 // 5% duration increase per level
      }
    })

    return true
  }

  /**
   * Checks if a skill can be used
   */
  canUseSkill(skillId: string, currentTime: number): boolean {
    const skill = this.skills.get(skillId)
    if (!skill || skill.type !== SkillType.ACTIVE) {
      return false
    }

    return currentTime - skill.lastUsed >= skill.cooldown
  }

  /**
   * Uses a skill (sets cooldown)
   */
  useSkill(skillId: string, currentTime: number): boolean {
    if (!this.canUseSkill(skillId, currentTime)) {
      return false
    }

    const skill = this.skills.get(skillId)!
    skill.lastUsed = currentTime
    return true
  }

  /**
   * Adds an active effect
   */
  addActiveEffect(effect: ActiveEffect): void {
    // Check if effect is stackable
    if (!effect.effect.stackable) {
      // Remove existing effects of the same type from the same skill
      this.activeEffects = this.activeEffects.filter(
        existing => !(existing.skillId === effect.skillId && 
                     existing.effect.type === effect.effect.type)
      )
    }

    this.activeEffects.push(effect)
  }

  /**
   * Removes expired effects
   */
  updateActiveEffects(currentTime: number): void {
    this.activeEffects = this.activeEffects.filter(effect => {
      return !effect.endTime || currentTime < effect.endTime
    })
  }

  /**
   * Gets all active effects of a specific type
   */
  getActiveEffectsByType(type: SkillEffectType): ActiveEffect[] {
    return this.activeEffects.filter(effect => effect.effect.type === type)
  }

  /**
   * Calculates total effect value for a type (stacking)
   */
  getTotalEffectValue(type: SkillEffectType): number {
    return this.activeEffects
      .filter(effect => effect.effect.type === type)
      .reduce((total, effect) => total + (effect.effect.value * effect.stacks), 0)
  }

  /**
   * Gets all skills of a specific type
   */
  getSkillsByType(type: SkillType): Skill[] {
    return Array.from(this.skills.values()).filter(skill => skill.type === type)
  }

  /**
   * Gets all available evolution options
   */
  getEvolutionOptions(): string[] {
    const options: string[] = []
    
    this.skills.forEach(skill => {
      if (skill.evolveInto && skill.level >= skill.maxLevel) {
        options.push(...skill.evolveInto)
      }
    })

    return options
  }

  /**
   * Checks if skill requirements are met
   */
  meetsRequirements(requirements: SkillRequirement[], entityLevel: number, entityStats: Record<string, number>): boolean {
    return requirements.every(req => {
      switch (req.type) {
        case 'level':
          return this.compareValues(entityLevel, req.operator, req.value as number)
        case 'skill':
          const skill = this.skills.get(req.value as string)
          return skill && skill.level > 0
        case 'stat':
          const statValue = entityStats[req.value as string] ?? 0
          return this.compareValues(statValue, req.operator, req.value as number)
        default:
          return true
      }
    })
  }

  /**
   * Helper method for requirement comparison
   */
  private compareValues(actual: number, operator: string, expected: number): boolean {
    switch (operator) {
      case '>': return actual > expected
      case '>=': return actual >= expected
      case '=': return actual === expected
      case '<': return actual < expected
      case '<=': return actual <= expected
      default: return false
    }
  }

  clone(): SkillsComponent {
    const clone = new SkillsComponent(this.skillPoints)
    
    // Deep clone skills
    this.skills.forEach((skill, id) => {
      clone.skills.set(id, {
        ...skill,
        effects: skill.effects.map(effect => ({ ...effect })),
        requirements: skill.requirements?.map(req => ({ ...req })),
        evolveInto: skill.evolveInto ? [...skill.evolveInto] : undefined
      })
    })

    // Deep clone active effects
    clone.activeEffects = this.activeEffects.map(effect => ({
      ...effect,
      effect: { ...effect.effect }
    }))

    clone.selectedSkills = [...this.selectedSkills]
    clone.evolutionProgress = new Map(this.evolutionProgress)

    return clone
  }

  serialize(): Record<string, unknown> {
    return {
      skillPoints: this.skillPoints,
      skills: Object.fromEntries(this.skills),
      activeEffects: this.activeEffects,
      selectedSkills: this.selectedSkills,
      evolutionProgress: Object.fromEntries(this.evolutionProgress)
    }
  }

  deserialize(data: Record<string, unknown>): void {
    this.skillPoints = data.skillPoints as number
    this.skills = new Map(Object.entries(data.skills as Record<string, Skill>))
    this.activeEffects = data.activeEffects as ActiveEffect[]
    this.selectedSkills = data.selectedSkills as string[]
    this.evolutionProgress = new Map(Object.entries(data.evolutionProgress as Record<string, number>))
  }
}
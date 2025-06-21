import {
  SkillType,
  SkillTargetType,
  SkillEffectType,
} from '../components/Skills'
import type { Skill } from '../components/Skills'

/**
 * Skill database configuration
 */
export interface SkillDatabase {
  skills: Record<string, SkillTemplate>
  evolutionTrees: EvolutionTree[]
  skillSets: SkillSet[]
}

/**
 * Template for creating skills
 */
export interface SkillTemplate {
  id: string
  name: string
  description: string
  type: SkillType
  targetType: SkillTargetType
  maxLevel: number
  cooldown: number
  manaCost?: number
  effects: SkillEffectTemplate[]
  requirements?: SkillRequirementTemplate[]
  evolveInto?: string[]
  rarity: SkillRarity
  category: SkillCategory
}

/**
 * Skill effect template with scaling
 */
export interface SkillEffectTemplate {
  type: SkillEffectType
  baseValue: number
  levelScaling: number // Multiplier per level
  duration?: number
  durationScaling?: number
  radius?: number
  radiusScaling?: number
  chance: number
  chanceScaling?: number
  stackable: boolean
  metadata?: Record<string, unknown>
}

/**
 * Skill requirement template
 */
export interface SkillRequirementTemplate {
  type: 'level' | 'skill' | 'stat' | 'achievement'
  value: number | string
  operator: '>' | '>=' | '=' | '<' | '<='
}

/**
 * Evolution tree definition
 */
export interface EvolutionTree {
  rootSkillId: string
  evolutions: EvolutionPath[]
}

/**
 * Single evolution path
 */
export interface EvolutionPath {
  fromSkillId: string
  toSkillId: string
  requirements: EvolutionRequirement[]
}

/**
 * Evolution requirement
 */
export interface EvolutionRequirement {
  type:
    | 'skill_level'
    | 'character_level'
    | 'stat'
    | 'achievement'
    | 'other_skill'
  value: number | string
  description: string
}

/**
 * Skill set for character classes or builds
 */
export interface SkillSet {
  id: string
  name: string
  description: string
  startingSkills: string[]
  availableSkills: string[]
  bonuses?: SkillSetBonus[]
}

/**
 * Bonus for having multiple skills from a set
 */
export interface SkillSetBonus {
  skillCount: number
  bonusType: 'damage' | 'cooldown' | 'effect' | 'stat'
  value: number
  description: string
}

/**
 * Skill rarity levels
 */
export enum SkillRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary',
}

/**
 * Skill categories for organization
 */
export enum SkillCategory {
  COMBAT = 'combat',
  MAGIC = 'magic',
  SUPPORT = 'support',
  MOVEMENT = 'movement',
  DEFENSIVE = 'defensive',
  UTILITY = 'utility',
}

/**
 * Default skill database with common survival game skills
 */
export const DEFAULT_SKILL_DATABASE: SkillDatabase = {
  skills: {
    // Basic Attack Skills
    rapid_fire: {
      id: 'rapid_fire',
      name: 'Rapid Fire',
      description: 'Increases attack speed for a short duration',
      type: SkillType.ACTIVE,
      targetType: SkillTargetType.SELF,
      maxLevel: 5,
      cooldown: 8000,
      effects: [
        {
          type: SkillEffectType.ATTRIBUTE_MODIFY,
          baseValue: 50, // 50% attack speed increase
          levelScaling: 10, // +10% per level
          duration: 5000,
          durationScaling: 500, // +0.5s per level
          chance: 1.0,
          stackable: false,
        },
      ],
      rarity: SkillRarity.COMMON,
      category: SkillCategory.COMBAT,
      evolveInto: ['bullet_storm', 'precision_shots'],
    },

    bullet_storm: {
      id: 'bullet_storm',
      name: 'Bullet Storm',
      description: 'Evolved Rapid Fire - Creates a storm of projectiles',
      type: SkillType.ACTIVE,
      targetType: SkillTargetType.AREA,
      maxLevel: 3,
      cooldown: 12000,
      effects: [
        {
          type: SkillEffectType.PROJECTILE_CREATE,
          baseValue: 8, // Number of projectiles
          levelScaling: 2,
          radius: 150,
          chance: 1.0,
          stackable: false,
          metadata: { projectileSpeed: 400, spread: 360 },
        },
      ],
      requirements: [{ type: 'skill', value: 'rapid_fire', operator: '>=' }],
      rarity: SkillRarity.RARE,
      category: SkillCategory.COMBAT,
    },

    precision_shots: {
      id: 'precision_shots',
      name: 'Precision Shots',
      description:
        'Evolved Rapid Fire - Every shot has a chance to critically hit',
      type: SkillType.PASSIVE,
      targetType: SkillTargetType.SELF,
      maxLevel: 3,
      cooldown: 0,
      effects: [
        {
          type: SkillEffectType.ATTRIBUTE_MODIFY,
          baseValue: 25, // 25% crit chance increase
          levelScaling: 10,
          chance: 1.0,
          stackable: false,
          metadata: { stat: 'criticalChance' },
        },
      ],
      requirements: [{ type: 'skill', value: 'rapid_fire', operator: '>=' }],
      rarity: SkillRarity.RARE,
      category: SkillCategory.COMBAT,
    },

    // Defensive Skills
    shield: {
      id: 'shield',
      name: 'Shield',
      description: 'Creates a protective barrier that absorbs damage',
      type: SkillType.ACTIVE,
      targetType: SkillTargetType.SELF,
      maxLevel: 5,
      cooldown: 15000,
      effects: [
        {
          type: SkillEffectType.BUFF,
          baseValue: 100, // Shield points
          levelScaling: 50,
          duration: 10000,
          durationScaling: 1000,
          chance: 1.0,
          stackable: false,
          metadata: { shieldType: 'absorb' },
        },
      ],
      rarity: SkillRarity.COMMON,
      category: SkillCategory.DEFENSIVE,
      evolveInto: ['fortress', 'reflective_barrier'],
    },

    fortress: {
      id: 'fortress',
      name: 'Fortress',
      description:
        'Evolved Shield - Provides immunity to damage for a short time',
      type: SkillType.ACTIVE,
      targetType: SkillTargetType.SELF,
      maxLevel: 3,
      cooldown: 25000,
      effects: [
        {
          type: SkillEffectType.BUFF,
          baseValue: 1, // Immunity flag
          levelScaling: 0,
          duration: 3000,
          durationScaling: 500,
          chance: 1.0,
          stackable: false,
          metadata: { invulnerable: true },
        },
      ],
      requirements: [{ type: 'skill', value: 'shield', operator: '>=' }],
      rarity: SkillRarity.EPIC,
      category: SkillCategory.DEFENSIVE,
    },

    // Healing Skills
    regeneration: {
      id: 'regeneration',
      name: 'Regeneration',
      description: 'Gradually restores health over time',
      type: SkillType.ACTIVE,
      targetType: SkillTargetType.SELF,
      maxLevel: 5,
      cooldown: 20000,
      effects: [
        {
          type: SkillEffectType.HEAL,
          baseValue: 5, // HP per tick
          levelScaling: 2,
          duration: 10000,
          durationScaling: 2000,
          chance: 1.0,
          stackable: true,
        },
      ],
      rarity: SkillRarity.COMMON,
      category: SkillCategory.SUPPORT,
      evolveInto: ['vampiric_aura', 'phoenix_rebirth'],
    },

    vampiric_aura: {
      id: 'vampiric_aura',
      name: 'Vampiric Aura',
      description: 'Heals based on damage dealt to enemies',
      type: SkillType.PASSIVE,
      targetType: SkillTargetType.SELF,
      maxLevel: 3,
      cooldown: 0,
      effects: [
        {
          type: SkillEffectType.BUFF,
          baseValue: 10, // 10% lifesteal
          levelScaling: 5,
          chance: 1.0,
          stackable: false,
          metadata: { lifesteal: true },
        },
      ],
      requirements: [{ type: 'skill', value: 'regeneration', operator: '>=' }],
      rarity: SkillRarity.RARE,
      category: SkillCategory.SUPPORT,
    },

    // Movement Skills
    dash: {
      id: 'dash',
      name: 'Dash',
      description: 'Quickly move to target location',
      type: SkillType.ACTIVE,
      targetType: SkillTargetType.AREA,
      maxLevel: 5,
      cooldown: 5000,
      effects: [
        {
          type: SkillEffectType.MOVEMENT,
          baseValue: 300, // Dash distance
          levelScaling: 50,
          chance: 1.0,
          stackable: false,
          metadata: { instantMovement: true },
        },
      ],
      rarity: SkillRarity.COMMON,
      category: SkillCategory.MOVEMENT,
      evolveInto: ['teleport', 'shadow_step'],
    },

    // Magic Skills
    fireball: {
      id: 'fireball',
      name: 'Fireball',
      description: 'Launches a fireball that explodes on impact',
      type: SkillType.ACTIVE,
      targetType: SkillTargetType.PROJECTILE,
      maxLevel: 5,
      cooldown: 3000,
      manaCost: 20,
      effects: [
        {
          type: SkillEffectType.DAMAGE,
          baseValue: 80,
          levelScaling: 20,
          radius: 50,
          radiusScaling: 10,
          chance: 1.0,
          stackable: false,
          metadata: { element: 'fire', explosive: true },
        },
      ],
      rarity: SkillRarity.UNCOMMON,
      category: SkillCategory.MAGIC,
      evolveInto: ['meteor', 'chain_lightning'],
    },

    meteor: {
      id: 'meteor',
      name: 'Meteor',
      description: 'Calls down a devastating meteor strike',
      type: SkillType.ACTIVE,
      targetType: SkillTargetType.AREA,
      maxLevel: 3,
      cooldown: 15000,
      manaCost: 80,
      effects: [
        {
          type: SkillEffectType.DAMAGE,
          baseValue: 300,
          levelScaling: 100,
          radius: 120,
          radiusScaling: 20,
          chance: 1.0,
          stackable: false,
          metadata: { element: 'fire', delay: 2000 },
        },
      ],
      requirements: [
        { type: 'skill', value: 'fireball', operator: '>=' },
        { type: 'level', value: 10, operator: '>=' },
      ],
      rarity: SkillRarity.LEGENDARY,
      category: SkillCategory.MAGIC,
    },

    // Utility Skills
    magnetic_field: {
      id: 'magnetic_field',
      name: 'Magnetic Field',
      description: 'Attracts nearby items and experience orbs',
      type: SkillType.PASSIVE,
      targetType: SkillTargetType.SELF,
      maxLevel: 5,
      cooldown: 0,
      effects: [
        {
          type: SkillEffectType.BUFF,
          baseValue: 50, // Collection radius increase
          levelScaling: 25,
          chance: 1.0,
          stackable: false,
          metadata: { magnetism: true },
        },
      ],
      rarity: SkillRarity.COMMON,
      category: SkillCategory.UTILITY,
    },
  },

  evolutionTrees: [
    {
      rootSkillId: 'rapid_fire',
      evolutions: [
        {
          fromSkillId: 'rapid_fire',
          toSkillId: 'bullet_storm',
          requirements: [
            {
              type: 'skill_level',
              value: 5,
              description: 'Rapid Fire at max level',
            },
            {
              type: 'character_level',
              value: 8,
              description: 'Character level 8+',
            },
          ],
        },
        {
          fromSkillId: 'rapid_fire',
          toSkillId: 'precision_shots',
          requirements: [
            {
              type: 'skill_level',
              value: 5,
              description: 'Rapid Fire at max level',
            },
            {
              type: 'stat',
              value: 'accuracy',
              description: 'High accuracy stat',
            },
          ],
        },
      ],
    },
    {
      rootSkillId: 'shield',
      evolutions: [
        {
          fromSkillId: 'shield',
          toSkillId: 'fortress',
          requirements: [
            {
              type: 'skill_level',
              value: 5,
              description: 'Shield at max level',
            },
            {
              type: 'character_level',
              value: 15,
              description: 'Character level 15+',
            },
          ],
        },
      ],
    },
    {
      rootSkillId: 'fireball',
      evolutions: [
        {
          fromSkillId: 'fireball',
          toSkillId: 'meteor',
          requirements: [
            {
              type: 'skill_level',
              value: 5,
              description: 'Fireball at max level',
            },
            {
              type: 'character_level',
              value: 20,
              description: 'Character level 20+',
            },
            {
              type: 'other_skill',
              value: 'magic_mastery',
              description: 'Magic Mastery skill learned',
            },
          ],
        },
      ],
    },
  ],

  skillSets: [
    {
      id: 'warrior',
      name: 'Warrior',
      description: 'Focused on melee combat and defense',
      startingSkills: ['rapid_fire', 'shield'],
      availableSkills: [
        'rapid_fire',
        'shield',
        'dash',
        'fortress',
        'bullet_storm',
      ],
      bonuses: [
        {
          skillCount: 2,
          bonusType: 'damage',
          value: 10,
          description: '+10% damage with 2+ warrior skills',
        },
        {
          skillCount: 4,
          bonusType: 'cooldown',
          value: 15,
          description: '-15% cooldown with 4+ warrior skills',
        },
      ],
    },
    {
      id: 'mage',
      name: 'Mage',
      description: 'Master of magical arts and elemental damage',
      startingSkills: ['fireball', 'magnetic_field'],
      availableSkills: [
        'fireball',
        'meteor',
        'chain_lightning',
        'regeneration',
        'vampiric_aura',
      ],
      bonuses: [
        {
          skillCount: 2,
          bonusType: 'effect',
          value: 20,
          description: '+20% spell effect with 2+ mage skills',
        },
        {
          skillCount: 4,
          bonusType: 'stat',
          value: 50,
          description: '+50 mana with 4+ mage skills',
        },
      ],
    },
    {
      id: 'survivor',
      name: 'Survivor',
      description: 'Balanced approach focusing on sustainability',
      startingSkills: ['regeneration', 'magnetic_field'],
      availableSkills: [
        'regeneration',
        'vampiric_aura',
        'shield',
        'dash',
        'magnetic_field',
      ],
      bonuses: [
        {
          skillCount: 3,
          bonusType: 'stat',
          value: 25,
          description: '+25% health with 3+ survivor skills',
        },
      ],
    },
  ],
}

/**
 * Skill selection configuration
 */
export interface SkillSelectionConfig {
  maxSkillsPerSelection: number
  rarityWeights: Record<SkillRarity, number>
  levelUpSkillCount: number
  evolutionChance: number
  duplicateSkillHandling: 'upgrade' | 'reroll' | 'ignore'
}

/**
 * Default skill selection configuration
 */
export const DEFAULT_SKILL_SELECTION_CONFIG: SkillSelectionConfig = {
  maxSkillsPerSelection: 3,
  rarityWeights: {
    [SkillRarity.COMMON]: 0.5,
    [SkillRarity.UNCOMMON]: 0.3,
    [SkillRarity.RARE]: 0.15,
    [SkillRarity.EPIC]: 0.04,
    [SkillRarity.LEGENDARY]: 0.01,
  },
  levelUpSkillCount: 3,
  evolutionChance: 0.2, // 20% chance to offer evolution instead of new skill
  duplicateSkillHandling: 'upgrade',
}

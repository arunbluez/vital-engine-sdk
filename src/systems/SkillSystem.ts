import { System } from '../core/ECS/System'
import type { World } from '../core/ECS/World'
import type {
  EntityId,
  ComponentType,
  SystemUpdateContext,
  EntityQuery,
} from '../types/CoreTypes'
import type { TransformComponent } from '../components/Transform'
import type { HealthComponent } from '../components/Health'
import type { CombatComponent } from '../components/Combat'
import type { MovementComponent } from '../components/Movement'
import type { SkillsComponent } from '../components/Skills'
import {
  SkillType,
  SkillEffectType,
  SkillTargetType,
  type Skill,
  type SkillEffect,
  type ActiveEffect,
} from '../components/Skills'
import type { ExperienceComponent } from '../components/Experience'
import type { GameEvent } from '../types/Events'

interface SkillSystemConfig {
  baseEffectRadius: number
  baseProjectileSpeed: number
  evolutionCheckInterval: number
  maxActiveEffects: number
  skillSelectionSeed?: number
  eventSystem?: any
}

interface SkillActivation {
  skillId: string
  sourceEntityId: EntityId
  targetEntityId?: EntityId
  targetPosition?: { x: number; y: number }
  timestamp: number
}

interface EvolutionOption {
  fromSkillIds: string[]
  toSkillId: string
  requirements: {
    minLevel?: number
    minGameTime?: number
    additionalSkills?: string[]
  }
  priority: number
}

/**
 * System that manages skill effects, evolution, and cooldowns
 */
export class SkillSystem extends System {
  readonly name = 'skill'
  readonly requiredComponents: ComponentType[] = ['skills']

  private config: SkillSystemConfig
  private world: World
  private eventSystem: any
  private pendingActivations: SkillActivation[] = []
  private evolutionDefinitions: Map<string, EvolutionOption> = new Map()
  private lastEvolutionCheck: number = 0
  private currentGameTime: number = 0
  private rng: () => number

  constructor(world: World, config: SkillSystemConfig) {
    super()
    this.world = world
    this.config = config
    this.eventSystem = config.eventSystem
    this.rng = this.createSeededRandom(config.skillSelectionSeed || Date.now())
    this.initializeEvolutionDefinitions()
  }

  /**
   * Initialize skill evolution definitions
   */
  private initializeEvolutionDefinitions(): void {
    // Example evolution definitions - would normally come from config
    this.evolutionDefinitions.set('spiritShuriken', {
      fromSkillIds: ['kunai'],
      toSkillId: 'spiritShuriken',
      requirements: {
        minLevel: 5,
        minGameTime: 600000, // 10 minutes
        additionalSkills: ['kogaNinjaScroll'],
      },
      priority: 1,
    })

    this.evolutionDefinitions.set('holyWater', {
      fromSkillIds: ['garlic'],
      toSkillId: 'holyWater',
      requirements: {
        minLevel: 5,
      },
      priority: 1,
    })
  }

  /**
   * Create a seeded random number generator
   */
  private createSeededRandom(seed: number): () => number {
    let state = seed
    return () => {
      state = (state * 9301 + 49297) % 233280
      return state / 233280
    }
  }

  update(context: SystemUpdateContext, entities: EntityQuery[]): void {
    this.currentGameTime = context.totalTime

    // Update cooldowns and active effects
    entities.forEach((entity) => {
      const skills = (entity.components as any).skills as SkillsComponent

      // Update skill cooldowns
      skills.skills.forEach((skill) => {
        if (
          skill.lastUsed > 0 &&
          this.currentGameTime - skill.lastUsed < skill.cooldown
        ) {
          // Skill is still on cooldown
        }
      })

      // Update active effects
      skills.updateActiveEffects(this.currentGameTime)
    })

    // Process pending skill activations
    this.processPendingActivations(this.currentGameTime)

    // Check for evolution opportunities periodically
    if (
      this.currentGameTime - this.lastEvolutionCheck >=
      this.config.evolutionCheckInterval
    ) {
      this.checkEvolutionOpportunities(entities, this.currentGameTime)
      this.lastEvolutionCheck = this.currentGameTime
    }
  }

  /**
   * Activate a skill for an entity
   */
  activateSkill(
    entityId: EntityId,
    skillId: string,
    targetId?: EntityId,
    targetPosition?: { x: number; y: number }
  ): boolean {
    const entity = this.world.getEntity(entityId)
    if (!entity) return false

    const skills = entity.getComponent('skills') as SkillsComponent
    if (!skills) return false

    const skill = skills.getSkill(skillId)
    if (!skill || skill.type !== SkillType.ACTIVE) return false

    const currentTime = Date.now()
    if (!skills.canUseSkill(skillId, currentTime)) return false

    // Queue the skill activation
    this.pendingActivations.push({
      skillId,
      sourceEntityId: entityId,
      targetEntityId: targetId,
      targetPosition,
      timestamp: currentTime,
    })

    // Mark skill as used
    skills.useSkill(skillId, currentTime)

    // Emit skill activation event
    this.emitEvent({
      type: 'SKILL_ACTIVATED',
      timestamp: currentTime,
      data: {
        entityId,
        skillId,
        skill,
      },
    })

    return true
  }

  /**
   * Process pending skill activations
   */
  private processPendingActivations(gameTime: number): void {
    const activations = [...this.pendingActivations]
    this.pendingActivations = []

    activations.forEach((activation) => {
      const sourceEntity = this.world.getEntity(activation.sourceEntityId)
      if (!sourceEntity) return

      const skills = sourceEntity.getComponent('skills') as SkillsComponent
      const skill = skills.getSkill(activation.skillId)
      if (!skill) return

      // Apply skill effects based on target type
      switch (skill.targetType) {
        case SkillTargetType.SELF:
          this.applySkillToEntity(
            skill,
            activation.sourceEntityId,
            activation.sourceEntityId,
            gameTime
          )
          break

        case SkillTargetType.ENEMIES:
          this.applySkillToEnemies(skill, activation.sourceEntityId, gameTime)
          break

        case SkillTargetType.AREA:
          const transform = sourceEntity.getComponent(
            'transform'
          ) as TransformComponent
          this.applySkillToArea(
            skill,
            activation.sourceEntityId,
            activation.targetPosition || transform?.position,
            gameTime
          )
          break

        case SkillTargetType.PROJECTILE:
          this.createProjectile(
            skill,
            activation.sourceEntityId,
            activation.targetPosition || activation.targetEntityId,
            gameTime
          )
          break
      }
    })
  }

  /**
   * Apply skill effects to a single entity
   */
  private applySkillToEntity(
    skill: Skill,
    sourceId: EntityId,
    targetId: EntityId,
    gameTime: number
  ): void {
    const targetEntity = this.world.getEntity(targetId)
    if (!targetEntity) return

    skill.effects.forEach((effect) => {
      this.applyEffect(effect, sourceId, targetId, skill.id, gameTime)
    })
  }

  /**
   * Apply skill to all enemies in range
   */
  private applySkillToEnemies(
    skill: Skill,
    sourceId: EntityId,
    gameTime: number
  ): void {
    const sourceEntity = this.world.getEntity(sourceId)
    if (!sourceEntity) return

    const sourceTransform = sourceEntity.getComponent(
      'transform'
    ) as TransformComponent
    if (!sourceTransform) return

    const range =
      skill.effects.find((e) => e.radius)?.radius ||
      this.config.baseEffectRadius

    // Find all enemies in range
    const enemies = this.world
      .getEntitiesWithComponents(['transform', 'health'])
      .filter((entity) => {
        if (entity.id === sourceId) return false

        const transform = entity.getComponent('transform') as TransformComponent
        const dx = transform.position.x - sourceTransform.position.x
        const dy = transform.position.y - sourceTransform.position.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        return distance <= range
      })

    enemies.forEach((enemy) => {
      this.applySkillToEntity(skill, sourceId, enemy.id, gameTime)
    })
  }

  /**
   * Apply skill to an area
   */
  private applySkillToArea(
    skill: Skill,
    sourceId: EntityId,
    position: { x: number; y: number } | undefined,
    gameTime: number
  ): void {
    if (!position) return

    const radius =
      skill.effects.find((e) => e.radius)?.radius ||
      this.config.baseEffectRadius

    // Find all entities in the area
    const entitiesInArea = this.world
      .getEntitiesWithComponents(['transform'])
      .filter((entity) => {
        const transform = entity.getComponent('transform') as TransformComponent
        const dx = transform.position.x - position.x
        const dy = transform.position.y - position.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        return distance <= radius
      })

    entitiesInArea.forEach((entity) => {
      this.applySkillToEntity(skill, sourceId, entity.id, gameTime)
    })
  }

  /**
   * Create a projectile for a skill
   */
  private createProjectile(
    skill: Skill,
    sourceId: EntityId,
    target: { x: number; y: number } | EntityId | undefined,
    gameTime: number
  ): void {
    // Projectile creation would be handled by a separate ProjectileSystem
    // For now, emit an event for other systems to handle
    this.emitEvent({
      type: 'PROJECTILE_CREATED',
      timestamp: gameTime,
      data: {
        skillId: skill.id,
        sourceEntityId: sourceId,
        target,
        speed:
          skill.effects.find((e) => e.metadata?.projectileSpeed)?.metadata
            ?.projectileSpeed || this.config.baseProjectileSpeed,
        effects: skill.effects,
      },
    })
  }

  /**
   * Apply a single effect to an entity
   */
  private applyEffect(
    effect: SkillEffect,
    sourceId: EntityId,
    targetId: EntityId,
    skillId: string,
    gameTime: number
  ): void {
    // Check chance
    if (effect.chance && this.rng() > effect.chance) return

    const targetEntity = this.world.getEntity(targetId)
    if (!targetEntity) return

    switch (effect.type) {
      case SkillEffectType.DAMAGE:
        this.applyDamageEffect(effect, targetEntity, sourceId)
        break

      case SkillEffectType.HEAL:
        this.applyHealEffect(effect, targetEntity)
        break

      case SkillEffectType.BUFF:
      case SkillEffectType.DEBUFF:
        this.applyStatusEffect(
          effect,
          targetEntity,
          sourceId,
          skillId,
          gameTime
        )
        break

      case SkillEffectType.MOVEMENT:
        this.applyMovementEffect(effect, targetEntity)
        break

      case SkillEffectType.ATTRIBUTE_MODIFY:
        this.applyAttributeModification(
          effect,
          targetEntity,
          sourceId,
          skillId,
          gameTime
        )
        break
    }
  }

  /**
   * Apply damage effect
   */
  private applyDamageEffect(
    effect: SkillEffect,
    target: any,
    sourceId: EntityId
  ): void {
    const health = target.getComponent('health') as HealthComponent
    if (!health) return

    health.takeDamage(effect.value, this.currentGameTime)

    this.emitEvent({
      type: 'ENTITY_DAMAGED',
      timestamp: this.currentGameTime,
      data: {
        entityId: target.id,
        damage: effect.value,
        sourceId,
        sourceType: 'skill',
      },
    })
  }

  /**
   * Apply heal effect
   */
  private applyHealEffect(effect: SkillEffect, target: any): void {
    const health = target.getComponent('health') as HealthComponent
    if (!health) return

    health.heal(effect.value)

    this.emitEvent({
      type: 'ENTITY_HEALED',
      timestamp: this.currentGameTime,
      data: {
        entityId: target.id,
        amount: effect.value,
      },
    })
  }

  /**
   * Apply status effect (buff/debuff)
   */
  private applyStatusEffect(
    effect: SkillEffect,
    target: any,
    sourceId: EntityId,
    skillId: string,
    gameTime: number
  ): void {
    const skills = target.getComponent('skills') as SkillsComponent
    if (!skills) return

    const activeEffect: ActiveEffect = {
      id: `${skillId}_${gameTime}_${Math.random()}`,
      skillId,
      sourceEntityId: sourceId,
      effect,
      startTime: gameTime,
      endTime: effect.duration ? gameTime + effect.duration : undefined,
      stacks: 1,
    }

    skills.addActiveEffect(activeEffect)
  }

  /**
   * Apply movement effect
   */
  private applyMovementEffect(effect: SkillEffect, target: any): void {
    const movement = target.getComponent('movement') as MovementComponent
    if (!movement) return

    // Apply movement speed modifier
    const modifier = (effect.metadata?.speedMultiplier as number) || 1.0
    movement.maxSpeed *= modifier

    if (effect.metadata?.dash) {
      // Apply instant dash/teleport
      const transform = target.getComponent('transform') as TransformComponent
      if (transform && effect.metadata.dashDirection) {
        const dir = effect.metadata.dashDirection as { x: number; y: number }
        transform.position.x += dir.x * effect.value
        transform.position.y += dir.y * effect.value
      }
    }
  }

  /**
   * Apply attribute modification
   */
  private applyAttributeModification(
    effect: SkillEffect,
    target: any,
    sourceId: EntityId,
    skillId: string,
    gameTime: number
  ): void {
    // For permanent or temporary stat modifications
    const attributeName = effect.metadata?.attribute as string
    if (!attributeName) return

    // Apply the modification based on the component type
    switch (attributeName) {
      case 'damage':
        const combat = target.getComponent('combat') as CombatComponent
        if (combat) {
          combat.weapon.damage *= 1 + effect.value / 100
        }
        break

      case 'speed':
        const movement = target.getComponent('movement') as MovementComponent
        if (movement) {
          movement.maxSpeed *= 1 + effect.value / 100
        }
        break

      case 'defense':
        // Defense modification would need to be handled by a separate DefenseComponent
        // For now, we'll skip this case
        break
    }

    // If it's a temporary effect, add it as an active effect
    if (effect.duration) {
      this.applyStatusEffect(effect, target, sourceId, skillId, gameTime)
    }
  }

  /**
   * Check for evolution opportunities
   */
  private checkEvolutionOpportunities(
    entities: EntityQuery[],
    gameTime: number
  ): void {
    entities.forEach((entity) => {
      const skills = (entity.components as any).skills as SkillsComponent
      const experience = (entity.components as any)
        .experience as ExperienceComponent

      if (!skills || !experience) return

      // Check each evolution definition
      this.evolutionDefinitions.forEach((evolution, evolutionId) => {
        // Check if entity has all required skills at max level
        const hasRequiredSkills = evolution.fromSkillIds.every((skillId) => {
          const skill = skills.getSkill(skillId)
          return skill && skill.level >= skill.maxLevel
        })

        if (!hasRequiredSkills) return

        // Check additional requirements
        if (
          evolution.requirements.minLevel &&
          experience.level < evolution.requirements.minLevel
        )
          return
        if (
          evolution.requirements.minGameTime &&
          gameTime < evolution.requirements.minGameTime
        )
          return
        if (evolution.requirements.additionalSkills) {
          const hasAdditional = evolution.requirements.additionalSkills.every(
            (skillId) => skills.getSkill(skillId) !== null
          )
          if (!hasAdditional) return
        }

        // Mark evolution as available
        if (!skills.evolutionProgress.has(evolutionId)) {
          skills.evolutionProgress.set(evolutionId, 1.0)

          this.emitEvent({
            type: 'EVOLUTION_AVAILABLE',
            timestamp: gameTime,
            data: {
              entityId: entity.id,
              evolutionId,
              evolution,
            },
          })
        }
      })
    })
  }

  /**
   * Perform skill evolution
   */
  evolveSkill(entityId: EntityId, evolutionId: string): boolean {
    const entity = this.world.getEntity(entityId)
    if (!entity) return false

    const skills = entity.getComponent('skills') as SkillsComponent
    if (!skills) return false

    const evolution = this.evolutionDefinitions.get(evolutionId)
    if (!evolution) return false

    // Remove old skills
    evolution.fromSkillIds.forEach((skillId) => {
      skills.removeSkill(skillId)
    })

    // Add new evolved skill
    const evolvedSkill: Skill = this.createEvolvedSkill(evolution.toSkillId)
    skills.addSkill(evolvedSkill)

    // Clear evolution progress
    skills.evolutionProgress.delete(evolutionId)

    this.emitEvent({
      type: 'SKILL_EVOLVED',
      timestamp: this.currentGameTime,
      data: {
        entityId,
        fromSkillIds: evolution.fromSkillIds,
        toSkillId: evolution.toSkillId,
      },
    })

    return true
  }

  /**
   * Create an evolved skill definition
   */
  private createEvolvedSkill(skillId: string): Skill {
    // This would normally come from configuration
    const evolvedSkills: Record<string, Skill> = {
      spiritShuriken: {
        id: 'spiritShuriken',
        name: 'Spirit Shuriken',
        description: 'Evolved kunai that pierces through enemies',
        type: SkillType.ACTIVE,
        targetType: SkillTargetType.PROJECTILE,
        level: 1,
        maxLevel: 5,
        cooldown: 1000,
        lastUsed: 0,
        effects: [
          {
            type: SkillEffectType.DAMAGE,
            value: 150,
            metadata: {
              projectileSpeed: 800,
              piercing: true,
            },
          },
        ],
      },
      holyWater: {
        id: 'holyWater',
        name: 'Holy Water',
        description: 'Creates a damaging area effect',
        type: SkillType.ACTIVE,
        targetType: SkillTargetType.AREA,
        level: 1,
        maxLevel: 5,
        cooldown: 3000,
        lastUsed: 0,
        effects: [
          {
            type: SkillEffectType.DAMAGE,
            value: 50,
            duration: 5000,
            radius: 100,
          },
        ],
      },
    }

    return (
      evolvedSkills[skillId] || {
        id: skillId,
        name: skillId,
        description: 'Unknown evolved skill',
        type: SkillType.ACTIVE,
        targetType: SkillTargetType.SELF,
        level: 1,
        maxLevel: 5,
        cooldown: 1000,
        lastUsed: 0,
        effects: [],
      }
    )
  }

  /**
   * Get available skills for selection (with weighted probability)
   */
  getAvailableSkillsForSelection(
    entityId: EntityId,
    count: number = 3
  ): Skill[] {
    const entity = this.world.getEntity(entityId)
    if (!entity) return []

    const skills = entity.getComponent('skills') as SkillsComponent
    if (!skills) return []

    // Get all possible skills from configuration (would normally come from SkillConfig)
    const allSkills = this.getAllAvailableSkills()

    // Filter out skills the entity already has
    const availableSkills = allSkills.filter(
      (skill) => !skills.getSkill(skill.id)
    )

    // Weighted random selection
    const selected: Skill[] = []
    const weights = availableSkills.map(
      (skill) => (skill.metadata?.weight as number) || 1
    )

    for (let i = 0; i < Math.min(count, availableSkills.length); i++) {
      const index = this.weightedRandomSelect(weights)
      if (index >= 0) {
        selected.push(availableSkills[index])
        // Remove selected skill from future selections
        availableSkills.splice(index, 1)
        weights.splice(index, 1)
      }
    }

    return selected
  }

  /**
   * Weighted random selection
   */
  private weightedRandomSelect(weights: number[]): number {
    const totalWeight = weights.reduce((sum, w) => sum + w, 0)
    if (totalWeight === 0) return -1

    const random = this.rng() * totalWeight
    let accumulator = 0

    for (let i = 0; i < weights.length; i++) {
      accumulator += weights[i]
      if (random < accumulator) return i
    }

    return weights.length - 1
  }

  /**
   * Get all available skills from configuration
   */
  private getAllAvailableSkills(): Skill[] {
    // This would normally come from SkillConfig
    return [
      {
        id: 'kunai',
        name: 'Kunai',
        description: 'Throws a piercing kunai',
        type: SkillType.ACTIVE,
        targetType: SkillTargetType.PROJECTILE,
        level: 1,
        maxLevel: 5,
        cooldown: 2000,
        lastUsed: 0,
        effects: [
          {
            type: SkillEffectType.DAMAGE,
            value: 50,
          },
        ],
        evolveInto: ['spiritShuriken'],
        metadata: { weight: 10 },
      },
      {
        id: 'garlic',
        name: 'Garlic',
        description: 'Creates a damage aura around you',
        type: SkillType.PASSIVE,
        targetType: SkillTargetType.AREA,
        level: 1,
        maxLevel: 5,
        cooldown: 0,
        lastUsed: 0,
        effects: [
          {
            type: SkillEffectType.DAMAGE,
            value: 10,
            radius: 50,
          },
        ],
        evolveInto: ['holyWater'],
        metadata: { weight: 8 },
      },
      {
        id: 'kogaNinjaScroll',
        name: 'Koga Ninja Scroll',
        description: 'Increases attack speed',
        type: SkillType.PASSIVE,
        targetType: SkillTargetType.SELF,
        level: 1,
        maxLevel: 5,
        cooldown: 0,
        lastUsed: 0,
        effects: [
          {
            type: SkillEffectType.ATTRIBUTE_MODIFY,
            value: 10,
            metadata: { attribute: 'attackSpeed' },
          },
        ],
        metadata: { weight: 5 },
      },
    ]
  }

  /**
   * Emit a game event
   */
  private emitEvent(event: GameEvent): void {
    if (this.eventSystem) {
      this.eventSystem.emit(event.type, event)
    }
  }
}

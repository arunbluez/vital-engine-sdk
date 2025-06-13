import { System } from '../core/ECS/System'
import type { 
  EntityQuery, 
  SystemUpdateContext, 
  ComponentType,
  EntityId
} from '../types/CoreTypes'
import { SkillsComponent, SkillType, SkillEffectType } from '../components/Skills'
import type { Skill, SkillEffect, ActiveEffect } from '../components/Skills'
import { TransformComponent } from '../components/Transform'
import type { HealthComponent } from '../components/Health'
import { MovementComponent } from '../components/Movement'
import type { CombatComponent } from '../components/Combat'
import type { ExperienceComponent } from '../components/Experience'
import { Vector2Math } from '../utils/Math'
import { GameEventType } from '../types/Events'

type SkillEntityQuery = EntityQuery & {
  components: {
    skills: SkillsComponent
    transform: TransformComponent
  }
}

/**
 * Skill configuration for the system
 */
export interface SkillSystemConfig {
  maxActiveEffects: number
  effectTickInterval: number // How often to process effects (ms)
  evolutionCooldown: number // Cooldown between evolutions (ms)
  skillSelectionCount: number // Number of skills to offer on level up
}

/**
 * Skills system handles skill usage, effects, and evolution
 */
export class SkillSystem extends System {
  readonly name = 'skills'
  readonly requiredComponents: ComponentType[] = ['skills', 'transform']

  private eventSystem?: { emit: (eventType: string, data: unknown) => void }
  private world?: { getEntity: (id: EntityId) => unknown; createEntity: () => { id: EntityId; addComponent: (comp: unknown) => void }; getEntitiesWithComponents: (components: string[]) => unknown[]; getSystem: (name: string) => unknown }
  private config: SkillSystemConfig
  private lastEffectTick: number = 0

  constructor(
    eventSystem?: { emit: (eventType: string, data: unknown) => void }, 
    world?: { getEntity: (id: EntityId) => unknown; createEntity: () => { id: EntityId; addComponent: (comp: unknown) => void }; getEntitiesWithComponents: (components: string[]) => unknown[]; getSystem: (name: string) => unknown }, 
    config: Partial<SkillSystemConfig> = {}
  ) {
    super()
    this.eventSystem = eventSystem
    this.world = world
    
    this.config = {
      maxActiveEffects: 50,
      effectTickInterval: 100, // Process effects every 100ms
      evolutionCooldown: 5000, // 5 second cooldown between evolutions
      skillSelectionCount: 3,
      ...config
    }
  }

  update(context: SystemUpdateContext, entities: EntityQuery[]): void {
    const currentTime = context.totalTime

    entities.forEach((entity) => {
      const skillEntity = entity as SkillEntityQuery
      this.updateEntitySkills(skillEntity, currentTime)
    })

    // Process effects periodically for performance
    if (currentTime - this.lastEffectTick >= this.config.effectTickInterval) {
      this.processActiveEffects(entities as SkillEntityQuery[], currentTime)
      this.lastEffectTick = currentTime
    }
  }

  /**
   * Updates skills for a single entity
   */
  private updateEntitySkills(entity: SkillEntityQuery, currentTime: number): void {
    const skillsComponent = entity.components.skills

    // Update active effects (remove expired ones)
    skillsComponent.updateActiveEffects(currentTime)

    // Process passive skills
    this.processPassiveSkills(entity, currentTime)

    // Limit active effects to prevent performance issues
    if (skillsComponent.activeEffects.length > this.config.maxActiveEffects) {
      // Remove oldest effects first
      skillsComponent.activeEffects = skillsComponent.activeEffects
        .sort((a, b) => a.startTime - b.startTime)
        .slice(-this.config.maxActiveEffects)
    }
  }

  /**
   * Processes passive skills that continuously apply effects
   */
  private processPassiveSkills(entity: SkillEntityQuery, currentTime: number): void {
    const passiveSkills = entity.components.skills.getSkillsByType(SkillType.PASSIVE)

    passiveSkills.forEach(skill => {
      skill.effects.forEach(effect => {
        // Apply continuous passive effects
        if (this.shouldApplyPassiveEffect(entity, skill, effect, currentTime)) {
          this.applySkillEffect(entity, skill, effect, currentTime, entity.id)
        }
      })
    })
  }

  /**
   * Determines if a passive effect should be applied
   */
  private shouldApplyPassiveEffect(
    entity: SkillEntityQuery, 
    skill: Skill, 
    effect: SkillEffect, 
    currentTime: number
  ): boolean {
    // Check if effect is already active (for non-stackable effects)
    if (!effect.stackable) {
      const existingEffect = entity.components.skills.activeEffects.find(
        ae => ae.skillId === skill.id && ae.effect.type === effect.type
      )
      if (existingEffect) {
        return false
      }
    }

    // Apply chance-based effects
    if (effect.chance && Math.random() > effect.chance) {
      return false
    }

    return true
  }

  /**
   * Processes all active effects for all entities
   */
  private processActiveEffects(entities: SkillEntityQuery[], currentTime: number): void {
    entities.forEach(entity => {
      entity.components.skills.activeEffects.forEach(activeEffect => {
        this.processActiveEffect(entity, activeEffect, currentTime)
      })
    })
  }

  /**
   * Processes a single active effect
   */
  private processActiveEffect(
    entity: SkillEntityQuery, 
    activeEffect: ActiveEffect, 
    currentTime: number
  ): void {
    const effect = activeEffect.effect

    switch (effect.type) {
      case SkillEffectType.DAMAGE:
        this.applyDamageOverTime(entity, activeEffect, currentTime)
        break
      case SkillEffectType.HEAL:
        this.applyHealOverTime(entity, activeEffect, currentTime)
        break
      case SkillEffectType.MOVEMENT:
        this.applyMovementEffect(entity, activeEffect)
        break
      case SkillEffectType.BUFF:
      case SkillEffectType.DEBUFF:
        this.applyAttributeEffect(entity, activeEffect)
        break
    }
  }

  /**
   * Applies damage over time effect
   */
  private applyDamageOverTime(
    entity: SkillEntityQuery, 
    activeEffect: ActiveEffect, 
    currentTime: number
  ): void {
    if (!this.world) return

    const targetEntity = this.world.getEntity(entity.id)
    if (!targetEntity) return

    const health = targetEntity.getComponent('health') as HealthComponent
    if (!health || health.isDead()) return

    // Apply damage per stack
    const damage = activeEffect.effect.value * activeEffect.stacks
    health.takeDamage(damage, currentTime)

    if (this.eventSystem) {
      this.eventSystem.emit(GameEventType.DAMAGE_DEALT, {
        sourceId: activeEffect.sourceEntityId,
        targetId: entity.id,
        damage: damage,
        skillId: activeEffect.skillId,
        timestamp: currentTime
      })
    }
  }

  /**
   * Applies heal over time effect
   */
  private applyHealOverTime(
    entity: SkillEntityQuery, 
    activeEffect: ActiveEffect, 
    currentTime: number
  ): void {
    if (!this.world) return

    const targetEntity = this.world.getEntity(entity.id)
    if (!targetEntity) return

    const health = targetEntity.getComponent('health') as HealthComponent
    if (!health || health.isDead()) return

    // Apply healing per stack
    const healing = activeEffect.effect.value * activeEffect.stacks
    health.heal(healing)

    if (this.eventSystem) {
      this.eventSystem.emit(GameEventType.HEALTH_RESTORED, {
        entityId: entity.id,
        amount: healing,
        skillId: activeEffect.skillId,
        timestamp: currentTime
      })
    }
  }

  /**
   * Applies movement speed effect
   */
  private applyMovementEffect(entity: SkillEntityQuery, activeEffect: ActiveEffect): void {
    if (!this.world) return

    const targetEntity = this.world.getEntity(entity.id)
    if (!targetEntity) return

    const movement = targetEntity.getComponent('movement') as MovementComponent
    if (!movement) return

    // Apply movement speed modifier (percentage)
    const modifier = 1 + (activeEffect.effect.value * activeEffect.stacks / 100)
    // Note: This is a simplified approach. In practice, you'd want to track base values
    // and apply modifiers to avoid permanent changes
  }

  /**
   * Applies attribute buff/debuff effects
   */
  private applyAttributeEffect(entity: SkillEntityQuery, activeEffect: ActiveEffect): void {
    // Apply statistical modifications to combat, health, etc.
    // This would integrate with a more comprehensive stat system
  }

  /**
   * Manually activates a skill for an entity
   */
  activateSkill(
    entityId: EntityId, 
    skillId: string, 
    targetPosition?: { x: number; y: number },
    targetEntityId?: EntityId
  ): boolean {
    if (!this.world) return false

    const entity = this.world.getEntity(entityId)
    if (!entity) return false

    const skillsComponent = entity.getComponent('skills') as SkillsComponent
    const transform = entity.getComponent('transform') as TransformComponent
    
    if (!skillsComponent || !transform) return false

    const currentTime = Date.now()
    
    if (!skillsComponent.canUseSkill(skillId, currentTime)) {
      return false
    }

    const skill = skillsComponent.getSkill(skillId)
    if (!skill || skill.type !== SkillType.ACTIVE) {
      return false
    }

    // Use the skill (sets cooldown)
    if (!skillsComponent.useSkill(skillId, currentTime)) {
      return false
    }

    // Apply skill effects
    this.executeActiveSkill(entity, skill, currentTime, targetPosition, targetEntityId)

    if (this.eventSystem) {
      this.eventSystem.emit('SKILL_ACTIVATED', {
        entityId,
        skillId,
        targetPosition,
        targetEntityId,
        timestamp: currentTime
      })
    }

    return true
  }

  /**
   * Executes an active skill
   */
  private executeActiveSkill(
    caster: { id: EntityId; getComponent: (type: string) => unknown },
    skill: Skill,
    currentTime: number,
    targetPosition?: { x: number; y: number },
    targetEntityId?: EntityId
  ): void {
    const casterTransform = caster.getComponent('transform') as TransformComponent

    skill.effects.forEach(effect => {
      switch (skill.targetType) {
        case 'self':
          this.applySkillEffect(
            { id: caster.id, components: { skills: caster.getComponent('skills'), transform: casterTransform } },
            skill,
            effect,
            currentTime,
            caster.id
          )
          break
          
        case 'enemies':
          this.applySkillToEnemies(caster, skill, effect, currentTime)
          break
          
        case 'area':
          const position = targetPosition || casterTransform.position
          this.applySkillToArea(caster, skill, effect, position, currentTime)
          break
          
        case 'projectile':
          this.createProjectile(caster, skill, effect, targetPosition, currentTime)
          break
      }
    })
  }

  /**
   * Applies skill effect to nearby enemies
   */
  private applySkillToEnemies(
    caster: { id: EntityId; getComponent: (type: string) => unknown },
    skill: Skill,
    effect: SkillEffect,
    currentTime: number
  ): void {
    if (!this.world) return

    const casterTransform = caster.getComponent('transform') as TransformComponent
    const enemies = this.world.getEntitiesWithComponents(['transform', 'health'])
      .filter((entity: any) => entity.id !== caster.id)

    enemies.forEach((enemy: any) => {
      const enemyTransform = enemy.getComponent('transform') as TransformComponent
      const distance = Vector2Math.distance(casterTransform.position, enemyTransform.position)
      
      if (distance <= (effect.radius || 100)) {
        const targetQuery = {
          id: enemy.id,
          components: {
            skills: enemy.getComponent('skills') || new SkillsComponent(),
            transform: enemyTransform
          }
        }
        this.applySkillEffect(targetQuery, skill, effect, currentTime, caster.id)
      }
    })
  }

  /**
   * Applies skill effect to an area
   */
  private applySkillToArea(
    caster: { id: EntityId; getComponent: (type: string) => unknown },
    skill: Skill,
    effect: SkillEffect,
    position: { x: number; y: number },
    currentTime: number
  ): void {
    if (!this.world) return

    const entitiesInArea = this.world.getEntitiesWithComponents(['transform'])
      .filter((entity: any) => {
        const transform = entity.getComponent('transform') as TransformComponent
        const distance = Vector2Math.distance(position, transform.position)
        return distance <= (effect.radius || 50)
      })

    entitiesInArea.forEach((entity: any) => {
      const targetQuery = {
        id: entity.id,
        components: {
          skills: entity.getComponent('skills') || new SkillsComponent(),
          transform: entity.getComponent('transform')
        }
      }
      this.applySkillEffect(targetQuery, skill, effect, currentTime, caster.id)
    })
  }

  /**
   * Creates a projectile for projectile-type skills
   */
  private createProjectile(
    caster: { id: EntityId; getComponent: (type: string) => unknown },
    skill: Skill,
    effect: SkillEffect,
    targetPosition?: { x: number; y: number },
    currentTime: number = Date.now()
  ): void {
    if (!this.world) return

    const casterTransform = caster.getComponent('transform') as TransformComponent
    
    // Create projectile entity
    const projectile = this.world.createEntity()
    
    // Add required components
    const startPos = { ...casterTransform.position }
    const targetPos = targetPosition || { x: startPos.x + 100, y: startPos.y }
    
    // Calculate direction
    const direction = Vector2Math.normalize({
      x: targetPos.x - startPos.x,
      y: targetPos.y - startPos.y
    })
    
    projectile.addComponent(new TransformComponent(startPos.x, startPos.y))
    
    const movement = new MovementComponent(300) // Projectile speed
    movement.setVelocity(direction.x * 300, direction.y * 300)
    projectile.addComponent(movement)
    
    // Add skill data to projectile
    const projectileSkills = new SkillsComponent()
    projectileSkills.addSkill({
      ...skill,
      id: `projectile_${skill.id}_${Date.now()}`
    })
    projectile.addComponent(projectileSkills)

    if (this.eventSystem) {
      this.eventSystem.emit('PROJECTILE_CREATED', {
        projectileId: projectile.id,
        casterId: caster.id,
        skillId: skill.id,
        startPosition: startPos,
        targetPosition: targetPos,
        timestamp: currentTime
      })
    }
  }

  /**
   * Applies a single skill effect to a target
   */
  private applySkillEffect(
    target: SkillEntityQuery,
    skill: Skill,
    effect: SkillEffect,
    currentTime: number,
    sourceEntityId: EntityId
  ): void {
    // Check effect chance
    if (effect.chance && Math.random() > effect.chance) {
      return
    }

    switch (effect.type) {
      case SkillEffectType.DAMAGE:
        this.applyInstantDamage(target, effect, currentTime, sourceEntityId)
        break
      case SkillEffectType.HEAL:
        this.applyInstantHeal(target, effect, currentTime)
        break
      default:
        // For ongoing effects, add to active effects
        this.addActiveEffect(target, skill, effect, currentTime, sourceEntityId)
        break
    }
  }

  /**
   * Applies instant damage effect
   */
  private applyInstantDamage(
    target: SkillEntityQuery,
    effect: SkillEffect,
    currentTime: number,
    sourceEntityId: EntityId
  ): void {
    if (!this.world) return

    const targetEntity = this.world.getEntity(target.id)
    if (!targetEntity) return

    const health = targetEntity.getComponent('health') as HealthComponent
    if (!health || health.isDead()) return

    const damage = health.takeDamage(effect.value, currentTime)

    if (this.eventSystem) {
      this.eventSystem.emit(GameEventType.DAMAGE_DEALT, {
        sourceId: sourceEntityId,
        targetId: target.id,
        damage: damage,
        timestamp: currentTime
      })

      if (health.isDead()) {
        this.eventSystem.emit(GameEventType.ENTITY_KILLED, {
          entityId: target.id,
          killerId: sourceEntityId,
          timestamp: currentTime
        })
      }
    }
  }

  /**
   * Applies instant heal effect
   */
  private applyInstantHeal(
    target: SkillEntityQuery,
    effect: SkillEffect,
    currentTime: number
  ): void {
    if (!this.world) return

    const targetEntity = this.world.getEntity(target.id)
    if (!targetEntity) return

    const health = targetEntity.getComponent('health') as HealthComponent
    if (!health) return

    const healing = health.heal(effect.value)

    if (this.eventSystem) {
      this.eventSystem.emit(GameEventType.HEALTH_RESTORED, {
        entityId: target.id,
        amount: healing,
        timestamp: currentTime
      })
    }
  }

  /**
   * Adds an active effect to an entity
   */
  private addActiveEffect(
    target: SkillEntityQuery,
    skill: Skill,
    effect: SkillEffect,
    currentTime: number,
    sourceEntityId: EntityId
  ): void {
    const activeEffect: ActiveEffect = {
      id: `${skill.id}_${currentTime}_${Math.random()}`,
      skillId: skill.id,
      sourceEntityId,
      effect,
      startTime: currentTime,
      endTime: effect.duration ? currentTime + effect.duration : undefined,
      stacks: 1
    }

    target.components.skills.addActiveEffect(activeEffect)
  }

  /**
   * Evolves a skill into a new form
   */
  evolveSkill(entityId: EntityId, baseSkillId: string, evolutionSkillId: string): boolean {
    if (!this.world) return false

    const entity = this.world.getEntity(entityId)
    if (!entity) return false

    const skillsComponent = entity.getComponent('skills') as SkillsComponent
    if (!skillsComponent) return false

    const baseSkill = skillsComponent.getSkill(baseSkillId)
    if (!baseSkill || !baseSkill.evolveInto?.includes(evolutionSkillId)) {
      return false
    }

    // Check if skill is at max level
    if (baseSkill.level < baseSkill.maxLevel) {
      return false
    }

    // Remove base skill and add evolution
    skillsComponent.removeSkill(baseSkillId)
    
    // Create evolved skill (this would typically come from a skill database)
    const evolvedSkill: Skill = {
      id: evolutionSkillId,
      name: `Evolved ${baseSkill.name}`,
      description: `An evolved form of ${baseSkill.name}`,
      type: baseSkill.type,
      targetType: baseSkill.targetType,
      level: 1,
      maxLevel: baseSkill.maxLevel,
      cooldown: Math.max(baseSkill.cooldown * 0.8, 100), // 20% faster cooldown
      lastUsed: 0,
      effects: baseSkill.effects.map(effect => ({
        ...effect,
        value: effect.value * 1.5 // 50% more powerful
      }))
    }

    skillsComponent.addSkill(evolvedSkill)

    if (this.eventSystem) {
      this.eventSystem.emit('SKILL_EVOLVED', {
        entityId,
        baseSkillId,
        evolutionSkillId,
        timestamp: Date.now()
      })
    }

    return true
  }

  /**
   * Awards skill points to an entity
   */
  awardSkillPoints(entityId: EntityId, points: number): boolean {
    if (!this.world) return false

    const entity = this.world.getEntity(entityId)
    if (!entity) return false

    const skillsComponent = entity.getComponent('skills') as SkillsComponent
    if (!skillsComponent) return false

    skillsComponent.skillPoints += points

    if (this.eventSystem) {
      this.eventSystem.emit('SKILL_POINTS_AWARDED', {
        entityId,
        points,
        totalPoints: skillsComponent.skillPoints,
        timestamp: Date.now()
      })
    }

    return true
  }

  /**
   * Gets available skills for selection (level up rewards)
   */
  getSkillSelectionOptions(entityId: EntityId): Skill[] {
    // This would typically be implemented with a skill database
    // For now, return empty array as placeholder
    return []
  }
}
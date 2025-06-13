import { System } from '../core/ECS/System'
import type { 
  EntityQuery, 
  SystemUpdateContext, 
  ComponentType,
  EntityId
} from '../types/CoreTypes'
import type { TransformComponent } from '../components/Transform'
import type { CombatComponent } from '../components/Combat'
import type { HealthComponent } from '../components/Health'
import { Vector2Math } from '../utils/Math'
import { GameEventType } from '../types/Events'

type CombatEntityQuery = EntityQuery & {
  components: {
    transform: TransformComponent
    combat: CombatComponent
  }
}

type TargetEntityQuery = EntityQuery & {
  components: {
    transform: TransformComponent
    health: HealthComponent
  }
}

/**
 * Combat system handles auto-attacking, targeting, and damage dealing
 */
export class CombatSystem extends System {
  readonly name = 'combat'
  readonly requiredComponents: ComponentType[] = ['transform', 'combat']

  private eventSystem?: any
  private world?: any

  constructor(eventSystem?: any, world?: any) {
    super()
    this.eventSystem = eventSystem
    this.world = world
  }

  update(context: SystemUpdateContext, entities: EntityQuery[]): void {
    entities.forEach((entity) => {
      const combatEntity = entity as CombatEntityQuery
      this.updateCombat(combatEntity, context.totalTime)
    })
  }

  private updateCombat(entity: CombatEntityQuery, currentTime: number): void {
    const components = entity.components as any
    const combat = components.combat as CombatComponent

    if (!combat.autoAttack) {
      return
    }

    // Find target if we don't have one
    if (!combat.targetId) {
      const target = this.findNearestTarget(entity)
      if (target) {
        combat.setTarget(target.id)
      }
    }

    // Attack target if we have one and can attack
    if (combat.targetId && combat.canAttack(currentTime)) {
      this.attemptAttack(entity, combat.targetId, currentTime)
    }
  }

  private findNearestTarget(attacker: CombatEntityQuery): TargetEntityQuery | null {
    if (!this.world) {
      return null
    }

    // Get all entities with health components (potential targets)
    const potentialTargets = this.world.getEntitiesWithComponents(['transform', 'health'])
      .filter((entity: any) => entity.id !== attacker.id) // Don't target self
      .map((entity: any) => ({
        id: entity.id,
        components: {
          transform: entity.getComponent('transform'),
          health: entity.getComponent('health'),
        }
      })) as TargetEntityQuery[]

    let nearestTarget: TargetEntityQuery | null = null
    let nearestDistance = Infinity

    potentialTargets.forEach((target) => {
      // Skip dead targets
      if (target.components.health.isDead()) {
        return
      }

      const distance = Vector2Math.distance(
        attacker.components.transform.position,
        target.components.transform.position
      )

      // Check if target is in range
      if (distance <= attacker.components.combat.weapon.range && distance < nearestDistance) {
        nearestDistance = distance
        nearestTarget = target
      }
    })

    return nearestTarget
  }

  private attemptAttack(attacker: CombatEntityQuery, targetId: EntityId, currentTime: number): void {
    if (!this.world) {
      return
    }

    const targetEntity = this.world.getEntity(targetId)
    if (!targetEntity) {
      // Target no longer exists, clear it
      attacker.components.combat.setTarget(null)
      return
    }

    const targetTransform = targetEntity.getComponent('transform') as TransformComponent
    const targetHealth = targetEntity.getComponent('health') as HealthComponent

    if (!targetTransform || !targetHealth) {
      // Target doesn't have required components
      attacker.components.combat.setTarget(null)
      return
    }

    // Check if target is still in range
    const distance = Vector2Math.distance(
      attacker.components.transform.position,
      targetTransform.position
    )

    if (distance > attacker.components.combat.weapon.range) {
      // Target out of range, clear it
      attacker.components.combat.setTarget(null)
      return
    }

    // Check if target is dead
    if (targetHealth.isDead()) {
      attacker.components.combat.setTarget(null)
      return
    }

    // Perform the attack
    this.performAttack(attacker, targetEntity, currentTime)
  }

  private performAttack(
    attacker: CombatEntityQuery, 
    targetEntity: any, 
    currentTime: number
  ): void {
    const combat = attacker.components.combat
    const targetHealth = targetEntity.getComponent('health') as HealthComponent

    // Calculate damage
    const damage = combat.calculateDamage()

    // Deal damage
    const actualDamage = targetHealth.takeDamage(damage, currentTime)

    // Update attack cooldown
    combat.attack(currentTime)

    // Emit damage event
    if (this.eventSystem) {
      this.eventSystem.emit(GameEventType.DAMAGE_DEALT, {
        sourceId: attacker.id,
        targetId: targetEntity.id,
        damage: actualDamage,
        totalDamage: damage,
        timestamp: currentTime,
      })

      // Emit death event if target died
      if (targetHealth.isDead()) {
        this.eventSystem.emit(GameEventType.ENTITY_KILLED, {
          entityId: targetEntity.id,
          killerId: attacker.id,
          timestamp: currentTime,
        })

        // Clear target since it's dead
        combat.setTarget(null)
      }
    }
  }

  /**
   * Manually triggers an attack from an entity
   */
  triggerAttack(attacker: CombatEntityQuery, targetId: EntityId): boolean {
    if (!this.world) {
      return false
    }

    const currentTime = Date.now()
    
    if (!attacker.components.combat.canAttack(currentTime)) {
      return false
    }

    const targetEntity = this.world.getEntity(targetId)
    if (!targetEntity) {
      return false
    }

    const targetTransform = targetEntity.getComponent('transform') as TransformComponent
    const targetHealth = targetEntity.getComponent('health') as HealthComponent

    if (!targetTransform || !targetHealth || targetHealth.isDead()) {
      return false
    }

    // Check range
    const distance = Vector2Math.distance(
      attacker.components.transform.position,
      targetTransform.position
    )

    if (distance > attacker.components.combat.weapon.range) {
      return false
    }

    this.performAttack(attacker, targetEntity, currentTime)
    return true
  }

  /**
   * Sets a target for an entity
   */
  setTarget(attacker: CombatEntityQuery, targetId: EntityId | null): void {
    attacker.components.combat.setTarget(targetId)
  }

  /**
   * Gets all entities in range of an attacker
   */
  getEntitiesInRange(attacker: CombatEntityQuery): TargetEntityQuery[] {
    if (!this.world) {
      return []
    }

    const potentialTargets = this.world.getEntitiesWithComponents(['transform', 'health'])
      .filter((entity: any) => entity.id !== attacker.id)
      .map((entity: any) => ({
        id: entity.id,
        components: {
          transform: entity.getComponent('transform'),
          health: entity.getComponent('health'),
        }
      })) as TargetEntityQuery[]

    return potentialTargets.filter((target) => {
      if (target.components.health.isDead()) {
        return false
      }

      const distance = Vector2Math.distance(
        attacker.components.transform.position,
        target.components.transform.position
      )

      return distance <= attacker.components.combat.weapon.range
    })
  }
}
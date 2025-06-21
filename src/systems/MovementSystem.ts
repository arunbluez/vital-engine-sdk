import { System } from '../core/ECS/System'
import type {
  EntityQuery,
  SystemUpdateContext,
  ComponentType,
} from '../types/CoreTypes'
import type { TransformComponent } from '../components/Transform'
import type { MovementComponent } from '../components/Movement'
import { Vector2Math } from '../utils/Math'
import { GameEventType } from '../types/Events'

type MovementEntityQuery = EntityQuery & {
  components: {
    transform: TransformComponent
    movement: MovementComponent
  }
}

/**
 * Movement system handles entity movement and physics
 */
export class MovementSystem extends System {
  readonly name = 'movement'
  readonly requiredComponents: ComponentType[] = ['transform', 'movement']

  private eventSystem?: any

  constructor(eventSystem?: any) {
    super()
    this.eventSystem = eventSystem

    // Configure batch processing for better performance
    this.batchConfig = {
      batchSize: 200, // Process 200 entities per batch
      maxBatchTime: 1.5, // Max 1.5ms per batch
      enableParallelProcessing: false,
    }
  }

  update(context: SystemUpdateContext, entities: EntityQuery[]): void {
    // Use batch processing for large entity counts
    if (entities.length > 100) {
      this.processBatches(context, entities)
    } else {
      // For small entity counts, process directly
      const deltaSeconds = context.deltaTime / 1000
      entities.forEach((entity) => {
        const components = entity.components as any
        const transform = components.transform as TransformComponent
        const movement = components.movement as MovementComponent

        // Skip entities that don't have required components
        if (!transform || !movement) {
          return
        }

        this.updateMovement(transform, movement, deltaSeconds, entity.id)
      })
    }
  }

  /**
   * Batch update implementation for processing entities in batches
   */
  protected updateBatch(
    context: SystemUpdateContext,
    batch: EntityQuery[]
  ): void {
    const deltaSeconds = context.deltaTime / 1000

    // Process batch of entities
    batch.forEach((entity) => {
      const components = entity.components as any
      const transform = components.transform as TransformComponent
      const movement = components.movement as MovementComponent

      // Skip entities that don't have required components
      if (!transform || !movement) {
        return
      }

      this.updateMovement(transform, movement, deltaSeconds, entity.id)
    })
  }

  private updateMovement(
    transform: TransformComponent,
    movement: MovementComponent,
    deltaTime: number,
    entityId: number
  ): void {
    const previousPosition = Vector2Math.clone(transform.position)

    // Apply acceleration to velocity
    movement.velocity.x += movement.acceleration.x * deltaTime
    movement.velocity.y += movement.acceleration.y * deltaTime

    // Apply friction
    if (movement.friction > 0) {
      const frictionFactor = Math.pow(movement.friction, deltaTime)
      movement.velocity.x *= frictionFactor
      movement.velocity.y *= frictionFactor
    }

    // Clamp velocity to max speed
    const speed = Vector2Math.magnitude(movement.velocity)
    if (speed > movement.maxSpeed) {
      const normalized = Vector2Math.normalize(movement.velocity)
      movement.velocity.x = normalized.x * movement.maxSpeed
      movement.velocity.y = normalized.y * movement.maxSpeed
    }

    // Update position based on velocity
    transform.position.x += movement.velocity.x * deltaTime
    transform.position.y += movement.velocity.y * deltaTime

    // Reset acceleration (forces are applied each frame)
    movement.acceleration.x = 0
    movement.acceleration.y = 0

    // Emit position changed event if position actually changed
    if (
      this.eventSystem &&
      !Vector2Math.equals(previousPosition, transform.position)
    ) {
      this.eventSystem.emit(GameEventType.POSITION_CHANGED, {
        entityId,
        previousPosition,
        newPosition: Vector2Math.clone(transform.position),
      })
    }
  }

  /**
   * Applies a force to an entity with movement component
   */
  applyForce(
    entity: MovementEntityQuery,
    forceX: number,
    forceY: number
  ): void {
    entity.components.movement.applyForce(forceX, forceY)
  }

  /**
   * Applies an impulse to an entity with movement component
   */
  applyImpulse(
    entity: MovementEntityQuery,
    impulseX: number,
    impulseY: number
  ): void {
    entity.components.movement.applyImpulse(impulseX, impulseY)
  }

  /**
   * Sets the velocity of an entity
   */
  setVelocity(
    entity: MovementEntityQuery,
    velocityX: number,
    velocityY: number
  ): void {
    const previousVelocity = Vector2Math.clone(
      entity.components.movement.velocity
    )
    entity.components.movement.setVelocity(velocityX, velocityY)

    // Emit velocity changed event
    if (
      this.eventSystem &&
      !Vector2Math.equals(previousVelocity, entity.components.movement.velocity)
    ) {
      this.eventSystem.emit(GameEventType.VELOCITY_CHANGED, {
        entityId: entity.id,
        previousVelocity,
        newVelocity: Vector2Math.clone(entity.components.movement.velocity),
      })
    }
  }

  /**
   * Moves an entity towards a target position
   */
  moveTowards(
    entity: MovementEntityQuery,
    targetX: number,
    targetY: number,
    force: number
  ): void {
    const transform = entity.components.transform
    const direction = Vector2Math.normalize({
      x: targetX - transform.position.x,
      y: targetY - transform.position.y,
    })

    this.applyForce(entity, direction.x * force, direction.y * force)
  }

  /**
   * Stops an entity's movement
   */
  stop(entity: MovementEntityQuery): void {
    entity.components.movement.stop()
  }

  /**
   * Gets the distance an entity will travel in the next frame
   */
  predictNextPosition(
    entity: MovementEntityQuery,
    deltaTime: number
  ): { x: number; y: number } {
    const movement = entity.components.movement
    const transform = entity.components.transform

    return {
      x: transform.position.x + movement.velocity.x * deltaTime,
      y: transform.position.y + movement.velocity.y * deltaTime,
    }
  }
}

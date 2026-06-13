import { System } from '../core/ECS/System'
import type {
  EntityQuery,
  SystemUpdateContext,
  ComponentType,
} from '../types/CoreTypes'
import type { MovementComponent } from '../components/Movement'
import type { PlayerControllerComponent } from '../components/PlayerController'
import type { MoveCommand } from '../input/InputCommand'

type PlayerEntityQuery = EntityQuery & {
  components: {
    movement: MovementComponent
    playerController: PlayerControllerComponent
  }
}

/**
 * Consumes MOVE input commands (delivered through the deterministic update
 * context) and applies them as velocity on player-controlled entities. This is
 * the only place player movement input becomes simulation state, so it runs
 * first in the canonical system order (input-apply).
 */
export class PlayerControllerSystem extends System {
  readonly name = 'playerController'
  readonly requiredComponents: ComponentType[] = [
    'movement',
    'playerController',
  ]

  update(context: SystemUpdateContext, entities: EntityQuery[]): void {
    const commands = context.inputCommands
    if (!commands || commands.length === 0) {
      return
    }

    // Last MOVE for this tick wins (the queue already coalesces, but be safe).
    let move: MoveCommand | undefined
    for (const cmd of commands) {
      if (cmd.type === 'MOVE') {
        move = cmd
      }
    }
    if (!move) {
      return
    }

    for (const entity of entities) {
      const { movement, playerController } = (entity as PlayerEntityQuery)
        .components
      movement.setVelocity(
        move.dx * playerController.moveSpeed,
        move.dy * playerController.moveSpeed
      )
    }
  }
}

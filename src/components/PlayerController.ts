import { Component } from '../core/ECS/Component'

/**
 * Tags an entity as player-controlled and carries the movement speed applied
 * when a MOVE input command is processed. Keeping the command→velocity mapping
 * inside an SDK component keeps it within the deterministic boundary (frontends
 * no longer mutate velocity directly).
 */
export class PlayerControllerComponent extends Component {
  readonly type = 'playerController'

  moveSpeed: number

  constructor(moveSpeed: number = 100) {
    super()
    this.moveSpeed = moveSpeed
  }

  clone(): Component {
    return new PlayerControllerComponent(this.moveSpeed)
  }

  serialize(): Record<string, unknown> {
    return { moveSpeed: this.moveSpeed }
  }

  deserialize(data: Record<string, unknown>): void {
    this.moveSpeed = (data.moveSpeed as number) ?? 100
  }
}

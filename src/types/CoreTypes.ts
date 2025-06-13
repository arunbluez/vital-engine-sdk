/**
 * Core type definitions for the Entity-Component-System architecture
 */

export type EntityId = number

export type ComponentType = string

export type SystemName = string

export interface Component {
  readonly type: ComponentType
  clone(): Component
  serialize(): Record<string, unknown>
  deserialize(data: Record<string, unknown>): void
  reset(): void
}

export interface ComponentConstructor<T extends Component = Component> {
  readonly type: ComponentType
  new (...args: unknown[]): T
}

export type ComponentMap = Map<ComponentType, Component>

export interface EntitySnapshot {
  id: EntityId
  components: Record<ComponentType, Component>
  active: boolean
}

export interface SystemSnapshot {
  name: SystemName
  enabled: boolean
  entityCount: number
  updateTime: number
  batchMetrics?: {
    batchesProcessed: number
    averageBatchTime: number
    currentBatchSize: number
  }
}

export interface WorldSnapshot {
  entities: EntitySnapshot[]
  systems: SystemSnapshot[]
  entityCount: number
  componentCount: number
  timestamp: number
}

export type EntityQuery<T extends Component = Component> = {
  id: EntityId
  components: T
}

export interface SystemUpdateContext {
  deltaTime: number
  totalTime: number
  frameCount: number
}

export interface System {
  name: SystemName
  enabled: boolean
  requiredComponents: ComponentType[]
  update(context: SystemUpdateContext, entities: EntityQuery[]): void
  initialize?(): void
  destroy?(): void
}

export interface SystemConstructor<T extends System = System> {
  new (...args: unknown[]): T
}

// Basic interfaces for common system dependencies
export interface EventSystem {
  emit(eventType: string, data?: unknown): void
  on(eventType: string, callback: (data?: unknown) => void): void
  off(eventType: string, callback: (data?: unknown) => void): void
}

export interface Entity {
  readonly id: EntityId
  addComponent<T extends Component>(component: T): Entity
  removeComponent(componentType: ComponentType): Entity
  getComponent<T extends Component>(componentType: ComponentType): T | null
  hasComponent(componentType: ComponentType): boolean
  hasComponents(componentTypes: ComponentType[]): boolean
  getComponents(): Component[]
  getComponentTypes(): ComponentType[]
  setActive(active: boolean): void
  isActive(): boolean
  snapshot(): EntitySnapshot
  clear(): void
}

export interface World {
  getActiveEntities(): Entity[]
  getEntity(id: EntityId): Entity | null
  removeEntity(id: EntityId): void
  createEntity(): Entity
}

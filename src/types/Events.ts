/**
 * Event type definitions for the game engine
 */

import type { EntityId } from './CoreTypes'

export interface GameEvent {
  type: string
  timestamp: number
  data: unknown
  source?: string
  entityId?: EntityId
}

export interface EventListener<T = unknown> {
  (event: GameEvent & { data: T }): void
}

export interface EventSubscription {
  unsubscribe(): void
}

export type EventFilter = (event: GameEvent) => boolean

export interface EventHistory {
  events: GameEvent[]
  maxSize: number
  startTime: number
  endTime: number
}

/**
 * Common game event types
 */
export enum GameEventType {
  // Entity events
  ENTITY_CREATED = 'ENTITY_CREATED',
  ENTITY_DESTROYED = 'ENTITY_DESTROYED',
  ENTITY_ACTIVATED = 'ENTITY_ACTIVATED',
  ENTITY_DEACTIVATED = 'ENTITY_DEACTIVATED',

  // Component events
  COMPONENT_ADDED = 'COMPONENT_ADDED',
  COMPONENT_REMOVED = 'COMPONENT_REMOVED',
  COMPONENT_UPDATED = 'COMPONENT_UPDATED',

  // System events
  SYSTEM_ADDED = 'SYSTEM_ADDED',
  SYSTEM_REMOVED = 'SYSTEM_REMOVED',
  SYSTEM_ENABLED = 'SYSTEM_ENABLED',
  SYSTEM_DISABLED = 'SYSTEM_DISABLED',

  // Game state events
  GAME_STARTED = 'GAME_STARTED',
  GAME_PAUSED = 'GAME_PAUSED',
  GAME_RESUMED = 'GAME_RESUMED',
  GAME_ENDED = 'GAME_ENDED',

  // Combat events
  DAMAGE_DEALT = 'DAMAGE_DEALT',
  ENTITY_KILLED = 'ENTITY_KILLED',
  HEALTH_RESTORED = 'HEALTH_RESTORED',

  // Movement events
  POSITION_CHANGED = 'POSITION_CHANGED',
  VELOCITY_CHANGED = 'VELOCITY_CHANGED',
  COLLISION_DETECTED = 'COLLISION_DETECTED',

  // Progression events
  EXPERIENCE_GAINED = 'EXPERIENCE_GAINED',
  LEVEL_UP = 'LEVEL_UP',
  SKILL_UNLOCKED = 'SKILL_UNLOCKED',

  // Collection events
  ITEM_COLLECTED = 'ITEM_COLLECTED',
  RESOURCE_GAINED = 'RESOURCE_GAINED',

  // Performance events
  PERFORMANCE_WARNING = 'PERFORMANCE_WARNING',
  QUALITY_ADJUSTED = 'QUALITY_ADJUSTED',

  // Custom events
  CUSTOM = 'CUSTOM',
}

/**
 * Event data interfaces for specific event types
 */
export interface EntityCreatedEventData {
  entityId: EntityId
}

export interface EntityDestroyedEventData {
  entityId: EntityId
}

export interface ComponentEventData {
  entityId: EntityId
  componentType: string
}

export interface DamageEventData {
  targetId: EntityId
  sourceId?: EntityId
  damage: number
  damageType?: string
}

export interface PositionChangedEventData {
  entityId: EntityId
  previousPosition: { x: number; y: number }
  newPosition: { x: number; y: number }
}

export interface ExperienceGainedEventData {
  entityId: EntityId
  amount: number
  source: string
}

export interface LevelUpEventData {
  entityId: EntityId
  previousLevel: number
  newLevel: number
}

export interface CollectionEvent {
  type: 'collection'
  timestamp: number
  collectorEntityId: EntityId
  collectibleEntityId: EntityId
  collectibleType: string
  value: number
  rarity: string
  position: { x: number; y: number }
}

export interface DifficultyChangedEvent {
  type: 'difficulty_changed'
  timestamp: number
  entityId: EntityId
  oldLevel: string
  newLevel: string
  currentScore: number
  performanceScore: number
  isAdaptive: boolean
}

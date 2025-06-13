/**
 * Vital Engine SDK - A headless game engine for Survivor.io-style games
 *
 * Core exports for the game engine SDK
 */

// Core engine and ECS
export {
  // ECS exports
  Component,
  ComponentRegistry,
  Entity,
  System,
  SystemRegistry,
  World,
  // Core exports
  EventSystem,
  Engine,
  createEngine,
} from './core'

// Game systems
export {
  MovementSystem,
  CombatSystem,
  ProgressionSystem,
  EconomySystem,
  SkillSystem,
  EnemySystem,
  CollectionSystem,
  SimpleCollectionSystem,
  DifficultySystem,
} from './systems'

// Components
export {
  TransformComponent,
  HealthComponent,
  MovementComponent,
  CombatComponent,
  ExperienceComponent,
  InventoryComponent,
  SkillsComponent,
  SkillType,
  SkillEffectType,
  SkillTargetType,
  EnemyAIComponent,
  AIBehaviorType,
  AIBehaviorState,
  MovementPattern,
  SpawnerComponent,
  CollectibleComponent,
  MagnetComponent,
  DifficultyComponent,
} from './components'

// Utilities
export {
  Vector2Math,
  CollisionDetection,
  MathUtils,
  ObjectPool,
  PoolManager,
} from './utils'

// Type definitions
export type {
  // Core types
  EntityId,
  ComponentType,
  SystemName,
  Component as IComponent,
  ComponentConstructor,
  ComponentMap,
  EntitySnapshot,
  SystemSnapshot,
  WorldSnapshot,
  EntityQuery,
  SystemUpdateContext,
  System as ISystem,
  SystemConstructor,
  // Event types
  GameEvent,
  EventListener,
  EventSubscription,
  EventFilter,
  EventHistory,
  EntityCreatedEventData,
  EntityDestroyedEventData,
  ComponentEventData,
  DamageEventData,
  PositionChangedEventData,
  ExperienceGainedEventData,
  LevelUpEventData,
  // Game types
  Vector2,
  Rectangle,
  Circle,
  GameState,
  EngineConfig,
  GameConfig,
  InputState,
  UpdateCallback,
  RenderCallback,
  // Component types
  WeaponStats,
  ResourceType,
  ItemStack,
  // System types
  XPSource,
  ResourceDrop,
  ShopItem,
  // Event types
  CollectionEvent,
  DifficultyChangedEvent,
  // Utility types
  Poolable,
  PoolFactory,
} from './types'

export { GameEventType } from './types'

// Version
export const VERSION = '0.0.1'

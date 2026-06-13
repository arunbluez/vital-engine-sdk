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
  // Determinism core
  RandomService,
  SimulationClock,
  StateHasher,
} from './core'
export type { HashableWorld, HashableEntity } from './core'

// Deterministic math layer
export { DMath } from './math'

// Input command model & queue
export {
  InputQueue,
  quantizeAxis,
  INPUT_QUANTIZATION,
  type InputCommand,
  type InputCommandType,
  type UnstampedInputCommand,
  type MoveCommand,
  type SkillPickCommand,
  type PauseCommand,
  type ResumeCommand,
} from './input'

// Replay system
export {
  ReplayRecorder,
  ReplayPlayer,
  ReplaySerializer,
  REPLAY_MISMATCH_EVENT,
  type ReplayData,
} from './replay'

// Versioning
export { ENGINE_VERSION, REPLAY_FORMAT_VERSION } from './version'

// Game systems
export {
  MovementSystem,
  CombatSystem,
  ProgressionSystem,
  EconomySystem,
  SkillSystem,
  AISystem,
  PathfindingType,
  SpawnSystem,
  EnemySystem,
  CollectionSystem,
  SimpleCollectionSystem,
  DifficultySystem,
  PlayerControllerSystem,
} from './systems'

// Components
export {
  TransformComponent,
  HealthComponent,
  MovementComponent,
  PlayerControllerComponent,
  CombatComponent,
  ExperienceComponent,
  InventoryComponent,
  SkillsComponent,
  SkillType,
  SkillEffectType,
  SkillTargetType,
  AIComponent,
  AIState,
  AIPersonality,
  EnemyAIComponent,
  AIBehaviorType,
  AIBehaviorState,
  MovementPattern,
  SpawnerComponent,
  SpawnPattern,
  SpawnTiming,
  CollectibleComponent,
  CollectibleType,
  CollectibleRarity,
  CollectionBehavior,
  MagnetFieldType,
  MagnetTrigger,
  MagnetComponent,
  MagnetTargetType,
  DifficultyComponent,
} from './components'

// Utilities
export {
  Vector2Math,
  CollisionDetection,
  MathUtils,
  ObjectPool,
  PoolManager,
  SpatialHashGrid,
  QuadTree,
} from './utils'

// Configuration
export {
  DEFAULT_SKILL_DATABASE,
  DEFAULT_SKILL_SELECTION_CONFIG,
  type SkillDatabase,
  type SkillTemplate,
  type SkillEffectTemplate,
} from './config/SkillConfig'

export {
  BASIC_ENEMIES,
  ADVANCED_ENEMIES,
  BOSS_ENEMIES,
  SPAWN_WAVES,
  BOSS_PHASES,
  ENEMY_GROUPS,
  DIFFICULTY_PRESETS,
  getAllEnemyTypes,
  getEnemiesByLevel,
  createCustomWave,
} from './config/EnemyConfig'

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

// Export additional types from systems and components
export type { AISystemConfig, SpawnSystemConfig } from './systems'

export type {
  StateTransition,
  AIContext,
  AIMemory,
  BehaviorNode,
  EnemyType,
  SpawnWave,
  BossPhase,
} from './components'

// Version
export const VERSION = '0.0.1'

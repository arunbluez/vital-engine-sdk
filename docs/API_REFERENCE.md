# Vital Engine SDK - API Reference

## Table of Contents
1. [Core Architecture](#core-architecture)
2. [Engine](#engine)
3. [Entity-Component-System](#entity-component-system)
4. [Components](#components)
5. [Systems](#systems)
6. [Event System](#event-system)
7. [Types](#types)
8. [Performance & Utilities](#performance--utilities)

## Core Architecture

The Vital Engine SDK follows an Entity-Component-System (ECS) architecture pattern:

- **Entities**: Unique identifiers for game objects
- **Components**: Data containers attached to entities
- **Systems**: Logic processors that operate on entities with specific components
- **Events**: Communication mechanism between systems

### Basic Usage Pattern

```typescript
import { Engine, World, EventSystem } from 'vital-engine-sdk';

// Create engine instance
const engine = new Engine({
  engine: {
    targetFPS: 60,
    fixedTimeStep: false
  }
});

const world = engine.getWorld();
const events = engine.getEvents();

// Add systems
world.addSystem(new MovementSystem(events));

// Create entities with components
const entity = world.createEntity();
entity.addComponent(new TransformComponent(0, 0));

// Game loop
function update() {
  world.update(16.67); // ~60 FPS
  requestAnimationFrame(update);
}
```

## Engine

### Engine Class

```typescript
import { Engine, EngineConfig } from 'vital-engine-sdk';

interface EngineConfig {
  engine?: {
    targetFPS?: number;
    fixedTimeStep?: boolean;
    enableEventHistory?: boolean;
    maxEntities?: number;
  };
  debug?: {
    enableProfiling?: boolean;
    logPerformance?: boolean;
  };
}

class Engine {
  constructor(config?: EngineConfig);
  
  getWorld(): World;
  getEvents(): EventSystem;
  
  start(): void;
  stop(): void;
  
  getConfig(): EngineConfig;
  updateConfig(config: Partial<EngineConfig>): void;
}
```

### Usage Example

```typescript
const engine = new Engine({
  engine: {
    targetFPS: 60,
    fixedTimeStep: false,
    enableEventHistory: true,
    maxEntities: 10000
  },
  debug: {
    enableProfiling: true,
    logPerformance: false
  }
});

const world = engine.getWorld();
const events = engine.getEvents();
```

## Entity-Component-System

### World Class

```typescript
import { World, Entity, System, EntityId } from 'vital-engine-sdk';

class World {
  // Entity management
  createEntity(): Entity;
  getEntity(id: EntityId): Entity | null;
  removeEntity(id: EntityId): void;
  getActiveEntities(): Entity[];
  clear(): void;
  
  // System management
  addSystem(system: System): void;
  removeSystem(systemName: string): void;
  getSystem(systemName: string): System | null;
  getSystems(): System[];
  
  // Updates
  update(deltaTime: number): void;
  
  // Queries
  getEntitiesWithComponents(componentTypes: string[]): Entity[];
  
  // Statistics
  getStats(): {
    activeEntityCount: number;
    totalEntityCount: number;
    systemCount: number;
    averageFrameTime: number;
  };
}
```

### Entity Class

```typescript
import { Entity, Component, ComponentType, EntityId } from 'vital-engine-sdk';

class Entity {
  readonly id: EntityId;
  
  // Component management
  addComponent<T extends Component>(component: T): Entity;
  removeComponent(componentType: ComponentType): Entity;
  getComponent<T extends Component>(componentType: ComponentType): T | null;
  hasComponent(componentType: ComponentType): boolean;
  hasComponents(componentTypes: ComponentType[]): boolean;
  getComponents(): Component[];
  getComponentTypes(): ComponentType[];
  
  // State management
  setActive(active: boolean): void;
  isActive(): boolean;
  
  // Serialization
  snapshot(): EntitySnapshot;
  clear(): void;
}
```

### Usage Examples

```typescript
// Create and configure entity
const player = world.createEntity();
player.addComponent(new TransformComponent(100, 200));
player.addComponent(new HealthComponent(100));
player.addComponent(new MovementComponent(150));

// Query entities
const movableEntities = world.getEntitiesWithComponents(['transform', 'movement']);

// Component access
const transform = player.getComponent<TransformComponent>('transform');
if (transform) {
  console.log('Player position:', transform.position);
}

// Check components
if (player.hasComponent('health')) {
  const health = player.getComponent<HealthComponent>('health')!;
  health.takeDamage(10, Date.now());
}
```

## Components

All components extend the base Component class and represent data containers.

### Base Component

```typescript
abstract class Component {
  abstract readonly type: ComponentType;
  
  abstract clone(): Component;
  abstract serialize(): Record<string, unknown>;
  abstract deserialize(data: Record<string, unknown>): void;
  abstract reset(): void;
}
```

### Transform Component

Position and rotation data for entities.

```typescript
import { TransformComponent, Vector2 } from 'vital-engine-sdk';

class TransformComponent extends Component {
  readonly type = 'transform';
  
  position: Vector2;
  rotation: number;
  scale: Vector2;
  
  constructor(x: number = 0, y: number = 0, rotation: number = 0);
  
  setPosition(x: number, y: number): void;
  translate(dx: number, dy: number): void;
  setRotation(rotation: number): void;
  rotate(deltaRotation: number): void;
  setScale(scaleX: number, scaleY: number): void;
  
  getDistanceTo(other: TransformComponent): number;
  getAngleTo(other: TransformComponent): number;
}

// Usage
const transform = new TransformComponent(100, 200, 0);
transform.setPosition(150, 250);
transform.rotate(Math.PI / 4); // 45 degrees
```

### Health Component

Health and damage management.

```typescript
import { HealthComponent } from 'vital-engine-sdk';

class HealthComponent extends Component {
  readonly type = 'health';
  
  maximum: number;
  current: number;
  regenerationRate: number; // HP per second
  lastDamageTime: number;
  invulnerabilityDuration: number; // milliseconds
  
  constructor(maxHealth: number = 100);
  
  takeDamage(amount: number, timestamp: number): boolean;
  heal(amount: number): void;
  setMaxHealth(newMax: number): void;
  isDead(): boolean;
  isInvulnerable(timestamp: number): boolean;
  getHealthPercentage(): number;
  
  // Regeneration
  update(deltaTime: number): void;
}

// Usage
const health = new HealthComponent(100);
health.takeDamage(25, Date.now());
console.log('Health:', health.current); // 75
console.log('Is dead:', health.isDead()); // false
```

### Movement Component

Movement and physics data.

```typescript
import { MovementComponent, Vector2 } from 'vital-engine-sdk';

class MovementComponent extends Component {
  readonly type = 'movement';
  
  velocity: Vector2;
  acceleration: Vector2;
  maxSpeed: number;
  friction: number;
  
  constructor(
    maxSpeed: number = 100,
    friction: number = 0.8,
    velocityX: number = 0,
    velocityY: number = 0
  );
  
  setVelocity(x: number, y: number): void;
  addVelocity(x: number, y: number): void;
  setAcceleration(x: number, y: number): void;
  addAcceleration(x: number, y: number): void;
  
  getSpeed(): number;
  getDirection(): number; // radians
  stop(): void;
}

// Usage
const movement = new MovementComponent(150, 0.9);
movement.setVelocity(100, 50);
movement.setAcceleration(10, 0);
```

### Combat Component

Combat capabilities and weapon stats.

```typescript
import { CombatComponent, WeaponStats } from 'vital-engine-sdk';

interface WeaponStats {
  damage: number;
  range: number;
  attackSpeed: number; // attacks per second
  projectileSpeed?: number;
  piercing?: number;
  criticalChance?: number;
  criticalMultiplier?: number;
}

class CombatComponent extends Component {
  readonly type = 'combat';
  
  weapon: WeaponStats;
  lastAttackTime: number;
  targetId: EntityId | null;
  autoAttack: boolean;
  
  constructor(weapon: WeaponStats, autoAttack: boolean = true);
  
  canAttack(currentTime?: number): boolean;
  attack(currentTime?: number): void;
  setTarget(targetId: EntityId | null): void;
  calculateDamage(): number;
  getAttackCooldown(): number;
  getRemainingCooldown(currentTime?: number): number;
  updateWeapon(newStats: Partial<WeaponStats>): void;
}

// Usage
const combat = new CombatComponent({
  damage: 25,
  range: 80,
  attackSpeed: 2,
  criticalChance: 0.15,
  criticalMultiplier: 2.0
});

if (combat.canAttack()) {
  combat.attack();
  const damage = combat.calculateDamage();
}
```

### Experience Component

Experience points and leveling system.

```typescript
import { ExperienceComponent } from 'vital-engine-sdk';

class ExperienceComponent extends Component {
  readonly type = 'experience';
  
  level: number;
  currentXP: number;
  xpToNextLevel: number;
  totalXP: number;
  
  constructor(level: number = 1);
  
  addExperience(amount: number): number[]; // Returns levels gained
  getLevelProgress(): number; // 0-1
  getXPToNextLevel(): number;
  setLevel(newLevel: number): void;
}

// Usage
const experience = new ExperienceComponent(1);
const levelsGained = experience.addExperience(150);
console.log('Levels gained:', levelsGained); // [2]
console.log('Progress to next:', experience.getLevelProgress()); // 0.3
```

### Inventory Component

Item storage and management.

```typescript
import { InventoryComponent, ItemStack, ItemType } from 'vital-engine-sdk';

interface ItemStack {
  type: ItemType;
  quantity: number;
}

class InventoryComponent extends Component {
  readonly type = 'inventory';
  
  items: Map<ItemType, ItemStack>;
  maxSlots: number;
  currency: number;
  
  constructor(maxSlots: number = 10);
  
  addItem(item: ItemStack): boolean;
  removeItem(itemType: ItemType, quantity: number): boolean;
  hasItem(itemType: ItemType, quantity?: number): boolean;
  getItem(itemType: ItemType): ItemStack | null;
  getItemCount(itemType: ItemType): number;
  isFull(): boolean;
  clear(): void;
  
  // Currency
  addCurrency(amount: number): void;
  removeCurrency(amount: number): boolean;
  hasCurrency(amount: number): boolean;
}

// Usage
const inventory = new InventoryComponent(20);
inventory.addItem({ type: 'sword', quantity: 1 });
inventory.addItem({ type: 'potion', quantity: 5 });
inventory.addCurrency(100);

const hasSword = inventory.hasItem('sword'); // true
const potionCount = inventory.getItemCount('potion'); // 5
```

### Skills Component

Skill trees and abilities.

```typescript
import { 
  SkillsComponent, 
  Skill, 
  SkillType, 
  SkillTargetType, 
  SkillEffectType,
  ActiveEffect 
} from 'vital-engine-sdk';

enum SkillType {
  ACTIVE = 'ACTIVE',
  PASSIVE = 'PASSIVE'
}

enum SkillTargetType {
  SELF = 'SELF',
  ENEMIES = 'ENEMIES',
  PROJECTILE = 'PROJECTILE',
  AREA = 'AREA'
}

enum SkillEffectType {
  DAMAGE = 'DAMAGE',
  HEAL = 'HEAL',
  BUFF = 'BUFF',
  DEBUFF = 'DEBUFF',
  PROJECTILE_CREATE = 'PROJECTILE_CREATE'
}

interface Skill {
  id: string;
  name: string;
  description: string;
  type: SkillType;
  targetType: SkillTargetType;
  level: number;
  maxLevel: number;
  cooldown: number;
  lastUsed: number;
  effects: SkillEffect[];
  evolveInto?: string[];
}

class SkillsComponent extends Component {
  readonly type = 'skills';
  
  skills: Map<string, Skill>;
  skillPoints: number;
  activeEffects: ActiveEffect[];
  
  constructor(skillPoints: number = 0);
  
  addSkill(skill: Skill): boolean;
  removeSkill(skillId: string): boolean;
  getSkill(skillId: string): Skill | null;
  upgradeSkill(skillId: string): boolean;
  canUseSkill(skillId: string, currentTime: number): boolean;
  useSkill(skillId: string, currentTime: number): boolean;
  
  // Active effects
  addActiveEffect(effect: ActiveEffect): void;
  removeActiveEffect(effectId: string): void;
  getActiveEffectsByType(type: SkillEffectType): ActiveEffect[];
  updateActiveEffects(currentTime: number): void;
  getTotalEffectValue(type: SkillEffectType): number;
}

// Usage
const skills = new SkillsComponent(5);
skills.addSkill({
  id: 'fireball',
  name: 'Fireball',
  description: 'Launches a fireball projectile',
  type: SkillType.ACTIVE,
  targetType: SkillTargetType.PROJECTILE,
  level: 1,
  maxLevel: 5,
  cooldown: 2000,
  lastUsed: 0,
  effects: [{
    type: SkillEffectType.DAMAGE,
    value: 50,
    radius: 30
  }]
});
```

### Collectible Component

Items that can be collected from the world.

```typescript
import { CollectibleComponent, CollectibleType, CollectibleEffect } from 'vital-engine-sdk';

enum CollectibleType {
  CURRENCY = 'CURRENCY',
  EXPERIENCE = 'EXPERIENCE',
  HEALTH_POTION = 'HEALTH_POTION',
  EQUIPMENT = 'EQUIPMENT',
  MATERIAL = 'MATERIAL'
}

enum CollectibleEffect {
  NONE = 'NONE',
  GLOW = 'GLOW',
  PULSE = 'PULSE',
  SPARKLE = 'SPARKLE'
}

class CollectibleComponent extends Component {
  readonly type = 'collectible';
  
  collectibleType: CollectibleType;
  value: number;
  rarity: string;
  visualEffect: CollectibleEffect;
  
  constructor(type: CollectibleType, value: number, rarity: string = 'common');
  
  canBeCollected(): boolean;
  collect(): void;
}

// Usage
const goldCoin = new CollectibleComponent(CollectibleType.CURRENCY, 10);
const xpOrb = new CollectibleComponent(CollectibleType.EXPERIENCE, 25);
```

### Magnet Component

Magnetic attraction for collectibles.

```typescript
import { MagnetComponent, MagnetismConfig } from 'vital-engine-sdk';

interface MagnetismConfig {
  enabled: boolean;
  range: number;
  strength: number;
}

class MagnetComponent extends Component {
  readonly type = 'magnet';
  
  magneticField: MagnetismConfig;
  
  constructor();
  
  setRange(range: number): void;
  setStrength(strength: number): void;
  enable(): void;
  disable(): void;
}

// Usage
const magnet = new MagnetComponent();
magnet.setRange(100);
magnet.setStrength(300);
```

## Systems

Systems contain game logic and operate on entities with specific components.

### Base System

```typescript
import { System, SystemUpdateContext, EntityQuery } from 'vital-engine-sdk';

abstract class System {
  abstract readonly name: string;
  abstract readonly requiredComponents: string[];
  
  enabled: boolean;
  
  abstract update(context: SystemUpdateContext, entities: EntityQuery[]): void;
  
  initialize?(): void;
  destroy?(): void;
}

interface SystemUpdateContext {
  deltaTime: number;
  totalTime: number;
  frameCount: number;
}
```

### Movement System

Handles entity movement and physics.

```typescript
import { MovementSystem } from 'vital-engine-sdk';

class MovementSystem extends System {
  readonly name = 'movement';
  readonly requiredComponents = ['transform', 'movement'];
  
  constructor(eventSystem?: EventSystem);
  
  update(context: SystemUpdateContext, entities: EntityQuery[]): void;
}

// Usage
const movementSystem = new MovementSystem(events);
world.addSystem(movementSystem);
```

### Combat System

Handles combat interactions and damage.

```typescript
import { CombatSystem } from 'vital-engine-sdk';

class CombatSystem extends System {
  readonly name = 'combat';
  readonly requiredComponents = ['transform', 'health', 'combat'];
  
  constructor(eventSystem: EventSystem);
  
  update(context: SystemUpdateContext, entities: EntityQuery[]): void;
  
  // Manual combat actions
  dealDamage(attackerId: EntityId, targetId: EntityId, damage: number): boolean;
  healEntity(entityId: EntityId, amount: number): boolean;
}

// Usage
const combatSystem = new CombatSystem(events);
world.addSystem(combatSystem);

// Manual damage
combatSystem.dealDamage(playerId, enemyId, 50);
```

### Progression System

Handles experience gain and leveling.

```typescript
import { ProgressionSystem, XPSource } from 'vital-engine-sdk';

interface XPSource {
  type: string;
  baseAmount: number;
  levelMultiplier?: number;
}

class ProgressionSystem extends System {
  readonly name = 'progression';
  readonly requiredComponents = ['experience'];
  
  constructor(eventSystem?: EventSystem, world?: World);
  
  update(context: SystemUpdateContext, entities: EntityQuery[]): void;
  
  // Manual XP awarding
  awardExperience(entityId: EntityId, sourceType: string, metadata?: Record<string, unknown>): number[];
  grantExperience(entityId: EntityId, amount: number, source?: string): number[];
  
  // XP source management
  addXPSource(source: XPSource): void;
  removeXPSource(sourceType: string): void;
}

// Usage
const progressionSystem = new ProgressionSystem(events, world);
world.addSystem(progressionSystem);

// Award XP
progressionSystem.grantExperience(playerId, 100, 'quest_complete');
```

### Collection System

Handles item collection and magnetic attraction.

```typescript
import { CollectionSystem } from 'vital-engine-sdk';

class CollectionSystem extends System {
  readonly name = 'collection';
  readonly requiredComponents = ['transform'];
  
  constructor(eventSystem: EventSystem, world: World);
  
  update(context: SystemUpdateContext, entities: EntityQuery[]): void;
}

// Usage
const collectionSystem = new CollectionSystem(events, world);
world.addSystem(collectionSystem);
```

### Skill System

Handles skill activation and effects.

```typescript
import { SkillSystem } from 'vital-engine-sdk';

class SkillSystem extends System {
  readonly name = 'skills';
  readonly requiredComponents = ['skills'];
  
  constructor(eventSystem: EventSystem, world: World);
  
  update(context: SystemUpdateContext, entities: EntityQuery[]): void;
  
  // Manual skill actions
  activateSkill(entityId: EntityId, skillId: string, targetPosition?: Vector2): boolean;
  evolveSkill(entityId: EntityId, oldSkillId: string, newSkillId: string): boolean;
  awardSkillPoints(entityId: EntityId, points: number): boolean;
}

// Usage
const skillSystem = new SkillSystem(events, world);
world.addSystem(skillSystem);

// Activate skill
skillSystem.activateSkill(playerId, 'fireball', { x: 200, y: 150 });
```

## Event System

The event system enables communication between systems and components.

### EventSystem Class

```typescript
import { EventSystem } from 'vital-engine-sdk';

class EventSystem {
  constructor();
  
  emit(eventType: string, data?: unknown): void;
  on(eventType: string, callback: (event: GameEvent) => void): void;
  off(eventType: string, callback: (event: GameEvent) => void): void;
  once(eventType: string, callback: (event: GameEvent) => void): void;
  
  getEventHistory(eventType?: string): GameEvent[];
  clearEventHistory(): void;
}

interface GameEvent {
  type: string;
  data?: unknown;
  source?: string;
  entityId?: EntityId;
  timestamp: number;
}
```

### Game Event Types

```typescript
import { GameEventType } from 'vital-engine-sdk';

enum GameEventType {
  // Combat events
  DAMAGE_DEALT = 'DAMAGE_DEALT',
  ENTITY_KILLED = 'ENTITY_KILLED',
  HEALTH_CHANGED = 'HEALTH_CHANGED',
  
  // Progression events
  EXPERIENCE_GAINED = 'EXPERIENCE_GAINED',
  LEVEL_UP = 'LEVEL_UP',
  
  // Collection events
  ITEM_COLLECTED = 'ITEM_COLLECTED',
  COLLECTIBLE_COLLECTED = 'COLLECTIBLE_COLLECTED',
  
  // Skill events
  SKILL_ACTIVATED = 'SKILL_ACTIVATED',
  SKILL_POINTS_AWARDED = 'SKILL_POINTS_AWARDED',
  
  // Entity events
  ENTITY_CREATED = 'ENTITY_CREATED',
  ENTITY_DESTROYED = 'ENTITY_DESTROYED'
}
```

### Usage Examples

```typescript
// Listen for events
events.on(GameEventType.DAMAGE_DEALT, (event) => {
  console.log(`Entity ${event.data.sourceId} dealt ${event.data.damage} damage to ${event.data.targetId}`);
});

events.on(GameEventType.LEVEL_UP, (event) => {
  console.log(`Entity ${event.entityId} leveled up to ${event.data.newLevel}!`);
  // Trigger visual effects, sounds, etc.
});

events.on(GameEventType.ITEM_COLLECTED, (event) => {
  console.log(`Collected ${event.data.quantity}x ${event.data.itemType}`);
});

// Emit custom events
events.emit('CUSTOM_EVENT', { customData: 'value' });
```

## Types

### Core Types

```typescript
// Basic types
export type EntityId = number;
export type ComponentType = string;
export type SystemName = string;

// Vector math
export interface Vector2 {
  x: number;
  y: number;
}

// Entity queries
export interface EntityQuery<T extends Component = Component> {
  id: EntityId;
  components: T;
}

// System context
export interface SystemUpdateContext {
  deltaTime: number;
  totalTime: number;
  frameCount: number;
}

// Snapshots for debugging/serialization
export interface EntitySnapshot {
  id: EntityId;
  components: Record<ComponentType, Component>;
  active: boolean;
}

export interface SystemSnapshot {
  name: SystemName;
  enabled: boolean;
  entityCount: number;
  updateTime: number;
  batchMetrics?: {
    batchesProcessed: number;
    averageBatchTime: number;
    currentBatchSize: number;
  };
}

export interface WorldSnapshot {
  entities: EntitySnapshot[];
  systems: SystemSnapshot[];
  entityCount: number;
  componentCount: number;
  timestamp: number;
}
```

### Game-Specific Types

```typescript
// Items and inventory
export type ItemType = string;
export type RarityLevel = 'common' | 'rare' | 'epic' | 'legendary';

export interface ItemStack {
  type: ItemType;
  quantity: number;
}

// Difficulty and scaling
export type DifficultyLevel = 'EASY' | 'NORMAL' | 'HARD' | 'EXTREME' | 'NIGHTMARE';

// AI and behavior
export enum AIBehaviorType {
  PASSIVE = 'PASSIVE',
  AGGRESSIVE = 'AGGRESSIVE',
  DEFENSIVE = 'DEFENSIVE',
  PATROL = 'PATROL',
  GUARD = 'GUARD'
}
```

## Performance & Utilities

### Performance Monitoring

```typescript
import { PerformanceMonitor } from 'vital-engine-sdk';

class PerformanceMonitor {
  constructor();
  
  startFrame(): void;
  endFrame(): void;
  
  getFrameTime(): number;
  getAverageFrameTime(): number;
  getFPS(): number;
  
  getStats(): {
    averageFrameTime: number;
    minFrameTime: number;
    maxFrameTime: number;
    fps: number;
    frameCount: number;
  };
}

// Usage
const monitor = new PerformanceMonitor();

function gameLoop() {
  monitor.startFrame();
  
  // Game logic here
  world.update(16.67);
  
  monitor.endFrame();
  
  // Log performance every 60 frames
  if (monitor.getStats().frameCount % 60 === 0) {
    console.log('Performance:', monitor.getStats());
  }
}
```

### Math Utilities

```typescript
import { Vector2Math } from 'vital-engine-sdk';

class Vector2Math {
  static add(a: Vector2, b: Vector2): Vector2;
  static subtract(a: Vector2, b: Vector2): Vector2;
  static multiply(v: Vector2, scalar: number): Vector2;
  static divide(v: Vector2, scalar: number): Vector2;
  static dot(a: Vector2, b: Vector2): number;
  static cross(a: Vector2, b: Vector2): number;
  static length(v: Vector2): number;
  static lengthSquared(v: Vector2): number;
  static distance(a: Vector2, b: Vector2): number;
  static distanceSquared(a: Vector2, b: Vector2): number;
  static normalize(v: Vector2): Vector2;
  static angle(v: Vector2): number;
  static rotate(v: Vector2, angle: number): Vector2;
  static lerp(a: Vector2, b: Vector2, t: number): Vector2;
  static clone(v: Vector2): Vector2;
  static zero(): Vector2;
  static one(): Vector2;
}

// Usage
const pos1 = { x: 100, y: 200 };
const pos2 = { x: 300, y: 400 };
const distance = Vector2Math.distance(pos1, pos2);
const direction = Vector2Math.normalize(Vector2Math.subtract(pos2, pos1));
```

### Memory Management

```typescript
import { MemoryManager } from 'vital-engine-sdk';

class MemoryManager {
  constructor();
  
  recordAllocation(count?: number): void;
  recordDeallocation(count?: number): void;
  
  updateMemoryStats(): MemoryStats;
  getMemoryStats(): MemoryStats;
  
  scheduleGC(): void;
  forceGC(): void;
}

interface MemoryStats {
  totalJSHeapSize?: number;
  usedJSHeapSize?: number;
  jsHeapSizeLimit?: number;
  allocations: number;
  deallocations: number;
  gcCycles: number;
  lastGCTime?: number;
}
```

## Complete Game Example

Here's a complete TypeScript example showing how to create a basic game:

```typescript
import {
  Engine,
  World,
  EventSystem,
  // Components
  TransformComponent,
  HealthComponent,
  MovementComponent,
  CombatComponent,
  ExperienceComponent,
  InventoryComponent,
  CollectibleComponent,
  MagnetComponent,
  // Systems
  MovementSystem,
  CombatSystem,
  ProgressionSystem,
  CollectionSystem,
  // Types
  CollectibleType,
  GameEventType,
  Vector2
} from 'vital-engine-sdk';

class Game {
  private engine: Engine;
  private world: World;
  private events: EventSystem;
  private playerId: number | null = null;
  private enemyIds: number[] = [];

  constructor() {
    // Initialize engine
    this.engine = new Engine({
      engine: {
        targetFPS: 60,
        fixedTimeStep: false,
        enableEventHistory: true
      }
    });

    this.world = this.engine.getWorld();
    this.events = this.engine.getEvents();

    this.setupSystems();
    this.setupEventListeners();
    this.createPlayer();
    this.createEnemies(5);
    this.createCollectibles(10);
  }

  private setupSystems(): void {
    this.world.addSystem(new MovementSystem(this.events));
    this.world.addSystem(new CombatSystem(this.events));
    this.world.addSystem(new ProgressionSystem(this.events, this.world));
    this.world.addSystem(new CollectionSystem(this.events, this.world));
  }

  private setupEventListeners(): void {
    this.events.on(GameEventType.DAMAGE_DEALT, (event) => {
      console.log(`Damage: ${event.data.damage} from ${event.data.sourceId} to ${event.data.targetId}`);
    });

    this.events.on(GameEventType.ENTITY_KILLED, (event) => {
      console.log(`Entity ${event.data.entityId} was killed`);
      this.respawnEnemy();
    });

    this.events.on(GameEventType.LEVEL_UP, (event) => {
      console.log(`Player leveled up to ${event.data.newLevel}!`);
    });

    this.events.on(GameEventType.COLLECTIBLE_COLLECTED, (event) => {
      console.log(`Collected item worth ${event.data.value}`);
    });
  }

  private createPlayer(): void {
    const player = this.world.createEntity();
    this.playerId = player.id;

    player.addComponent(new TransformComponent(400, 300));
    player.addComponent(new HealthComponent(100));
    player.addComponent(new MovementComponent(150));
    player.addComponent(new CombatComponent({
      damage: 25,
      range: 80,
      attackSpeed: 2,
      criticalChance: 0.1,
      criticalMultiplier: 2.0
    }));
    player.addComponent(new ExperienceComponent(1));
    player.addComponent(new InventoryComponent(20));
    player.addComponent(new MagnetComponent());
  }

  private createEnemies(count: number): void {
    for (let i = 0; i < count; i++) {
      this.createEnemy();
    }
  }

  private createEnemy(): void {
    const enemy = this.world.createEntity();
    this.enemyIds.push(enemy.id);

    // Random position around player
    const angle = Math.random() * Math.PI * 2;
    const distance = 200 + Math.random() * 200;
    const x = 400 + Math.cos(angle) * distance;
    const y = 300 + Math.sin(angle) * distance;

    enemy.addComponent(new TransformComponent(x, y));
    enemy.addComponent(new HealthComponent(50));
    enemy.addComponent(new MovementComponent(75));
    enemy.addComponent(new CombatComponent({
      damage: 10,
      range: 60,
      attackSpeed: 1
    }));
  }

  private createCollectibles(count: number): void {
    for (let i = 0; i < count; i++) {
      const collectible = this.world.createEntity();

      const x = Math.random() * 800;
      const y = Math.random() * 600;

      collectible.addComponent(new TransformComponent(x, y));
      collectible.addComponent(new CollectibleComponent(
        Math.random() < 0.7 ? CollectibleType.CURRENCY : CollectibleType.EXPERIENCE,
        Math.floor(Math.random() * 20) + 5
      ));
    }
  }

  private respawnEnemy(): void {
    // Remove dead enemy from list
    this.enemyIds = this.enemyIds.filter(id => {
      const entity = this.world.getEntity(id);
      return entity && entity.isActive();
    });

    // Create new enemy
    this.createEnemy();
  }

  public movePlayer(direction: Vector2): void {
    if (!this.playerId) return;

    const player = this.world.getEntity(this.playerId);
    if (!player) return;

    const movement = player.getComponent<MovementComponent>('movement');
    if (movement) {
      movement.setVelocity(
        direction.x * movement.maxSpeed,
        direction.y * movement.maxSpeed
      );
    }
  }

  public getPlayerStats(): any {
    if (!this.playerId) return null;

    const player = this.world.getEntity(this.playerId);
    if (!player) return null;

    const health = player.getComponent<HealthComponent>('health');
    const experience = player.getComponent<ExperienceComponent>('experience');
    const inventory = player.getComponent<InventoryComponent>('inventory');

    return {
      health: health ? { current: health.current, max: health.maximum } : null,
      level: experience?.level || 1,
      xp: experience?.totalXP || 0,
      currency: inventory?.currency || 0,
      entityCount: this.world.getStats().activeEntityCount
    };
  }

  public update(): void {
    this.world.update(16.67); // ~60 FPS
  }

  public start(): void {
    const gameLoop = () => {
      this.update();
      
      // Log stats every 3 seconds
      if (Date.now() % 3000 < 20) {
        console.log('Game stats:', this.getPlayerStats());
      }
      
      requestAnimationFrame(gameLoop);
    };
    
    gameLoop();
  }
}

// Usage
const game = new Game();
game.start();

// Player controls (example)
document.addEventListener('keydown', (e) => {
  const direction = { x: 0, y: 0 };
  
  switch (e.code) {
    case 'KeyW': direction.y = -1; break;
    case 'KeyS': direction.y = 1; break;
    case 'KeyA': direction.x = -1; break;
    case 'KeyD': direction.x = 1; break;
  }
  
  if (direction.x !== 0 || direction.y !== 0) {
    game.movePlayer(direction);
  }
});
```

This API reference provides complete TypeScript examples and documentation for implementing games with the Vital Engine SDK. The AI agent can use this as a comprehensive guide to understand the SDK's capabilities and create game implementations.
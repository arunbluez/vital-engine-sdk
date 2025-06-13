import { World } from '../../src/core/ECS/World';
import { Entity } from '../../src/core/ECS/Entity';
import { EventSystem } from '../../src/core/EventSystem';
import { Engine } from '../../src/core/Engine';

// Systems
import { MovementSystem } from '../../src/systems/MovementSystem';
import { CombatSystem } from '../../src/systems/CombatSystem';
import { CollectionSystem } from '../../src/systems/CollectionSystem';
import { SkillSystem } from '../../src/systems/SkillSystem';
import { EnemySystem } from '../../src/systems/EnemySystem';

// Components
import { TransformComponent } from '../../src/components/Transform';
import { MovementComponent } from '../../src/components/Movement';
import { HealthComponent } from '../../src/components/Health';
import { CombatComponent } from '../../src/components/Combat';
import { CollectibleComponent, CollectibleType } from '../../src/components/Collectible';
import { MagnetComponent } from '../../src/components/Magnet';
import { SkillsComponent } from '../../src/components/Skills';
import { EnemyAIComponent, AIBehaviorType } from '../../src/components/EnemyAI';

interface BenchmarkResult {
  systemName: string;
  entityCount: number;
  avgUpdateTime: number;
  minUpdateTime: number;
  maxUpdateTime: number;
  iterations: number;
  entitiesPerMs: number;
}

interface PerformanceBaseline {
  [systemName: string]: {
    maxUpdateTime: number; // ms
    minEntitiesPerMs: number;
  };
}

describe('Performance Regression Tests', () => {
  let world: World;
  let eventSystem: EventSystem;
  
  // Performance baselines - adjust these based on expected performance
  const PERFORMANCE_BASELINES: PerformanceBaseline = {
    'MovementSystem': { maxUpdateTime: 5, minEntitiesPerMs: 200 },
    'CombatSystem': { maxUpdateTime: 10, minEntitiesPerMs: 100 },
    'CollectionSystem': { maxUpdateTime: 8, minEntitiesPerMs: 125 },
    'SkillSystem': { maxUpdateTime: 15, minEntitiesPerMs: 67 },
    'EnemySystem': { maxUpdateTime: 12, minEntitiesPerMs: 83 }
  };

  beforeEach(() => {
    world = new World();
    eventSystem = new EventSystem();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createTestEntities(count: number, type: 'movement' | 'combat' | 'collection' | 'skills' | 'enemy'): Entity[] {
    const entities: Entity[] = [];

    for (let i = 0; i < count; i++) {
      const entity = world.createEntity();
      entity.addComponent(new TransformComponent(
        Math.random() * 1000,
        Math.random() * 1000
      ));

      switch (type) {
        case 'movement':
          entity.addComponent(new MovementComponent(Math.random() * 100 + 50));
          break;
        
        case 'combat':
          entity.addComponent(new HealthComponent(100));
          entity.addComponent(new CombatComponent());
          break;
        
        case 'collection':
          if (i % 2 === 0) {
            entity.addComponent(new MagnetComponent());
          } else {
            entity.addComponent(new CollectibleComponent(CollectibleType.CURRENCY, 10));
          }
          break;
        
        case 'skills':
          entity.addComponent(new HealthComponent(100));
          entity.addComponent(new SkillsComponent());
          break;
        
        case 'enemy':
          entity.addComponent(new HealthComponent(100));
          entity.addComponent(new MovementComponent(75));
          entity.addComponent(new EnemyAIComponent(AIBehaviorType.AGGRESSIVE));
          break;
      }

      entities.push(entity);
    }

    return entities;
  }

  function benchmarkSystem(
    systemName: string,
    systemInstance: any,
    entities: Entity[],
    iterations: number = 100
  ): BenchmarkResult {
    const times: number[] = [];
    const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };

    // Prepare entity data based on system requirements
    let entityData: any[] = [];
    switch (systemName) {
      case 'MovementSystem':
        entityData = entities
          .filter(e => e.hasComponent('movement'))
          .map(e => ({ id: e.id, components: e.getComponent('movement') }));
        break;
      case 'CombatSystem':
        entityData = entities
          .filter(e => e.hasComponent('combat'))
          .map(e => ({ id: e.id, components: e.getComponent('combat') }));
        break;
      case 'CollectionSystem':
        world.getActiveEntities = jest.fn().mockReturnValue(entities);
        world.removeEntity = jest.fn();
        entityData = []; // Collection system uses world.getActiveEntities
        break;
      case 'SkillSystem':
        entityData = entities
          .filter(e => e.hasComponent('skills'))
          .map(e => ({ id: e.id, components: e.getComponent('skills') }));
        break;
      case 'EnemySystem':
        world.getActiveEntities = jest.fn().mockReturnValue(entities);
        entityData = entities
          .filter(e => e.hasComponent('enemyAI'))
          .map(e => ({ id: e.id, components: e.getComponent('enemyAI') }));
        break;
    }

    // Warmup
    for (let i = 0; i < 10; i++) {
      systemInstance.update(context, entityData);
    }

    // Benchmark
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      systemInstance.update(context, entityData);
      const end = performance.now();
      times.push(end - start);
    }

    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const entitiesPerMs = entities.length / avgTime;

    return {
      systemName,
      entityCount: entities.length,
      avgUpdateTime: avgTime,
      minUpdateTime: minTime,
      maxUpdateTime: maxTime,
      iterations,
      entitiesPerMs
    };
  }

  describe('Individual System Performance', () => {
    const entityCounts = [10, 50, 100, 500, 1000];

    entityCounts.forEach(entityCount => {
      describe(`${entityCount} entities`, () => {
        it('should meet MovementSystem performance requirements', () => {
          const entities = createTestEntities(entityCount, 'movement');
          const system = new MovementSystem();
          
          const result = benchmarkSystem('MovementSystem', system, entities);
          
          console.log(`MovementSystem (${entityCount} entities):`, {
            avgTime: `${result.avgUpdateTime.toFixed(2)}ms`,
            entitiesPerMs: result.entitiesPerMs.toFixed(1)
          });

          const baseline = PERFORMANCE_BASELINES.MovementSystem;
          expect(result.avgUpdateTime).toBeLessThan(baseline.maxUpdateTime);
          expect(result.entitiesPerMs).toBeGreaterThan(baseline.minEntitiesPerMs);
        });

        it('should meet CombatSystem performance requirements', () => {
          const entities = createTestEntities(entityCount, 'combat');
          const system = new CombatSystem(eventSystem);
          
          const result = benchmarkSystem('CombatSystem', system, entities);
          
          console.log(`CombatSystem (${entityCount} entities):`, {
            avgTime: `${result.avgUpdateTime.toFixed(2)}ms`,
            entitiesPerMs: result.entitiesPerMs.toFixed(1)
          });

          const baseline = PERFORMANCE_BASELINES.CombatSystem;
          expect(result.avgUpdateTime).toBeLessThan(baseline.maxUpdateTime);
          expect(result.entitiesPerMs).toBeGreaterThan(baseline.minEntitiesPerMs);
        });

        it('should meet CollectionSystem performance requirements', () => {
          const entities = createTestEntities(entityCount, 'collection');
          const system = new CollectionSystem(eventSystem, world);
          
          const result = benchmarkSystem('CollectionSystem', system, entities);
          
          console.log(`CollectionSystem (${entityCount} entities):`, {
            avgTime: `${result.avgUpdateTime.toFixed(2)}ms`,
            entitiesPerMs: result.entitiesPerMs.toFixed(1)
          });

          const baseline = PERFORMANCE_BASELINES.CollectionSystem;
          expect(result.avgUpdateTime).toBeLessThan(baseline.maxUpdateTime);
          expect(result.entitiesPerMs).toBeGreaterThan(baseline.minEntitiesPerMs);
        });

        it('should meet SkillSystem performance requirements', () => {
          const entities = createTestEntities(entityCount, 'skills');
          const system = new SkillSystem(eventSystem, world as any);
          
          const result = benchmarkSystem('SkillSystem', system, entities);
          
          console.log(`SkillSystem (${entityCount} entities):`, {
            avgTime: `${result.avgUpdateTime.toFixed(2)}ms`,
            entitiesPerMs: result.entitiesPerMs.toFixed(1)
          });

          const baseline = PERFORMANCE_BASELINES.SkillSystem;
          expect(result.avgUpdateTime).toBeLessThan(baseline.maxUpdateTime);
          expect(result.entitiesPerMs).toBeGreaterThan(baseline.minEntitiesPerMs);
        });

        it('should meet EnemySystem performance requirements', () => {
          const entities = createTestEntities(entityCount, 'enemy');
          const system = new EnemySystem(eventSystem, world);
          
          const result = benchmarkSystem('EnemySystem', system, entities);
          
          console.log(`EnemySystem (${entityCount} entities):`, {
            avgTime: `${result.avgUpdateTime.toFixed(2)}ms`,
            entitiesPerMs: result.entitiesPerMs.toFixed(1)
          });

          const baseline = PERFORMANCE_BASELINES.EnemySystem;
          expect(result.avgUpdateTime).toBeLessThan(baseline.maxUpdateTime);
          expect(result.entitiesPerMs).toBeGreaterThan(baseline.minEntitiesPerMs);
        });
      });
    });
  });

  describe('Memory Performance', () => {
    it('should not leak memory during entity creation/destruction cycles', () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      for (let cycle = 0; cycle < 10; cycle++) {
        // Create many entities
        const entities: Entity[] = [];
        for (let i = 0; i < 1000; i++) {
          const entity = world.createEntity();
          entity.addComponent(new TransformComponent(0, 0));
          entity.addComponent(new MovementComponent(100));
          entity.addComponent(new HealthComponent(100));
          entities.push(entity);
        }

        // Update systems
        const movementSystem = new MovementSystem();
        const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };
        
        for (let i = 0; i < 10; i++) {
          movementSystem.update(context, entities.map(e => ({ 
            id: e.id, 
            components: e.getComponent('movement') 
          })));
        }

        // Clean up entities
        entities.forEach(entity => {
          world.removeEntity(entity.id);
        });

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it('should handle large numbers of components efficiently', () => {
      const entityCount = 5000;
      const entities: Entity[] = [];

      const startTime = performance.now();

      // Create entities with multiple components
      for (let i = 0; i < entityCount; i++) {
        const entity = world.createEntity();
        entity.addComponent(new TransformComponent(i, i));
        entity.addComponent(new MovementComponent(100));
        entity.addComponent(new HealthComponent(100));
        entity.addComponent(new CombatComponent());
        entities.push(entity);
      }

      const creationTime = performance.now() - startTime;

      // Test component access performance
      const accessStartTime = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        const randomEntity = entities[Math.floor(Math.random() * entities.length)];
        randomEntity.getComponent('transform');
        randomEntity.getComponent('movement');
        randomEntity.getComponent('health');
        randomEntity.getComponent('combat');
      }

      const accessTime = performance.now() - accessStartTime;

      console.log(`Component Performance:`, {
        creationTime: `${creationTime.toFixed(2)}ms for ${entityCount} entities`,
        accessTime: `${accessTime.toFixed(2)}ms for 1000 random accesses`,
        avgCreationPerEntity: `${(creationTime / entityCount).toFixed(4)}ms`,
        avgAccessTime: `${(accessTime / 1000).toFixed(4)}ms`
      });

      // Creation should be under 1ms per entity
      expect(creationTime / entityCount).toBeLessThan(1);
      // Component access should be very fast
      expect(accessTime / 1000).toBeLessThan(0.1);
    });
  });

  describe('Scalability Tests', () => {
    it('should scale linearly with entity count', () => {
      const system = new MovementSystem();
      const results: BenchmarkResult[] = [];

      const entityCounts = [100, 200, 400, 800];

      entityCounts.forEach(count => {
        const entities = createTestEntities(count, 'movement');
        const result = benchmarkSystem('MovementSystem', system, entities, 50);
        results.push(result);
      });

      // Check that performance scales roughly linearly
      for (let i = 1; i < results.length; i++) {
        const current = results[i];
        const previous = results[i - 1];
        
        const entityRatio = current.entityCount / previous.entityCount;
        const timeRatio = current.avgUpdateTime / previous.avgUpdateTime;
        
        console.log(`Scaling ${previous.entityCount} -> ${current.entityCount}:`, {
          entityRatio: entityRatio.toFixed(2),
          timeRatio: timeRatio.toFixed(2),
          efficiency: (entityRatio / timeRatio).toFixed(2)
        });

        // Time should not increase more than 3x the entity increase
        expect(timeRatio).toBeLessThan(entityRatio * 3);
      }
    });

    it('should maintain frame rate under different loads', () => {
      const TARGET_FPS = 60;
      const FRAME_TIME_MS = 1000 / TARGET_FPS; // ~16.67ms

      const systems = {
        movement: new MovementSystem(),
        combat: new CombatSystem(eventSystem),
        collection: new CollectionSystem(eventSystem, world)
      };

      const entityCounts = [50, 100, 200, 500];

      entityCounts.forEach(entityCount => {
        const movementEntities = createTestEntities(entityCount, 'movement');
        const combatEntities = createTestEntities(entityCount, 'combat');
        const collectionEntities = createTestEntities(entityCount, 'collection');

        world.getActiveEntities = jest.fn().mockReturnValue(collectionEntities);
        world.removeEntity = jest.fn();

        const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };

        // Measure total frame time
        const frameStart = performance.now();

        systems.movement.update(context, movementEntities.map(e => ({ 
          id: e.id, 
          components: e.getComponent('movement') 
        })));

        systems.combat.update(context, combatEntities.map(e => ({ 
          id: e.id, 
          components: e.getComponent('combat') 
        })));

        systems.collection.update(context, []);

        const frameEnd = performance.now();
        const frameTime = frameEnd - frameStart;

        console.log(`Frame time with ${entityCount} entities: ${frameTime.toFixed(2)}ms`);

        // Frame time should be under target for smooth gameplay
        if (entityCount <= 200) {
          expect(frameTime).toBeLessThan(FRAME_TIME_MS);
        } else {
          // For larger counts, allow some degradation but not extreme
          expect(frameTime).toBeLessThan(FRAME_TIME_MS * 2);
        }
      });
    });
  });

  describe('Stress Tests', () => {
    it('should handle maximum entity counts without crashing', () => {
      const MAX_ENTITIES = 10000;
      const entities: Entity[] = [];

      expect(() => {
        for (let i = 0; i < MAX_ENTITIES; i++) {
          const entity = world.createEntity();
          entity.addComponent(new TransformComponent(
            Math.random() * 10000,
            Math.random() * 10000
          ));
          entity.addComponent(new MovementComponent(Math.random() * 200));
          entities.push(entity);
        }
      }).not.toThrow();

      const system = new MovementSystem();
      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };

      expect(() => {
        system.update(context, entities.map(e => ({ 
          id: e.id, 
          components: e.getComponent('movement') 
        })));
      }).not.toThrow();

      console.log(`Successfully handled ${MAX_ENTITIES} entities`);
    });

    it('should handle rapid system updates', () => {
      const entities = createTestEntities(100, 'movement');
      const system = new MovementSystem();
      const context = { deltaTime: 1, totalTime: 1, frameCount: 1 }; // Very fast updates

      const RAPID_UPDATES = 1000;

      const startTime = performance.now();

      expect(() => {
        for (let i = 0; i < RAPID_UPDATES; i++) {
          system.update(context, entities.map(e => ({ 
            id: e.id, 
            components: e.getComponent('movement') 
          })));
        }
      }).not.toThrow();

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      console.log(`${RAPID_UPDATES} rapid updates completed in ${totalTime.toFixed(2)}ms`);

      // Should complete rapid updates in reasonable time
      expect(totalTime).toBeLessThan(1000); // Under 1 second
    });
  });

  describe('Performance Regression Detection', () => {
    it('should detect performance regressions in core systems', () => {
      const baseline = {
        'MovementSystem': 2.5, // ms for 1000 entities
        'CombatSystem': 5.0,
        'CollectionSystem': 4.0
      };

      const systems = {
        'MovementSystem': new MovementSystem(),
        'CombatSystem': new CombatSystem(eventSystem),
        'CollectionSystem': new CollectionSystem(eventSystem, world)
      };

      Object.entries(systems).forEach(([systemName, systemInstance]) => {
        let entities: Entity[];
        
        switch (systemName) {
          case 'MovementSystem':
            entities = createTestEntities(1000, 'movement');
            break;
          case 'CombatSystem':
            entities = createTestEntities(1000, 'combat');
            break;
          case 'CollectionSystem':
            entities = createTestEntities(1000, 'collection');
            break;
          default:
            entities = [];
        }

        const result = benchmarkSystem(systemName, systemInstance, entities, 100);
        const regressionThreshold = baseline[systemName as keyof typeof baseline] * 1.5; // 50% regression allowance

        console.log(`${systemName} performance:`, {
          current: `${result.avgUpdateTime.toFixed(2)}ms`,
          baseline: `${baseline[systemName as keyof typeof baseline]}ms`,
          threshold: `${regressionThreshold.toFixed(2)}ms`,
          status: result.avgUpdateTime <= regressionThreshold ? '✅ PASS' : '❌ REGRESSION'
        });

        expect(result.avgUpdateTime).toBeLessThan(regressionThreshold);
      });
    });
  });
});
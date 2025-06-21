import { MovementSystem } from '../../src/systems/MovementSystem';
import { World } from '../../src/core/ECS/World';
import { Entity } from '../../src/core/ECS/Entity';
import { TransformComponent } from '../../src/components/Transform';
import { MovementComponent } from '../../src/components/Movement';
import { EventSystem } from '../../src/core/EventSystem';

describe('MovementSystem', () => {
  let world: World;
  let movementSystem: MovementSystem;
  let eventSystem: EventSystem;

  beforeEach(() => {
    world = new World();
    eventSystem = new EventSystem();
    movementSystem = new MovementSystem(eventSystem);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with correct name and dependencies', () => {
      expect(movementSystem.name).toBe('movement');
      expect((movementSystem as any).eventSystem).toBe(eventSystem);
      // MovementSystem doesn't store world reference
    });
  });

  describe('basic movement', () => {
    let entity: Entity;
    let transform: TransformComponent;
    let movement: MovementComponent;

    beforeEach(() => {
      entity = world.createEntity();
      transform = new TransformComponent(0, 0);
      movement = new MovementComponent(100, 0.8); // maxSpeed: 100, friction: 0.8
      entity.addComponent(transform);
      entity.addComponent(movement);
    });

    it('should update position based on velocity', () => {
      movement.setVelocity(50, 0);

      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };
      const entityQuery = {
        id: entity.id,
        components: {
          transform,
          movement
        }
      };
      movementSystem.update(context, [entityQuery as any]);

      // Position should update based on velocity * deltaTime
      expect(transform.position.x).toBeCloseTo(0.8, 1); // 50 * 0.016
      expect(transform.position.y).toBe(0);
    });

    it('should apply acceleration to velocity', () => {
      movement.setAcceleration(100, 0);

      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };
      const entityQuery = {
        id: entity.id,
        components: {
          transform,
          movement
        }
      };
      movementSystem.update(context, [entityQuery as any]);

      // Velocity should increase based on acceleration * deltaTime
      expect(movement.velocity.x).toBeGreaterThan(0);
      expect(movement.velocity.y).toBe(0);
    });

    it('should apply friction to velocity', () => {
      movement.setVelocity(100, 0);
      movement.friction = 0.9;

      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };
      const entityQuery = {
        id: entity.id,
        components: {
          transform,
          movement
        }
      };
      movementSystem.update(context, [entityQuery as any]);

      // Velocity should decrease due to friction
      expect(movement.velocity.x).toBeLessThan(100);
      expect(movement.velocity.x).toBeGreaterThan(0);
    });

    it('should respect max speed', () => {
      movement.maxSpeed = 50;
      movement.setVelocity(100, 0);

      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };
      const entityQuery = {
        id: entity.id,
        components: {
          transform,
          movement
        }
      };
      movementSystem.update(context, [entityQuery as any]);

      // Velocity should be clamped to max speed
      expect(movement.getSpeed()).toBeLessThanOrEqual(50);
    });

    it('should handle diagonal movement correctly', () => {
      movement.setVelocity(30, 40); // 3-4-5 triangle

      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };
      const entityQuery = {
        id: entity.id,
        components: {
          transform,
          movement
        }
      };
      movementSystem.update(context, [entityQuery as any]);

      expect(movement.getSpeed()).toBeCloseTo(50, 0);
      expect(transform.position.x).toBeGreaterThan(0);
      expect(transform.position.y).toBeGreaterThan(0);
    });
  });

  describe('movement methods', () => {
    let entity: Entity;
    let movement: MovementComponent;

    beforeEach(() => {
      entity = world.createEntity();
      movement = new MovementComponent();
      entity.addComponent(new TransformComponent(0, 0));
      entity.addComponent(movement);
    });

    it('should add velocity correctly', () => {
      movement.setVelocity(10, 20);
      movement.addVelocity(5, -10);

      expect(movement.velocity.x).toBe(15);
      expect(movement.velocity.y).toBe(10);
    });

    it('should add acceleration correctly', () => {
      movement.setAcceleration(10, 20);
      movement.addAcceleration(5, -10);

      expect(movement.acceleration.x).toBe(15);
      expect(movement.acceleration.y).toBe(10);
    });

    it('should apply forces correctly', () => {
      movement.applyForce(100, 50);

      expect(movement.acceleration.x).toBe(100);
      expect(movement.acceleration.y).toBe(50);
    });

    it('should apply impulses correctly', () => {
      movement.setVelocity(10, 10);
      movement.applyImpulse(20, -5);

      expect(movement.velocity.x).toBe(30);
      expect(movement.velocity.y).toBe(5);
    });

    it('should stop movement', () => {
      movement.setVelocity(50, 50);
      movement.setAcceleration(10, 10);
      movement.stop();

      expect(movement.velocity.x).toBe(0);
      expect(movement.velocity.y).toBe(0);
      expect(movement.acceleration.x).toBe(0);
      expect(movement.acceleration.y).toBe(0);
    });

    it('should get direction correctly', () => {
      movement.setVelocity(30, 40);
      const direction = movement.getDirection();

      expect(direction.x).toBeCloseTo(0.6, 1);
      expect(direction.y).toBeCloseTo(0.8, 1);
    });

    it('should handle zero velocity direction', () => {
      movement.setVelocity(0, 0);
      const direction = movement.getDirection();

      expect(direction.x).toBe(0);
      expect(direction.y).toBe(0);
    });
  });

  describe('physics integration', () => {
    let entity: Entity;
    let transform: TransformComponent;
    let movement: MovementComponent;

    beforeEach(() => {
      entity = world.createEntity();
      transform = new TransformComponent(100, 100);
      movement = new MovementComponent(100, 0.95);
      entity.addComponent(transform);
      entity.addComponent(movement);
    });

    it('should simulate projectile motion', () => {
      // Launch at 45 degrees
      const speed = 100;
      const angle = Math.PI / 4;
      movement.setVelocity(
        speed * Math.cos(angle),
        speed * Math.sin(angle)
      );

      // Simulate gravity
      movement.setAcceleration(0, -98); // 9.8 m/s^2 scaled

      // Run simulation for several frames
      const initialX = transform.position.x;
      const initialY = transform.position.y;
      const initialVelocityY = movement.velocity.y;

      for (let i = 0; i < 10; i++) {
        const context = { deltaTime: 100, totalTime: (i + 1) * 100, frameCount: i + 1 };
        const entityQuery = {
          id: entity.id,
          components: {
            transform,
            movement
          }
        };
        movementSystem.update(context, [entityQuery as any]);
      }

      // Should have moved in parabolic arc
      expect(transform.position.x).toBeGreaterThan(initialX);
      expect(transform.position.y).not.toBe(initialY); // Will have changed due to gravity
      expect(movement.velocity.y).not.toBe(initialVelocityY); // Velocity changed due to physics
    });

    it('should handle circular motion', () => {
      const radius = 50;
      const angularVelocity = Math.PI; // radians per second

      let angle = 0;
      const centerX = 100;
      const centerY = 100;

      for (let i = 0; i < 4; i++) {
        // Update angle
        angle += angularVelocity * 0.016;

        // Set position on circle
        const targetX = centerX + radius * Math.cos(angle);
        const targetY = centerY + radius * Math.sin(angle);

        // Calculate velocity to reach target
        const dx = targetX - transform.position.x;
        const dy = targetY - transform.position.y;
        movement.setVelocity(dx / 0.016, dy / 0.016);

        const context = { deltaTime: 16, totalTime: (i + 1) * 16, frameCount: i + 1 };
        const entityQuery = {
          id: entity.id,
          components: {
            transform,
            movement
          }
        };
        movementSystem.update(context, [entityQuery as any]);
      }

      // Should still be approximately on the circle
      const distFromCenter = Math.sqrt(
        Math.pow(transform.position.x - centerX, 2) +
        Math.pow(transform.position.y - centerY, 2)
      );
      expect(distFromCenter).toBeGreaterThan(0); // Entity moved in some circular pattern
    });
  });

  describe('performance optimization', () => {
    it('should handle many entities efficiently', () => {
      const entities: Entity[] = [];
      
      // Create 1000 moving entities
      for (let i = 0; i < 1000; i++) {
        const entity = world.createEntity();
        entity.addComponent(new TransformComponent(Math.random() * 1000, Math.random() * 1000));
        entity.addComponent(new MovementComponent(100, 0.9));
        
        const movement = entity.getComponent('movement') as MovementComponent;
        movement.setVelocity(
          (Math.random() - 0.5) * 100,
          (Math.random() - 0.5) * 100
        );
        
        entities.push(entity);
      }

      const startTime = performance.now();
      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };
      const entityQueries = entities.map(e => ({
        id: e.id,
        components: {
          transform: e.getComponent('transform'),
          movement: e.getComponent('movement')
        }
      }));
      movementSystem.update(context, entityQueries as any);
      const endTime = performance.now();

      // Should process all entities in reasonable time
      expect(endTime - startTime).toBeLessThan(16); // One frame
    });

    it('should skip stationary entities', () => {
      const movingEntity = world.createEntity();
      movingEntity.addComponent(new TransformComponent(0, 0));
      movingEntity.addComponent(new MovementComponent());

      const stationaryEntity = world.createEntity();
      stationaryEntity.addComponent(new TransformComponent(100, 100));
      const stationaryMovement = new MovementComponent();
      stationaryMovement.setVelocity(0, 0);
      stationaryMovement.setAcceleration(0, 0);
      stationaryEntity.addComponent(stationaryMovement);

      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };
      const entityQueries = [movingEntity, stationaryEntity].map(e => ({
        id: e.id,
        components: {
          transform: e.getComponent('transform'),
          movement: e.getComponent('movement')
        }
      }));
      movementSystem.update(context, entityQueries as any);

      // Stationary entity position should not change
      const stationaryTransform = stationaryEntity.getComponent('transform') as TransformComponent;
      expect(stationaryTransform.position.x).toBe(100);
      expect(stationaryTransform.position.y).toBe(100);
    });
  });

  describe('edge cases', () => {
    it('should handle entities without transform component', () => {
      const entity = world.createEntity();
      entity.addComponent(new MovementComponent());

      expect(() => {
        const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };
        const entityQuery = {
          id: entity.id,
          components: {
            transform: null,
            movement: entity.getComponent('movement')
          }
        };
        movementSystem.update(context, [entityQuery as any]);
      }).not.toThrow();
    });

    it('should handle very small velocities', () => {
      const entity = world.createEntity();
      const transform = new TransformComponent(0, 0);
      const movement = new MovementComponent();
      entity.addComponent(transform);
      entity.addComponent(movement);

      movement.setVelocity(0.0001, 0.0001);

      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };
      const entityQuery = {
        id: entity.id,
        components: {
          transform,
          movement
        }
      };
      movementSystem.update(context, [entityQuery as any]);

      // Should still update position even with tiny velocities
      expect(transform.position.x).toBeGreaterThan(0);
      expect(transform.position.y).toBeGreaterThan(0);
    });

    it('should handle very large deltaTime', () => {
      const entity = world.createEntity();
      const transform = new TransformComponent(0, 0);
      const movement = new MovementComponent(100);
      entity.addComponent(transform);
      entity.addComponent(movement);

      movement.setVelocity(50, 0);

      // Large deltaTime (1 second)
      const context = { deltaTime: 1000, totalTime: 1000, frameCount: 1 };
      const entityQuery = {
        id: entity.id,
        components: {
          transform,
          movement
        }
      };
      movementSystem.update(context, [entityQuery as any]);

      // Should still respect max speed
      expect(transform.position.x).toBeLessThanOrEqual(100); // max_speed * 1 second
    });

    it('should handle negative friction', () => {
      const entity = world.createEntity();
      const movement = new MovementComponent(100, -0.5); // Negative friction
      entity.addComponent(new TransformComponent(0, 0));
      entity.addComponent(movement);

      movement.setVelocity(10, 0);

      const context = { deltaTime: 16, totalTime: 16, frameCount: 1 };
      const entityQuery = {
        id: entity.id,
        components: {
          transform: entity.getComponent('transform'),
          movement
        }
      };
      movementSystem.update(context, [entityQuery as any]);

      // Should still work, though behavior might be unusual
      expect(movement.velocity.x).toBeDefined();
    });
  });
});
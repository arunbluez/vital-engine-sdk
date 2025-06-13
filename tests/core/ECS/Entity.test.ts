import { Entity, Component } from '@/core/ECS'

// Test component implementation
class TestComponent extends Component {
  readonly type = 'test'
  value: number = 0

  constructor(value: number = 0) {
    super()
    this.value = value
  }

  clone(): Component {
    return new TestComponent(this.value)
  }

  serialize(): Record<string, unknown> {
    return { value: this.value }
  }

  deserialize(data: Record<string, unknown>): void {
    this.value = data.value as number
  }
}

class AnotherTestComponent extends Component {
  readonly type = 'anotherTest'
  name: string = ''

  constructor(name: string = '') {
    super()
    this.name = name
  }

  clone(): Component {
    return new AnotherTestComponent(this.name)
  }

  serialize(): Record<string, unknown> {
    return { name: this.name }
  }

  deserialize(data: Record<string, unknown>): void {
    this.name = data.name as string
  }
}

describe('Entity', () => {
  beforeEach(() => {
    Entity.resetIdCounter()
  })

  test('should create entity with unique ID', () => {
    const entity1 = new Entity()
    const entity2 = new Entity()
    
    expect(entity1.id).toBe(1)
    expect(entity2.id).toBe(2)
  })

  test('should add and retrieve components', () => {
    const entity = new Entity()
    const component = new TestComponent(42)
    
    entity.addComponent(component)
    
    expect(entity.hasComponent('test')).toBe(true)
    expect(entity.getComponent('test')).toBe(component)
  })

  test('should throw error when adding duplicate component type', () => {
    const entity = new Entity()
    const component1 = new TestComponent(1)
    const component2 = new TestComponent(2)
    
    entity.addComponent(component1)
    
    expect(() => entity.addComponent(component2)).toThrow()
  })

  test('should remove components', () => {
    const entity = new Entity()
    const component = new TestComponent()
    
    entity.addComponent(component)
    entity.removeComponent('test')
    
    expect(entity.hasComponent('test')).toBe(false)
    expect(entity.getComponent('test')).toBeNull()
  })

  test('should check multiple components', () => {
    const entity = new Entity()
    entity.addComponent(new TestComponent())
    
    expect(entity.hasComponents(['test'])).toBe(true)
    expect(entity.hasComponents(['test', 'missing'])).toBe(false)
  })

  test('should manage active state', () => {
    const entity = new Entity()
    
    expect(entity.isActive()).toBe(true)
    
    entity.setActive(false)
    expect(entity.isActive()).toBe(false)
  })

  test('should create snapshot', () => {
    const entity = new Entity()
    const component = new TestComponent(123)
    entity.addComponent(component)
    entity.setActive(false)
    
    const snapshot = entity.snapshot()
    
    expect(snapshot.id).toBe(entity.id)
    expect(snapshot.active).toBe(false)
    expect(snapshot.components.test).toBeDefined()
    expect(snapshot.components.test).not.toBe(component) // Should be cloned
  })

  test('should clear all components', () => {
    const entity = new Entity()
    entity.addComponent(new TestComponent(1))
    entity.addComponent(new AnotherTestComponent('test'))
    
    entity.clear()
    
    expect(entity.getComponents().length).toBe(0)
  })
})
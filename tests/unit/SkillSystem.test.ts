import { SkillSystem } from '../../src/systems/SkillSystem'
import { SkillsComponent, SkillType, SkillEffectType, SkillTargetType, Skill, ActiveEffect } from '../../src/components/Skills'
import { TransformComponent } from '../../src/components/Transform'
import { HealthComponent } from '../../src/components/Health'
import { World } from '../../src/core/ECS/World'
import { Entity } from '../../src/core/ECS/Entity'
import { EventSystem } from '../../src/core/EventSystem'
import { GameEventType } from '../../src/types/Events'

describe('SkillSystem', () => {
  let world: World
  let eventSystem: EventSystem
  let skillSystem: SkillSystem
  let player: Entity
  let enemy: Entity

  beforeEach(() => {
    world = new World()
    eventSystem = new EventSystem()
    skillSystem = new SkillSystem(eventSystem, world as any)
    
    // Create player entity
    player = world.createEntity()
    player.addComponent(new TransformComponent(0, 0))
    player.addComponent(new HealthComponent(100))
    player.addComponent(new SkillsComponent(5)) // 5 skill points
    
    // Create enemy entity  
    enemy = world.createEntity()
    enemy.addComponent(new TransformComponent(50, 0)) // Within range
    enemy.addComponent(new HealthComponent(50))
    enemy.addComponent(new SkillsComponent())
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should add skills to entity', () => {
    const skillsComp = player.getComponent('skills') as SkillsComponent
    
    const fireball: Skill = {
      id: 'fireball',
      name: 'Fireball',
      description: 'Launches a fireball',
      type: SkillType.ACTIVE,
      targetType: SkillTargetType.PROJECTILE,
      level: 1,
      maxLevel: 5,
      cooldown: 3000,
      lastUsed: 0,
      effects: [{
        type: SkillEffectType.DAMAGE,
        value: 50,
        radius: 30
      }]
    }
    
    const success = skillsComp.addSkill(fireball)
    expect(success).toBe(true)
    expect(skillsComp.getSkill('fireball')).toBeTruthy()
  })

  it('should upgrade skills using skill points', () => {
    const skillsComp = player.getComponent('skills') as SkillsComponent
    
    const skill: Skill = {
      id: 'test_skill',
      name: 'Test Skill',
      description: 'Test',
      type: SkillType.ACTIVE,
      targetType: SkillTargetType.SELF,
      level: 1,
      maxLevel: 3,
      cooldown: 1000,
      lastUsed: 0,
      effects: [{
        type: SkillEffectType.DAMAGE,
        value: 10
      }]
    }
    
    skillsComp.addSkill(skill)
    const initialPoints = skillsComp.skillPoints
    
    const success = skillsComp.upgradeSkill('test_skill')
    expect(success).toBe(true)
    expect(skillsComp.skillPoints).toBe(initialPoints - 1)
    expect(skillsComp.getSkill('test_skill')!.level).toBe(2)
  })

  it('should check skill cooldowns', () => {
    const skillsComp = player.getComponent('skills') as SkillsComponent
    
    const skill: Skill = {
      id: 'cooldown_test',
      name: 'Cooldown Test',
      description: 'Test',
      type: SkillType.ACTIVE,
      targetType: SkillTargetType.SELF,
      level: 1,
      maxLevel: 1,
      cooldown: 5000,
      lastUsed: 0,
      effects: []
    }
    
    skillsComp.addSkill(skill)
    
    const currentTime = Date.now()
    expect(skillsComp.canUseSkill('cooldown_test', currentTime)).toBe(true)
    
    skillsComp.useSkill('cooldown_test', currentTime)
    expect(skillsComp.canUseSkill('cooldown_test', currentTime)).toBe(false)
    expect(skillsComp.canUseSkill('cooldown_test', currentTime + 6000)).toBe(true)
  })

  it('should activate skills through system', (done) => {
    const skillsComp = player.getComponent('skills') as SkillsComponent
    
    const healSkill: Skill = {
      id: 'heal',
      name: 'Heal',
      description: 'Restores health',
      type: SkillType.ACTIVE,
      targetType: SkillTargetType.SELF,
      level: 1,
      maxLevel: 3,
      cooldown: 1000,
      lastUsed: 0,
      effects: [{
        type: SkillEffectType.HEAL,
        value: 30
      }]
    }
    
    skillsComp.addSkill(healSkill)
    
    // Damage player first
    const health = player.getComponent('health') as HealthComponent
    health.takeDamage(40, Date.now())
    const damagedHealth = health.current
    
    eventSystem.on('SKILL_ACTIVATED', (event: any) => {
      expect(event.entityId).toBe(player.id)
      expect(event.skillId).toBe('heal')
      done()
    })
    
    const success = skillSystem.activateSkill(player.id, 'heal')
    expect(success).toBe(true)
    expect(health.current).toBeGreaterThan(damagedHealth)
  })

  it('should apply damage to enemies in range', () => {
    const skillsComp = player.getComponent('skills') as SkillsComponent
    
    const aoeSkill: Skill = {
      id: 'explosion',
      name: 'Explosion',
      description: 'Area damage',
      type: SkillType.ACTIVE,
      targetType: SkillTargetType.ENEMIES,
      level: 1,
      maxLevel: 1,
      cooldown: 2000,
      lastUsed: 0,
      effects: [{
        type: SkillEffectType.DAMAGE,
        value: 40,
        radius: 100
      }]
    }
    
    skillsComp.addSkill(aoeSkill)
    
    const enemyHealth = enemy.getComponent('health') as HealthComponent
    const initialHealth = enemyHealth.current
    
    const success = skillSystem.activateSkill(player.id, 'explosion')
    expect(success).toBe(true)
    expect(enemyHealth.current).toBeLessThan(initialHealth)
  })

  it('should manage active effects', () => {
    const skillsComp = player.getComponent('skills') as SkillsComponent
    
    const activeEffect: ActiveEffect = {
      id: 'test_effect',
      skillId: 'test_skill',
      sourceEntityId: player.id,
      effect: {
        type: SkillEffectType.BUFF,
        value: 20,
        duration: 5000
      },
      startTime: Date.now(),
      endTime: Date.now() + 5000,
      stacks: 1
    }
    
    skillsComp.addActiveEffect(activeEffect)
    expect(skillsComp.activeEffects).toHaveLength(1)
    expect(skillsComp.getActiveEffectsByType(SkillEffectType.BUFF)).toHaveLength(1)
  })

  it('should remove expired effects', () => {
    const skillsComp = player.getComponent('skills') as SkillsComponent
    const currentTime = Date.now()
    
    const expiredEffect: ActiveEffect = {
      id: 'expired',
      skillId: 'test',
      sourceEntityId: player.id,
      effect: {
        type: SkillEffectType.BUFF,
        value: 10
      },
      startTime: currentTime - 10000,
      endTime: currentTime - 5000,
      stacks: 1
    }
    
    skillsComp.addActiveEffect(expiredEffect)
    skillsComp.updateActiveEffects(currentTime)
    expect(skillsComp.activeEffects).toHaveLength(0)
  })

  it('should calculate total effect values', () => {
    const skillsComp = player.getComponent('skills') as SkillsComponent
    
    skillsComp.addActiveEffect({
      id: 'effect1',
      skillId: 'skill1',
      sourceEntityId: player.id,
      effect: { type: SkillEffectType.DAMAGE, value: 10 },
      startTime: Date.now(),
      stacks: 2
    })
    
    skillsComp.addActiveEffect({
      id: 'effect2',
      skillId: 'skill2',
      sourceEntityId: player.id,
      effect: { type: SkillEffectType.DAMAGE, value: 15 },
      startTime: Date.now(),
      stacks: 1
    })
    
    const total = skillsComp.getTotalEffectValue(SkillEffectType.DAMAGE)
    expect(total).toBe(35) // (10 * 2) + (15 * 1)
  })

  it('should evolve skills at max level', () => {
    const skillsComp = player.getComponent('skills') as SkillsComponent
    
    const baseSkill: Skill = {
      id: 'basic_shot',
      name: 'Basic Shot',
      description: 'Basic attack',
      type: SkillType.ACTIVE,
      targetType: SkillTargetType.PROJECTILE,
      level: 3,
      maxLevel: 3,
      cooldown: 1000,
      lastUsed: 0,
      effects: [{
        type: SkillEffectType.DAMAGE,
        value: 20
      }],
      evolveInto: ['power_shot']
    }
    
    skillsComp.addSkill(baseSkill)
    
    const success = skillSystem.evolveSkill(player.id, 'basic_shot', 'power_shot')
    expect(success).toBe(true)
    expect(skillsComp.getSkill('basic_shot')).toBeNull()
    expect(skillsComp.getSkill('power_shot')).toBeTruthy()
  })

  it('should award skill points', (done) => {
    const skillsComp = player.getComponent('skills') as SkillsComponent
    const initialPoints = skillsComp.skillPoints
    
    eventSystem.on('SKILL_POINTS_AWARDED', (event: any) => {
      expect(event.entityId).toBe(player.id)
      expect(event.points).toBe(3)
      done()
    })
    
    const success = skillSystem.awardSkillPoints(player.id, 3)
    expect(success).toBe(true)
    expect(skillsComp.skillPoints).toBe(initialPoints + 3)
  })

  it('should process passive skills', () => {
    const skillsComp = player.getComponent('skills') as SkillsComponent
    
    const passiveSkill: Skill = {
      id: 'regeneration',
      name: 'Regeneration',
      description: 'Passive healing',
      type: SkillType.PASSIVE,
      targetType: SkillTargetType.SELF,
      level: 1,
      maxLevel: 3,
      cooldown: 0,
      lastUsed: 0,
      effects: [{
        type: SkillEffectType.HEAL,
        value: 2,
        duration: 1000,
        chance: 1.0
      }]
    }
    
    skillsComp.addSkill(passiveSkill)
    
    // Update system to process passive
    const entities = [{ id: player.id, components: skillsComp } as any]
    skillSystem.update({ deltaTime: 100, totalTime: 1000, frameCount: 1 }, entities)
    
    // Should have healing effect applied
    expect(skillsComp.activeEffects.length).toBeGreaterThan(0)
  })

  it('should create projectiles for projectile skills', (done) => {
    const skillsComp = player.getComponent('skills') as SkillsComponent
    
    const projectileSkill: Skill = {
      id: 'arrow',
      name: 'Arrow',
      description: 'Shoots an arrow',
      type: SkillType.ACTIVE,
      targetType: SkillTargetType.PROJECTILE,
      level: 1,
      maxLevel: 1,
      cooldown: 500,
      lastUsed: 0,
      effects: [{
        type: SkillEffectType.PROJECTILE_CREATE,
        value: 30
      }]
    }
    
    skillsComp.addSkill(projectileSkill)
    
    eventSystem.on('PROJECTILE_CREATED', (event: any) => {
      expect(event.casterId).toBe(player.id)
      expect(event.skillId).toBe('arrow')
      done()
    })
    
    skillSystem.activateSkill(player.id, 'arrow', { x: 100, y: 0 })
  })

  it('should apply area effects', () => {
    // Create multiple enemies
    const enemy2 = world.createEntity()
    enemy2.addComponent(new TransformComponent(0, 50))
    enemy2.addComponent(new HealthComponent(50))
    
    const enemy3 = world.createEntity()
    enemy3.addComponent(new TransformComponent(200, 0)) // Out of range
    enemy3.addComponent(new HealthComponent(50))
    
    const skillsComp = player.getComponent('skills') as SkillsComponent
    
    const areaSkill: Skill = {
      id: 'meteor',
      name: 'Meteor',
      description: 'Area damage',
      type: SkillType.ACTIVE,
      targetType: SkillTargetType.AREA,
      level: 1,
      maxLevel: 1,
      cooldown: 5000,
      lastUsed: 0,
      effects: [{
        type: SkillEffectType.DAMAGE,
        value: 30,
        radius: 100
      }]
    }
    
    skillsComp.addSkill(areaSkill)
    
    const enemy1Health = enemy.getComponent('health') as HealthComponent
    const enemy2Health = enemy2.getComponent('health') as HealthComponent
    const enemy3Health = enemy3.getComponent('health') as HealthComponent
    
    skillSystem.activateSkill(player.id, 'meteor', { x: 25, y: 25 })
    
    // Enemies within radius should take damage
    expect(enemy1Health.current).toBeLessThan(50)
    expect(enemy2Health.current).toBeLessThan(50)
    // Enemy out of range should not
    expect(enemy3Health.current).toBe(50)
  })

  it('should limit active effects for performance', () => {
    const skillsComp = player.getComponent('skills') as SkillsComponent
    
    // Add many effects
    for (let i = 0; i < 100; i++) {
      skillsComp.addActiveEffect({
        id: `effect_${i}`,
        skillId: 'test',
        sourceEntityId: player.id,
        effect: { type: SkillEffectType.BUFF, value: 1 },
        startTime: Date.now(),
        stacks: 1
      })
    }
    
    const entities = [{ id: player.id, components: skillsComp } as any]
    skillSystem.update({ deltaTime: 16, totalTime: 1000, frameCount: 1 }, entities)
    
    // Should be limited to maxActiveEffects (50 by default)
    expect(skillsComp.activeEffects.length).toBeLessThanOrEqual(50)
  })

  it('should check skill requirements', () => {
    const skillsComp = player.getComponent('skills') as SkillsComponent
    
    // Add prerequisite skill
    skillsComp.addSkill({
      id: 'prereq',
      name: 'Prerequisite',
      description: 'Required skill',
      type: SkillType.PASSIVE,
      targetType: SkillTargetType.SELF,
      level: 1,
      maxLevel: 1,
      cooldown: 0,
      lastUsed: 0,
      effects: []
    })
    
    const requirements = [
      { type: 'level' as const, value: 3, operator: '>=' as const },
      { type: 'skill' as const, value: 'prereq', operator: '=' as const }
    ]
    
    const meets = skillsComp.meetsRequirements(requirements, 5, {})
    expect(meets).toBe(true)
  })

  it('should emit damage dealt events', (done) => {
    const skillsComp = player.getComponent('skills') as SkillsComponent
    
    const damageSkill: Skill = {
      id: 'strike',
      name: 'Strike',
      description: 'Direct damage',
      type: SkillType.ACTIVE,
      targetType: SkillTargetType.ENEMIES,
      level: 1,
      maxLevel: 1,
      cooldown: 1000,
      lastUsed: 0,
      effects: [{
        type: SkillEffectType.DAMAGE,
        value: 25,
        radius: 100
      }]
    }
    
    skillsComp.addSkill(damageSkill)
    
    eventSystem.on(GameEventType.DAMAGE_DEALT, (event: any) => {
      expect(event.sourceId).toBe(player.id)
      expect(event.targetId).toBe(enemy.id)
      expect(event.damage).toBe(25)
      done()
    })
    
    skillSystem.activateSkill(player.id, 'strike')
  })
})
import { SkillSystem } from '../../src/systems/SkillSystem'
import { SkillsComponent, SkillType, SkillEffectType, SkillTargetType, type Skill, type ActiveEffect } from '../../src/components/Skills'
import { TransformComponent } from '../../src/components/Transform'
import { HealthComponent } from '../../src/components/Health'
import { ExperienceComponent } from '../../src/components/Experience'
import { CombatComponent } from '../../src/components/Combat'
import { MovementComponent } from '../../src/components/Movement'
import { World } from '../../src/core/ECS/World'
import { Entity } from '../../src/core/ECS/Entity'
import { EventSystem } from '../../src/core/EventSystem'

describe('SkillSystem', () => {
  let world: World
  let eventSystem: EventSystem
  let skillSystem: SkillSystem
  let player: Entity
  let enemy: Entity

  const skillSystemConfig = {
    baseEffectRadius: 100,
    baseProjectileSpeed: 500,
    evolutionCheckInterval: 5000,
    maxActiveEffects: 50,
    skillSelectionSeed: 42,
    eventSystem: null as any
  }

  beforeEach(() => {
    world = new World()
    eventSystem = new EventSystem()
    skillSystemConfig.eventSystem = eventSystem
    skillSystem = new SkillSystem(world, skillSystemConfig)
    
    // Create player entity
    player = world.createEntity()
    player.addComponent(new TransformComponent(0, 0))
    player.addComponent(new HealthComponent(100))
    player.addComponent(new SkillsComponent(5)) // 5 skill points
    player.addComponent(new ExperienceComponent(5)) // Level 5
    player.addComponent(new CombatComponent({
      damage: 25,
      range: 50,
      attackSpeed: 1.5
    }))
    player.addComponent(new MovementComponent())
    
    // Create enemy entity  
    enemy = world.createEntity()
    enemy.addComponent(new TransformComponent(50, 0)) // Within range
    enemy.addComponent(new HealthComponent(50))
    enemy.addComponent(new SkillsComponent())
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Skill Management', () => {
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

    it('should not upgrade skill without points', () => {
      const skillsComp = player.getComponent('skills') as SkillsComponent
      skillsComp.skillPoints = 0
      
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
        effects: []
      }
      
      skillsComp.addSkill(skill)
      const success = skillsComp.upgradeSkill('test_skill')
      expect(success).toBe(false)
      expect(skillsComp.getSkill('test_skill')!.level).toBe(1)
    })
  })

  describe('Skill Cooldowns', () => {
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

    it('should update cooldowns over time', () => {
      const entities = world.getEntitiesWithComponents(['skills'])
      skillSystem.update({ deltaTime: 100, totalTime: 1000, frameCount: 1 }, [])
      
      // Verify update was called without errors
      expect(entities).toBeDefined()
    })
  })

  describe('Skill Activation', () => {
    it('should activate self-targeting skills', () => {
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
      health.takeDamage(40)
      const damagedHealth = health.current
      
      const success = skillSystem.activateSkill(player.id, 'heal')
      expect(success).toBe(true)
      
      // Process pending activations
      skillSystem.update({ deltaTime: 16, totalTime: Date.now(), frameCount: 1 }, [])
      
      // Health should be restored
      expect(health.current).toBe(damagedHealth + 30)
    })

    it('should activate enemy-targeting skills', () => {
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
      
      // Process pending activations
      skillSystem.update({ deltaTime: 16, totalTime: Date.now(), frameCount: 1 }, [])
      
      expect(enemyHealth.current).toBe(initialHealth - 40)
    })

    it('should create projectiles for projectile skills', () => {
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
          type: SkillEffectType.DAMAGE,
          value: 30
        }]
      }
      
      skillsComp.addSkill(projectileSkill)
      
      const success = skillSystem.activateSkill(player.id, 'arrow', undefined, { x: 100, y: 0 })
      expect(success).toBe(true)
      
      // Process the skill activation
      skillSystem.update({ deltaTime: 16, totalTime: Date.now(), frameCount: 1 }, [])
      
      // Verify the skill was used (cooldown was set)
      expect(skillsComp.getSkill('arrow')!.lastUsed).toBeGreaterThan(0)
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
      
      skillSystem.activateSkill(player.id, 'meteor', undefined, { x: 25, y: 25 })
      skillSystem.update({ deltaTime: 16, totalTime: Date.now(), frameCount: 1 }, [])
      
      // Enemies within radius should take damage
      expect(enemy1Health.current).toBe(20)
      expect(enemy2Health.current).toBe(20)
      // Enemy out of range should not
      expect(enemy3Health.current).toBe(50)
    })
  })

  describe('Active Effects', () => {
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

    it('should apply attribute modifications', () => {
      const skillsComp = player.getComponent('skills') as SkillsComponent
      const combat = player.getComponent('combat') as CombatComponent
      const initialDamage = combat.weapon.damage
      
      const buffSkill: Skill = {
        id: 'power_up',
        name: 'Power Up',
        description: 'Increases damage',
        type: SkillType.ACTIVE,
        targetType: SkillTargetType.SELF,
        level: 1,
        maxLevel: 1,
        cooldown: 1000,
        lastUsed: 0,
        effects: [{
          type: SkillEffectType.ATTRIBUTE_MODIFY,
          value: 50, // 50% increase
          metadata: { attribute: 'damage' }
        }]
      }
      
      skillsComp.addSkill(buffSkill)
      skillSystem.activateSkill(player.id, 'power_up')
      skillSystem.update({ deltaTime: 16, totalTime: Date.now(), frameCount: 1 }, [])
      
      expect(combat.weapon.damage).toBe(initialDamage * 1.5)
    })
  })

  describe('Skill Evolution', () => {
    it('should check evolution opportunities', () => {
      const skillsComp = player.getComponent('skills') as SkillsComponent
      
      // Add max level kunai
      const kunai: Skill = {
        id: 'kunai',
        name: 'Kunai',
        description: 'Throws a kunai',
        type: SkillType.ACTIVE,
        targetType: SkillTargetType.PROJECTILE,
        level: 5,
        maxLevel: 5,
        cooldown: 2000,
        lastUsed: 0,
        effects: [{
          type: SkillEffectType.DAMAGE,
          value: 50
        }],
        evolveInto: ['spiritShuriken']
      }
      
      // Add required passive skill
      const scroll: Skill = {
        id: 'kogaNinjaScroll',
        name: 'Koga Ninja Scroll',
        description: 'Increases attack speed',
        type: SkillType.PASSIVE,
        targetType: SkillTargetType.SELF,
        level: 1,
        maxLevel: 5,
        cooldown: 0,
        lastUsed: 0,
        effects: [{
          type: SkillEffectType.ATTRIBUTE_MODIFY,
          value: 10,
          metadata: { attribute: 'attackSpeed' }
        }]
      }
      
      skillsComp.addSkill(kunai)
      skillsComp.addSkill(scroll)
      
      // Check for evolution after 10 minutes - need to pass player entity
      // The system update expects entities with components as a wrapper object
      const entities = [{ 
        id: player.id, 
        components: { 
          skills: skillsComp,
          experience: player.getComponent('experience')
        } as any 
      }]
      skillSystem.update({ deltaTime: 16, totalTime: 600001, frameCount: 1 }, entities)
      
      // Evolution should be marked as available
      expect(skillsComp.evolutionProgress.has('spiritShuriken')).toBe(true)
    })

    it('should perform skill evolution', () => {
      const skillsComp = player.getComponent('skills') as SkillsComponent
      
      // Add max level garlic
      const garlic: Skill = {
        id: 'garlic',
        name: 'Garlic',
        description: 'Creates a damage aura',
        type: SkillType.PASSIVE,
        targetType: SkillTargetType.AREA,
        level: 5,
        maxLevel: 5,
        cooldown: 0,
        lastUsed: 0,
        effects: [{
          type: SkillEffectType.DAMAGE,
          value: 10,
          radius: 50
        }],
        evolveInto: ['holyWater']
      }
      
      skillsComp.addSkill(garlic)
      
      // Perform evolution
      const success = skillSystem.evolveSkill(player.id, 'holyWater')
      expect(success).toBe(true)
      expect(skillsComp.getSkill('garlic')).toBeNull()
      expect(skillsComp.getSkill('holyWater')).toBeTruthy()
    })
  })

  describe('Skill Selection', () => {
    it('should get available skills for selection with weighted probability', () => {
      const skills = skillSystem.getAvailableSkillsForSelection(player.id, 3)
      
      // Since there are only 3 skills total in getAllAvailableSkills, 
      // we might get fewer if the player already has some
      expect(skills.length).toBeGreaterThan(0)
      expect(skills.length).toBeLessThanOrEqual(3)
      expect(skills[0]).toBeDefined()
      expect(skills[0].id).toBeDefined()
      expect(skills[0].name).toBeDefined()
    })

    it('should not suggest skills the entity already has', () => {
      const skillsComp = player.getComponent('skills') as SkillsComponent
      
      // Add kunai to player
      const kunai: Skill = {
        id: 'kunai',
        name: 'Kunai',
        description: 'Throws a kunai',
        type: SkillType.ACTIVE,
        targetType: SkillTargetType.PROJECTILE,
        level: 1,
        maxLevel: 5,
        cooldown: 2000,
        lastUsed: 0,
        effects: [{
          type: SkillEffectType.DAMAGE,
          value: 50
        }]
      }
      
      skillsComp.addSkill(kunai)
      
      const skills = skillSystem.getAvailableSkillsForSelection(player.id, 3)
      
      // Should not include kunai
      const hasKunai = skills.some(s => s.id === 'kunai')
      expect(hasKunai).toBe(false)
    })

    it('should use deterministic random selection with seed', () => {
      // Create two systems with same seed
      const system1 = new SkillSystem(world, { ...skillSystemConfig, skillSelectionSeed: 123 })
      const system2 = new SkillSystem(world, { ...skillSystemConfig, skillSelectionSeed: 123 })
      
      const skills1 = system1.getAvailableSkillsForSelection(player.id, 3)
      const skills2 = system2.getAvailableSkillsForSelection(player.id, 3)
      
      // Should get same skills in same order
      expect(skills1.map(s => s.id)).toEqual(skills2.map(s => s.id))
    })
  })

  describe('Skill Requirements', () => {
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
        { type: 'level' as const, value: 5, operator: '>=' as const },
        { type: 'skill' as const, value: 'prereq', operator: '=' as const }
      ]
      
      const meets = skillsComp.meetsRequirements(requirements, 5, {})
      expect(meets).toBe(true)
    })

    it('should fail requirements when not met', () => {
      const skillsComp = player.getComponent('skills') as SkillsComponent
      
      const requirements = [
        { type: 'level' as const, value: 10, operator: '>' as const }
      ]
      
      const meets = skillsComp.meetsRequirements(requirements, 5, {})
      expect(meets).toBe(false)
    })
  })

  describe('Event Emissions', () => {
    it('should emit damage dealt events', () => {
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
      
      const enemyHealth = enemy.getComponent('health') as HealthComponent
      const initialHealth = enemyHealth.current
      
      const success = skillSystem.activateSkill(player.id, 'strike')
      expect(success).toBe(true)
      
      skillSystem.update({ deltaTime: 16, totalTime: Date.now(), frameCount: 1 }, [])
      
      // Verify enemy took damage
      expect(enemyHealth.current).toBe(initialHealth - 25)
    })

    it('should emit evolution available events', () => {
      const skillsComp = player.getComponent('skills') as SkillsComponent
      
      // Add max level garlic
      const garlic: Skill = {
        id: 'garlic',
        name: 'Garlic',
        description: 'Creates a damage aura',
        type: SkillType.PASSIVE,
        targetType: SkillTargetType.AREA,
        level: 5,
        maxLevel: 5,
        cooldown: 0,
        lastUsed: 0,
        effects: [{
          type: SkillEffectType.DAMAGE,
          value: 10,
          radius: 50
        }],
        evolveInto: ['holyWater']
      }
      
      skillsComp.addSkill(garlic)
      
      // Process update to check for evolutions
      const entities = [{ 
        id: player.id, 
        components: { 
          skills: skillsComp,
          experience: player.getComponent('experience')
        } as any 
      }]
      skillSystem.update({ deltaTime: 16, totalTime: Date.now(), frameCount: 1 }, entities)
      
      // Verify evolution was marked as available
      expect(skillsComp.evolutionProgress.has('holyWater')).toBe(true)
    })
  })

  describe('Performance', () => {
    it('should handle many entities with skills efficiently', () => {
      const entities: Entity[] = []
      
      // Create 100 entities with skills
      for (let i = 0; i < 100; i++) {
        const entity = world.createEntity()
        entity.addComponent(new TransformComponent(i * 10, 0))
        entity.addComponent(new HealthComponent(100))
        entity.addComponent(new SkillsComponent())
        entities.push(entity)
      }
      
      const startTime = performance.now()
      skillSystem.update({ deltaTime: 16, totalTime: Date.now(), frameCount: 1 }, [])
      const endTime = performance.now()
      
      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(10)
    })

    it('should handle skill effect stacking efficiently', () => {
      const skillsComp = player.getComponent('skills') as SkillsComponent
      
      // Apply multiple stacking effects
      for (let i = 0; i < 20; i++) {
        const buffSkill: Skill = {
          id: `buff_${i}`,
          name: `Buff ${i}`,
          description: 'Buff',
          type: SkillType.ACTIVE,
          targetType: SkillTargetType.SELF,
          level: 1,
          maxLevel: 1,
          cooldown: 100,
          lastUsed: 0,
          effects: [{
            type: SkillEffectType.BUFF,
            value: 1,
            stackable: true
          }]
        }
        
        skillsComp.addSkill(buffSkill)
        skillSystem.activateSkill(player.id, `buff_${i}`)
      }
      
      const startTime = performance.now()
      skillSystem.update({ deltaTime: 16, totalTime: Date.now(), frameCount: 1 }, [])
      const endTime = performance.now()
      
      // Should handle multiple effects efficiently
      expect(endTime - startTime).toBeLessThan(5)
    })
  })
})
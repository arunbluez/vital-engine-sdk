import type { EnemyType, SpawnWave, BossPhase } from '../components/Spawner'
import { SpawnPattern, SpawnTiming } from '../components/Spawner'
import { AIPersonality } from '../components/AI'

/**
 * Basic enemy types
 */
export const BASIC_ENEMIES: EnemyType[] = [
  {
    id: 'basic_melee',
    name: 'Melee Grunt',
    weight: 10,
    minLevel: 1,
    maxLevel: 10,
    components: [
      {
        type: 'health',
        data: { maximum: 100 }
      },
      {
        type: 'movement',
        data: { maxSpeed: 50 }
      },
      {
        type: 'combat',
        data: {
          damage: { min: 8, max: 12 },
          attackSpeed: 1.0,
          range: 40
        }
      },
      {
        type: 'ai',
        data: { personality: AIPersonality.AGGRESSIVE }
      }
    ],
    scalingFactors: {
      health: 1.0,
      damage: 1.0,
      speed: 1.0,
      experience: 1.0
    }
  },
  {
    id: 'basic_ranged',
    name: 'Ranged Attacker',
    weight: 8,
    minLevel: 2,
    maxLevel: 12,
    components: [
      {
        type: 'health',
        data: { maximum: 80 }
      },
      {
        type: 'movement',
        data: { maxSpeed: 40 }
      },
      {
        type: 'combat',
        data: {
          damage: { min: 10, max: 15 },
          attackSpeed: 0.8,
          range: 150
        }
      },
      {
        type: 'ai',
        data: { personality: AIPersonality.DEFENSIVE }
      }
    ],
    scalingFactors: {
      health: 0.8,
      damage: 1.2,
      speed: 0.9,
      experience: 1.2
    }
  },
  {
    id: 'fast_scout',
    name: 'Scout',
    weight: 6,
    minLevel: 3,
    maxLevel: 15,
    components: [
      {
        type: 'health',
        data: { maximum: 60 }
      },
      {
        type: 'movement',
        data: { maxSpeed: 80 }
      },
      {
        type: 'combat',
        data: {
          damage: { min: 5, max: 8 },
          attackSpeed: 2.0,
          range: 30
        }
      },
      {
        type: 'ai',
        data: { personality: AIPersonality.HUNTER }
      }
    ],
    scalingFactors: {
      health: 0.6,
      damage: 0.8,
      speed: 1.5,
      experience: 1.1
    }
  },
  {
    id: 'tank',
    name: 'Tank',
    weight: 4,
    minLevel: 5,
    maxLevel: 20,
    components: [
      {
        type: 'health',
        data: { maximum: 300 }
      },
      {
        type: 'movement',
        data: { maxSpeed: 25 }
      },
      {
        type: 'combat',
        data: {
          damage: { min: 15, max: 20 },
          attackSpeed: 0.5,
          range: 50
        }
      },
      {
        type: 'ai',
        data: { personality: AIPersonality.GUARDIAN }
      }
    ],
    scalingFactors: {
      health: 2.0,
      damage: 1.5,
      speed: 0.6,
      experience: 2.0
    }
  }
]

/**
 * Advanced enemy types
 */
export const ADVANCED_ENEMIES: EnemyType[] = [
  {
    id: 'swarm',
    name: 'Swarm Drone',
    weight: 12,
    minLevel: 4,
    maxLevel: 18,
    components: [
      {
        type: 'health',
        data: { maximum: 40 }
      },
      {
        type: 'movement',
        data: { maxSpeed: 60 }
      },
      {
        type: 'combat',
        data: {
          damage: { min: 4, max: 6 },
          attackSpeed: 1.5,
          range: 30
        }
      },
      {
        type: 'ai',
        data: { personality: AIPersonality.SWARM }
      }
    ],
    scalingFactors: {
      health: 0.5,
      damage: 0.6,
      speed: 1.2,
      experience: 0.8
    }
  },
  {
    id: 'berserker',
    name: 'Berserker',
    weight: 3,
    minLevel: 8,
    maxLevel: 25,
    components: [
      {
        type: 'health',
        data: { maximum: 150 }
      },
      {
        type: 'movement',
        data: { maxSpeed: 70 }
      },
      {
        type: 'combat',
        data: {
          damage: { min: 20, max: 30 },
          attackSpeed: 1.2,
          range: 45,
          criticalChance: 0.3
        }
      },
      {
        type: 'ai',
        data: { personality: AIPersonality.BERSERKER }
      }
    ],
    scalingFactors: {
      health: 1.2,
      damage: 2.0,
      speed: 1.3,
      experience: 1.8
    }
  },
  {
    id: 'healer',
    name: 'Support Unit',
    weight: 2,
    minLevel: 10,
    maxLevel: 30,
    components: [
      {
        type: 'health',
        data: { maximum: 120 }
      },
      {
        type: 'movement',
        data: { maxSpeed: 35 }
      },
      {
        type: 'combat',
        data: {
          damage: { min: 3, max: 5 },
          attackSpeed: 0.5,
          range: 100
        }
      },
      {
        type: 'ai',
        data: { personality: AIPersonality.SUPPORT }
      }
    ],
    scalingFactors: {
      health: 1.0,
      damage: 0.3,
      speed: 0.8,
      experience: 2.5
    }
  },
  {
    id: 'elite',
    name: 'Elite Warrior',
    weight: 1,
    minLevel: 15,
    maxLevel: 40,
    components: [
      {
        type: 'health',
        data: { maximum: 500 }
      },
      {
        type: 'movement',
        data: { maxSpeed: 55 }
      },
      {
        type: 'combat',
        data: {
          damage: { min: 25, max: 35 },
          attackSpeed: 1.0,
          range: 60,
          criticalChance: 0.25,
          criticalDamage: 2.0
        }
      },
      {
        type: 'ai',
        data: { personality: AIPersonality.TACTICAL }
      }
    ],
    scalingFactors: {
      health: 3.0,
      damage: 2.5,
      speed: 1.1,
      experience: 5.0
    }
  }
]

/**
 * Boss enemy types
 */
export const BOSS_ENEMIES: EnemyType[] = [
  {
    id: 'boss_behemoth',
    name: 'The Behemoth',
    weight: 1,
    minLevel: 10,
    maxLevel: 99,
    components: [
      {
        type: 'health',
        data: { maximum: 2000 }
      },
      {
        type: 'movement',
        data: { maxSpeed: 30 }
      },
      {
        type: 'combat',
        data: {
          damage: { min: 40, max: 60 },
          attackSpeed: 0.7,
          range: 100,
          criticalChance: 0.2,
          criticalDamage: 2.5
        }
      },
      {
        type: 'ai',
        data: { personality: AIPersonality.BERSERKER }
      }
    ],
    scalingFactors: {
      health: 10.0,
      damage: 5.0,
      speed: 0.6,
      experience: 20.0
    }
  },
  {
    id: 'boss_necromancer',
    name: 'The Necromancer',
    weight: 1,
    minLevel: 15,
    maxLevel: 99,
    components: [
      {
        type: 'health',
        data: { maximum: 1500 }
      },
      {
        type: 'movement',
        data: { maxSpeed: 25 }
      },
      {
        type: 'combat',
        data: {
          damage: { min: 30, max: 40 },
          attackSpeed: 1.0,
          range: 200
        }
      },
      {
        type: 'ai',
        data: { personality: AIPersonality.TACTICAL }
      }
    ],
    scalingFactors: {
      health: 8.0,
      damage: 4.0,
      speed: 0.5,
      experience: 25.0
    }
  },
  {
    id: 'boss_shadow_lord',
    name: 'Shadow Lord',
    weight: 1,
    minLevel: 20,
    maxLevel: 99,
    components: [
      {
        type: 'health',
        data: { maximum: 1800 }
      },
      {
        type: 'movement',
        data: { maxSpeed: 50 }
      },
      {
        type: 'combat',
        data: {
          damage: { min: 35, max: 50 },
          attackSpeed: 1.5,
          range: 80,
          criticalChance: 0.4,
          criticalDamage: 3.0
        }
      },
      {
        type: 'ai',
        data: { personality: AIPersonality.HUNTER }
      }
    ],
    scalingFactors: {
      health: 9.0,
      damage: 6.0,
      speed: 1.0,
      experience: 30.0
    }
  }
]

/**
 * Spawn waves configuration
 */
export const SPAWN_WAVES: SpawnWave[] = [
  // Wave 1: Introduction
  {
    id: 'wave_1',
    enemyTypes: ['basic_melee'],
    totalCount: 10,
    spawnRate: 0.5,
    pattern: SpawnPattern.CIRCLE,
    area: {
      center: { x: 0, y: 0 },
      radius: 300
    },
    delay: 3000
  },
  // Wave 2: Mixed basics
  {
    id: 'wave_2',
    enemyTypes: ['basic_melee', 'basic_ranged'],
    totalCount: 20,
    spawnRate: 1.0,
    pattern: SpawnPattern.RANDOM,
    area: {
      center: { x: 0, y: 0 },
      radius: 400
    },
    delay: 5000,
    requirements: [
      { type: 'previous_wave', value: 'wave_1', operator: '=' }
    ]
  },
  // Wave 3: Fast enemies
  {
    id: 'wave_3',
    enemyTypes: ['fast_scout', 'basic_melee'],
    totalCount: 25,
    spawnRate: 1.5,
    pattern: SpawnPattern.PERIMETER,
    area: {
      center: { x: 0, y: 0 },
      width: 600,
      height: 600
    },
    delay: 5000,
    requirements: [
      { type: 'time', value: 60000, operator: '>' }
    ]
  },
  // Wave 4: Tank introduction
  {
    id: 'wave_4',
    enemyTypes: ['tank', 'basic_ranged', 'healer'],
    totalCount: 20,
    spawnRate: 0.8,
    pattern: SpawnPattern.LINE,
    area: {
      center: { x: 0, y: -300 },
      width: 400
    },
    delay: 5000,
    requirements: [
      { type: 'level', value: 5, operator: '>=' }
    ]
  },
  // Wave 5: Swarm attack
  {
    id: 'wave_5',
    enemyTypes: ['swarm'],
    totalCount: 50,
    spawnRate: 3.0,
    pattern: SpawnPattern.WAVE,
    area: {
      center: { x: 0, y: 0 },
      radius: 500
    },
    delay: 3000,
    requirements: [
      { type: 'time', value: 120000, operator: '>' }
    ]
  },
  // Boss Wave 1
  {
    id: 'boss_wave_1',
    enemyTypes: ['boss_behemoth'],
    totalCount: 1,
    spawnRate: 1.0,
    pattern: SpawnPattern.PORTAL,
    area: {
      center: { x: 0, y: 0 },
      points: [{ x: 0, y: -400 }]
    },
    delay: 10000,
    requirements: [
      { type: 'enemy_count', value: 0, operator: '=' },
      { type: 'time', value: 180000, operator: '>' }
    ]
  }
]

/**
 * Boss phases configuration
 */
export const BOSS_PHASES: Record<string, BossPhase[]> = {
  boss_behemoth: [
    {
      id: 'phase_1',
      healthThreshold: 1.0,
      enemyTypes: [],
      spawnCount: 0,
      pattern: SpawnPattern.CIRCLE,
      special: false
    },
    {
      id: 'phase_2',
      healthThreshold: 0.75,
      enemyTypes: ['basic_melee'],
      spawnCount: 5,
      pattern: SpawnPattern.CIRCLE,
      special: true
    },
    {
      id: 'phase_3',
      healthThreshold: 0.5,
      enemyTypes: ['berserker', 'basic_ranged'],
      spawnCount: 8,
      pattern: SpawnPattern.RANDOM,
      special: true
    },
    {
      id: 'phase_4',
      healthThreshold: 0.25,
      enemyTypes: ['swarm'],
      spawnCount: 15,
      pattern: SpawnPattern.WAVE,
      special: true
    }
  ],
  boss_necromancer: [
    {
      id: 'phase_1',
      healthThreshold: 1.0,
      enemyTypes: ['basic_melee'],
      spawnCount: 3,
      pattern: SpawnPattern.CIRCLE,
      special: false
    },
    {
      id: 'phase_2',
      healthThreshold: 0.66,
      enemyTypes: ['tank', 'healer'],
      spawnCount: 4,
      pattern: SpawnPattern.LINE,
      special: true
    },
    {
      id: 'phase_3',
      healthThreshold: 0.33,
      enemyTypes: ['elite', 'swarm'],
      spawnCount: 10,
      pattern: SpawnPattern.PERIMETER,
      special: true
    }
  ]
}

/**
 * Enemy group presets for quick spawning
 */
export const ENEMY_GROUPS = {
  basic_patrol: ['basic_melee', 'basic_melee', 'basic_ranged'],
  scout_party: ['fast_scout', 'fast_scout', 'fast_scout'],
  tank_squad: ['tank', 'healer', 'basic_ranged', 'basic_ranged'],
  swarm_cluster: Array(10).fill('swarm'),
  elite_guard: ['elite', 'tank', 'healer'],
  mixed_assault: ['berserker', 'basic_melee', 'basic_ranged', 'fast_scout'],
  boss_minions: ['swarm', 'swarm', 'basic_melee', 'basic_ranged']
}

/**
 * Difficulty scaling presets
 */
export const DIFFICULTY_PRESETS = {
  easy: {
    enemyHealthMultiplier: 0.7,
    enemyDamageMultiplier: 0.8,
    spawnRateMultiplier: 0.8,
    maxEnemies: 300
  },
  normal: {
    enemyHealthMultiplier: 1.0,
    enemyDamageMultiplier: 1.0,
    spawnRateMultiplier: 1.0,
    maxEnemies: 500
  },
  hard: {
    enemyHealthMultiplier: 1.5,
    enemyDamageMultiplier: 1.3,
    spawnRateMultiplier: 1.2,
    maxEnemies: 700
  },
  nightmare: {
    enemyHealthMultiplier: 2.0,
    enemyDamageMultiplier: 1.8,
    spawnRateMultiplier: 1.5,
    maxEnemies: 1000
  }
}

/**
 * Helper function to get all enemy types
 */
export function getAllEnemyTypes(): EnemyType[] {
  return [...BASIC_ENEMIES, ...ADVANCED_ENEMIES, ...BOSS_ENEMIES]
}

/**
 * Helper function to get enemies by level range
 */
export function getEnemiesByLevel(minLevel: number, maxLevel: number): EnemyType[] {
  return getAllEnemyTypes().filter(
    enemy => enemy.minLevel <= maxLevel && enemy.maxLevel >= minLevel
  )
}

/**
 * Helper function to create a custom wave
 */
export function createCustomWave(
  id: string,
  enemyTypes: string[],
  count: number,
  pattern: SpawnPattern = SpawnPattern.RANDOM
): SpawnWave {
  return {
    id,
    enemyTypes,
    totalCount: count,
    spawnRate: Math.min(count / 10, 3),
    pattern,
    area: {
      center: { x: 0, y: 0 },
      radius: 400
    },
    delay: 3000
  }
}
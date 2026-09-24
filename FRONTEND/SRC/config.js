// frontend/src/config.js
// Configuración centralizada y editable de Neon Siege

export const CONFIG = {
  // Configuración del Servidor y API
  API: {
    BASE_URL: 'http://localhost:4000/api'
  },

// Dimensiones y Físicas de la Arena
  ARENA: {
    WIDTH: 2400,
    HEIGHT: 1800,
    GRID_CELL_SIZE: 120, // Resolución del Spatial Hash Grid
    SHOW_DEBUG_GRID: false, // <-- En false para gráficos inmersivos limpios
    OBSTACLES: [
      { x: 450, y: 450, w: 150, h: 150 },
      { x: 1800, y: 450, w: 150, h: 150 },
      { x: 1100, y: 820, w: 200, h: 160 },
      { x: 500, y: 1250, w: 160, h: 160 },
      { x: 1750, y: 1250, w: 160, h: 160 }
    ]
  },

  // Estadísticas del Jugador
  PLAYER: {
    RADIUS: 20,
    SPEED: 280,              // px/s
    MAX_HP: 100,
    MAX_ENERGY: 100,
    ENERGY_REGEN: 22,        // por segundo
    DASH_COST: 35,
    DASH_SPEED_MULT: 3.2,
    DASH_DURATION: 0.18,     // segundos
    INVULNERABLE_TIME: 0.8,  // tras recibir impacto
    BASE_MAGNET_RADIUS: 140
  },

  // Arsenal de Armas
  // Arsenal de Armas con Munición
  // En frontend/src/config.js dentro de WEAPONS:
  WEAPONS: {
    PISTOL: {
      name: "Pistola Rápida",
      cadence: 0.14,
      damage: 18,
      bulletSpeed: 900,
      spread: 0.04,
      range: 850,
      energyCost: 0,
      pellets: 1,
      penetration: 1,
      color: "#00f0ff",
      maxAmmo: Infinity,
      startAmmo: Infinity,
      ammoType: null // Infinita
    },
    SHOTGUN: {
      name: "Escopeta de Choque",
      cadence: 0.65,
      damage: 14,
      bulletSpeed: 750,
      spread: 0.28,
      range: 520,
      energyCost: 15,
      pellets: 6,
      penetration: 1,
      color: "#ff0077",
      maxAmmo: 48,
      startAmmo: 24,
      ammoPerPickup: 16,
      ammoType: "ammo_shotgun"
    },
    ENERGY_BEAM: {
      name: "Fusil de Plasma",
      cadence: 0.38,
      damage: 42,
      bulletSpeed: 1100,
      spread: 0.01,
      range: 1200,
      energyCost: 20,
      pellets: 1,
      penetration: 3,
      color: "#39ff14",
      maxAmmo: 30,
      startAmmo: 12,
      ammoPerPickup: 8,
      ammoType: "ammo_plasma"
    }
  },

  PICKUPS: {
    AMMO_SHOTGUN: {
      color: '#ff0077', // Rosa/Rojo Neón (identifica a la escopeta)
      label: 'SG'
    },
    AMMO_PLASMA: {
      color: '#39ff14', // Verde Plasma Neón
      label: 'PL'
    }
  },

  // Definición de Enemigos (5 tipos con FSM)
  ENEMIES: {
    HUNTER: {
      radius: 18, speed: 200, hp: 45, damage: 15, exp: 12,
      attackCooldown: 1.0, attackRange: 35, color: "#ff3333"
    },
    RANGER: {
      radius: 17, speed: 150, hp: 35, damage: 10, exp: 16,
      idealDist: 340, shootRange: 480, shootCooldown: 1.8,
      bulletSpeed: 380, retreatDist: 200, color: "#e6fb04"
    },
    SWARM: {
      radius: 11, speed: 240, hp: 16, damage: 7, exp: 6,
      separationDist: 28, cohesionWeight: 0.05, color: "#ff8800"
    },
    TANK: {
      radius: 34, speed: 85, hp: 280, damage: 32, exp: 50,
      chargeCooldown: 4.0, chargeSpeed: 280, chargeDuration: 1.0, color: "#8a2be2"
    },
    KAMIKAZE: {
      radius: 15, speed: 290, hp: 25, damage: 55, exp: 20,
      triggerDist: 60, explosionRadius: 110, primeTime: 0.6, color: "#ff0055"
    }
  },

  // Jefes (3 Fases)
  BOSSES: {
    GOLIATH: {
      name: "Goliath Prime (Mecha)",
      radius: 55, maxHp: 1800, exp: 350,
      fases: {
        F1: { speed: 80, shootCooldown: 2.2, burstCount: 8 },
        F2: { speed: 125, shootCooldown: 1.4, burstCount: 16, spawnSwarms: false },
        F3: { speed: 160, shootCooldown: 0.8, burstCount: 24, spawnSwarms: true, spawnFreq: 5.0 }
      }
    },
    TEMPEST: {
      name: "Tempest Matrix (Núcleo AI)",
      radius: 48, maxHp: 1400, exp: 400,
      fases: {
        F1: { speed: 130, laserCooldown: 3.5, teleportRate: 0 },
        F2: { speed: 180, laserCooldown: 2.2, teleportRate: 6.0 },
        F3: { speed: 220, laserCooldown: 1.2, teleportRate: 3.5, kamikazeSupport: true }
      }
    }
  },

  // Oleadas y Escalado
  WAVES: {
    INITIAL_SPAWN_INTERVAL: 2.5,
    MIN_SPAWN_INTERVAL: 0.35,
    ENEMIES_PER_WAVE_BASE: 12,
    ENEMIES_PER_WAVE_MULT: 1.35,
    BOSS_INTERVAL: 5,
    STAT_SCALING_PER_WAVE: {
      hp: 1.08,
      damage: 1.06,
      speed: 1.02
    }
  },

  // Puntuación y Combos
  SCORING: {
    KILL_BASE: 100,
    BOSS_BASE: 5000,
    COMBO_TIMEOUT: 2.2,
    COMBO_MULTIPLIER_STEP: 0.25,
    MAX_MULTIPLIER: 5.0
  },

  // Capacidad de Object Pools
  POOLS: {
    PLAYER_BULLETS: 400,
    ENEMY_BULLETS: 300,
    PARTICLES: 1200
  },

// Rutas y manifiesto de Assets
  // frontend/src/config.js (dentro de CONFIG)
  ASSETS: {
    USE_IMAGE_SPRITES: true,
    USE_AUDIO: true,
    SPRITES: {
      // Suelo y entorno
      tile_floor: './assets/tiles/floor_metal.png',
      tile_wall: './assets/tiles/wall_tech.png',
      obstacle_box: './assets/tiles/obstacle_box.png',

      // Spritesheets por cada arma (1536x1024 px: 6 columnas x 5 filas)
      player_pistol: {
        src: './assets/characters/player_pistol.png',
        frameW: 64,
        frameH: 64,
        animations: {
          idle:   { row: 0, frames: 4, speed: 0.18 },
          walk:   { row: 1, frames: 6, speed: 0.10 },
          attack: { row: 2, frames: 3, speed: 0.08 },
          hurt:   { row: 3, frames: 2, speed: 0.12 },
          die:    { row: 4, frames: 5, speed: 0.15 }
        }
      },
      player_shotgun: {
        src: './assets/characters/player_shotgun.png',
        frameW: 256,
        frameH: 204.8,
        animations: {
          idle:   { row: 0, frames: 4, speed: 0.18 },
          walk:   { row: 1, frames: 6, speed: 0.10 },
          attack: { row: 2, frames: 3, speed: 0.08 },
          hurt:   { row: 3, frames: 2, speed: 0.12 },
          die:    { row: 4, frames: 5, speed: 0.15 }
        }
      },
      player_energy_beam: {
        src: './assets/characters/player_plasma.png',
        frameW: 256,
        frameH: 204.8,
        animations: {
          idle:   { row: 0, frames: 4, speed: 0.18 },
          walk:   { row: 1, frames: 6, speed: 0.10 },
          attack: { row: 2, frames: 3, speed: 0.08 },
          hurt:   { row: 3, frames: 2, speed: 0.12 },
          die:    { row: 4, frames: 5, speed: 0.15 }
        }
      },

      // frontend/src/config.js (dentro de ASSETS.SPRITES)
      // Enemigos comunes (pueden ser hojas de 4 a 6 frames o PNG estático)
      enemy_hunter: {
        src: './assets/enemies/hunter.png',
        frameW: 64,
        frameH: 64,
        animations: {
          walk:   { row: 0, frames: 4, speed: 0.14 },
          attack: { row: 1, frames: 3, speed: 0.10 }
        }
      },
      enemy_ranger: {
        src: './assets/enemies/ranger.png',
        frameW: 64,
        frameH: 64,
        animations: {
          walk:   { row: 0, frames: 4, speed: 0.15 },
          attack: { row: 1, frames: 2, speed: 0.12 }
        }
      },
      enemy_swarm: {
        src: './assets/enemies/swarm.png',
        frameW: 48,
        frameH: 48,
        animations: {
          walk: { row: 0, frames: 4, speed: 0.08 }
        }
      },
      enemy_tank: {
        src: './assets/enemies/tank.png',
        frameW: 96,
        frameH: 96,
        animations: {
          walk:   { row: 0, frames: 4, speed: 0.20 },
          attack: { row: 1, frames: 3, speed: 0.12 }
        }
      },
      enemy_kamikaze: {
        src: './assets/enemies/kamikaze.png',
        frameW: 48,
        frameH: 48,
        animations: {
          walk: { row: 0, frames: 4, speed: 0.06 }
        }
      },

      // Jefe Final: Void Colossus (Estructura de alta resolución)
      boss_goliath: {
        src: './assets/bosses/void_colossus.png',
        frameW: 256,
        frameH: 204.8,
        animations: {
          idle:    { row: 0, frames: 4, speed: 0.20 },
          walk:    { row: 1, frames: 6, speed: 0.12 },
          attack:  { row: 2, frames: 4, speed: 0.10 },
          special: { row: 3, frames: 4, speed: 0.08 },
          die:     { row: 4, frames: 5, speed: 0.18 }
        }
      },
      boss_tempest: {
        src: './assets/bosses/void_tempest.png',
        frameW: 256,
        frameH: 204.8,
        animations: {
          idle:    { row: 0, frames: 4, speed: 0.20 },
          walk:    { row: 1, frames: 6, speed: 0.12 },
          attack:  { row: 2, frames: 4, speed: 0.10 },
          special: { row: 3, frames: 4, speed: 0.08 },
          die:     { row: 4, frames: 5, speed: 0.18 }
        }
      }
    },
         AUDIO: {
      // --- Música ---
      bgm_arena:          './assets/audio/bgm/arena_theme.mp3',

      // --- Jugador ---
      sfx_shoot:          './assets/audio/sfx/shoot.wav',
      sfx_dash:           './assets/audio/sfx/dash.wav',
      sfx_hit:            './assets/audio/sfx/hit.wav',
      sfx_pickup:         './assets/audio/sfx/pickup.wav',
      sfx_levelup:        './assets/audio/sfx/levelup.wav',
      sfx_wave_start:     './assets/audio/sfx/wave_start.wav',

      // --- Enemigos ---
      sfx_enemy_shoot:    './assets/audio/sfx/enemy_shoot.wav',
      sfx_enemy_attack:   './assets/audio/sfx/enemy_attack.wav',
      sfx_enemy_hit:      './assets/audio/sfx/enemy_hit.wav',
      sfx_enemy_explode:  './assets/audio/sfx/enemy_explode.wav',
      sfx_tank_charge:    './assets/audio/sfx/tank_charge.wav',
      sfx_kamikaze_beep:  './assets/audio/sfx/kamikaze_beep.wav',

      // --- Jefes ---
      sfx_boss_shoot:     './assets/audio/sfx/boss_shoot.wav',
      sfx_boss_summon:    './assets/audio/sfx/boss_summon.wav',
      sfx_boss_teleport:  './assets/audio/sfx/boss_teleport.wav',
      sfx_boss_explode:   './assets/audio/sfx/boss_explode.wav',

      // --- Genéricos ---
      sfx_boom:           './assets/audio/sfx/explosion.wav'
    }
  }
};
// frontend/src/systems/WaveManager.js
import { CONFIG } from '../config.js';
import { Enemy } from '../ENTITIES/Enemy.js';
import { Boss } from '../ENTITIES/Boss.js';

export class WaveManager {
  constructor(engine) {
    this.engine = engine;
    this.currentWave = 1;
    this.enemiesToSpawn = 0;
    this.spawnTimer = 0;
    this.spawnInterval = CONFIG.WAVES.INITIAL_SPAWN_INTERVAL;
    this.waveActive = false;
  }

  startWave(waveNumber) {
    this.currentWave = waveNumber;
    this.waveActive = true;
    this.enemiesToSpawn = Math.floor(
      CONFIG.WAVES.ENEMIES_PER_WAVE_BASE * Math.pow(CONFIG.WAVES.ENEMIES_PER_WAVE_MULT, waveNumber - 1)
    );
    this.spawnInterval = Math.max(
      CONFIG.WAVES.MIN_SPAWN_INTERVAL,
      CONFIG.WAVES.INITIAL_SPAWN_INTERVAL - waveNumber * 0.1
    );

    // ¿Ronda de Jefe? (Cada 5 oleadas)
    if (waveNumber % CONFIG.WAVES.BOSS_INTERVAL === 0) {
      const bossKind = (waveNumber / CONFIG.WAVES.BOSS_INTERVAL) % 2 === 1 ? 'GOLIATH' : 'TEMPEST';
      this.engine.currentBoss = new Boss(bossKind, waveNumber);
    }
  }

  getMultipliers() {
    const sc = CONFIG.WAVES.STAT_SCALING_PER_WAVE;
    return {
      hp: Math.pow(sc.hp, this.currentWave - 1),
      damage: Math.pow(sc.damage, this.currentWave - 1),
      speed: Math.pow(sc.speed, this.currentWave - 1)
    };
  }

  update(dt) {
    if (!this.waveActive) return;

    this.spawnTimer += dt;
    if (this.enemiesToSpawn > 0 && this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnEnemy();
      this.enemiesToSpawn--;
    } else if (
      this.enemiesToSpawn === 0 &&
      this.engine.enemies.length === 0 &&
      !this.engine.currentBoss
    ) {
      // Oleada completada -> pasar a la siguiente
      this.startWave(this.currentWave + 1);
    }
  }

  spawnEnemy() {
    const player = this.engine.player;
    let x, y, dist;

    // Generar fuera del campo visual inmediato del jugador
    do {
      x = Math.random() * (CONFIG.ARENA.WIDTH - 120) + 60;
      y = Math.random() * (CONFIG.ARENA.HEIGHT - 120) + 60;
      dist = Math.hypot(x - player.x, y - player.y);
    } while (dist < 480);

    // Desbloqueo progresivo de enemigos según oleada
    const types = ['HUNTER', 'SWARM'];
    if (this.currentWave >= 2) types.push('KAMIKAZE');
    if (this.currentWave >= 3) types.push('RANGER');
    if (this.currentWave >= 4) types.push('TANK');

    const chosen = types[Math.floor(Math.random() * types.length)];
    this.engine.enemies.push(new Enemy(chosen, x, y, this.getMultipliers()));
  }
}
// frontend/src/core/Engine.js
import { CONFIG } from '../config.js';
import { InputHandler } from './Input.js';
import { Camera } from './Camera.js';
import { SpatialGrid } from './SpatialGrid.js';
import { ObjectPool } from '../SYSTEMS/ObjectPool.js';
import { ParticleSystem } from '../SYSTEMS/ParticleSystem.js';
import { WaveManager } from '../SYSTEMS/WaveManager.js';
import { Projectile } from '../ENTITIES/Projectile.js';
import { Player } from '../ENTITIES/Player.js';
import { Enemy } from '../ENTITIES/Enemy.js';
import { Pickup } from '../ENTITIES/Pickup.js';

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.canvas.width = window.innerWidth || 800;
    this.canvas.height = window.innerHeight || 600;

    this.input = new InputHandler(this.canvas);
    this.camera = new Camera(this.canvas.width, this.canvas.height);
    this.spatialGrid = new SpatialGrid(CONFIG.ARENA.WIDTH, CONFIG.ARENA.HEIGHT, CONFIG.ARENA.GRID_CELL_SIZE);

    this.particleSystem = new ParticleSystem();
    this.playerBulletsPool = new ObjectPool(() => new Projectile(), CONFIG.POOLS.PLAYER_BULLETS);
    this.enemyBulletsPool = new ObjectPool(() => new Projectile(), CONFIG.POOLS.ENEMY_BULLETS);

    this.player = new Player(CONFIG.ARENA.WIDTH / 2, CONFIG.ARENA.HEIGHT / 2);
    this.enemies = [];
    this.pickups = [];
    this.currentBoss = null;

    // Puntuación, combos y métricas
    this.score = 0;
    this.kills = 0;
    this.bossesDefeated = 0;
    this.gameTime = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.comboMult = 1.0;

    this.waveManager = new WaveManager(this);

    this.lastTime = performance.now();
    this.isPaused = false;
    this.isRunning = false;
    this.isGameOver = false;

    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    if (this.camera) {
      this.camera.resize(this.canvas.width, this.canvas.height);
    }
  }

  start() {
    this.isRunning = true;
    this.lastTime = performance.now();
    this.waveManager.startWave(1);
    requestAnimationFrame((time) => this._loop(time));
  }

  onEnemyKilled(enemy) {
    this.kills++;
    this.comboCount++;
    this.comboTimer = CONFIG.SCORING.COMBO_TIMEOUT;
    this.comboMult = Math.min(CONFIG.SCORING.MAX_MULTIPLIER, 1.0 + this.comboCount * CONFIG.SCORING.COMBO_MULTIPLIER_STEP);
    this.score += Math.floor(CONFIG.SCORING.KILL_BASE * this.comboMult);
  }

  onBossDefeated(boss) {
    this.bossesDefeated++;
    this.score += Math.floor(CONFIG.SCORING.BOSS_BASE * this.comboMult);
    this.currentBoss = null;
  }

  _loop(currentTime) {
    if (!this.isRunning) return;

    const dt = Math.min(0.1, (currentTime - this.lastTime) / 1000);
    this.lastTime = currentTime;

    if (!this.isPaused && !this.isGameOver) {
      this.update(dt);
    }
    this.render();

    requestAnimationFrame((time) => this._loop(time));
  }

  update(dt) {
    this.gameTime += dt;
    this.input.updateWorldCoordinates(this.camera.x, this.camera.y);

    // Actualizar Jugador y Cámara
    this.player.update(dt, this);
    if (!this.player.active && !this.isGameOver) {
      this.isGameOver = true;
      console.log('[Neon Siege] Game Over');
    }
    this.camera.follow(this.player.x, this.player.y);

    // Sistema de Combos
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
        this.comboMult = 1.0;
      }
    }

    // Oleadas
    this.waveManager.update(dt);

    // Poblar Spatial Grid con enemigos
    this.spatialGrid.clear();
    for (let i = 0; i < this.enemies.length; i++) {
      this.spatialGrid.insert(this.enemies[i]);
    }

    // Actualizar Enemigos
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.update(dt, this);
      if (!e.active) {
        this.enemies.splice(i, 1);
      }
    }

    // Actualizar Jefe
    if (this.currentBoss) {
      this.currentBoss.update(dt, this);
    }

    // Actualizar Balas del Jugador y colisión por Spatial Grid
    const activePlayerBullets = this.playerBulletsPool.getActive();
    for (let i = 0; i < activePlayerBullets.length; i++) {
      const b = activePlayerBullets[i];
      b.update(dt, CONFIG.ARENA.OBSTACLES);
      if (!b.active) continue;

      // Colisión contra Jefe
      if (this.currentBoss && Math.hypot(b.x - this.currentBoss.x, b.y - this.currentBoss.y) < b.radius + this.currentBoss.radius) {
        this.currentBoss.takeDamage(b.damage, this);
        b.hitsLeft--;
        if (b.hitsLeft <= 0) b.active = false;
      }

      // Colisión contra Enemigos en la celda de la cuadrícula
      const nearbyEnemies = this.spatialGrid.query(b.x, b.y, b.radius + 30);
      for (const enemy of nearbyEnemies) {
        if (!b.active) break;
        if (enemy.active && Math.hypot(b.x - enemy.x, b.y - enemy.y) < b.radius + enemy.radius) {
          enemy.takeDamage(b.damage, this);
          b.hitsLeft--;
          if (b.hitsLeft <= 0) {
            b.active = false;
          }
        }
      }
    }

    // Actualizar Balas Enemigas y colisión con el Jugador
    const activeEnemyBullets = this.enemyBulletsPool.getActive();
    for (let i = 0; i < activeEnemyBullets.length; i++) {
      const b = activeEnemyBullets[i];
      b.update(dt, CONFIG.ARENA.OBSTACLES);
      if (!b.active) continue;

      if (Math.hypot(b.x - this.player.x, b.y - this.player.y) < b.radius + this.player.radius) {
        this.player.takeDamage(b.damage, this.particleSystem);
        b.active = false;
      }
    }

    // Actualizar Pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.update(dt, this.player);

      const dist = Math.hypot(p.x - this.player.x, p.y - this.player.y);
      if (dist < p.radius + this.player.radius) {
        if (p.type === 'ammo') {
          this.player.addAmmo(p.weaponTarget, p.value);
          this.particleSystem.emitSparks(p.x, p.y, '#ffd700', 16);
        } else if (p.type === 'exp') {
          this.player.addExp(p.value);
          this.particleSystem.emitSparks(p.x, p.y, '#aa00ff', 12);
        } else if (p.type === 'heal') {
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + p.value);
          this.particleSystem.emitSparks(p.x, p.y, '#00ff66', 14);
        }
        this.pickups.splice(i, 1);
      }
    }

    this.particleSystem.update(dt);
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    const camX = Math.floor(this.camera.x || 0);
    const camY = Math.floor(this.camera.y || 0);
    this.ctx.translate(-camX, -camY);

    this._drawArena();

    // Dibujar Pickups
    for (let i = 0; i < this.pickups.length; i++) this.pickups[i].draw(this.ctx);

    // Dibujar Balas
    const playerBullets = this.playerBulletsPool.getActive();
    for (let i = 0; i < playerBullets.length; i++) playerBullets[i].draw(this.ctx);

    const enemyBullets = this.enemyBulletsPool.getActive();
    for (let i = 0; i < enemyBullets.length; i++) enemyBullets[i].draw(this.ctx);

    // Dibujar Enemigos y Jefe
    for (let i = 0; i < this.enemies.length; i++) this.enemies[i].draw(this.ctx);
    if (this.currentBoss) this.currentBoss.draw(this.ctx);

    this.player.draw(this.ctx);
    this.particleSystem.draw(this.ctx);

    this.ctx.restore();

    this._drawHUD();
  }

  _drawHUD() {
    this.ctx.save();
    const p = this.player;
    const w = CONFIG.WEAPONS[p.currentWeaponKey];

    // 1. Barra de Jefe superior
    if (this.currentBoss) {
      const bw = 400;
      const bx = (this.canvas.width - bw) / 2;
      this.ctx.fillStyle = 'rgba(0,0,0,0.8)';
      this.ctx.fillRect(bx, 20, bw, 14);
      this.ctx.fillStyle = '#ff0055';
      this.ctx.fillRect(bx, 20, (this.currentBoss.hp / this.currentBoss.maxHp) * bw, 14);
      this.ctx.strokeStyle = '#fff';
      this.ctx.strokeRect(bx, 20, bw, 14);

      this.ctx.font = 'bold 12px monospace';
      this.ctx.fillStyle = '#fff';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`${this.currentBoss.name} [FASE ${this.currentBoss.phase}]`, this.canvas.width / 2, 16);
    }

    // 2. Panel Estadísticas Superior Centro
    this.ctx.textAlign = 'center';
    this.ctx.font = 'bold 16px monospace';
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.fillText(`SCORE: ${this.score}`, this.canvas.width / 2, 55);

    this.ctx.font = '13px monospace';
    this.ctx.fillStyle = '#ff0077';
    this.ctx.fillText(`OLEADA: ${this.waveManager.currentWave}`, this.canvas.width / 2, 74);

    if (this.comboCount > 1) {
      this.ctx.font = 'bold 14px monospace';
      this.ctx.fillStyle = '#ffd700';
      this.ctx.fillText(`COMBO x${this.comboMult.toFixed(2)}`, this.canvas.width / 2, 94);
    }

    // 3. Panel Inferior Jugador
    this.ctx.textAlign = 'left';
    const hudX = 24;
    const hudY = this.canvas.height - 90;

    this.ctx.fillStyle = 'rgba(7, 11, 20, 0.8)';
    this.ctx.strokeStyle = '#00f0ff';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(hudX, hudY, 280, 70);
    this.ctx.fillRect(hudX, hudY, 280, 70);

    // Vida
    this.ctx.fillStyle = '#ff0055';
    this.ctx.fillRect(hudX + 10, hudY + 12, (p.hp / p.maxHp) * 120, 8);
    this.ctx.strokeStyle = '#333';
    this.ctx.strokeRect(hudX + 10, hudY + 12, 120, 8);

    // Energía
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.fillRect(hudX + 10, hudY + 26, (p.energy / p.maxEnergy) * 120, 8);
    this.ctx.strokeStyle = '#333';
    this.ctx.strokeRect(hudX + 10, hudY + 26, 120, 8);

    // Balas
    this.ctx.font = 'bold 12px monospace';
    this.ctx.fillStyle = w.color;
    this.ctx.fillText(w.name.toUpperCase(), hudX + 140, hudY + 20);

    this.ctx.font = 'bold 14px monospace';
    this.ctx.fillStyle = '#ffd700';
    const ammoText = p.ammo[p.currentWeaponKey] === Infinity ? 'INF' : `${p.ammo[p.currentWeaponKey]} / ${w.maxAmmo}`;
    this.ctx.fillText(`AMMO: ${ammoText}`, hudX + 140, hudY + 40);

    this.ctx.font = '10px monospace';
    this.ctx.fillStyle = '#888';
    this.ctx.fillText(`LVL: ${p.level}  KILLS: ${this.kills}`, hudX + 10, hudY + 56);

    this.ctx.restore();
  }

  _drawArena() {
    this.ctx.fillStyle = '#060913';
    this.ctx.fillRect(0, 0, CONFIG.ARENA.WIDTH, CONFIG.ARENA.HEIGHT);

    if (CONFIG.ARENA.SHOW_DEBUG_GRID) {
      this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
      this.ctx.lineWidth = 1;
      const step = CONFIG.ARENA.GRID_CELL_SIZE;
      for (let x = 0; x <= CONFIG.ARENA.WIDTH; x += step) {
        this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, CONFIG.ARENA.HEIGHT); this.ctx.stroke();
      }
      for (let y = 0; y <= CONFIG.ARENA.HEIGHT; y += step) {
        this.ctx.beginPath(); this.ctx.moveTo(0, y); this.ctx.lineTo(CONFIG.ARENA.WIDTH, y); this.ctx.stroke();
      }
    }

    this.ctx.save();
    this.ctx.strokeStyle = '#00f0ff';
    this.ctx.lineWidth = 4;
    this.ctx.shadowBlur = 18;
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.strokeRect(0, 0, CONFIG.ARENA.WIDTH, CONFIG.ARENA.HEIGHT);
    this.ctx.restore();

    for (const obs of CONFIG.ARENA.OBSTACLES) {
      this.ctx.fillStyle = '#101726';
      this.ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      this.ctx.strokeStyle = '#1e304f';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);

      this.ctx.fillStyle = '#00f0ff';
      const cSize = 6;
      this.ctx.fillRect(obs.x, obs.y, cSize, cSize);
      this.ctx.fillRect(obs.x + obs.w - cSize, obs.y, cSize, cSize);
      this.ctx.fillRect(obs.x, obs.y + obs.h - cSize, cSize, cSize);
      this.ctx.fillRect(obs.x + obs.w - cSize, obs.y + obs.h - cSize, cSize, cSize);
    }
  }
}
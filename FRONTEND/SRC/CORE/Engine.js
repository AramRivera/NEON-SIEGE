// frontend/src/core/Engine.js
import { CONFIG } from '../config.js';
import { InputHandler } from './Input.js';
import { Camera } from './Camera.js';
import { SpatialGrid } from './SpatialGrid.js';
import { ObjectPool } from '../SYSTEMS/ObjectPool.js';
import { ParticleSystem } from '../SYSTEMS/ParticleSystem.js';
import { Projectile } from '../ENTITIES/Projectile.js';
import { Player } from '../ENTITIES/Player.js';
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
    this.pickups = [];

    // Spawneamos algunos pickups iniciales alrededor para probar recolección
    this._spawnInitialPickups();

    this.lastTime = performance.now();
    this.isPaused = false;
    this.isRunning = false;

    window.addEventListener('resize', () => this.resizeCanvas());
  }

  _spawnInitialPickups() {
    const cx = CONFIG.ARENA.WIDTH / 2;
    const cy = CONFIG.ARENA.HEIGHT / 2;
    // Cajas de munición doradas
    this.pickups.push(new Pickup(cx - 150, cy - 100, 'ammo', 15));
    this.pickups.push(new Pickup(cx + 150, cy + 100, 'ammo', 15));
    // Gemas de exp violetas
    this.pickups.push(new Pickup(cx - 200, cy + 80, 'exp', 25));
    this.pickups.push(new Pickup(cx + 200, cy - 80, 'exp', 25));
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
    requestAnimationFrame((time) => this._loop(time));
  }

  _loop(currentTime) {
    if (!this.isRunning) return;

    const dt = Math.min(0.1, (currentTime - this.lastTime) / 1000);
    this.lastTime = currentTime;

    if (!this.isPaused) {
      this.update(dt);
    }
    this.render();

    requestAnimationFrame((time) => this._loop(time));
  }

  update(dt) {
    this.input.updateWorldCoordinates(this.camera.x, this.camera.y);

    this.player.update(dt, this);
    this.camera.follow(this.player.x, this.player.y);

    // Actualizar Proyectiles del jugador
    const activeBullets = this.playerBulletsPool.getActive();
    for (let i = 0; i < activeBullets.length; i++) {
      activeBullets[i].update(dt, CONFIG.ARENA.OBSTACLES);
    }

    // Actualizar Pickups y colisión con el jugador
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
    for (let i = 0; i < this.pickups.length; i++) {
      this.pickups[i].draw(this.ctx);
    }

    // Dibujar Balas
    const activeBullets = this.playerBulletsPool.getActive();
    for (let i = 0; i < activeBullets.length; i++) {
      activeBullets[i].draw(this.ctx);
    }

    this.player.draw(this.ctx);
    this.particleSystem.draw(this.ctx);

    this.ctx.restore();

    // HUD superpuesto en pantalla fija (no afectado por la cámara)
    this._drawHUD();
  }

  _drawHUD() {
    this.ctx.save();
    const p = this.player;
    const w = CONFIG.WEAPONS[p.currentWeaponKey];

    // Panel HUD inferior izquierdo
    const hudX = 24;
    const hudY = this.canvas.height - 90;

    this.ctx.fillStyle = 'rgba(7, 11, 20, 0.75)';
    this.ctx.strokeStyle = '#00f0ff';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(hudX, hudY, 260, 70);
    this.ctx.fillRect(hudX, hudY, 260, 70);

    // Barra de Vida
    this.ctx.fillStyle = '#ff0055';
    this.ctx.fillRect(hudX + 10, hudY + 12, (p.hp / p.maxHp) * 120, 8);
    this.ctx.strokeStyle = '#333';
    this.ctx.strokeRect(hudX + 10, hudY + 12, 120, 8);

    // Barra de Energía
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.fillRect(hudX + 10, hudY + 26, (p.energy / p.maxEnergy) * 120, 8);
    this.ctx.strokeStyle = '#333';
    this.ctx.strokeRect(hudX + 10, hudY + 26, 120, 8);

    // Datos del Arma y Balas
    this.ctx.font = 'bold 13px monospace';
    this.ctx.fillStyle = w.color;
    this.ctx.fillText(w.name.toUpperCase(), hudX + 140, hudY + 20);

    this.ctx.font = 'bold 15px monospace';
    this.ctx.fillStyle = '#ffd700';
    const ammoText = p.ammo[p.currentWeaponKey] === Infinity ? 'INF' : `${p.ammo[p.currentWeaponKey]} / ${w.maxAmmo}`;
    this.ctx.fillText(`BALAS: ${ammoText}`, hudX + 140, hudY + 42);

    this.ctx.font = '11px monospace';
    this.ctx.fillStyle = '#888';
    this.ctx.fillText('[1] PISTOLA  [2] ESCOPETA  [3] PLASMA', hudX + 10, hudY + 56);

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
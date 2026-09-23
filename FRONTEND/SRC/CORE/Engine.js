// frontend/src/core/Engine.js
import { CONFIG } from '../config.js';
import { InputHandler } from './Input.js';
import { Camera } from './Camera.js';
import { SpatialGrid } from './SpatialGrid.js';
import { ObjectPool } from '../SYSTEMS/ObjectPool.js';
import { ParticleSystem } from '../SYSTEMS/ParticleSystem.js';
import { Projectile } from '../ENTITIES/Projectile.js';
import { Player } from '../ENTITIES/Player.js';

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    this.canvas.width = window.innerWidth || 800;
    this.canvas.height = window.innerHeight || 600;

    this.input = new InputHandler(this.canvas);
    this.camera = new Camera(this.canvas.width, this.canvas.height);
    this.spatialGrid = new SpatialGrid(CONFIG.ARENA.WIDTH, CONFIG.ARENA.HEIGHT, CONFIG.ARENA.GRID_CELL_SIZE);

    // Sistemas y Pools
    this.particleSystem = new ParticleSystem();
    this.playerBulletsPool = new ObjectPool(() => new Projectile(), CONFIG.POOLS.PLAYER_BULLETS);
    this.enemyBulletsPool = new ObjectPool(() => new Projectile(), CONFIG.POOLS.ENEMY_BULLETS);

    // Jugador (centrado en la arena al inicio)
    this.player = new Player(CONFIG.ARENA.WIDTH / 2, CONFIG.ARENA.HEIGHT / 2);

    this.lastTime = performance.now();
    this.isPaused = false;
    this.isRunning = false;

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
    console.log('[Neon Siege] Motor y Jugador inicializados.');
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
    // 1. Sincronizar coordenadas del mouse con la posición del mundo
    this.input.updateWorldCoordinates(this.camera.x, this.camera.y);

    // 2. Actualizar Jugador
    this.player.update(dt, this);

    // 3. Cámara siguiendo suavemente al jugador
    this.camera.follow(this.player.x, this.player.y);

    // 4. Actualizar Proyectiles activos del Jugador contra obstáculos
    const activeBullets = this.playerBulletsPool.getActive();
    for (let i = 0; i < activeBullets.length; i++) {
      activeBullets[i].update(dt, CONFIG.ARENA.OBSTACLES);
    }

    // 5. Actualizar Partículas
    this.particleSystem.update(dt);
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    const camX = Math.floor(this.camera.x || 0);
    const camY = Math.floor(this.camera.y || 0);
    this.ctx.translate(-camX, -camY);

    // Dibujar Arena inmersiva
    this._drawArena();

    // Dibujar Proyectiles
    const activeBullets = this.playerBulletsPool.getActive();
    for (let i = 0; i < activeBullets.length; i++) {
      activeBullets[i].draw(this.ctx);
    }

    // Dibujar Jugador
    this.player.draw(this.ctx);

    // Dibujar Partículas
    this.particleSystem.draw(this.ctx);

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

    // Bordes neón
    this.ctx.save();
    this.ctx.strokeStyle = '#00f0ff';
    this.ctx.lineWidth = 4;
    this.ctx.shadowBlur = 18;
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.strokeRect(0, 0, CONFIG.ARENA.WIDTH, CONFIG.ARENA.HEIGHT);
    this.ctx.restore();

    // Obstáculos ambientales
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
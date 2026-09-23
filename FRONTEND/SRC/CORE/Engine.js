// frontend/src/core/Engine.js
import { CONFIG } from '../config.js';
import { InputHandler } from './Input.js';
import { Camera } from './Camera.js';
import { SpatialGrid } from './SpatialGrid.js';

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resizeCanvas();

    this.input = new InputHandler(this.canvas);
    this.camera = new Camera(this.canvas.width, this.canvas.height);
    this.spatialGrid = new SpatialGrid(CONFIG.ARENA.WIDTH, CONFIG.ARENA.HEIGHT, CONFIG.ARENA.GRID_CELL_SIZE);

    this.lastTime = performance.now();
    this.isPaused = false;
    this.isRunning = false;

    // Lista general de entidades registradas para el ciclo
    this.entities = [];

    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    if (this.camera) this.camera.resize(this.canvas.width, this.canvas.height);
  }

  start() {
    this.isRunning = true;
    this.lastTime = performance.now();
    requestAnimationFrame((time) => this._loop(time));
  }

  _loop(currentTime) {
    if (!this.isRunning) return;

    // Cálculo estricto de Delta Time en segundos, clamp a 0.1s para evitar saltos en background
    const dt = Math.min(0.1, (currentTime - this.lastTime) / 1000);
    this.lastTime = currentTime;

    if (!this.isPaused) {
      this.update(dt);
    }
    this.render();

    requestAnimationFrame((time) => this._loop(time));
  }

  update(dt) {
    // Sincronizar coordenadas del mouse con la cámara
    this.input.updateWorldCoordinates(this.camera.x, this.camera.y);

    // Actualización de entidades registradas
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const entity = this.entities[i];
      if (entity.active) {
        entity.update(dt, this);
      } else {
        this.entities.splice(i, 1);
      }
    }
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    // Traslación según coordenadas de la cámara
    this.ctx.translate(-Math.floor(this.camera.x), -Math.floor(this.camera.y));

    this._drawArena();

    // Dibujar entidades
    for (const entity of this.entities) {
      if (entity.active) entity.draw(this.ctx);
    }

    this.ctx.restore();
  }

  _drawArena() {
    // Cuadrícula cyberpunk de fondo
    this.ctx.strokeStyle = '#0d1627';
    this.ctx.lineWidth = 1;
    const step = 80;

    for (let x = 0; x <= CONFIG.ARENA.WIDTH; x += step) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, CONFIG.ARENA.HEIGHT);
      this.ctx.stroke();
    }

    for (let y = 0; y <= CONFIG.ARENA.HEIGHT; y += step) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(CONFIG.ARENA.WIDTH, y);
      this.ctx.stroke();
    }

    // Bordes de la arena con brillo neón
    this.ctx.strokeStyle = '#00f0ff';
    this.ctx.lineWidth = 4;
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.strokeRect(0, 0, CONFIG.ARENA.WIDTH, CONFIG.ARENA.HEIGHT);
    this.ctx.shadowBlur = 0;

    // Obstáculos
    this.ctx.fillStyle = '#141d33';
    this.ctx.strokeStyle = '#00f0ff';
    this.ctx.lineWidth = 2;
    for (const obs of CONFIG.ARENA.OBSTACLES) {
      this.ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      this.ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
    }
  }
}
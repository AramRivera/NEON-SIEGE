// frontend/src/systems/ParticleSystem.js
import { ObjectPool } from './ObjectPool.js';
import { CONFIG } from '../config.js';

class Particle {
  constructor() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.color = '#ffffff';
    this.radius = 2;
    this.maxLife = 0.5;
    this.life = 0;
  }

  spawn(x, y, vx, vy, color, radius, life) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.radius = radius;
    this.maxLife = life;
    this.life = life;
    this.active = true;
  }

  update(dt) {
    if (!this.active) return;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) {
      this.active = false;
    }
  }

  draw(ctx) {
    if (!this.active) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 6;
    ctx.shadowColor = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export class ParticleSystem {
  constructor() {
    this.pool = new ObjectPool(() => new Particle(), CONFIG.POOLS.PARTICLES);
  }

  emitExplosion(x, y, color = '#ff0055', count = 30) {
    for (let i = 0; i < count; i++) {
      const p = this.pool.get();
      if (!p) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 260 + 50;
      const radius = Math.random() * 3 + 1.5;
      const life = Math.random() * 0.4 + 0.25;
      p.spawn(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, radius, life);
    }
  }

  emitSparks(x, y, color = '#00f0ff', count = 10) {
    for (let i = 0; i < count; i++) {
      const p = this.pool.get();
      if (!p) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 150 + 30;
      p.spawn(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, Math.random() * 2 + 1, Math.random() * 0.2 + 0.1);
    }
  }

  update(dt) {
    const active = this.pool.getActive();
    for (let i = 0; i < active.length; i++) {
      active[i].update(dt);
    }
  }

  draw(ctx) {
    const active = this.pool.getActive();
    for (let i = 0; i < active.length; i++) {
      active[i].draw(ctx);
    }
  }
}
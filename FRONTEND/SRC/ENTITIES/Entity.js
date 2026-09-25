// frontend/src/entities/Entity.js
import { CONFIG } from '../config.js';

export class Entity {
  constructor(x, y, radius) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    // Negativo = más arriba. El pivote (x,y) se queda en los pies para movimiento/sombra.
    this.hitboxOffsetY = 0;
    this.hitboxRadius = radius;
    this.active = true;
  }

  getHitX() {
    return this.x;
  }

  getHitY() {
    return this.y + this.hitboxOffsetY;
  }

  getHitRadius() {
    return this.hitboxRadius;
  }

  // Restringe a la entidad dentro de los límites de la arena
  clampToArena() {
    this.x = Math.max(this.radius, Math.min(CONFIG.ARENA.WIDTH - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(CONFIG.ARENA.HEIGHT - this.radius, this.y));
  }

  // Resuelve colisiones circulares contra rectángulos (AABB) de obstáculos
  resolveObstacleCollisions(obstacles) {
    for (let i = 0; i < obstacles.length; i++) {
      const box = obstacles[i];
      const closestX = Math.max(box.x, Math.min(this.x, box.x + box.w));
      const closestY = Math.max(box.y, Math.min(this.y, box.y + box.h));
      const dx = this.x - closestX;
      const dy = this.y - closestY;
      const dist = Math.hypot(dx, dy);

      if (dist < this.radius) {
        const overlap = this.radius - dist;
        if (dist > 0.0001) {
          this.x += (dx / dist) * overlap;
          this.y += (dy / dist) * overlap;
        } else {
          this.x += this.radius;
        }
      }
    }
  }

  update(dt, engine) {}
  draw(ctx) {}
}
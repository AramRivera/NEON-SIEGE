/**
 * Proyectil reutilizable (ObjectPool).
 * Movimiento: integración euler con alcance restante.
 * Colisión con obstáculos: punto dentro de AABB (se desactiva al impactar muro).
 * hitsLeft / penetration permiten atravesar varios enemigos (plasma).
 */
import { Entity } from './Entity.js';
import { assetManager } from '../SYSTEMS/AssetManager.js';

export class Projectile {
  constructor() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.damage = 10;
    this.distanceLeft = 500;
    this.color = '#00f0ff';
    this.penetration = 1;
    this.hitsLeft = 1;
    this.radius = 4;
    this.isEnemy = false;
  }

  /** Primera firma (sobrescrita más abajo): se deja por compatibilidad con el pool. */
  spawn(x, y, angle, speed, damage, range, color, penetration = 1, isEnemy = false) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.damage = damage;
    this.distanceLeft = range;
    this.color = color;
    this.penetration = penetration;
    this.hitsLeft = penetration;
    this.radius = isEnemy ? 6 : 4;
    this.isEnemy = isEnemy;
    this.active = true;
  }

  /**
   * Integra posición, agota alcance y comprueba colisión punto-AABB con cover.
   * Las colisiones contra entidades se resuelven en Engine.update.
   */
  update(dt, obstacles) {
    if (!this.active) return;

    const moveStep = Math.hypot(this.vx * dt, this.vy * dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.distanceLeft -= moveStep;

    // Alcance terminado o impactos agotados
    if (this.distanceLeft <= 0 || this.hitsLeft <= 0) {
      this.active = false;
      return;
    }

    // Colisión contra obstáculos AABB
    if (obstacles) {
      for (let i = 0; i < obstacles.length; i++) {
        const obs = obstacles[i];
        if (
          this.x >= obs.x &&
          this.x <= obs.x + obs.w &&
          this.y >= obs.y &&
          this.y <= obs.y + obs.h
        ) {
          this.active = false;
          return;
        }
      }
    }
  }

  /** Recicla la instancia: vector de velocidad, sprite y penetración. */
  spawn(x, y, angle, speed, damage, range, color, penetration = 1, isEnemy = false, spriteKey = null) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.angle = angle;                    // <-- para rotar el sprite
    this.damage = damage;
    this.distanceLeft = range;
    this.color = color;
    this.penetration = penetration;
    this.hitsLeft = penetration;
    this.radius = isEnemy ? 6 : 4;
    this.isEnemy = isEnemy;
    this.spriteKey = spriteKey;            // <-- clave del sprite (o null)
    this.active = true;
  }

  /** Dibujo: sprite rotado según ángulo de vuelo, o círculo con glow. */
    draw(ctx) {
    if (!this.active) return;

    // --- Sprite rotado (si está definido y cargado) ---
    const img = this.spriteKey ? assetManager.getImage(this.spriteKey) : null;

    if (img) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);              // rota según dirección de vuelo
      const scale = this.isEnemy ? 1.2 : 1.0;
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
      return;
    }

    // --- Fallback: círculo con glow (comportamiento anterior) ---
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
// frontend/src/entities/Projectile.js
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

  draw(ctx) {
    if (!this.active) return;
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
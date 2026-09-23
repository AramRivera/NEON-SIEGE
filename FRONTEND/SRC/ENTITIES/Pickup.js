// frontend/src/entities/Pickup.js
export class Pickup {
  constructor(x, y, type = 'exp', value = 10) {
    this.x = x;
    this.y = y;
    this.type = type; // 'exp' | 'heal' | 'energy'
    this.value = value;
    this.radius = 7;
    this.active = true;
    this.color = type === 'exp' ? '#aa00ff' : (type === 'heal' ? '#00ff66' : '#00f0ff');
  }

  update(dt, player) {
    if (!this.active || !player) return;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);

    // Atracción magnética basada en la estadística del traje del jugador
    if (dist < player.magnetRadius) {
      const speed = 480 * (1 - dist / player.magnetRadius) + 140;
      this.x += (dx / dist) * speed * dt;
      this.y += (dy / dist) * speed * dt;
    }
  }

  draw(ctx) {
    if (!this.active) return;
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
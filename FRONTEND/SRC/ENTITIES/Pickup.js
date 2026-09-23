// frontend/src/entities/Pickup.js
export class Pickup {
  constructor(x, y, type = 'exp', value = 10, weaponTarget = null) {
    this.x = x;
    this.y = y;
    this.type = type; // 'exp' | 'heal' | 'energy' | 'ammo'
    this.value = value;
    this.weaponTarget = weaponTarget; // null = recarga todas las armas secundarias
    this.radius = type === 'ammo' ? 8 : 7;
    this.active = true;

    // Colores característicos
    if (type === 'exp') this.color = '#aa00ff';
    else if (type === 'heal') this.color = '#00ff66';
    else if (type === 'ammo') this.color = '#ffd700';
    else this.color = '#00f0ff';
  }

  update(dt, player) {
    if (!this.active || !player) return;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);

    // Atracción magnética hacia el jugador
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
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;

    if (this.type === 'ammo') {
      // Dibujamos un icono rectangular tipo cápsula/caja militar neón
      ctx.fillRect(this.x - 6, this.y - 4, 12, 8);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(this.x - 6, this.y - 4, 12, 8);
    } else {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
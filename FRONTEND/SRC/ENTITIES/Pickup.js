import { assetManager } from '../SYSTEMS/AssetManager.js';
// frontend/src/entities/Pickup.js
export class Pickup {
  constructor(x, y, type = 'exp', value = 10, targetWeapon = null) {
    this.x = x;
    this.y = y;
    this.type = type; // 'exp' | 'heal' | 'ammo_shotgun' | 'ammo_plasma'
    this.value = value;
    this.targetWeapon = targetWeapon;
    this.radius = 8;
    this.active = true;

    // Colores característicos
    if (type === 'exp') this.color = '#aa00ff';
    else if (type === 'heal') this.color = '#00ff66';
    else if (type === 'ammo_shotgun') this.color = '#ff0077';
    else if (type === 'ammo_plasma') this.color = '#39ff14';
    else this.color = '#ffd700';
  }

  update(dt, player) {
    if (!this.active || !player) return;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist < player.magnetRadius) {
      const speed = 480 * (1 - dist / player.magnetRadius) + 140;
      this.x += (dx / dist) * speed * dt;
      this.y += (dy / dist) * speed * dt;
    }
  }

    draw(ctx) {
    if (!this.active) return;

    // Mapear tipo de pickup -> clave de sprite
    let spriteKey = null;
    if (this.type === 'heal') spriteKey = 'pickup_heal';
    else if (this.type === 'ammo_shotgun') spriteKey = 'pickup_ammo_shotgun';
    else if (this.type === 'ammo_plasma') spriteKey = 'pickup_ammo_plasma';
    else if (this.type === 'exp') spriteKey = 'pickup_exp';

    const img = spriteKey ? assetManager.getImage(spriteKey) : null;

    // --- Sprite (con leve pulso flotante) ---
    if (img) {
      const bob = Math.sin(Date.now() / 300 + this.x * 0.05) * 2; // flotar suave
      ctx.save();
      const size = 32;
      ctx.drawImage(img, this.x - size / 2, this.y - size / 2 + bob, size, size);
      ctx.restore();
      return;
    }

    // --- Fallback: forma geométrica anterior ---
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;

    if (this.type.startsWith('ammo_')) {
      ctx.fillRect(this.x - 7, this.y - 5, 14, 10);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(this.x - 7, this.y - 5, 14, 10);

      ctx.fillStyle = '#000';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = this.type === 'ammo_shotgun' ? 'SG' : 'PL';
      ctx.fillText(label, this.x, this.y);
    } else {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
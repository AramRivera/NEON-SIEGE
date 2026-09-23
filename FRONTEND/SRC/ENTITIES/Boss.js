// frontend/src/entities/Boss.js
import { Entity } from './Entity.js';
import { CONFIG } from '../config.js';
import { Enemy } from './Enemy.js';
import { Pickup } from './Pickup.js';
import { assetManager } from '../SYSTEMS/AssetManager.js';

export class Boss extends Entity {
  constructor(kind, wave) {
    const data = CONFIG.BOSSES[kind];
    super(CONFIG.ARENA.WIDTH / 2, 220, data.radius);

    this.kind = kind; // 'GOLIATH' | 'TEMPEST'
    this.name = data.name;
    this.maxHp = data.maxHp * Math.pow(1.2, Math.floor(wave / 5));
    this.hp = this.maxHp;
    this.exp = data.exp;

    this.phase = 1; // 1: 100-60%, 2: 60-30%, 3: 30-0%
    this.actionTimer = 0;
    this.supportTimer = 0;
  }

  takeDamage(amount, engine) {
    if (!this.active) return;
    this.hp -= amount;
    engine.particleSystem.emitSparks(this.x, this.y, '#ff0077', 8);

    if (this.hp <= 0) {
      this.hp = 0;
      this.active = false;
      this._onDefeat(engine);
    }
  }

  _onDefeat(engine) {
    engine.particleSystem.emitExplosion(this.x, this.y, '#ffffff', 80);
    engine.onBossDefeated(this);

    // Botín abundante
    for (let i = 0; i < 6; i++) {
      const ox = (Math.random() - 0.5) * 80;
      const oy = (Math.random() - 0.5) * 80;
      engine.pickups.push(new Pickup(this.x + ox, this.y + oy, 'exp', 50));
    }
    engine.pickups.push(new Pickup(this.x, this.y, 'heal', 40));
    engine.pickups.push(new Pickup(this.x, this.y + 20, 'ammo', 30));

    assetManager.playSound('sfx_boom', 0.5);
  }

  update(dt, engine) {
    if (!this.active) return;

    const hpRatio = this.hp / this.maxHp;
    if (hpRatio > 0.6) this.phase = 1;
    else if (hpRatio > 0.3) this.phase = 2;
    else this.phase = 3;

    this.actionTimer += dt;
    this.supportTimer += dt;

    const player = engine.player;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    if (this.kind === 'GOLIATH') {
      this._updateGoliath(dt, player, dist, dx, dy, engine);
    } else {
      this._updateTempest(dt, player, dist, dx, dy, angle, engine);
    }

    if (dist <= this.radius + player.radius) {
      player.takeDamage(25, engine.particleSystem);
    }

    this.clampToArena();
    this.resolveObstacleCollisions(CONFIG.ARENA.OBSTACLES);
  }

  _updateGoliath(dt, player, dist, dx, dy, engine) {
    const fCfg = CONFIG.BOSSES.GOLIATH.fases[`F${this.phase}`];
    this.x += (dx / dist) * fCfg.speed * dt;
    this.y += (dy / dist) * fCfg.speed * dt;

    // Disparo radial
    if (this.actionTimer >= fCfg.shootCooldown) {
      this.actionTimer = 0;
      const count = fCfg.burstCount;
      for (let i = 0; i < count; i++) {
        const a = (Math.PI * 2 / count) * i;
        const b = engine.enemyBulletsPool.get();
        if (b) {
          b.spawn(this.x, this.y, a, 320, 16, 850, '#ff0055', 1, true);
        }
      }
    }

    // Fase 3: Invocación de Swarms
    if (fCfg.spawnSwarms && this.supportTimer >= fCfg.spawnFreq) {
      this.supportTimer = 0;
      for (let i = 0; i < 3; i++) {
        const ox = (Math.random() - 0.5) * 80;
        const oy = (Math.random() - 0.5) * 80;
        engine.enemies.push(new Enemy('SWARM', this.x + ox, this.y + oy, engine.waveManager.getMultipliers()));
      }
    }
  }

  _updateTempest(dt, player, dist, dx, dy, angle, engine) {
    const fCfg = CONFIG.BOSSES.TEMPEST.fases[`F${this.phase}`];
    this.x += (dx / dist) * fCfg.speed * dt;
    this.y += (dy / dist) * fCfg.speed * dt;

    // Teletransporte táctico
    if (fCfg.teleportRate > 0 && this.actionTimer >= fCfg.teleportRate) {
      this.actionTimer = 0;
      engine.particleSystem.emitExplosion(this.x, this.y, '#9400d3', 30);
      this.x = Math.max(150, Math.min(CONFIG.ARENA.WIDTH - 150, player.x + (Math.random() - 0.5) * 500));
      this.y = Math.max(150, Math.min(CONFIG.ARENA.HEIGHT - 150, player.y + (Math.random() - 0.5) * 500));
      engine.particleSystem.emitExplosion(this.x, this.y, '#9400d3', 30);
    }

    // Ráfagas en abanico
    if (this.supportTimer >= fCfg.laserCooldown) {
      this.supportTimer = 0;
      for (let k = 0; k < 5; k++) {
        const offset = (k - 2) * 0.18;
        const b = engine.enemyBulletsPool.get();
        if (b) {
          b.spawn(this.x, this.y, angle + offset, 440, 14, 900, '#9400d3', 1, true);
        }
      }
    }
  }

  draw(ctx) {
    if (!this.active) return;
    ctx.save();

    const color = this.phase === 3 ? '#ff0000' : (this.phase === 2 ? '#ff5500' : '#9400d3');
    ctx.fillStyle = color;
    ctx.shadowBlur = 25;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Anillo de fase
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();
  }
}
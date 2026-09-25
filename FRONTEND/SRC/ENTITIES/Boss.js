// frontend/src/entities/Boss.js
import { Entity } from './Entity.js';
import { CONFIG } from '../config.js';
import { Enemy } from './Enemy.js';
import { Pickup } from './Pickup.js';
import { assetManager } from '../SYSTEMS/AssetManager.js';
import { SpriteRenderer } from '../SYSTEMS/SpriteRender.js';

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
    this.target = null;

    // Animación visual de spritesheets
    this.state = 'idle'; // 'idle' | 'walk' | 'attack' | 'special' | 'die'
    this.frameIndex = 0;
    this.frameTimer = 0;
    this.hitTimer = 0; // Efecto de parpadeo visual al ser dañado

    // ---- AUDIO: control de golpes (throttle) ----
    this._lastHitSfx = 0;
  }

  takeDamage(amount, engine) {
    if (!this.active || this.state === 'die') return;
    this.hp -= amount;
    this.hitTimer = 0.08;
    engine.particleSystem.emitSparks(this.x, this.y, '#ff0077', 8);

    // ---- AUDIO: impacto en el jefe (throttled, no saturar) ----
    const now = performance.now();
    if (now - this._lastHitSfx > 100) {
      this._lastHitSfx = now;
      assetManager.playSound('sfx_enemy_hit', 0.2);
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.state = 'die';
      this.frameIndex = 0;
      this.active = false;
      this._onDefeat(engine);
    }
  }

  _onDefeat(engine) {
    engine.particleSystem.emitExplosion(this.x, this.y, '#ffffff', 80);
    engine.onBossDefeated(this);

    // Botín abundante al caer el jefe
    for (let i = 0; i < 6; i++) {
      const ox = (Math.random() - 0.5) * 80;
      const oy = (Math.random() - 0.5) * 80;
      engine.pickups.push(new Pickup(this.x + ox, this.y + oy, 'exp', 50));
    }
    engine.pickups.push(new Pickup(this.x, this.y, 'heal', 40));
    engine.pickups.push(new Pickup(this.x, this.y + 20, 'ammo_shotgun', 32, 'SHOTGUN'));
    engine.pickups.push(new Pickup(this.x, this.y - 20, 'ammo_plasma', 20, 'ENERGY_BEAM'));

    // ---- AUDIO: explosión épica del jefe (doble golpe) ----
    assetManager.playSound('sfx_boom', 0.7);
    assetManager.playSound('sfx_boss_explode', 0.8);
  }

  _updateAnimation(dt) {
    const spriteKey = this.kind === 'GOLIATH' ? 'boss_goliath' : 'boss_tempest';
    const cfg = CONFIG.ASSETS.SPRITES[spriteKey];
    const anim = cfg && cfg.animations ? cfg.animations[this.state] : null;
    const speed = anim ? anim.speed : 0.15;

    this.frameTimer += dt;
    if (this.frameTimer >= speed) {
      this.frameTimer = 0;
      this.frameIndex++;
      if (anim && this.frameIndex >= anim.frames) {
        if (this.state === 'die') {
          this.frameIndex = anim.frames - 1;
        } else {
          this.frameIndex = 0;
          if (this.state === 'attack' || this.state === 'special') {
            this.state = 'idle';
          }
        }
      }
    }
  }

  update(dt, engine) {
    if (!this.active && this.state !== 'die') return;

    if (this.hitTimer > 0) this.hitTimer -= dt;
    this._updateAnimation(dt);

    if (!this.active) return; // Si fue derrotado, solo reproduce animación de muerte

    const hpRatio = this.hp / this.maxHp;
    if (hpRatio > 0.6) this.phase = 1;
    else if (hpRatio > 0.3) this.phase = 2;
    else this.phase = 3;

    this.actionTimer += dt;
    this.supportTimer += dt;

    const player = engine.player;
    this.target = player;

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
    if (this.state !== 'attack' && this.state !== 'special') {
      this.state = 'walk';
    }

    // Disparo radial
    if (this.actionTimer >= fCfg.shootCooldown) {
      this.actionTimer = 0;
      this.state = 'attack';
      this.frameIndex = 0;

      // ---- AUDIO: disparo pesado del jefe ----
      assetManager.playSound('sfx_boss_shoot', 0.4);

      const count = fCfg.burstCount;
      for (let i = 0; i < count; i++) {
        const a = (Math.PI * 2 / count) * i;
        const b = engine.enemyBulletsPool.get();
        if (b) {
          b.spawn(this.x, this.y, a, 320, 16, 850, '#ff0055', 1, true, 'boss_projectile');
        }
      }
    }

    // Fase 3: Invocación de Swarms
    if (fCfg.spawnSwarms && this.supportTimer >= fCfg.spawnFreq) {
      this.supportTimer = 0;
      this.state = 'special';
      this.frameIndex = 0;

      // ---- AUDIO: invocación de refuerzos ----
      assetManager.playSound('sfx_boss_summon', 0.45);

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
    if (this.state !== 'attack' && this.state !== 'special') {
      this.state = 'walk';
    }

    // Teletransporte táctico
    if (fCfg.teleportRate > 0 && this.actionTimer >= fCfg.teleportRate) {
      this.actionTimer = 0;
      this.state = 'special';
      this.frameIndex = 0;

      // ---- AUDIO: zumbido de teletransporte ----
      assetManager.playSound('sfx_boss_teleport', 0.4);

      engine.particleSystem.emitExplosion(this.x, this.y, '#9400d3', 30);
      this.x = Math.max(150, Math.min(CONFIG.ARENA.WIDTH - 150, player.x + (Math.random() - 0.5) * 500));
      this.y = Math.max(150, Math.min(CONFIG.ARENA.HEIGHT - 150, player.y + (Math.random() - 0.5) * 500));
      engine.particleSystem.emitExplosion(this.x, this.y, '#9400d3', 30);
    }

    // Ráfagas en abanico
    if (this.supportTimer >= fCfg.laserCooldown) {
      this.supportTimer = 0;
      this.state = 'attack';
      this.frameIndex = 0;

      // ---- AUDIO: disparo láser del jefe ----
      assetManager.playSound('sfx_boss_shoot', 0.4);

      for (let k = 0; k < 5; k++) {
        const offset = (k - 2) * 0.18;
        const b = engine.enemyBulletsPool.get();
        if (b) {
          b.spawn(this.x, this.y, angle + offset, 440, 14, 900, '#9400d3', 1, true, 'boss_projectile');
        }
      }
    }
  }

  draw(ctx) {
    if (!this.active && this.state !== 'die') return;

    SpriteRenderer.drawShadow(ctx, this.x, this.y, this.radius * 1.3);

    ctx.save();
    if (this.hitTimer > 0) {
      ctx.filter = 'brightness(2.5)';
    }

    const spriteKey = this.kind === 'GOLIATH' ? 'boss_goliath' : 'boss_tempest';
    const isFacingLeft = this.target ? (this.x > this.target.x) : false;
    const bossSize = this.radius * 2.8;

    // 1. Renderizado de spritesheet animado
    let drew = SpriteRenderer.drawAnimatedSprite({
      ctx,
      imageKey: spriteKey,
      animState: this.state,
      frameIndex: this.frameIndex,
      x: this.x,
      y: this.y,
      width: bossSize,
      height: bossSize,
      angle: 0,
      flipX: isFacingLeft
    });

    // 2. Sprite estático si no es hoja de animación
    if (!drew) {
      drew = SpriteRenderer.drawEntitySprite({
        ctx,
        imageKey: spriteKey,
        x: this.x,
        y: this.y,
        width: bossSize,
        height: bossSize,
        flipX: isFacingLeft
      });
    }

    // 3. Fallback geométrico con iluminación neón según la fase
    if (!drew) {
      const color = this.phase === 3 ? '#ff0000' : (this.phase === 2 ? '#ff5500' : '#9400d3');
      ctx.fillStyle = color;
      ctx.shadowBlur = 25;
      ctx.shadowColor = color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();

      // Anillo concéntrico de energía
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.restore();
  }
}
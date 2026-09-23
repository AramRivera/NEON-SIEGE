// frontend/src/entities/Enemy.js
import { Entity } from './Entity.js';
import { CONFIG } from '../config.js';
import { Pickup } from './Pickup.js';
import { assetManager } from '../SYSTEMS/AssetManager.js';
import { SpriteRenderer } from '../SYSTEMS/SpriteRender.js';

export class Enemy extends Entity {
  constructor(type, x, y, waveMultipliers = { hp: 1, damage: 1, speed: 1 }) {
    const base = CONFIG.ENEMIES[type];
    super(x, y, base.radius);

    this.type = type; // 'HUNTER' | 'RANGER' | 'SWARM' | 'TANK' | 'KAMIKAZE'
    this.maxHp = base.hp * waveMultipliers.hp;
    this.hp = this.maxHp;
    this.speed = base.speed * waveMultipliers.speed;
    this.damage = base.damage * waveMultipliers.damage;
    this.exp = base.exp;
    this.color = base.color;

    // FSM: SPAWN -> SEARCH -> CHASE -> ATTACK -> RETREAT -> DEAD
    this.state = 'SPAWN';
    this.stateTimer = 0.4; // Tiempo de materialización
    this.cooldownTimer = 0;
    this.angle = 0;

    // Variables específicas según arquetipo
    this.chargeDir = { x: 0, y: 0 };
    this.primeTimer = 0;
  }

  takeDamage(amount, engine) {
    if (!this.active || this.state === 'SPAWN' || this.state === 'DEAD') return;

    this.hp -= amount;
    engine.particleSystem.emitSparks(this.x, this.y, this.color, 4);

    if (this.hp <= 0) {
      this.hp = 0;
      this.state = 'DEAD';
      this.active = false;
      this._onDeath(engine);
    }
  }

  _onDeath(engine) {
    engine.particleSystem.emitExplosion(this.x, this.y, this.color, 24);
    engine.onEnemyKilled(this);

    // Dropeo de experiencia (siempre)
    engine.pickups.push(new Pickup(this.x, this.y, 'exp', this.exp));

    // Probabilidad de soltar munición (18%) o curación (8%)
    const rand = Math.random();
    if (rand < 0.18) {
      engine.pickups.push(new Pickup(this.x + 8, this.y, 'ammo', 12));
    } else if (rand < 0.26) {
      engine.pickups.push(new Pickup(this.x - 8, this.y, 'heal', 20));
    }

    assetManager.playSound('sfx_boom', 0.2);
  }

  update(dt, engine) {
    if (!this.active) return;

    if (this.cooldownTimer > 0) this.cooldownTimer -= dt;

    const player = engine.player;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    this.angle = Math.atan2(dy, dx);

    // Ejecución de la Máquina de Estados Finita (FSM)
    switch (this.state) {
      case 'SPAWN':
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = 'CHASE';
        }
        break;

      case 'SEARCH':
        // Si el jugador está dentro de la arena, pasa a perseguir
        if (dist < 1500) {
          this.state = 'CHASE';
        }
        break;

      case 'CHASE':
        this._handleChase(dt, player, dist, dx, dy, engine);
        break;

      case 'ATTACK':
        this._handleAttack(dt, player, dist, engine);
        break;

      case 'RETREAT':
        // Ranger huyendo hacia atrás para mantener rango seguro
        this.x -= Math.cos(this.angle) * (this.speed * 1.1) * dt;
        this.y -= Math.sin(this.angle) * (this.speed * 1.1) * dt;
        if (dist >= CONFIG.ENEMIES.RANGER.idealDist) {
          this.state = 'CHASE';
        }
        break;

      case 'DEAD':
        this.active = false;
        break;
    }

    // Físicas y límites
    this.clampToArena();
    this.resolveObstacleCollisions(CONFIG.ARENA.OBSTACLES);
  }

  _handleChase(dt, player, dist, dx, dy, engine) {
    const base = CONFIG.ENEMIES[this.type];
    const dirX = dist > 0.001 ? dx / dist : 0;
    const dirY = dist > 0.001 ? dy / dist : 0;

    switch (this.type) {
      case 'HUNTER':
        this.x += dirX * this.speed * dt;
        this.y += dirY * this.speed * dt;
        if (dist <= base.attackRange) {
          this.state = 'ATTACK';
        }
        break;

      case 'RANGER':
        if (dist < base.retreatDist) {
          this.state = 'RETREAT';
        } else if (dist <= base.shootRange) {
          if (this.cooldownTimer <= 0) {
            this.state = 'ATTACK';
          }
        } else {
          this.x += dirX * this.speed * dt;
          this.y += dirY * this.speed * dt;
        }
        break;

      case 'SWARM': {
        // Separación con vecinos (Boids / Flocking) usando SpatialGrid
        let sepX = 0;
        let sepY = 0;
        const neighbors = engine.spatialGrid.query(this.x, this.y, base.separationDist);
        for (const other of neighbors) {
          if (other !== this && other instanceof Enemy) {
            const odx = this.x - other.x;
            const ody = this.y - other.y;
            const odist = Math.hypot(odx, ody);
            if (odist > 0.001 && odist < base.separationDist) {
              sepX += odx / odist;
              sepY += ody / odist;
            }
          }
        }
        this.x += (dirX + sepX * 0.75) * this.speed * dt;
        this.y += (dirY + sepY * 0.75) * this.speed * dt;

        if (dist <= this.radius + player.radius) {
          player.takeDamage(this.damage, engine.particleSystem);
        }
        break;
      }

      case 'TANK':
        this.x += dirX * this.speed * dt;
        this.y += dirY * this.speed * dt;
        if (this.cooldownTimer <= 0 && dist < 320) {
          this.state = 'ATTACK';
          this.stateTimer = base.chargeDuration;
          this.chargeDir = { x: dirX, y: dirY };
        }
        break;

      case 'KAMIKAZE':
        this.x += dirX * this.speed * dt;
        this.y += dirY * this.speed * dt;
        if (dist <= base.triggerDist) {
          this.state = 'ATTACK';
          this.primeTimer = base.primeTime;
        }
        break;
    }
  }

  _handleAttack(dt, player, dist, engine) {
    const base = CONFIG.ENEMIES[this.type];

    switch (this.type) {
      case 'HUNTER':
        player.takeDamage(this.damage, engine.particleSystem);
        this.cooldownTimer = base.attackCooldown;
        this.state = 'CHASE';
        break;

      case 'RANGER': {
        const bullet = engine.enemyBulletsPool.get();
        if (bullet) {
          bullet.spawn(
            this.x,
            this.y,
            this.angle,
            base.bulletSpeed,
            this.damage,
            650,
            base.color,
            1,
            true // isEnemy = true
          );
        }
        this.cooldownTimer = base.shootCooldown;
        this.state = 'CHASE';
        break;
      }

      case 'TANK':
        // Embestida recta a gran velocidad
        this.x += this.chargeDir.x * base.chargeSpeed * dt;
        this.y += this.chargeDir.y * base.chargeSpeed * dt;
        this.stateTimer -= dt;

        if (dist <= this.radius + player.radius) {
          player.takeDamage(this.damage, engine.particleSystem);
          this.stateTimer = 0;
        }
        if (this.stateTimer <= 0) {
          this.cooldownTimer = base.chargeCooldown;
          this.state = 'CHASE';
        }
        break;

      case 'KAMIKAZE':
        this.primeTimer -= dt;
        // Parpadeo de sobrecarga antes de explotar
        this.color = Math.floor(Date.now() / 70) % 2 === 0 ? '#ffffff' : '#ff0055';

        if (this.primeTimer <= 0) {
          engine.particleSystem.emitExplosion(this.x, this.y, '#ff0055', 45);
          if (dist <= base.explosionRadius) {
            player.takeDamage(this.damage, engine.particleSystem);
          }
          this.hp = 0;
          this.state = 'DEAD';
          this.active = false;
          engine.onEnemyKilled(this);
        }
        break;
    }
  }

  draw(ctx) {
    if (!this.active) return;

    // Sombra en el piso
    SpriteRenderer.drawShadow(ctx, this.x, this.y, this.radius);

    ctx.save();
    if (this.state === 'SPAWN') {
      ctx.globalAlpha = 0.4 + Math.sin(Date.now() / 50) * 0.3;
    }

    const spriteKey = `enemy_${this.type.toLowerCase()}`;
    const isFacingLeft = Math.cos(this.angle) < 0;
    
    // Tamaños según arquetipo
    const spriteSize = this.type === 'TANK' ? 72 : (this.type === 'SWARM' ? 26 : 42);

    const drew = SpriteRenderer.drawEntitySprite({
      ctx,
      imageKey: spriteKey,
      x: this.x,
      y: this.y,
      width: spriteSize,
      height: spriteSize,
      flipX: isFacingLeft,
      yOffset: -4
    });

    // Fallback procedural con forma y brillo si no está el PNG
    if (!drew) {
      ctx.fillStyle = this.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Barra de vida superior para Tanques
    if (this.type === 'TANK') {
      const barW = 44;
      const barH = 5;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(this.x - barW / 2, this.y - this.radius - 16, barW, barH);
      ctx.fillStyle = '#ff0055';
      ctx.fillRect(this.x - barW / 2, this.y - this.radius - 16, (this.hp / this.maxHp) * barW, barH);
    }

    ctx.restore();
  }
}
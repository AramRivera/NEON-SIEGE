// frontend/src/entities/Player.js
import { Entity } from './Entity.js';
import { CONFIG } from '../config.js';
import { assetManager } from '../SYSTEMS/AssetManager.js';

export class Player extends Entity {
  constructor(x, y) {
    super(x, y, CONFIG.PLAYER.RADIUS);

    // Estadísticas base
    this.speed = CONFIG.PLAYER.SPEED;
    this.maxHp = CONFIG.PLAYER.MAX_HP;
    this.hp = this.maxHp;
    this.maxEnergy = CONFIG.PLAYER.MAX_ENERGY;
    this.energy = this.maxEnergy;

    // Nivel y progresión
    this.level = 1;
    this.exp = 0;
    this.expNext = 50;
    this.magnetRadius = CONFIG.PLAYER.BASE_MAGNET_RADIUS;

    // Modificadores de estadísticas (Upgrades)
    this.dmgMultiplier = 1.0;
    this.fireRateMultiplier = 1.0;
    this.extraPellets = 0;

    // Control de armas
    this.currentWeaponKey = 'PISTOL';
    this.shootCooldown = 0;
    this.aimAngle = 0;

    // Habilidad especial (Dash)
    this.isDashing = false;
    this.dashTimer = 0;
    this.dashDir = { x: 0, y: 0 };
    this.invulnerableTimer = 0;

    // Máquina de estados de animación
    this.state = 'idle'; // 'idle' | 'walk' | 'attack' | 'hurt' | 'die'
    this.frameIndex = 0;
    this.frameTimer = 0;
  }

  takeDamage(amount, particleSystem) {
    if (this.invulnerableTimer > 0 || this.isDashing || !this.active) return;

    this.hp -= amount;
    this.invulnerableTimer = CONFIG.PLAYER.INVULNERABLE_TIME;
    this.state = 'hurt';

    if (particleSystem) {
      particleSystem.emitSparks(this.x, this.y, '#00f0ff', 14);
    }
    assetManager.playSound('sfx_hit', 0.4);

    if (this.hp <= 0) {
      this.hp = 0;
      this.active = false;
      this.state = 'die';
      if (particleSystem) {
        particleSystem.emitExplosion(this.x, this.y, '#00f0ff', 40);
      }
    }
  }

  dash(moveDir, particleSystem) {
    if (this.isDashing || this.energy < CONFIG.PLAYER.DASH_COST) return;
    if (moveDir.vx === 0 && moveDir.vy === 0) return;

    this.energy -= CONFIG.PLAYER.DASH_COST;
    this.isDashing = true;
    this.dashTimer = CONFIG.PLAYER.DASH_DURATION;
    this.dashDir = { x: moveDir.vx, y: moveDir.vy };

    if (particleSystem) {
      particleSystem.emitSparks(this.x, this.y, '#00f0ff', 20);
    }
    assetManager.playSound('sfx_dash', 0.5);
  }

  switchWeapon(weaponKey) {
    if (CONFIG.WEAPONS[weaponKey]) {
      this.currentWeaponKey = weaponKey;
    }
  }

  shoot(bulletsPool, particleSystem) {
    const weapon = CONFIG.WEAPONS[this.currentWeaponKey];
    if (this.energy < weapon.energyCost) return;

    this.energy -= weapon.energyCost;
    this.shootCooldown = weapon.cadence / this.fireRateMultiplier;
    this.state = 'attack';

    const totalProjectiles = weapon.pellets + this.extraPellets;

    for (let i = 0; i < totalProjectiles; i++) {
      const spreadOffset = (Math.random() - 0.5) * weapon.spread;
      const finalAngle = this.aimAngle + spreadOffset;

      const bullet = bulletsPool.get();
      if (bullet) {
        bullet.spawn(
          this.x,
          this.y,
          finalAngle,
          weapon.bulletSpeed,
          weapon.damage * this.dmgMultiplier,
          weapon.range,
          weapon.color,
          weapon.penetration,
          false // isEnemy = false
        );
      }
    }

    if (particleSystem) {
      const tipX = this.x + Math.cos(this.aimAngle) * (this.radius + 12);
      const tipY = this.y + Math.sin(this.aimAngle) * (this.radius + 12);
      particleSystem.emitSparks(tipX, tipY, weapon.color, 4);
    }

    assetManager.playSound('sfx_shoot', 0.25);
  }

  addExp(amount) {
    this.exp += amount;
    if (this.exp >= this.expNext) {
      this.exp -= this.expNext;
      this.level++;
      this.expNext = Math.floor(this.expNext * 1.45);
      return true; // Indicador de que subió de nivel
    }
    return false;
  }

  update(dt, engine) {
    if (!this.active) return;

    // 1. Regeneración de energía pasiva
    this.energy = Math.min(this.maxEnergy, this.energy + CONFIG.PLAYER.ENERGY_REGEN * dt);

    // 2. Timers de invulnerabilidad y cadencia
    if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;

    // 3. Dirección de apuntado (independiente del movimiento)
    this.aimAngle = Math.atan2(
      engine.input.mouse.worldY - this.y,
      engine.input.mouse.worldX - this.x
    );

    // 4. Manejo de movimiento o Dash
    const moveDir = engine.input.getMovementVector();

    if (this.isDashing) {
      this.x += this.dashDir.x * (this.speed * CONFIG.PLAYER.DASH_SPEED_MULT) * dt;
      this.y += this.dashDir.y * (this.speed * CONFIG.PLAYER.DASH_SPEED_MULT) * dt;
      this.dashTimer -= dt;
      if (this.dashTimer <= 0) {
        this.isDashing = false;
      }
    } else {
      this.x += moveDir.vx * this.speed * dt;
      this.y += moveDir.vy * this.speed * dt;

      if (moveDir.vx !== 0 || moveDir.vy !== 0) {
        this.state = 'walk';
      } else if (this.state !== 'attack') {
        this.state = 'idle';
      }

      // Disparador de habilidad especial (Dash)
      if (engine.input.keys['Space']) {
        this.dash(moveDir, engine.particleSystem);
      }
    }

    // 5. Cambio de armas (Teclado 1, 2, 3)
    if (engine.input.keys['Digit1']) this.switchWeapon('PISTOL');
    if (engine.input.keys['Digit2']) this.switchWeapon('SHOTGUN');
    if (engine.input.keys['Digit3']) this.switchWeapon('ENERGY_BEAM');

    // 6. Disparo principal sostenido con mouse
    if (engine.input.mouse.down && this.shootCooldown <= 0) {
      this.shoot(engine.playerBulletsPool, engine.particleSystem);
    }

    // 7. Físicas: Límites de arena y obstáculos
    this.clampToArena();
    this.resolveObstacleCollisions(CONFIG.ARENA.OBSTACLES);
  }

  draw(ctx) {
    if (!this.active) return;

    ctx.save();

    // Efecto de parpadeo al ser golpeado (invulnerabilidad)
    if (this.invulnerableTimer > 0 && Math.floor(Date.now() / 70) % 2 === 0) {
      ctx.globalAlpha = 0.35;
    }

    // Dibujo procedural cibernético (o sprite cuando se active la bandera)
    ctx.translate(this.x, this.y);
    ctx.rotate(this.aimAngle);

    // Rastro luminoso si está en Dash
    if (this.isDashing) {
      ctx.shadowBlur = 25;
      ctx.shadowColor = '#ffffff';
      ctx.fillStyle = '#ffffff';
    } else {
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#00f0ff';
      ctx.fillStyle = '#00f0ff';
    }

    // Chasis principal
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Cañón del arma activa
    const weapon = CONFIG.WEAPONS[this.currentWeaponKey];
    ctx.fillStyle = weapon.color;
    ctx.fillRect(8, -3.5, 18, 7);

    // Núcleo central de energía
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
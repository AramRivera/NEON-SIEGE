// frontend/src/entities/Player.js
import { Entity } from './Entity.js';
import { CONFIG } from '../config.js';
import { assetManager } from '../SYSTEMS/AssetManager.js';
import { SpriteRenderer } from '../SYSTEMS/SpriteRender.js';

export class Player extends Entity {
  constructor(x, y) {
    super(x, y, CONFIG.PLAYER.RADIUS);

    this.speed = CONFIG.PLAYER.SPEED;
    this.maxHp = CONFIG.PLAYER.MAX_HP;
    this.hp = this.maxHp;
    this.maxEnergy = CONFIG.PLAYER.MAX_ENERGY;
    this.energy = this.maxEnergy;

    // Inventario de Munición por arma
    this.ammo = {
      PISTOL: CONFIG.WEAPONS.PISTOL.startAmmo,
      SHOTGUN: CONFIG.WEAPONS.SHOTGUN.startAmmo,
      ENERGY_BEAM: CONFIG.WEAPONS.ENERGY_BEAM.startAmmo
    };

    // Nivel y progresión
    this.level = 1;
    this.exp = 0;
    this.expNext = 50;
    this.magnetRadius = CONFIG.PLAYER.BASE_MAGNET_RADIUS;

    this.dmgMultiplier = 1.0;
    this.fireRateMultiplier = 1.0;
    this.extraPellets = 0;

    this.currentWeaponKey = 'PISTOL';
    this.shootCooldown = 0;
    this.aimAngle = 0;

    this.isDashing = false;
    this.dashTimer = 0;
    this.dashDir = { x: 0, y: 0 };
    this.invulnerableTimer = 0;

    this.state = 'idle';
  }

  // Método para recargar munición al recoger cajas
  addAmmo(weaponKey = null, amount = null) {
    if (weaponKey && CONFIG.WEAPONS[weaponKey]) {
      const max = CONFIG.WEAPONS[weaponKey].maxAmmo;
      const add = amount || CONFIG.WEAPONS[weaponKey].ammoPerPickup || 10;
      this.ammo[weaponKey] = Math.min(max, this.ammo[weaponKey] + add);
    } else {
      // Recarga general para todas las armas que no sean infinitas
      ['SHOTGUN', 'ENERGY_BEAM'].forEach((wKey) => {
        const max = CONFIG.WEAPONS[wKey].maxAmmo;
        const add = CONFIG.WEAPONS[wKey].ammoPerPickup || 10;
        this.ammo[wKey] = Math.min(max, this.ammo[wKey] + add);
      });
    }
  }

  takeDamage(amount, particleSystem) {
    if (this.invulnerableTimer > 0 || this.isDashing || !this.active) return;
    this.hp -= amount;
    this.invulnerableTimer = CONFIG.PLAYER.INVULNERABLE_TIME;
    this.state = 'hurt';

    if (particleSystem) particleSystem.emitSparks(this.x, this.y, '#00f0ff', 14);
    assetManager.playSound('sfx_hit', 0.4);

    if (this.hp <= 0) {
      this.hp = 0;
      this.active = false;
      this.state = 'die';
      if (particleSystem) particleSystem.emitExplosion(this.x, this.y, '#00f0ff', 40);
    }
  }

  dash(moveDir, particleSystem) {
    if (this.isDashing || this.energy < CONFIG.PLAYER.DASH_COST) return;
    if (moveDir.vx === 0 && moveDir.vy === 0) return;

    this.energy -= CONFIG.PLAYER.DASH_COST;
    this.isDashing = true;
    this.dashTimer = CONFIG.PLAYER.DASH_DURATION;
    this.dashDir = { x: moveDir.vx, y: moveDir.vy };

    if (particleSystem) particleSystem.emitSparks(this.x, this.y, '#00f0ff', 20);
    assetManager.playSound('sfx_dash', 0.5);
  }

  switchWeapon(weaponKey) {
    if (CONFIG.WEAPONS[weaponKey]) {
      this.currentWeaponKey = weaponKey;
    }
  }

  shoot(bulletsPool, particleSystem) {
    const weapon = CONFIG.WEAPONS[this.currentWeaponKey];

    // Verificación de munición
    if (this.ammo[this.currentWeaponKey] <= 0) {
      if (particleSystem) {
        // Chispa pequeña que avisa visualmente "clic en seco"
        const tipX = this.x + Math.cos(this.aimAngle) * (this.radius + 14);
        const tipY = this.y + Math.sin(this.aimAngle) * (this.radius + 14);
        particleSystem.emitSparks(tipX, tipY, '#ffaa00', 2);
      }
      return;
    }

    // Verificación de energía
    if (this.energy < weapon.energyCost) return;

    // Consumir recursos
    this.energy -= weapon.energyCost;
    if (this.ammo[this.currentWeaponKey] !== Infinity) {
      this.ammo[this.currentWeaponKey]--;
    }

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
          false
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
      return true;
    }
    return false;
  }

  update(dt, engine) {
    if (!this.active) return;

    this.energy = Math.min(this.maxEnergy, this.energy + CONFIG.PLAYER.ENERGY_REGEN * dt);
    if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;

    this.aimAngle = Math.atan2(
      engine.input.mouse.worldY - this.y,
      engine.input.mouse.worldX - this.x
    );

    const moveDir = engine.input.getMovementVector();

    if (this.isDashing) {
      this.x += this.dashDir.x * (this.speed * CONFIG.PLAYER.DASH_SPEED_MULT) * dt;
      this.y += this.dashDir.y * (this.speed * CONFIG.PLAYER.DASH_SPEED_MULT) * dt;
      this.dashTimer -= dt;
      if (this.dashTimer <= 0) this.isDashing = false;
    } else {
      this.x += moveDir.vx * this.speed * dt;
      this.y += moveDir.vy * this.speed * dt;

      if (moveDir.vx !== 0 || moveDir.vy !== 0) {
        this.state = 'walk';
      } else if (this.state !== 'attack') {
        this.state = 'idle';
      }

      if (engine.input.keys['Space']) {
        this.dash(moveDir, engine.particleSystem);
      }
    }

    if (engine.input.keys['Digit1']) this.switchWeapon('PISTOL');
    if (engine.input.keys['Digit2']) this.switchWeapon('SHOTGUN');
    if (engine.input.keys['Digit3']) this.switchWeapon('ENERGY_BEAM');

    if (engine.input.mouse.down && this.shootCooldown <= 0) {
      this.shoot(engine.playerBulletsPool, engine.particleSystem);
    }

    this.clampToArena();
    this.resolveObstacleCollisions(CONFIG.ARENA.OBSTACLES);
  }

  draw(ctx) {
    if (!this.active) return;

    // 1. Sombra en el piso
    SpriteRenderer.drawShadow(ctx, this.x, this.y, this.radius);

    ctx.save();
    if (this.invulnerableTimer > 0 && Math.floor(Date.now() / 70) % 2 === 0) {
      ctx.globalAlpha = 0.35;
    }

    // 2. Intentar dibujar sprite si existe
    // Se voltea horizontalmente (flipX) si apunta hacia la izquierda
    const isFacingLeft = Math.abs(this.aimAngle) > Math.PI / 2;
    const drew = SpriteRenderer.drawEntitySprite({
      ctx,
      imageKey: 'player',
      x: this.x,
      y: this.y,
      width: 48,
      height: 48,
      flipX: isFacingLeft,
      yOffset: -6 // Eleva el torso para dar perspectiva 2.5D
    });

    // 3. Fallback procedural si aún no agregaste player_walk.png
    if (!drew) {
      ctx.translate(this.x, this.y);
      ctx.rotate(this.aimAngle);

      ctx.shadowBlur = this.isDashing ? 25 : 12;
      ctx.shadowColor = this.isDashing ? '#ffffff' : '#00f0ff';
      ctx.fillStyle = this.isDashing ? '#ffffff' : '#00f0ff';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();

      const weapon = CONFIG.WEAPONS[this.currentWeaponKey];
      ctx.fillStyle = weapon.color;
      ctx.fillRect(8, -3.5, 18, 7);

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
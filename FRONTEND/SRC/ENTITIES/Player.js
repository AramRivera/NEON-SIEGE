/**
 * Player — piloto controlable.
 * Lógica: movimiento 8-dir, dash con energía, 3 armas, magnetismo de pickups.
 * Animación: FSM idle/walk/attack/hurt/die según spritesheet del arma activa.
 * Colisiones: clamp de arena + obstáculos AABB (Entity).
 */
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

    this.ammo = {
      PISTOL: CONFIG.WEAPONS.PISTOL.startAmmo,
      SHOTGUN: CONFIG.WEAPONS.SHOTGUN.startAmmo,
      ENERGY_BEAM: CONFIG.WEAPONS.ENERGY_BEAM.startAmmo
    };

    this.weaponModifiers = {
      PISTOL:      { fireRateMult: 1.0, dmgMult: 1.0 },
      SHOTGUN:     { fireRateMult: 1.0, dmgMult: 1.0 },
      ENERGY_BEAM: { fireRateMult: 1.0, dmgMult: 1.0 }
    };

    this.level = 1;
    this.exp = 0;
    this.expNext = 50;
    this.magnetRadius = CONFIG.PLAYER.BASE_MAGNET_RADIUS;
    this.extraPellets = 0;

    this.currentWeaponKey = 'PISTOL';
    this.shootCooldown = 0;
    this.aimAngle = 0;

    this.isDashing = false;
    this.dashTimer = 0;
    this.dashDir = { x: 0, y: 0 };
    this.invulnerableTimer = 0;

    /** FSM visual (independiente del cooldown de disparo). */
    this.state = 'idle';
    this.frameIndex = 0;
    this.frameTimer = 0;
  }

  addSpecificAmmo(weaponKey, amount) {
    if (!this.ammo[weaponKey] || this.ammo[weaponKey] === Infinity) return;
    const max = CONFIG.WEAPONS[weaponKey].maxAmmo;
    this.ammo[weaponKey] = Math.min(max, this.ammo[weaponKey] + amount);
  }

  /** Colisión de daño: i-frames + dash anulan el hit. */
  takeDamage(amount, particleSystem) {
    if (this.invulnerableTimer > 0 || this.isDashing || !this.active) return;
    this.hp -= amount;
    this.invulnerableTimer = CONFIG.PLAYER.INVULNERABLE_TIME;
    this.state = 'hurt';
    this.frameIndex = 0;

    if (particleSystem) particleSystem.emitSparks(this.x, this.y, '#00f0ff', 14);
    assetManager.playSound('sfx_hit', 0.4);

    if (this.hp <= 0) {
      this.hp = 0;
      this.active = false;
      this.state = 'die';
      this.frameIndex = 0;
      if (particleSystem) particleSystem.emitExplosion(this.x, this.y, '#00f0ff', 40);
    }
  }

  /** Dash: consume energía y aplica un impulso corto (invulnerable implícito). */
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

  /**
   * Disparo: gasta munición/energía, aplica spread y saca balas del ObjectPool.
   * pellets extra de level-up solo afectan a la escopeta.
   */
  shoot(bulletsPool, particleSystem) {
    const weapon = CONFIG.WEAPONS[this.currentWeaponKey];
    const mods = this.weaponModifiers[this.currentWeaponKey];

    if (this.ammo[this.currentWeaponKey] <= 0) {
      if (particleSystem) {
        const tipX = this.x + Math.cos(this.aimAngle) * (this.radius + 14);
        const tipY = this.y + Math.sin(this.aimAngle) * (this.radius + 14);
        particleSystem.emitSparks(tipX, tipY, '#ffaa00', 2);
      }
      return;
    }

    if (this.energy < weapon.energyCost) return;

    this.energy -= weapon.energyCost;
    if (this.ammo[this.currentWeaponKey] !== Infinity) {
      this.ammo[this.currentWeaponKey]--;
    }

    this.shootCooldown = weapon.cadence / mods.fireRateMult;
    this.state = 'attack';
    this.frameIndex = 0;

    const totalProjectiles = weapon.pellets + (this.currentWeaponKey === 'SHOTGUN' ? this.extraPellets : 0);
    for (let i = 0; i < totalProjectiles; i++) {
      const spreadOffset = (Math.random() - 0.5) * weapon.spread;
      const finalAngle = this.aimAngle + spreadOffset;

      const bullet = bulletsPool.get();
      if (bullet) {
        let spriteKey = 'bullet_pistol';
        if (this.currentWeaponKey === 'SHOTGUN') spriteKey = 'bullet_shotgun';
        else if (this.currentWeaponKey === 'ENERGY_BEAM') spriteKey = 'bullet_plasma';

        bullet.spawn(
          this.x,
          this.y,
          finalAngle,
          weapon.bulletSpeed,
          weapon.damage * mods.dmgMult,
          weapon.range,
          weapon.color,
          weapon.penetration,
          false,
          spriteKey
        );
      }
    }

    if (particleSystem) {
      const tipX = this.x + Math.cos(this.aimAngle) * (this.radius + 12);
      const tipY = this.y + Math.sin(this.aimAngle) * (this.radius + 12);
      particleSystem.emitSparks(tipX, tipY, weapon.color, 4);
    }

     // ---- AUDIO: disparo específico según arma ----
    if (this.currentWeaponKey === 'SHOTGUN') {
      assetManager.playSound('sfx_shoot_shotgun', 0.4);
    } else if (this.currentWeaponKey === 'ENERGY_BEAM') {
      assetManager.playSound('sfx_shoot_plasma', 0.35);
    } else {
      assetManager.playSound('sfx_shoot', 0.22);
    }
  }

  /** Sube de nivel cuando exp >= expNext (curva 1.45). Devuelve true si hubo level-up. */
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

  /** Avanza frames del spritesheet; attack/hurt vuelven a idle al terminar. */
  _updateAnimation(dt) {
    let sheetKey = 'player_pistol';
    if (this.currentWeaponKey === 'SHOTGUN') sheetKey = 'player_shotgun';
    else if (this.currentWeaponKey === 'ENERGY_BEAM') sheetKey = 'player_energy_beam';

    const sheetConfig = CONFIG.ASSETS.SPRITES[sheetKey];
    const anim = sheetConfig && sheetConfig.animations ? sheetConfig.animations[this.state] : null;
    const speed = anim ? anim.speed : 0.12;

    this.frameTimer += dt;
    if (this.frameTimer >= speed) {
      this.frameTimer = 0;
      this.frameIndex++;

      if (anim && this.frameIndex >= anim.frames) {
        if (this.state === 'die') {
          this.frameIndex = anim.frames - 1;
        } else if (this.state === 'attack' || this.state === 'hurt') {
          this.state = 'idle';
          this.frameIndex = 0;
        } else {
          this.frameIndex = 0;
        }
      }
    }
  }

  /** Lógica de un frame: energía, apuntado al mouse, dash, armas 1-3, disparo LMB. */
  update(dt, engine) {
    if (!this.active && this.state !== 'die') return;

    this._updateAnimation(dt);

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
        if (this.state !== 'attack' && this.state !== 'hurt') {
          this.state = 'walk';
        }
      } else if (this.state !== 'attack' && this.state !== 'hurt') {
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

  /** Sprite del arma + flipX según ángulo de apuntado; parpadeo en i-frames. */
  draw(ctx) {
    SpriteRenderer.drawShadow(ctx, this.x, this.y, this.radius);

    ctx.save();
    if (this.invulnerableTimer > 0 && Math.floor(Date.now() / 70) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    const isFacingLeft = Math.abs(this.aimAngle) > Math.PI / 2;

    let sheetKey = 'player_pistol';
    if (this.currentWeaponKey === 'SHOTGUN') sheetKey = 'player_shotgun';
    else if (this.currentWeaponKey === 'ENERGY_BEAM') sheetKey = 'player_energy_beam';

    const drew = SpriteRenderer.drawAnimatedSprite({
      ctx,
      imageKey: sheetKey,
      animState: this.state,
      frameIndex: this.frameIndex,
      x: this.x,
      y: this.y,
      width: 58,
      height: 58,
      angle: 0,
      flipX: isFacingLeft
    });

    if (!drew) {
      ctx.translate(this.x, this.y);
      ctx.rotate(this.aimAngle);
      ctx.fillStyle = this.isDashing ? '#ffffff' : '#00f0ff';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();

      const weapon = CONFIG.WEAPONS[this.currentWeaponKey];
      ctx.fillStyle = weapon.color;
      ctx.fillRect(8, -3.5, 18, 7);
    }

    ctx.restore();
  }
}
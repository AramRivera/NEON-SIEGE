// frontend/src/core/Engine.js
import { CONFIG } from '../config.js';
import { InputHandler } from './Input.js';
import { Camera } from './Camera.js';
import { SpatialGrid } from './SpatialGrid.js';
import { ObjectPool } from '../SYSTEMS/ObjectPool.js';
import { ParticleSystem } from '../SYSTEMS/ParticleSystem.js';
import { WaveManager } from '../SYSTEMS/WaveManager.js';
import { assetManager } from '../SYSTEMS/AssetManager.js';
import { ApiService } from '../SYSTEMS/ApiService.js';
import { Projectile } from '../ENTITIES/Projectile.js';
import { Player } from '../ENTITIES/Player.js';
import { Pickup } from '../ENTITIES/Pickup.js';
import { DebugOverlay } from '../TOOLS/DebugOverlay.js';

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.canvas.width = window.innerWidth || 800;
    this.canvas.height = window.innerHeight || 600;

    this.input = new InputHandler(this.canvas);
    this.camera = new Camera(this.canvas.width, this.canvas.height);
    this.spatialGrid = new SpatialGrid(CONFIG.ARENA.WIDTH, CONFIG.ARENA.HEIGHT, CONFIG.ARENA.GRID_CELL_SIZE);

    this.particleSystem = new ParticleSystem();
    this.playerBulletsPool = new ObjectPool(() => new Projectile(), CONFIG.POOLS.PLAYER_BULLETS);
    this.enemyBulletsPool = new ObjectPool(() => new Projectile(), CONFIG.POOLS.ENEMY_BULLETS);

    this.player = new Player(CONFIG.ARENA.WIDTH / 2, CONFIG.ARENA.HEIGHT / 2);
    this.enemies = [];
    this.pickups = [];
    this.currentBoss = null;

    this.score = 0;
    this.kills = 0;
    this.bossesDefeated = 0;
    this.gameTime = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.comboMult = 1.0;

        this.waveManager = new WaveManager(this);

    // ---- MODO DEBUG (F3) ----
    this.debug = new DebugOverlay();
    window.addEventListener('keydown', (e) => {
      if (e.code === CONFIG.DEBUG.KEY && !e.repeat) {
        e.preventDefault(); // evita búsqueda de Firefox / dev-tools
        this.debug.toggle();
      }
    });

    this.lastTime = performance.now();
    this.isPaused = false;
    this._pauseKeyCooldown = false; // anti-rebote de la tecla de pausa
    this.isRunning = false;
    this.isGameOver = false;

    // ---- AUDIO: volumen master (sincronizado con los ajustes del menú) ----
    this.masterVolume = assetManager.masterVolume;
    // ---- AUDIO: pantalla de game over ----
    this.screenShakeEnabled = true;

    this._setupUIListeners();
    this._spawnInitialPickups();
    this._setupAudioUnlock();
    this._setupPauseMenu();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  // ------------------------------------------------------------
  //  AUDIO: desbloquear reproducción tras la primera interacción
  // ------------------------------------------------------------
  _setupAudioUnlock() {
    const unlock = () => {
      assetManager.unlockAudio();
      // Reanudar BGM si quedó pendiente por el bloqueo de autoplay
      if (this.isRunning && CONFIG.ASSETS.USE_AUDIO) {
        assetManager.playBgm('bgm_arena', { loop: true, fadeIn: 0.8 });
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  // En frontend/src/core/Engine.js dentro de _spawnInitialPickups():
  _spawnInitialPickups() {
    const cx = CONFIG.ARENA.WIDTH / 2;
    const cy = CONFIG.ARENA.HEIGHT / 2;
    // Caja roja para Escopeta y caja verde para Plasma
    this.pickups.push(new Pickup(cx - 150, cy - 80, 'ammo_shotgun', 16, 'SHOTGUN'));
    this.pickups.push(new Pickup(cx + 150, cy + 80, 'ammo_plasma', 8, 'ENERGY_BEAM'));
    this.pickups.push(new Pickup(cx - 200, cy + 60, 'exp', 30));
    this.pickups.push(new Pickup(cx + 200, cy - 60, 'exp', 30));
  }

  _setupUIListeners() {
    // Guardar Puntuación
    const btnSave = document.getElementById('btn-save-score');
    if (btnSave) {
      btnSave.onclick = async () => {
        const input = document.getElementById('player-name-input');
        const playerName = (input?.value.trim()) || 'Piloto Neon';

        btnSave.disabled = true;
        btnSave.innerText = 'Guardando...';

        await ApiService.saveScore({
          player: playerName,
          score: this.score,
          wave: this.waveManager.currentWave,
          timeSurvived: Math.floor(this.gameTime),
          kills: this.kills,
          bossesDefeated: this.bossesDefeated
        });

        btnSave.innerText = '¡Guardado!';
        this.loadLeaderboard();
      };
    }

    // Reiniciar
    const btnRestart = document.getElementById('btn-restart');
    if (btnRestart) {
      btnRestart.onclick = () => window.location.reload();
    }
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    if (this.camera) {
      this.camera.resize(this.canvas.width, this.canvas.height);
    }
  }

    // ------------------------------------------------------------
  //  MENÚ DE PAUSA (ESC o P)
  // ------------------------------------------------------------
  _setupPauseMenu() {
    // Detectar ESC / P para alternar pausa
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (e.repeat) return;
        if (this.isGameOver) return;
        // No pausar si hay un level-up pendiente
        const lvlModal = document.getElementById('modal-levelup');
        if (lvlModal && lvlModal.classList.contains('active')) return;
        this.togglePause();
      }
    });

    const btnResume = document.getElementById('btn-resume');
    if (btnResume) btnResume.onclick = () => this.setPause(false);

    const btnRestart = document.getElementById('btn-pause-restart');
    if (btnRestart) btnRestart.onclick = () => window.location.reload();

    const btnQuit = document.getElementById('btn-pause-quit');
    if (btnQuit) btnQuit.onclick = () => window.location.reload();

    // Sub-vista de ajustes dentro de la pausa
    const btnSettings = document.getElementById('btn-pause-settings');
    const btnBack = document.getElementById('btn-pause-back');
    const viewMain = document.getElementById('pause-view');
    const viewSettings = document.getElementById('pause-settings-view');
    if (btnSettings) btnSettings.onclick = () => {
      viewMain?.classList.remove('active');
      viewSettings?.classList.add('active');
    };
    if (btnBack) btnBack.onclick = () => {
      viewSettings?.classList.remove('active');
      viewMain?.classList.add('active');
    };

    // Sincronizar controles de ajustes con el estado global
    const chkAudio = document.getElementById('pause-audio');
    const rngVolume = document.getElementById('pause-master-volume');
    if (chkAudio) {
      chkAudio.checked = CONFIG.ASSETS.USE_AUDIO;
      chkAudio.onchange = async () => {
        await assetManager.setAudioEnabled(chkAudio.checked);
        const mainChk = document.getElementById('setting-audio');
        if (mainChk) mainChk.checked = chkAudio.checked;
      };
    }
    if (rngVolume) {
      rngVolume.value = assetManager.masterVolume;
      rngVolume.oninput = () => {
        assetManager.setMasterVolume(parseFloat(rngVolume.value));
        const mainRng = document.getElementById('setting-master-volume');
        if (mainRng) mainRng.value = rngVolume.value;
      };
    }
  }

  togglePause() {
    this.setPause(!this.isPaused);
  }

  setPause(paused) {
    this.isPaused = paused;
    const modal = document.getElementById('modal-pause');
    if (modal) modal.classList.toggle('active', paused);

    // Volver siempre a la vista principal al pausar
    document.getElementById('pause-view')?.classList.add('active');
    document.getElementById('pause-settings-view')?.classList.remove('active');

    // ---- AUDIO: bajar la música al pausar ----
    if (paused) {
      assetManager.playSound('sfx_pickup', 0.15); // feedback sutil opcional
    }
  }

  start() {
    this.isRunning = true;
    this.lastTime = performance.now();

    // ---- AUDIO: arrancar música de fondo de la arena (con fade in) ----
    assetManager.playBgm('bgm_arena', { loop: true, fadeIn: 1.2 });

    this.waveManager.startWave(1);
    requestAnimationFrame((time) => this._loop(time));
  }

  onEnemyKilled(enemy) {
    this.kills++;
    this.comboCount++;
    this.comboTimer = CONFIG.SCORING.COMBO_TIMEOUT;
    this.comboMult = Math.min(CONFIG.SCORING.MAX_MULTIPLIER, 1.0 + this.comboCount * CONFIG.SCORING.COMBO_MULTIPLIER_STEP);
    this.score += Math.floor(CONFIG.SCORING.KILL_BASE * this.comboMult);
  }

  onBossDefeated(boss) {
    this.bossesDefeated++;
    this.score += Math.floor(CONFIG.SCORING.BOSS_BASE * this.comboMult);
    this.currentBoss = null;
    // ---- AUDIO: explosión potente al morir el jefe ----
    assetManager.playSound('sfx_boom', 0.7);
  }

  triggerLevelUp() {
    this.isPaused = true;

    // ---- AUDIO: sonido de subida de nivel ----
    assetManager.playSound('sfx_levelup', 0.6);

    // Mejoras independientes por arma y de movilidad
    const availableUpgrades = [
      {
        title: 'Cadencia: Pistola +35%',
        desc: 'Aumenta significativamente la velocidad de disparo de tu pistola rápida.',
        apply: () => { this.player.weaponModifiers.PISTOL.fireRateMult += 0.35; }
      },
      {
        title: 'Cadencia: Escopeta +25%',
        desc: 'Reduce el tiempo de recarga entre ráfagas de perdigones.',
        apply: () => { this.player.weaponModifiers.SHOTGUN.fireRateMult += 0.25; }
      },
      {
        title: 'Cadencia: Plasma +20%',
        desc: 'Acelera la salida de los rayos penetrantes de energía.',
        apply: () => { this.player.weaponModifiers.ENERGY_BEAM.fireRateMult += 0.20; }
      },
      {
        title: 'Potencia: Escopeta (+Perdigón)',
        desc: 'Añade +1 perdigón extra a cada descarga de escopeta.',
        apply: () => { this.player.extraPellets += 1; }
      },
      {
        title: 'Daño Plasma +30%',
        desc: 'Incrementa la potencia destructiva de los rayos de plasma.',
        apply: () => { this.player.weaponModifiers.ENERGY_BEAM.dmgMult += 0.30; }
      },
      {
        title: 'Servos: +40 Velocidad',
        desc: 'Mejora la velocidad de carrera en todas las direcciones.',
        apply: () => { this.player.speed += 40; }
      },
      {
        title: 'Imán Ampliado +60px',
        desc: 'Atrae munición y gemas de experiencia desde mayor distancia.',
        apply: () => { this.player.magnetRadius += 60; }
      }
    ];

    const selected = availableUpgrades.sort(() => 0.5 - Math.random()).slice(0, 3);
    const container = document.getElementById('upgrades-container');
    if (!container) return;

    container.innerHTML = '';
    selected.forEach(upg => {
      const card = document.createElement('div');
      card.className = 'upgrade-card';
      card.innerHTML = `<h4>${upg.title}</h4><p>${upg.desc}</p>`;
      card.onclick = () => {
        upg.apply();
        document.getElementById('modal-levelup')?.classList.remove('active');
        this.isPaused = false;
      };
      container.appendChild(card);
    });

    document.getElementById('modal-levelup')?.classList.add('active');
  }

  async onGameOver() {
    this.isGameOver = true;

    // ---- AUDIO: detener la música de fondo ----
    assetManager.stopBgm(1.0);

    // Actualizar datos del modal
    document.getElementById('final-score').innerText = this.score;
    document.getElementById('final-wave').innerText = this.waveManager.currentWave;
    document.getElementById('final-kills').innerText = this.kills;

    const m = Math.floor(this.gameTime / 60).toString().padStart(2, '0');
    const s = Math.floor(this.gameTime % 60).toString().padStart(2, '0');
    document.getElementById('final-time').innerText = `${m}:${s}`;

    document.getElementById('modal-gameover')?.classList.add('active');
    await this.loadLeaderboard();
  }

  async loadLeaderboard() {
    const scores = await ApiService.getTopScores();
    const tbody = document.getElementById('scores-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (scores.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#888;">No hay registros en PostgreSQL aún.</td></tr>';
      return;
    }

    scores.forEach((entry, idx) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${idx + 1}</td>
        <td style="color:#00f0ff;">${entry.player}</td>
        <td>${entry.score}</td>
        <td>${entry.wave}</td>
        <td>${entry.kills}</td>
      `;
      tbody.appendChild(row);
    });
  }

    _loop(currentTime) {
    if (!this.isRunning) return;

    const dt = Math.min(0.1, (currentTime - this.lastTime) / 1000);
    this.lastTime = currentTime;

    // ---- DEBUG: métricas de rendimiento (solo si activo) ----
    this.debug.update(dt);

    if (!this.isPaused && !this.isGameOver) {
      this.update(dt);
    }
    this.render();

    requestAnimationFrame((time) => this._loop(time));
  }

  update(dt) {
    this.gameTime += dt;
    this.input.updateWorldCoordinates(this.camera.x, this.camera.y);

    this.player.update(dt, this);
    if (!this.player.active && !this.isGameOver) {
      this.onGameOver();
    }
    this.camera.follow(this.player.x, this.player.y);

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
        this.comboMult = 1.0;
      }
    }

    this.waveManager.update(dt);

    this.spatialGrid.clear();
    for (let i = 0; i < this.enemies.length; i++) {
      this.spatialGrid.insert(this.enemies[i]);
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.update(dt, this);
      if (!e.active) this.enemies.splice(i, 1);
    }

    if (this.currentBoss) {
      this.currentBoss.update(dt, this);
    }

    // Colisiones proyectiles jugador
    const activePlayerBullets = this.playerBulletsPool.getActive();
    for (let i = 0; i < activePlayerBullets.length; i++) {
      const b = activePlayerBullets[i];
      b.update(dt, CONFIG.ARENA.OBSTACLES);
      if (!b.active) continue;

      if (this.currentBoss && Math.hypot(b.x - this.currentBoss.x, b.y - this.currentBoss.y) < b.radius + this.currentBoss.radius) {
        this.currentBoss.takeDamage(b.damage, this);
        b.hitsLeft--;
        if (b.hitsLeft <= 0) b.active = false;
      }

      const nearby = this.spatialGrid.query(b.x, b.y, b.radius + 30);
      for (const enemy of nearby) {
        if (!b.active) break;
        if (enemy.active && Math.hypot(b.x - enemy.x, b.y - enemy.y) < b.radius + enemy.radius) {
          enemy.takeDamage(b.damage, this);
          b.hitsLeft--;
          if (b.hitsLeft <= 0) { b.active = false; }
        }
      }
    }

    // Balas enemigas
    const activeEnemyBullets = this.enemyBulletsPool.getActive();
    for (let i = 0; i < activeEnemyBullets.length; i++) {
      const b = activeEnemyBullets[i];
      b.update(dt, CONFIG.ARENA.OBSTACLES);
      if (!b.active) continue;

      if (Math.hypot(b.x - this.player.x, b.y - this.player.y) < b.radius + this.player.radius) {
        this.player.takeDamage(b.damage, this.particleSystem);
        b.active = false;
      }
    }

    // Pickups y absorción
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.update(dt, this.player);

      const dist = Math.hypot(p.x - this.player.x, p.y - this.player.y);
      if (dist < p.radius + this.player.radius) {
        if (p.type === 'ammo_shotgun') {
          this.player.addSpecificAmmo('SHOTGUN', p.value);
          this.particleSystem.emitSparks(p.x, p.y, '#ff0077', 16);
          assetManager.playSound('sfx_pickup', 0.5);
        } else if (p.type === 'ammo_plasma') {
          this.player.addSpecificAmmo('ENERGY_BEAM', p.value);
          this.particleSystem.emitSparks(p.x, p.y, '#39ff14', 16);
          assetManager.playSound('sfx_pickup', 0.5);
        } else if (p.type === 'exp') {
          const leveledUp = this.player.addExp(p.value);
          this.particleSystem.emitSparks(p.x, p.y, '#aa00ff', 12);
          assetManager.playSound('sfx_pickup', 0.25);
          if (leveledUp) this.triggerLevelUp();
        } else if (p.type === 'heal') {
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + p.value);
          this.particleSystem.emitSparks(p.x, p.y, '#00ff66', 14);
          assetManager.playSound('sfx_pickup', 0.5);
        }
        this.pickups.splice(i, 1);
      }
    }

    this.particleSystem.update(dt);
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    const camX = Math.floor(this.camera.x || 0);
    const camY = Math.floor(this.camera.y || 0);
    this.ctx.translate(-camX, -camY);

    this._drawArena();

    for (let i = 0; i < this.pickups.length; i++) this.pickups[i].draw(this.ctx);

    const playerBullets = this.playerBulletsPool.getActive();
    for (let i = 0; i < playerBullets.length; i++) playerBullets[i].draw(this.ctx);

    const enemyBullets = this.enemyBulletsPool.getActive();
    for (let i = 0; i < enemyBullets.length; i++) enemyBullets[i].draw(this.ctx);

    for (let i = 0; i < this.enemies.length; i++) this.enemies[i].draw(this.ctx);
    if (this.currentBoss) this.currentBoss.draw(this.ctx);

    this.player.draw(this.ctx);
    this.particleSystem.draw(this.ctx);

    // ---- DEBUG FASE 2: capa de MUNDO (dentro del translate de la cámara) ----
    this.debug.renderWorldLayer(this.ctx, this);

    this.ctx.restore();

    this._drawHUD();

    // ---- DEBUG: panel de PANTALLA (encima de todo) ----
    this.debug.render(this.ctx, this);
  }

  _drawHUD() {
    this.ctx.save();
    const p = this.player;
    const w = CONFIG.WEAPONS[p.currentWeaponKey];

    // Barra de Jefe
    if (this.currentBoss) {
      const bw = 400;
      const bx = (this.canvas.width - bw) / 2;
      this.ctx.fillStyle = 'rgba(0,0,0,0.8)';
      this.ctx.fillRect(bx, 20, bw, 14);
      this.ctx.fillStyle = '#ff0055';
      this.ctx.fillRect(bx, 20, (this.currentBoss.hp / this.currentBoss.maxHp) * bw, 14);
      this.ctx.strokeStyle = '#fff';
      this.ctx.strokeRect(bx, 20, bw, 14);

      this.ctx.font = 'bold 12px monospace';
      this.ctx.fillStyle = '#fff';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`${this.currentBoss.name} [FASE ${this.currentBoss.phase}]`, this.canvas.width / 2, 16);
    }

    // Puntuación y Oleada
    this.ctx.textAlign = 'center';
    this.ctx.font = 'bold 16px monospace';
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.fillText(`SCORE: ${this.score}`, this.canvas.width / 2, 55);

    this.ctx.font = '13px monospace';
    this.ctx.fillStyle = '#ff0077';
    this.ctx.fillText(`OLEADA: ${this.waveManager.currentWave}`, this.canvas.width / 2, 74);

    if (this.comboCount > 1) {
      this.ctx.font = 'bold 14px monospace';
      this.ctx.fillStyle = '#ffd700';
      this.ctx.fillText(`COMBO x${this.comboMult.toFixed(2)}`, this.canvas.width / 2, 94);
    }

    // Panel Jugador
    this.ctx.textAlign = 'left';
    const hudX = 24;
    const hudY = this.canvas.height - 90;

    this.ctx.fillStyle = 'rgba(7, 11, 20, 0.8)';
    this.ctx.strokeStyle = '#00f0ff';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(hudX, hudY, 280, 70);
    this.ctx.fillRect(hudX, hudY, 280, 70);

    // Barra de Vida
    this.ctx.fillStyle = '#ff0055';
    this.ctx.fillRect(hudX + 10, hudY + 12, (p.hp / p.maxHp) * 120, 8);
    this.ctx.strokeStyle = '#333';
    this.ctx.strokeRect(hudX + 10, hudY + 12, 120, 8);

    // Barra de Energía
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.fillRect(hudX + 10, hudY + 26, (p.energy / p.maxEnergy) * 120, 8);
    this.ctx.strokeStyle = '#333';
    this.ctx.strokeRect(hudX + 10, hudY + 26, 120, 8);

    // Balas y Arma
    this.ctx.font = 'bold 12px monospace';
    this.ctx.fillStyle = w.color;
    this.ctx.fillText(w.name.toUpperCase(), hudX + 140, hudY + 20);

    this.ctx.font = 'bold 14px monospace';
    this.ctx.fillStyle = '#ffd700';
    const ammoText = p.ammo[p.currentWeaponKey] === Infinity ? 'INF' : `${p.ammo[p.currentWeaponKey]} / ${w.maxAmmo}`;
    this.ctx.fillText(`AMMO: ${ammoText}`, hudX + 140, hudY + 40);

    this.ctx.font = '10px monospace';
    this.ctx.fillStyle = '#888';
    this.ctx.fillText(`LVL: ${p.level}  EXP: ${p.exp}/${p.expNext}`, hudX + 10, hudY + 56);

    this.ctx.restore();
  }

  _drawArena() {
    // 1. DIBUJAR SUELO CON TEXTURA REPETIDA
    const floorImg = assetManager.getImage('tile_floor');
    if (floorImg) {
      const pattern = this.ctx.createPattern(floorImg, 'repeat');
      this.ctx.fillStyle = pattern;
      this.ctx.fillRect(0, 0, CONFIG.ARENA.WIDTH, CONFIG.ARENA.HEIGHT);
    } else {
      // Color base de respaldo si no hay imagen de piso
      this.ctx.fillStyle = '#060913';
      this.ctx.fillRect(0, 0, CONFIG.ARENA.WIDTH, CONFIG.ARENA.HEIGHT);
    }

    // 2. Cuadrícula de depuración (opcional)
    if (CONFIG.ARENA.SHOW_DEBUG_GRID) {
      this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
      this.ctx.lineWidth = 1;
      const step = CONFIG.ARENA.GRID_CELL_SIZE;
      for (let x = 0; x <= CONFIG.ARENA.WIDTH; x += step) {
        this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, CONFIG.ARENA.HEIGHT); this.ctx.stroke();
      }
      for (let y = 0; y <= CONFIG.ARENA.HEIGHT; y += step) {
        this.ctx.beginPath(); this.ctx.moveTo(0, y); this.ctx.lineTo(CONFIG.ARENA.WIDTH, y); this.ctx.stroke();
      }
    }

    // 3. Bordes exteriores luminosos de la arena
    this.ctx.save();
    this.ctx.strokeStyle = '#00f0ff';
    this.ctx.lineWidth = 4;
    this.ctx.shadowBlur = 18;
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.strokeRect(0, 0, CONFIG.ARENA.WIDTH, CONFIG.ARENA.HEIGHT);
    this.ctx.restore();

    // 4. Obstáculos con textura o bisel
    const boxImg = assetManager.getImage('obstacle_box');
    for (const obs of CONFIG.ARENA.OBSTACLES) {
      if (boxImg) {
        this.ctx.drawImage(boxImg, obs.x, obs.y, obs.w, obs.h);
      } else {
        this.ctx.fillStyle = '#101726';
        this.ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        this.ctx.strokeStyle = '#1e304f';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);

        this.ctx.fillStyle = '#00f0ff';
        const cSize = 6;
        this.ctx.fillRect(obs.x, obs.y, cSize, cSize);
        this.ctx.fillRect(obs.x + obs.w - cSize, obs.y, cSize, cSize);
        this.ctx.fillRect(obs.x, obs.y + obs.h - cSize, cSize, cSize);
        this.ctx.fillRect(obs.x + obs.w - cSize, obs.y + obs.h - cSize, cSize, cSize);
      }
    }
  }
}
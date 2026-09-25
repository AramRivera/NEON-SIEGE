// frontend/src/tools/DebugOverlay.js
// ============================================================
//  DebugOverlay — Capa de diagnóstico visual (tecla F3)
//  ------------------------------------------------------------
//  Filosofía:
//    - Solo LEE datos del engine. Nunca modifica gameplay.
//    - Coste CERO cuando está apagado (no se dibuja nada).
//    - Dibujo dividido en espacio de MUNDO y de PANTALLA.
// ============================================================

import { CONFIG } from '../config.js';

export class DebugOverlay {
  constructor() {
    this.enabled = false;

    // --- Métricas de rendimiento ---
    this.fps = 0;
    this.frameTimeMs = 0;
    this.minFps = Infinity;
    this.maxFrameMs = 0;
    this._frameSamples = [];
    this._frameCounter = 0;
    this._fpsTimer = 0;

    // --- Spikes (tirones) ---
    this.spikes = 0;
    this.lastSpikeMs = 0;
  }

  toggle() {
    this.enabled = !this.enabled;
    console.log(`[Debug] Modo debug ${this.enabled ? 'ACTIVADO' : 'DESACTIVADO'}`);
  }

  // ------------------------------------------------------------
  //  ACUMULADOR DE MÉTRICAS (llamado cada frame desde Engine._loop)
  // ------------------------------------------------------------
  update(dt) {
    if (!this.enabled) return;

    const ms = dt * 1000;
    this.frameTimeMs = ms;
    if (ms > this.maxFrameMs) this.maxFrameMs = ms;

    // Spike = frame que tardó más de 33ms (~30 FPS)
    if (ms > 33) {
      this.spikes++;
      this.lastSpikeMs = ms;
    }

    // Promedio de FPS cada ~0.5s
    this._fpsTimer += dt;
    this._frameCounter++;
    if (this._fpsTimer >= 0.5) {
      const fps = this._frameCounter / this._fpsTimer;
      this.fps = fps;
      if (fps < this.minFps) this.minFps = fps;

      // Reset del contador de spikes para que sea "spikes por ventana"
      this._frameCounter = 0;
      this._fpsTimer = 0;
    }
  }

  resetMetrics() {
    this.fps = 0;
    this.frameTimeMs = 0;
    this.minFps = Infinity;
    this.maxFrameMs = 0;
    this.spikes = 0;
    this._frameCounter = 0;
    this._fpsTimer = 0;
  }

  // ------------------------------------------------------------
  //  RENDER PRINCIPAL — orquesta mundo + pantalla
  // ------------------------------------------------------------
    render(ctx, engine) {
    if (!this.enabled) return;
    this.renderScreen(ctx, engine);
  }

  // Se llama DESDE el espacio de mundo (dentro del translate de la cámara)
  renderWorldLayer(ctx, engine) {
    this.renderWorld(ctx, engine);
  }

  // ============================================================
  //  PANEL DE ESTADÍSTICAS (espacio de PANTALLA, esquina superior izq.)
  // ============================================================
  renderScreen(ctx, engine) {
    if (!CONFIG.DEBUG.SHOW_HUD) return;

    const p = engine.player;
    const lines = [];

    // --- Rendimiento ---
    lines.push(`=== RENDIMIENTO ===`);
    lines.push(`FPS: ${this.fps.toFixed(0)}  (min: ${this.minFps === Infinity ? '--' : this.minFps.toFixed(0)})`);
    lines.push(`Frame: ${this.frameTimeMs.toFixed(1)} ms  (max: ${this.maxFrameMs.toFixed(1)})`);
    lines.push(`Spikes: ${this.spikes}`);
    lines.push('');

    // --- Entidades ---
    const playerBullets = engine.playerBulletsPool ? engine.playerBulletsPool.getActive().length : 0;
    const enemyBullets = engine.enemyBulletsPool ? engine.enemyBulletsPool.getActive().length : 0;
    lines.push(`=== ENTIDADES ===`);
    lines.push(`Enemigos: ${engine.enemies.length}`);
    lines.push(`Balas jugador: ${playerBullets} / ${CONFIG.POOLS.PLAYER_BULLETS}`);
    lines.push(`Balas enemigo: ${enemyBullets} / ${CONFIG.POOLS.ENEMY_BULLETS}`);
    lines.push(`Pickups: ${engine.pickups.length}`);
    const particles = engine.particleSystem ? engine.particleSystem.pool.getActive().length : 0;
    lines.push(`Particulas: ${particles} / ${CONFIG.POOLS.PARTICLES}`);
    lines.push(`Jefe activo: ${engine.currentBoss ? 'SI' : 'NO'}`);
    lines.push('');

    // --- Oleada ---
    const wm = engine.waveManager;
    lines.push(`=== OLEADA ===`);
    lines.push(`Oleada actual: ${wm.currentWave}`);
    lines.push(`Por spawnear: ${wm.enemiesToSpawn}`);
    lines.push(`Intervalo: ${wm.spawnInterval.toFixed(2)} s`);
    lines.push(`Combo: x${engine.comboMult.toFixed(2)} (${engine.comboCount})`);
    lines.push('');

    // --- Jugador ---
    lines.push(`=== JUGADOR ===`);
    lines.push(`HP: ${p.hp.toFixed(0)} / ${p.maxHp}`);
    lines.push(`Energia: ${p.energy.toFixed(0)} / ${p.maxEnergy}`);
    lines.push(`Nivel: ${p.level}  EXP: ${p.exp}/${p.expNext}`);
    lines.push(`Arma: ${p.currentWeaponKey}`);
    lines.push(`Municion: ${p.ammo[p.currentWeaponKey] === Infinity ? 'INF' : p.ammo[p.currentWeaponKey]}`);
    lines.push(`Pos: (${p.x.toFixed(0)}, ${p.y.toFixed(0)})`);
    lines.push(`Camara: (${engine.camera.x.toFixed(0)}, ${engine.camera.y.toFixed(0)})`);
    lines.push('');

    // --- Estado ---
    lines.push(`=== ESTADO ===`);
    lines.push(`Pausa: ${engine.isPaused ? 'SI' : 'NO'}  GameOver: ${engine.isGameOver ? 'SI' : 'NO'}`);
    lines.push(`Audio: ${CONFIG.ASSETS.USE_AUDIO ? 'ON' : 'OFF'}`);
    lines.push(`Tiempo: ${engine.gameTime.toFixed(1)} s`);
    lines.push(`Kills: ${engine.kills}  Bosses: ${engine.bossesDefeated}`);

    // --- Dibujar el panel ---
    const padX = 12;
    const padY = 10;
    const fontSize = 12;
    const lineH = 15;
    const panelW = 300;
    const panelH = lines.length * lineH + padY * 2;

    ctx.save();

    // Fondo semitransparente
    ctx.fillStyle = 'rgba(0, 10, 5, 0.78)';
    ctx.fillRect(10, 10, panelW, panelH);
    ctx.strokeStyle = '#39ff14'; // verde neón tipo consola
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, panelW, panelH);

    // Texto
    ctx.font = `${fontSize}px Consolas, monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    let y = 10 + padY;
    for (const line of lines) {
      if (line.startsWith('===')) {
        ctx.fillStyle = '#39ff14'; // cabeceras verde
        ctx.font = `bold ${fontSize}px Consolas, monospace`;
      } else {
        ctx.fillStyle = '#c8facc'; // texto verde claro
        ctx.font = `${fontSize}px Consolas, monospace`;
      }
      ctx.fillText(line, 10 + padX, y);
      y += lineH;
    }

    ctx.restore();
  }

    // ============================================================
  //  CAPAS DE MUNDO (se dibujan dentro del translate de la cámara)
  // ============================================================
  renderWorld(ctx, engine) {
    if (!this.enabled) return;

    if (CONFIG.DEBUG.DRAW_ARENA_BOUNDS) this._drawArenaBounds(ctx);
    if (CONFIG.DEBUG.DRAW_HITBOXES) this._drawHitboxes(ctx, engine);
    if (CONFIG.DEBUG.DRAW_OBSTACLES) this._drawObstacles(ctx);
  }

  // ------------------------------------------------------------
  //  Utilidad: dibuja un pivote (cruz) en un punto
  // ------------------------------------------------------------
  _drawPivot(ctx, x, y, size = 6, color = '#ffffff') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.lineTo(x + size, y);
    ctx.moveTo(x, y - size);
    ctx.lineTo(x, y + size);
    ctx.stroke();
  }

  // ------------------------------------------------------------
  //  Utilidad: círculo de hitbox con pivote
  // ------------------------------------------------------------
  _drawHitCircle(ctx, x, y, radius, color, withPivot = true) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();

    if (withPivot) this._drawPivot(ctx, x, y, 4, color);
  }

  // ------------------------------------------------------------
  //  Límites reales de la arena (borde jugable)
  // ------------------------------------------------------------
  _drawArenaBounds(ctx) {
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 6]);
    ctx.strokeRect(0, 0, CONFIG.ARENA.WIDTH, CONFIG.ARENA.HEIGHT);
    ctx.setLineDash([]);
    ctx.restore();
  }

  // ------------------------------------------------------------
  //  Hitboxes de todas las entidades
  // ------------------------------------------------------------
  _drawHitboxes(ctx, engine) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.5;

    // --- Jugador (cian) ---
    const p = engine.player;
    if (p && p.active !== false) {
      // Radio de magnetismo (círculo punteado)
      if (CONFIG.DEBUG.DRAW_MAGNET) {
        ctx.strokeStyle = '#00f0ff';
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.magnetRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // Hitbox jugador
      ctx.strokeStyle = '#00f0ff';
      this._drawHitCircle(ctx, p.x, p.y, p.radius, '#00f0ff');
    }

    // --- Enemigos (rojo) ---
    ctx.strokeStyle = '#ff3333';
    for (let i = 0; i < engine.enemies.length; i++) {
      const e = engine.enemies[i];
      this._drawHitCircle(ctx, e.x, e.y, e.radius, '#ff3333');
    }

    // --- Jefe (rosa) ---
    if (engine.currentBoss) {
      const b = engine.currentBoss;
      ctx.strokeStyle = '#ff0077';
      ctx.lineWidth = 2.5;
      this._drawHitCircle(ctx, b.x, b.y, b.radius, '#ff0077');
      ctx.lineWidth = 1.5;
    }

    // --- Balas del jugador (amarillo) ---
    const pb = engine.playerBulletsPool.getActive();
    ctx.strokeStyle = '#ffd700';
    for (let i = 0; i < pb.length; i++) {
      const b = pb[i];
      this._drawHitCircle(ctx, b.x, b.y, b.radius, '#ffd700', false);
    }

    // --- Balas enemigas (naranja) ---
    const eb = engine.enemyBulletsPool.getActive();
    ctx.strokeStyle = '#ff8800';
    for (let i = 0; i < eb.length; i++) {
      const b = eb[i];
      this._drawHitCircle(ctx, b.x, b.y, b.radius, '#ff8800', false);
    }

    // --- Pickups (verde) ---
    ctx.strokeStyle = '#39ff14';
    for (let i = 0; i < engine.pickups.length; i++) {
      const pk = engine.pickups[i];
      this._drawHitCircle(ctx, pk.x, pk.y, pk.radius, '#39ff14', false);
    }

    ctx.restore();
  }

  // ------------------------------------------------------------
  //  Obstáculos como rectángulos AABB
  // ------------------------------------------------------------
  _drawObstacles(ctx) {
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 2;
    for (const obs of CONFIG.ARENA.OBSTACLES) {
      ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
      this._drawPivot(ctx, obs.x + obs.w / 2, obs.y + obs.h / 2, 5, '#ff00ff');
    }
    ctx.restore();
  }
}

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
  /** Hitboxes, vectores de IA y obstáculos en espacio de mundo (tras cámara). */
  renderWorldLayer(ctx, engine) {
    this.renderWorld(ctx, engine);
  }

  // ============================================================
  //  PANEL DE ESTADÍSTICAS (espacio de PANTALLA, esquina superior izq.)
  // ============================================================
  renderScreen(ctx, engine) {
    if (!CONFIG.DEBUG.SHOW_HUD) return;

    const p = engine.player;
    const playerBullets = engine.playerBulletsPool ? engine.playerBulletsPool.getActive().length : 0;
    const enemyBullets = engine.enemyBulletsPool ? engine.enemyBulletsPool.getActive().length : 0;
    const totalProjectiles = playerBullets + enemyBullets;

    // --- Conteo total de entidades activas ---
    const totalEnemies = engine.enemies.length + (engine.currentBoss ? 1 : 0);
    const totalEntities = totalEnemies + totalProjectiles + engine.pickups.length + 1; // +1 = jugador

    // --- Estado del juego ---
    let estado = 'PLAYING';
    if (engine.isGameOver) estado = 'GAMEOVER';
    else if (engine.isPaused) estado = 'PAUSED';

    const particles = engine.particleSystem ? engine.particleSystem.pool.getActive().length : 0;
    const wm = engine.waveManager;

    // --- Construir líneas (formato enunciado + detalle extendido) ---
    const lines = [];
    const divider = (txt) => lines.push(`==${txt}==`);
    const kv = (k, v) => lines.push(`${k}: ${v}`);

    // ===== BLOQUE OBLIGATORIO (enunciado) =====
    kv('FPS', this.fps.toFixed(0));
    kv('ENTIDADES', totalEntities);
    kv('ENEMIGOS', totalEnemies);
    kv('PROYECTILES', totalProjectiles);
    kv('PLAYER X', p.x.toFixed(0));
    kv('PLAYER Y', p.y.toFixed(0));
    kv('ESTADO', estado);

    // ===== DETALLE EXTENDIDO =====
    divider('RENDIMIENTO');
    kv('Frame', `${this.frameTimeMs.toFixed(1)} ms (max ${this.maxFrameMs.toFixed(1)})`);
    kv('FPS min', this.minFps === Infinity ? '--' : this.minFps.toFixed(0));
    kv('Spikes', this.spikes);

    divider('ENTIDADES');
    kv('Jugador', 1);
    kv('Balas jugador', `${playerBullets} / ${CONFIG.POOLS.PLAYER_BULLETS}`);
    kv('Balas enemigo', `${enemyBullets} / ${CONFIG.POOLS.ENEMY_BULLETS}`);
    kv('Pickups', engine.pickups.length);
    kv('Particulas', `${particles} / ${CONFIG.POOLS.PARTICLES}`);
    kv('Jefe', engine.currentBoss ? 'SI' : 'NO');

    divider('OLEADA');
    kv('Oleada', wm.currentWave);
    kv('Por spawnear', wm.enemiesToSpawn);
    kv('Intervalo', `${wm.spawnInterval.toFixed(2)} s`);
    kv('Combo', `x${engine.comboMult.toFixed(2)} (${engine.comboCount})`);

        divider('JUGADOR');
    kv('HP', `${p.hp.toFixed(0)} / ${p.maxHp}`);
    kv('Energia', `${p.energy.toFixed(0)} / ${p.maxEnergy}`);
    kv('Nivel', `${p.level}  EXP: ${p.exp}/${p.expNext}`);
    kv('Arma', p.currentWeaponKey);
    kv('Municion', p.ammo[p.currentWeaponKey] === Infinity ? 'INF' : p.ammo[p.currentWeaponKey]);
    kv('Camara', `(${engine.camera.x.toFixed(0)}, ${engine.camera.y.toFixed(0)})`);
    kv('Tiempo', `${engine.gameTime.toFixed(1)} s`);
    kv('Kills', engine.kills);

    // ===== MOVIMIENTO (velocidad y dash) =====
    const speedBase = p.speed;
    const dashMult = CONFIG.PLAYER.DASH_SPEED_MULT;
    const speedActual = p.isDashing ? speedBase * dashMult : speedBase;
    const pctVsBase = ((speedBase / CONFIG.PLAYER.SPEED - 1) * 100);

    divider('MOVIMIENTO');
    kv('Vel. base', `${speedBase.toFixed(0)} px/s`);
    kv('Vel. actual', `${speedActual.toFixed(0)} px/s`);
    kv('Bonus mejoras', `${pctVsBase >= 0 ? '+' : ''}${pctVsBase.toFixed(0)}%`);
    kv('Dash', p.isDashing ? `SI (x${dashMult})` : 'NO');
    kv('Costo dash', `${CONFIG.PLAYER.DASH_COST} EN`);
    kv('Regen energia', `${CONFIG.PLAYER.ENERGY_REGEN}/s`);

    // --- Dibujar el panel ---
    const padX = 12;
    const padY = 10;
    const fontSize = 12;
    const lineH = 15;

    // Ancho dinámico: se ajusta al texto más largo (con tope máximo)
    let maxW = 0;
    ctx.save();
    ctx.font = `${fontSize}px Consolas, monospace`;
    for (const line of lines) {
      const w = ctx.measureText(line).width;
      if (w > maxW) maxW = w;
    }
    ctx.restore();

    const panelW = Math.min(420, Math.max(260, maxW + padX * 2));
    const panelH = lines.length * lineH + padY * 2;

    ctx.save();

    ctx.fillStyle = 'rgba(0, 10, 5, 0.82)';
    ctx.fillRect(10, 10, panelW, panelH);
    ctx.strokeStyle = '#39ff14';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, panelW, panelH);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    let y = 10 + padY;
    for (const line of lines) {
      if (line.startsWith('==')) {
        // Cabeceras de sección
        ctx.fillStyle = '#39ff14';
        ctx.font = `bold ${fontSize}px Consolas, monospace`;
      } else {
        ctx.fillStyle = '#c8facc';
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
  // ============================================================
  //  CAPA MUNDO — hitboxes, paths de IA, magnetismo, cover
  // ============================================================
    renderWorld(ctx, engine) {
    if (!this.enabled) return;

    if (CONFIG.DEBUG.DRAW_ARENA_BOUNDS) this._drawArenaBounds(ctx);
    if (CONFIG.DEBUG.DRAW_PATHS) this._drawAIPaths(ctx, engine);
    if (CONFIG.DEBUG.DRAW_HITBOXES) this._drawHitboxes(ctx, engine);
    if (CONFIG.DEBUG.DRAW_VECTORS) this._drawVectors(ctx, engine);
    if (CONFIG.DEBUG.DRAW_OBSTACLES) this._drawObstacles(ctx);
    if (CONFIG.DEBUG.SHOW_ENTITY_LABELS) this._drawEntityLabels(ctx, engine);
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
      this._drawHitCircle(ctx, e.getHitX(), e.getHitY(), e.getHitRadius(), '#ff3333');
    }

    // --- Jefe (rosa) ---
    if (engine.currentBoss) {
      const b = engine.currentBoss;
      ctx.strokeStyle = '#ff0077';
      ctx.lineWidth = 2.5;
      this._drawHitCircle(ctx, b.getHitX(), b.getHitY(), b.getHitRadius(), '#ff0077');
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
  //  Vectores de apuntado y movimiento
  // ------------------------------------------------------------
  _drawVectors(ctx, engine) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 1.5;

    // --- Jugador: flecha de apuntado (hacia el mouse) ---
    const p = engine.player;
    if (p) {
      this._drawArrow(
        ctx,
        p.x, p.y,
        p.x + Math.cos(p.aimAngle) * (p.radius + 34),
        p.y + Math.sin(p.aimAngle) * (p.radius + 34),
        '#00f0ff'
      );
    }

    // --- Enemigos: flecha con su ángulo hacia el jugador ---
    for (let i = 0; i < engine.enemies.length; i++) {
      const e = engine.enemies[i];
      this._drawArrow(
        ctx,
        e.x, e.y,
        e.x + Math.cos(e.angle) * (e.radius + 22),
        e.y + Math.sin(e.angle) * (e.radius + 22),
        '#ff8800'
      );
    }

    // --- Jefe ---
    if (engine.currentBoss) {
      const b = engine.currentBoss;
      if (typeof b.angle === 'number') {
        this._drawArrow(
          ctx,
          b.x, b.y,
          b.x + Math.cos(b.angle) * (b.radius + 40),
          b.y + Math.sin(b.angle) * (b.radius + 40),
          '#ff0077'
        );
      }
    }

    ctx.restore();
  }

  // ------------------------------------------------------------
  //  Rutas de IA: línea enemigo -> jugador
  // ------------------------------------------------------------
  _drawAIPaths(ctx, engine) {
    const p = engine.player;
    if (!p) return;

    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#ff3333';
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    for (let i = 0; i < engine.enemies.length; i++) {
      const e = engine.enemies[i];
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(p.x, p.y);
    }
    if (engine.currentBoss) {
      ctx.moveTo(engine.currentBoss.x, engine.currentBoss.y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // ------------------------------------------------------------
  //  Etiquetas FSM sobre cada enemigo
  // ------------------------------------------------------------
  _drawEntityLabels(ctx, engine) {
    if (!CONFIG.DEBUG.SHOW_ENTITY_LABELS) return;

    ctx.save();
    ctx.font = 'bold 9px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    const labelColors = {
      SPAWN: '#888888',
      SEARCH: '#00f0ff',
      CHASE: '#ffd700',
      ATTACK: '#ff3333',
      RETREAT: '#39ff14',
      DEAD: '#555555'
    };

    for (let i = 0; i < engine.enemies.length; i++) {
      const e = engine.enemies[i];
      const txt = `${e.state}`;
      const y = e.y - e.radius - 6;

      // Sombra para legibilidad
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillText(txt, e.x + 1, y + 1);

      // Texto del estado
      ctx.fillStyle = labelColors[e.state] || '#ffffff';
      ctx.fillText(txt, e.x, y);
    }

    ctx.restore();
  }

  // ------------------------------------------------------------
  //  Utilidad: dibuja una flecha desde (x1,y1) a (x2,y2)
  // ------------------------------------------------------------
  _drawArrow(ctx, x1, y1, x2, y2, color) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = 7;

    ctx.strokeStyle = color;
    ctx.fillStyle = color;

    // Línea
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Cabeza de flecha
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - headLen * Math.cos(angle - Math.PI / 6),
      y2 - headLen * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      x2 - headLen * Math.cos(angle + Math.PI / 6),
      y2 - headLen * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
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

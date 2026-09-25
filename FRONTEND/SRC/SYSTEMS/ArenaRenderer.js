// frontend/src/systems/ArenaRenderer.js
/**
 * ArenaRenderer — dibujo del mundo (no gameplay).
 *
 * Algoritmo de suelo: hash2 elige variante de tile por celda 64px; hazard en pistas.
 * Animaciones ambientales: barrido de scan, holo de plaza, luces, partículas de ventilación.
 * Obstáculos: tesela textura de caja sobre los AABB de CONFIG.ARENA.OBSTACLES.
 */
import { CONFIG } from '../config.js';
import { assetManager } from './AssetManager.js';

const T = 64;

/** Hash determinista [0,1] para variación de tiles (mismo mapa siempre). */
function hash2(x, y) {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export class ArenaRenderer {
  constructor() {
    this.w = CONFIG.ARENA.WIDTH;
    this.h = CONFIG.ARENA.HEIGHT;
    this.ready = false;
    this.floorCanvas = null;
    this.tiles = { metal: null, grid: null, hazard: null, panel: null, scuff: null, wall: null };
    this.scanPattern = null;
    this.lights = [];
    this.vents = [];
    this._ventAcc = 0;
    this._wallSrc = null;
    this._boxSrc = null;
  }

  /** Compone tiles, suelo offscreen, patrón de scan y luces (una sola vez). */
  ensureReady() {
    if (this.ready) return;
    this._buildTiles();
    this._buildFloor();
    this._buildScanPattern();
    this._layoutFx();
    this.ready = true;
  }

  _buildTiles() {
    const floorImg = assetManager.getImage('tile_floor');
    const wallImg = assetManager.getImage('tile_wall');
    const boxImg = assetManager.getImage('obstacle_box');
    this._wallSrc = wallImg;
    this._boxSrc = boxImg;

    this.tiles.metal = this._tileMetal(floorImg, 0);
    this.tiles.grid = this._tileMetal(floorImg, 1);
    this.tiles.hazard = this._tileHazard(floorImg);
    this.tiles.panel = this._tilePanel(floorImg);
    this.tiles.scuff = this._tileMetal(floorImg, 2);
    this.tiles.wall = this._tileWall(wallImg);
  }

  _stampBase(ctx, src) {
    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, T, T);
    if (src) {
      ctx.globalAlpha = 0.85;
      ctx.drawImage(src, 0, 0, T, T);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(4, 8, 16, 0.35)';
      ctx.fillRect(0, 0, T, T);
    }
  }

  _tileMetal(src, variant) {
    const c = makeCanvas(T, T);
    const ctx = c.getContext('2d');
    this._stampBase(ctx, src);

    ctx.strokeStyle = 'rgba(18, 36, 58, 0.9)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, T - 1, T - 1);

    if (variant === 1) {
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.16)';
      ctx.beginPath();
      ctx.moveTo(0, T * 0.5);
      ctx.lineTo(T, T * 0.5);
      ctx.moveTo(T * 0.5, 0);
      ctx.lineTo(T * 0.5, T);
      ctx.stroke();
    } else if (variant === 2) {
      ctx.strokeStyle = 'rgba(255, 0, 119, 0.12)';
      ctx.beginPath();
      ctx.moveTo(8, 50);
      ctx.lineTo(40, 14);
      ctx.moveTo(22, 58);
      ctx.lineTo(58, 28);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(3, 3, 5, 5);
    ctx.fillRect(T - 9, T - 9, 5, 5);
    return c;
  }

  _tileHazard(src) {
    const c = makeCanvas(T, T);
    const ctx = c.getContext('2d');
    this._stampBase(ctx, src);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, T, T);
    ctx.clip();
    ctx.rotate(-0.4);
    for (let i = -T; i < T * 2; i += 14) {
      ctx.fillStyle = i % 28 === 0 ? 'rgba(255, 200, 40, 0.16)' : 'rgba(8, 12, 20, 0.45)';
      ctx.fillRect(i, -T, 8, T * 3);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255, 180, 40, 0.22)';
    ctx.strokeRect(1, 1, T - 2, T - 2);
    return c;
  }

  _tilePanel(src) {
    const c = makeCanvas(T, T);
    const ctx = c.getContext('2d');
    this._stampBase(ctx, src);
    ctx.fillStyle = 'rgba(10, 22, 40, 0.55)';
    ctx.fillRect(8, 8, T - 16, T - 16);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.18)';
    ctx.strokeRect(8.5, 8.5, T - 17, T - 17);
    ctx.fillStyle = '#00f0ff';
    [[12, 12], [T - 16, 12], [12, T - 16], [T - 16, T - 16]].forEach(([x, y]) => {
      ctx.fillRect(x, y, 3, 3);
    });
    return c;
  }

  _tileWall(src) {
    const c = makeCanvas(T, T);
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, T);
    g.addColorStop(0, '#1a2a44');
    g.addColorStop(0.45, '#10192c');
    g.addColorStop(1, '#070b14');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, T, T);
    if (src) {
      ctx.globalAlpha = 0.75;
      ctx.drawImage(src, 0, 0, T, T);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = 'rgba(0, 240, 255, 0.07)';
    ctx.fillRect(0, 0, T, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, T - 8, T, 8);
    ctx.strokeStyle = 'rgba(0, 180, 220, 0.25)';
    ctx.strokeRect(1, 1, T - 2, T - 2);
    return c;
  }

  _isHazardCell(c, r) {
    const x = c * T;
    const y = r * T;
    const cx = this.w / 2;
    const cy = this.h / 2;
    const onRing = Math.abs(Math.hypot(x + 32 - cx, y + 32 - cy) - 220) < 40;
    const runwayN = y > 360 && y < 440 && x > 700 && x < 1700;
    const runwayS = y > 1360 && y < 1440 && x > 700 && x < 1700;
    const laneW = x > 600 && x < 700 && y > 520 && y < 1280;
    const laneE = x > 1700 && x < 1800 && y > 520 && y < 1280;
    return onRing || runwayN || runwayS || laneW || laneE;
  }

  /** Rasteriza el piso completo a un canvas cacheado (no se rehace cada frame). */
  _buildFloor() {
    const c = makeCanvas(this.w, this.h);
    const ctx = c.getContext('2d');
    const cols = Math.ceil(this.w / T);
    const rows = Math.ceil(this.h / T);

    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const h = hash2(col, r);
        let tile = this.tiles.metal;
        if (this._isHazardCell(col, r)) tile = this.tiles.hazard;
        else if (h > 0.82) tile = this.tiles.panel;
        else if (h > 0.64) tile = this.tiles.grid;
        else if (h > 0.48) tile = this.tiles.scuff;
        ctx.drawImage(tile, col * T, r * T);
      }
    }

    this._paintStaticDecals(ctx);
    this._paintPerimeterTrim(ctx);
    this.floorCanvas = c;
  }

  _paintStaticDecals(ctx) {
    const cx = this.w / 2;
    const cy = this.h / 2;

    ctx.save();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.18)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 210, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 0, 119, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 246, 0, Math.PI * 2);
    ctx.stroke();

    const arrows = [
      { x: cx, y: 520, rot: 0 },
      { x: cx, y: this.h - 520, rot: Math.PI },
      { x: 560, y: cy, rot: Math.PI / 2 },
      { x: this.w - 560, y: cy, rot: -Math.PI / 2 }
    ];
    arrows.forEach((a) => {
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rot);
      ctx.fillStyle = 'rgba(0, 240, 255, 0.14)';
      ctx.beginPath();
      ctx.moveTo(0, 28);
      ctx.lineTo(-22, -18);
      ctx.lineTo(22, -18);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    const stains = [
      [480, 700], [1900, 640], [700, 1500], [1680, 1480],
      [1100, 300], [1320, 1540], [900, 1100], [1480, 780]
    ];
    stains.forEach(([x, y], i) => {
      const rad = 38 + (i % 5) * 8;
      const g = ctx.createRadialGradient(x, y, 4, x, y, rad);
      g.addColorStop(0, i % 2 ? 'rgba(0, 40, 50, 0.45)' : 'rgba(40, 8, 20, 0.4)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(0, 240, 255, 0.22)';
    const labels = [
      [300, 240, 'SEC-01 NW'],
      [1980, 240, 'SEC-02 NE'],
      [300, 1720, 'SEC-03 SW'],
      [1980, 1720, 'SEC-04 SE'],
      [cx - 40, cy + 280, 'PLAZA CORE']
    ];
    labels.forEach(([x, y, t]) => ctx.fillText(t, x, y));

    ctx.restore();
  }

  _paintPerimeterTrim(ctx) {
    const thick = 36;
    ctx.fillStyle = 'rgba(0, 10, 18, 0.55)';
    ctx.fillRect(0, 0, this.w, thick);
    ctx.fillRect(0, this.h - thick, this.w, thick);
    ctx.fillRect(0, 0, thick, this.h);
    ctx.fillRect(this.w - thick, 0, thick, this.h);

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(thick, thick, this.w - thick * 2, this.h - thick * 2);
  }

  _buildScanPattern() {
    const c = makeCanvas(2, 4);
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
    ctx.fillRect(0, 3, 2, 1);
    this.scanPattern = ctx.createPattern(c, 'repeat');
  }

  _layoutFx() {
    const cx = this.w / 2;
    const cy = this.h / 2;
    this.lights = [
      { x: 80, y: 80, color: 'rgba(0,240,255,0.16)', r: 220 },
      { x: this.w - 80, y: 80, color: 'rgba(255,0,119,0.14)', r: 220 },
      { x: 80, y: this.h - 80, color: 'rgba(255,0,119,0.12)', r: 200 },
      { x: this.w - 80, y: this.h - 80, color: 'rgba(0,240,255,0.14)', r: 200 },
      { x: cx, y: cy, color: 'rgba(0,240,255,0.10)', r: 340 },
      { x: 400, y: 420, color: 'rgba(57,255,20,0.08)', r: 160 },
      { x: 2000, y: 420, color: 'rgba(57,255,20,0.08)', r: 160 }
    ];
    this.vents = [
      { x: 288, y: 288 },
      { x: 2080, y: 288 },
      { x: 288, y: 1512 },
      { x: 2080, y: 1512 },
      { x: cx, y: 200 },
      { x: cx, y: this.h - 200 }
    ];
  }

  /** Emite chispas periódicas en ventilaciones (animación de ambiente). */
  updateAmbient(particles, dt) {
    this._ventAcc += dt;
    if (this._ventAcc < 0.18) return;
    this._ventAcc = 0;
    const v = this.vents[(Math.random() * this.vents.length) | 0];
    const color = Math.random() > 0.5 ? '#00f0ff' : '#39ff14';
    particles.emitSparks(v.x, v.y, color, 3);
  }

  /** Orden de capas: parallax → suelo → FX animados → obstáculos → borde. */
  drawWorld(ctx, time, camera) {
    this.ensureReady();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const camX = camera.x || 0;
    const camY = camera.y || 0;

    this._drawParallax(ctx, camX, camY);
    ctx.drawImage(this.floorCanvas, 0, 0);
    this._drawScanSweep(ctx, time);
    this._drawPlazaHolo(ctx, time);
    this._drawCornerRifts(ctx, time);
    this._drawLights(ctx, time);
    this._drawObstacles(ctx);
    this._drawArenaBorder(ctx, time);
  }

  /** Fondo de rejilla que se mueve más lento que la cámara (parallax). */
  _drawParallax(ctx, camX, camY) {
    ctx.save();
    ctx.translate(camX * 0.38, camY * 0.38);
    ctx.fillStyle = '#03060c';
    ctx.fillRect(-800, -800, this.w + 1600, this.h + 1600);
    ctx.strokeStyle = 'rgba(0, 80, 120, 0.18)';
    ctx.lineWidth = 1;
    const step = 90;
    for (let x = -800; x < this.w + 800; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, -800);
      ctx.lineTo(x, this.h + 800);
      ctx.stroke();
    }
    for (let y = -800; y < this.h + 800; y += step) {
      ctx.beginPath();
      ctx.moveTo(-800, y);
      ctx.lineTo(this.w + 800, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Barrido vertical cíclico (animación de “escáner”). */
  _drawScanSweep(ctx, time) {
    const y = ((time * 85) % (this.h + 240)) - 120;
    const g = ctx.createLinearGradient(0, y - 50, 0, y + 50);
    g.addColorStop(0, 'rgba(0,240,255,0)');
    g.addColorStop(0.5, 'rgba(0,240,255,0.055)');
    g.addColorStop(1, 'rgba(0,240,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 50, this.w, 100);
  }

  /** Anillo holográfico pulsante en la plaza central. */
  _drawPlazaHolo(ctx, time) {
    const cx = this.w / 2;
    const cy = this.h / 2;
    const pulse = 0.22 + Math.sin(time * 2.2) * 0.1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(0, 240, 255, ${pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 168 + Math.sin(time * 1.4) * 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255, 0, 119, ${pulse * 0.55})`;
    ctx.beginPath();
    ctx.arc(cx, cy, 128, time * 0.4, time * 0.4 + Math.PI * 1.2);
    ctx.stroke();
    ctx.restore();
  }

  _drawCornerRifts(ctx, time) {
    const spots = [
      { x: 180, y: 180, c: '#ffaa00' },
      { x: this.w - 180, y: 180, c: '#ffaa00' },
      { x: 180, y: this.h - 180, c: '#ff0077' },
      { x: this.w - 180, y: this.h - 180, c: '#ff0077' }
    ];
    const t = time;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    spots.forEach((s, i) => {
      const a = 0.18 + Math.sin(t * 3 + i) * 0.08;
      ctx.strokeStyle = s.c;
      ctx.globalAlpha = a;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 22 + Math.sin(t * 4 + i) * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = a * 0.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 36, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.restore();
  }

  _drawLights(ctx, time) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this.lights.forEach((L, i) => {
      const pulse = 0.75 + Math.sin(time * 1.6 + i * 0.9) * 0.25;
      const g = ctx.createRadialGradient(L.x, L.y, 8, L.x, L.y, L.r);
      const col = L.color.replace(/[\d.]+\)/, `${0.12 * pulse})`);
      g.addColorStop(0, col);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(L.x, L.y, L.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  _drawTiled(ctx, img, x, y, w, h) {
    const tw = img.width || T;
    const th = img.height || T;
    const tileW = Math.min(T, tw);
    const tileH = Math.min(T, th);
    for (let py = y; py < y + h; py += tileH) {
      for (let px = x; px < x + w; px += tileW) {
        const dw = Math.min(tileW, x + w - px);
        const dh = Math.min(tileH, y + h - py);
        ctx.drawImage(img, 0, 0, dw, dh, px, py, dw, dh);
      }
    }
  }

  /**
   * Cover jugable: recorta textura de caja a cada rectángulo de colisión.
   * La geometría real de colisión sigue siendo CONFIG.ARENA.OBSTACLES.
   */
  _drawObstacles(ctx) {
    const list = CONFIG.ARENA.OBSTACLES;
    const wall = this._wallSrc || this.tiles.wall;
    const box = this._boxSrc;

    for (const obs of list) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
      ctx.fillRect(obs.x - 6, obs.y + 10, obs.w + 14, obs.h + 8);
    }

    for (const obs of list) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(obs.x - 10, obs.y - 10, obs.w + 20, obs.h + 20);

      const useBox = box && obs.w <= 128 && obs.h <= 128;
      this._drawTiled(ctx, useBox ? box : wall, obs.x, obs.y, obs.w, obs.h);

      ctx.strokeStyle = 'rgba(0, 240, 255, 0.55)';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#00f0ff';
      ctx.strokeRect(obs.x + 1, obs.y + 1, obs.w - 2, obs.h - 2);
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#00f0ff';
      const s = 7;
      ctx.fillRect(obs.x, obs.y, s, s);
      ctx.fillRect(obs.x + obs.w - s, obs.y, s, s);
      ctx.fillRect(obs.x, obs.y + obs.h - s, s, s);
      ctx.fillRect(obs.x + obs.w - s, obs.y + obs.h - s, s, s);

      ctx.fillStyle = 'rgba(255, 0, 119, 0.35)';
      ctx.fillRect(obs.x + 10, obs.y + 4, Math.max(12, obs.w * 0.28), 3);
    }
  }

  _drawArenaBorder(ctx, time) {
    const pulse = 14 + Math.sin(time * 2) * 6;
    ctx.save();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 5;
    ctx.shadowBlur = pulse;
    ctx.shadowColor = '#00f0ff';
    ctx.strokeRect(2, 2, this.w - 4, this.h - 4);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 0, 119, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, this.w - 20, this.h - 20);
    ctx.restore();
  }

  /** Viñeta de pantalla + scanlines (post-proceso, no mundo). */
  drawOverlay(ctx, sw, sh, time) {
    this.ensureReady();
    ctx.save();
    const g = ctx.createRadialGradient(sw * 0.5, sh * 0.5, sh * 0.22, sw * 0.5, sh * 0.5, sh * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.65, 'rgba(0,0,0,0.12)');
    g.addColorStop(1, 'rgba(2, 4, 12, 0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, sw, sh);

    if (this.scanPattern) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = this.scanPattern;
      ctx.fillRect(0, 0, sw, sh);
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = `rgba(0, 240, 255, ${0.08 + Math.sin(time * 3) * 0.03})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, sw - 16, sh - 16);
    ctx.restore();
  }
}

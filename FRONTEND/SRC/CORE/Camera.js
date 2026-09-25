/**
 * Cámara 2D que sigue al jugador con interpolación (lerp).
 * Se clampa al tamaño de la arena para no mostrar vacío fuera del mapa.
 */
import { CONFIG } from '../config.js';

export class Camera {
  constructor(viewportWidth, viewportHeight) {
    this.x = 0;
    this.y = 0;
    this.w = viewportWidth || 800;
    this.h = viewportHeight || 600;
    this.smoothSpeed = 0.1;
  }

  resize(w, h) {
    this.w = w || this.w;
    this.h = h || this.h;
  }

  /** Centra suavemente el viewport sobre el objetivo (x, y mundo). */
  follow(targetX, targetY) {
    if (typeof targetX !== 'number' || typeof targetY !== 'number') return;

    const targetCamX = targetX - this.w / 2;
    const targetCamY = targetY - this.h / 2;

    this.x += (targetCamX - this.x) * this.smoothSpeed;
    this.y += (targetCamY - this.y) * this.smoothSpeed;

    const maxX = Math.max(0, CONFIG.ARENA.WIDTH - this.w);
    const maxY = Math.max(0, CONFIG.ARENA.HEIGHT - this.h);
    this.x = Math.max(0, Math.min(maxX, this.x));
    this.y = Math.max(0, Math.min(maxY, this.y));
  }
}
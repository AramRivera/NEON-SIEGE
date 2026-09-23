// frontend/src/core/Camera.js
import { CONFIG } from '../config.js';

export class Camera {
  constructor(viewportWidth, viewportHeight) {
    this.x = 0;
    this.y = 0;
    this.w = viewportWidth;
    this.h = viewportHeight;
    this.smoothSpeed = 0.1; // Factor de interpolación lineal (Lerp)
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
  }

  follow(targetX, targetY) {
    // Posición deseada: objetivo en el centro exacto de la pantalla
    const targetCamX = targetX - this.w / 2;
    const targetCamY = targetY - this.h / 2;

    // Lerp suave
    this.x += (targetCamX - this.x) * this.smoothSpeed;
    this.y += (targetCamY - this.y) * this.smoothSpeed;

    // Delimitar cámara dentro de las dimensiones de la arena
    this.x = Math.max(0, Math.min(CONFIG.ARENA.WIDTH - this.w, this.x));
    this.y = Math.max(0, Math.min(CONFIG.ARENA.HEIGHT - this.h, this.y));
  }
}
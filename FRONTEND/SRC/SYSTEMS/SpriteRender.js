// frontend/src/systems/SpriteRender.js
// ============================================================
//  SpriteRenderer — Motor de dibujo de sprites y animaciones
//  ------------------------------------------------------------
//  Soporta DOS modos de animación:
//    1) SPRITE SHEET  → una imagen con grilla fila/columna (recomendado)
//    2) FRAME BY FRAME → un array de imágenes independientes
//
//  Reglas de robustez implementadas aquí:
//    - Fuerza frames ENTEROS (evita el "salto" por decimales como 204.8).
//    - Pivot/anclaje configurable por asset (anchorX, anchorY).
//    - Anclaje por defecto "abajo-centro" (los pies al suelo, top-down).
//    - Validación defensiva: si el sheet no cuadra, no rompe el render.
// ============================================================

import { assetManager } from './AssetManager.js';
import { CONFIG } from '../config.js';

export class SpriteRenderer {
  // ------------------------------------------------------------
  //  SOMBRA proyectada bajo la entidad
  // ------------------------------------------------------------
  static drawShadow(ctx, x, y, radius) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(x, y + radius * 0.4, radius * 0.85, radius * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ------------------------------------------------------------
  //  SPRITE ESTÁTICO (imagen única, sin animación)
  // ------------------------------------------------------------
  static drawEntitySprite({
    ctx,
    imageKey,
    x,
    y,
    width = 48,
    height = 48,
    angle = 0,
    flipX = false,
    yOffset = 0
  }) {
    const img = assetManager.getImage(imageKey);
    if (!img) return false;

    ctx.save();
    ctx.translate(x, y + yOffset);
    if (flipX) ctx.scale(-1, 1);
    if (angle !== 0 && !flipX) ctx.rotate(angle);
    ctx.drawImage(img, -width / 2, -height / 2, width, height);
    ctx.restore();
    return true;
  }

  // ------------------------------------------------------------
  //  SPRITE ANIMADO (acepta spritesheets y frames individuales)
  // ------------------------------------------------------------
  static drawAnimatedSprite({
    ctx,
    imageKey,
    animState = 'idle',
    frameIndex = 0,
    x,
    y,
    width = 56,
    height = 56,
    angle = 0,
    flipX = false,
    yOffset = 0
  }) {
    const img = assetManager.getImage(imageKey);
    if (!img) return false;

    const meta = CONFIG.ASSETS.SPRITES[imageKey];

    // --- Caso A: sin metadatos → tratar como sprite estático
    if (!meta || !meta.animations) {
      return this.drawEntitySprite({ ctx, imageKey, x, y, width, height, angle, flipX, yOffset });
    }

    // --- Resolver la animación solicitada (con fallback a idle / la primera)
    const anim = meta.animations[animState]
      || meta.animations['idle']
      || meta.animations[Object.keys(meta.animations)[0]];
    if (!anim) {
      return this.drawEntitySprite({ ctx, imageKey, x, y, width, height, angle, flipX, yOffset });
    }

    // ========================================================
    //  MODO SPRITE SHEET (tiene frameW / frameH definidos)
    // ========================================================
    if (meta.frameW && meta.frameH) {
      // 1. Forzar frames ENTEROS (elimina saltos por decimales)
      const fw = Math.floor(meta.frameW);
      const fh = Math.floor(meta.frameH);

      // 2. Frame seguro dentro del rango de la animación (módulo positivo)
      const total = Math.max(1, anim.frames | 0);
      const idx = ((frameIndex % total) + total) % total;

      // 3. Coordenadas de recorte dentro del sheet
      const sx = idx * fw;
      const sy = (anim.row | 0) * fh;

      // 4. Validación defensiva: no recortar fuera de la imagen
      if (sx + fw > img.width + 0.5 || sy + fh > img.height + 0.5) {
        return this.drawEntitySprite({ ctx, imageKey, x, y, width, height, angle, flipX, yOffset });
      }

      // 5. Pivote (anclaje). Por defecto abajo-centro estilo top-down.
      const ax = (meta.anchorX !== undefined) ? meta.anchorX : 0.5; // 0=izq, 0.5=centro, 1=der
      const ay = (meta.anchorY !== undefined) ? meta.anchorY : 0.85; // 0=arriba, 1=abajo

      ctx.save();
      ctx.translate(x, y + yOffset);
      if (flipX) ctx.scale(-1, 1);
      if (angle !== 0 && !flipX) ctx.rotate(angle);
      ctx.drawImage(img, sx, sy, fw, fh, -width * ax, -height * ay, width, height);
      ctx.restore();
      return true;
    }

    // ========================================================
    //  MODO FRAME BY FRAME (array de imágenes independientes)
    //  meta.frames = ['./a.png', './b.png', ...]
    // ========================================================
    if (meta.frames && Array.isArray(meta.frames)) {
      const total = meta.frames.length;
      if (total === 0) return false;
      const idx = ((frameIndex % total) + total) % total;
      const frameImg = assetManager.getImage(`${imageKey}__${idx}`);
      if (!frameImg) return false;

      const ax = (meta.anchorX !== undefined) ? meta.anchorX : 0.5;
      const ay = (meta.anchorY !== undefined) ? meta.anchorY : 0.85;

      ctx.save();
      ctx.translate(x, y + yOffset);
      if (flipX) ctx.scale(-1, 1);
      if (angle !== 0 && !flipX) ctx.rotate(angle);
      ctx.drawImage(frameImg, -width * ax, -height * ay, width, height);
      ctx.restore();
      return true;
    }

    // --- Fallback final
    return this.drawEntitySprite({ ctx, imageKey, x, y, width, height, angle, flipX, yOffset });
  }
}

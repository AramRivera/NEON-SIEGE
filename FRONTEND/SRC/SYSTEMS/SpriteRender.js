// frontend/src/systems/SpriteRenderer.js
import { assetManager } from './AssetManager.js';

export class SpriteRenderer {
  /**
   * Dibuja una sombra elíptica en los pies de cualquier entidad
   */
  static drawShadow(ctx, x, y, radius) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(x, y + radius * 0.5, radius * 0.9, radius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Dibuja un frame de spritesheet o imagen estática
   */
  static drawEntitySprite({
    ctx,
    imageKey,
    x,
    y,
    width,
    height,
    angle = 0,
    flipX = false,
    frameIndex = 0,
    totalFrames = 1,
    row = 0,
    frameWidth = null,
    frameHeight = null,
    yOffset = 0 // Permite elevar el sprite respecto a su colisión para dar perspectiva
  }) {
    const img = assetManager.getImage(imageKey);
    if (!img) return false; // Retorna false si no existe la imagen (para usar fallback)

    const fw = frameWidth || (img.width / totalFrames);
    const fh = frameHeight || (img.height / (row + 1));
    const sx = (frameIndex % totalFrames) * fw;
    const sy = row * fh;

    ctx.save();
    ctx.translate(x, y + yOffset);

    // Si queremos rotar hacia el mouse o voltear según la dirección horizontal
    if (flipX) ctx.scale(-1, 1);
    if (angle !== 0 && !flipX) ctx.rotate(angle);

    ctx.drawImage(img, sx, sy, fw, fh, -width / 2, -height / 2, width, height);
    ctx.restore();
    return true;
  }
}
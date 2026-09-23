// frontend/src/systems/SpriteRenderer.js
import { assetManager } from '../SYSTEMS/AssetManager.js';
import { CONFIG } from '../config.js';

export class SpriteRenderer {
  static drawShadow(ctx, x, y, radius) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(x, y + radius * 0.4, radius * 0.85, radius * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

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
    if (!meta || !meta.animations) {
      return this.drawEntitySprite({ ctx, imageKey, x, y, width, height, angle, flipX, yOffset });
    }

    const anim = meta.animations[animState] || meta.animations['idle'];
    const fw = meta.frameW || (img.width / 6);
    const fh = meta.frameH || (img.height / 5);

    // Recorte dentro del spritesheet de 1536x1024
    const sx = (frameIndex % anim.frames) * fw;
    const sy = anim.row * fh;

    ctx.save();
    ctx.translate(x, y + yOffset);

    // Espejo horizontal (Opción A)
    if (flipX) ctx.scale(-1, 1);
    if (angle !== 0 && !flipX) ctx.rotate(angle);

    // Dibujar escalado a pantalla
    ctx.drawImage(img, sx, sy, fw, fh, -width / 2, -height / 2, width, height);
    ctx.restore();
    return true;
  }
}
// frontend/src/systems/AssetManager.js
import { CONFIG } from '../config.js';

export class AssetManager {
  constructor() {
    this.images = new Map();
    this.sounds = new Map();
    this.isLoaded = false;
  }

  async loadAll() {
    const promises = [];

    if (CONFIG.ASSETS.USE_IMAGE_SPRITES) {
      for (const [key, value] of Object.entries(CONFIG.ASSETS.SPRITES)) {
        // Extraer la ruta si es string o si viene dentro de un objeto { src: '...' }
        const src = typeof value === 'string' ? value : (value && value.src);
        if (src) {
          promises.push(this._loadImage(key, src));
        }
      }
    }

    if (CONFIG.ASSETS.USE_AUDIO) {
      for (const [key, src] of Object.entries(CONFIG.ASSETS.AUDIO)) {
        promises.push(this._loadAudio(key, src));
      }
    }

    await Promise.allSettled(promises);
    this.isLoaded = true;
    console.log(`[AssetManager] ${this.images.size} imágenes cargadas en memoria.`);
  }

  _loadImage(key, src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        this.images.set(key, img);
        resolve(img);
      };
      img.onerror = () => {
        console.warn(`[AssetManager] No se pudo cargar imagen "${key}" (${src}). Usando fallback procedural.`);
        resolve(null);
      };
    });
  }

  _loadAudio(key, src) {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.src = src;
      audio.oncanplaythrough = () => {
        this.sounds.set(key, audio);
        resolve(audio);
      };
      audio.onerror = () => {
        resolve(null);
      };
    });
  }

  getImage(key) {
    return this.images.get(key) || null;
  }

  playSound(key, volume = 0.5) {
    const sound = this.sounds.get(key);
    if (!sound) return;
    try {
      const clone = sound.cloneNode();
      clone.volume = volume;
      clone.play().catch(() => {});
    } catch (e) {}
  }
}

export const assetManager = new AssetManager();
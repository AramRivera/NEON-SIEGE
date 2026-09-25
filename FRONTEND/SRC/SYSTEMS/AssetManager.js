// frontend/src/systems/AssetManager.js
// ============================================================
//  AssetManager — Carga de imágenes y sistema de AUDIO
//  ------------------------------------------------------------
//  AUDIO:
//    - Volumen MASTER general (engine.masterVolume).
//    - Volumen por categoría: música (bgm) y efectos (sfx).
//    - Reproducción de SFX con clonado (permite solapamiento).
//    - Música de fondo (BGM) con loop y fade in/out.
//    - Carga diferida / recarga dinámica al activar audio.
//    - Manejo del bloqueo de autoplay del navegador.
// ============================================================

import { CONFIG } from '../config.js';

export class AssetManager {
  constructor() {
    this.images = new Map();
    this.sounds = new Map();     // key -> Audio (plantilla reutilizable)

    this.isLoaded = false;
    this.audioLoaded = false;

    // ---- Control de volumen ----
    this.masterVolume = 0.7;     // controlado desde los ajustes del menú
    this.sfxVolume = 1.0;        // multiplicador de efectos
    this.bgmVolume = 0.55;       // multiplicador de música

    // ---- Música de fondo actual ----
    this.currentBgm = null;      // elemento <Audio> en reproducción
    this.currentBgmKey = null;

    // ---- Autoplay ----
    this.audioUnlocked = false;
    this._pendingBgmKey = null;
  }

  // ------------------------------------------------------------
  //  CARGA PRINCIPAL
  // ------------------------------------------------------------
  async loadAll() {
    const promises = [];

    if (CONFIG.ASSETS.USE_IMAGE_SPRITES) {
      for (const [key, value] of Object.entries(CONFIG.ASSETS.SPRITES)) {
        const src = typeof value === 'string' ? value : (value && value.src);
        if (src) promises.push(this._loadImage(key, src));
      }
    }

    if (CONFIG.ASSETS.USE_AUDIO) {
      promises.push(this.loadAudio());
    }

    await Promise.allSettled(promises);
    this.isLoaded = true;
    console.log(`[AssetManager] ${this.images.size} imágenes en memoria. Audio: ${this.sounds.size}.`);
  }

  // Carga (o recarga) todos los sonidos declarados en CONFIG
  async loadAudio() {
    const promises = [];
    for (const [key, src] of Object.entries(CONFIG.ASSETS.AUDIO)) {
      promises.push(this._loadAudio(key, src));
    }
    await Promise.allSettled(promises);
    this.audioLoaded = true;
    return this.sounds;
  }

  // ------------------------------------------------------------
  //  IMÁGENES
  // ------------------------------------------------------------
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

  getImage(key) {
    return this.images.get(key) || null;
  }

  // ------------------------------------------------------------
  //  AUDIO — CARGA
  // ------------------------------------------------------------
  _loadAudio(key, src) {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = src;
      audio.oncanplaythrough = () => {
        this.sounds.set(key, audio);
        resolve(audio);
      };
      audio.onerror = () => {
        console.warn(`[AssetManager] No se pudo cargar audio "${key}" (${src}).`);
        resolve(null);
      };
      // Fallback por timeout (algunos navegadores no disparan oncanplaythrough)
      setTimeout(() => {
        if (!this.sounds.has(key)) {
          this.sounds.set(key, audio);
          resolve(audio);
        }
      }, 1500);
    });
  }

  // ------------------------------------------------------------
  //  AUDIO — EFECTOS (SFX)
  // ------------------------------------------------------------
  /** Reproduce SFX clonando el Audio para permitir solapes (muchos disparos). */
  playSound(key, volume = 0.5) {
    if (!CONFIG.ASSETS.USE_AUDIO) return;
    const sound = this.sounds.get(key);
    if (!sound) return;

    const finalVolume = this._clamp01(volume * this.sfxVolume * this.masterVolume);
    if (finalVolume <= 0) return;

    try {
      const clone = sound.cloneNode(true);
      clone.volume = finalVolume;
      const p = clone.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  }

  // Variante con tono aleatorio (evita monotonía en disparos repetidos)
  playSoundVaried(key, volume = 0.5) {
    const sound = this.sounds.get(key);
    if (!sound) return;
    try {
      const clone = sound.cloneNode(true);
      clone.volume = this._clamp01(volume * this.sfxVolume * this.masterVolume);
      clone.playbackRate = 0.92 + Math.random() * 0.16;
      const p = clone.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  }

  // ------------------------------------------------------------
  //  AUDIO — MÚSICA DE FONDO (BGM)
  // ------------------------------------------------------------
  playBgm(key, { loop = true, fadeIn = 1.0 } = {}) {
    if (!CONFIG.ASSETS.USE_AUDIO) return;

    const sound = this.sounds.get(key);
    if (!sound) return;

    if (this.currentBgmKey === key && this.currentBgm && !this.currentBgm.paused) return;

    this.stopBgm(0.6);

    const bgm = sound.cloneNode(true);
    bgm.loop = loop;
    bgm.volume = 0;

    this.currentBgm = bgm;
    this.currentBgmKey = key;
    this._pendingBgmKey = null;

    const target = this._clamp01(this.bgmVolume * this.masterVolume);
    const start = bgm.play();

    if (start && start.catch) {
      start.catch(() => { this._pendingBgmKey = key; });
    }

    this._fade(bgm, 0, target, fadeIn);
  }

  stopBgm(fadeOut = 0.8) {
    if (!this.currentBgm) return;
    const bgm = this.currentBgm;
    this.currentBgm = null;
    this.currentBgmKey = null;
    const current = bgm.volume;
    this._fade(bgm, current, 0, fadeOut, () => {
      try { bgm.pause(); } catch (e) {}
    });
  }

  _fade(audioEl, from, to, duration, onComplete) {
    if (duration <= 0) {
      audioEl.volume = this._clamp01(to);
      if (onComplete) onComplete();
      return;
    }
    const steps = Math.max(1, Math.floor(duration * 30));
    let i = 0;
    const delta = (to - from) / steps;
    const timer = setInterval(() => {
      i++;
      audioEl.volume = this._clamp01(from + delta * i);
      if (i >= steps) {
        clearInterval(timer);
        if (onComplete) onComplete();
      }
    }, 1000 / 30);
  }

  // ------------------------------------------------------------
  //  VOLUMEN GLOBAL
  // ------------------------------------------------------------
  setMasterVolume(v) {
    this.masterVolume = this._clamp01(v);
    if (this.currentBgm) {
      this.currentBgm.volume = this._clamp01(this.bgmVolume * this.masterVolume);
    }
  }

  _clamp01(v) {
    return Math.max(0, Math.min(1, v || 0));
  }

  // ------------------------------------------------------------
  //  DESBLOQUEO DE AUTOPLAY (tras la primera interacción)
  // ------------------------------------------------------------
  unlockAudio() {
    if (this.audioUnlocked) return;
    this.audioUnlocked = true;

    if (this._pendingBgmKey) {
      const key = this._pendingBgmKey;
      this._pendingBgmKey = null;
      this.playBgm(key, { loop: true, fadeIn: 0.8 });
    }
  }

  // ------------------------------------------------------------
  //  ACTIVAR / DESACTIVAR AUDIO EN CALIENTE
  // ------------------------------------------------------------
  async setAudioEnabled(enabled) {
    CONFIG.ASSETS.USE_AUDIO = enabled;

    if (enabled) {
      if (!this.audioLoaded) {
        await this.loadAudio();
      }
      if (this.currentBgmKey && this.currentBgm) {
        this.currentBgm.play().catch(() => {});
      }
    } else {
      this.stopBgm(0.2);
    }
  }
}

export const assetManager = new AssetManager();
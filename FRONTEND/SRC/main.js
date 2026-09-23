// frontend/src/main.js
import { Engine } from '/core/Engine.js';
import { assetManager } from '/systems/AssetManager.js';

window.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('gameCanvas');
  await assetManager.loadAll();

  const engine = new Engine(canvas);
  engine.start();

  window.engineInstance = engine; // Accesible para depuración en consola durante la exposición
  console.log('[Neon Siege] Motor iniciado con éxito.');
});
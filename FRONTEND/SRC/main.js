// frontend/src/main.js
import { Engine } from './core/Engine.js';
import { assetManager } from './SYSTEMS/AssetManager.js';
import { MainMenu } from './UI/MainMenu.js';

window.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('gameCanvas');

  // Carga previa de spritesheets y fuentes de audio
  await assetManager.loadAll();

  // Inicializar motor
  const engine = new Engine(canvas);
  window.engineInstance = engine;

  // Montar e inicializar el menú de inicio
  const mainMenu = new MainMenu(engine);
  mainMenu.show();

  console.log('[Neon Siege] Motor cargado. Esperando inicio de partida desde el menú.');
});
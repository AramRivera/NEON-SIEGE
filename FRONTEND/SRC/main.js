/**
 * Punto de entrada del cliente.
 * Espera al DOM, precarga assets y deja el motor listo detrás del menú.
 * La partida no arranca aquí: MainMenu llama a Engine.start() al pulsar JUGAR.
 */
import { Engine } from './core/Engine.js';
import { assetManager } from './SYSTEMS/AssetManager.js';
import { MainMenu } from './UI/MainMenu.js';

window.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('gameCanvas');

  // Spritesheets, tiles y audio deben estar en memoria antes del primer frame.
  await assetManager.loadAll();

  const engine = new Engine(canvas);
  // Acceso de depuración desde la consola del navegador.
  window.engineInstance = engine;

  const mainMenu = new MainMenu(engine);
  mainMenu.show();

  console.log('[Neon Siege] Motor cargado. Esperando inicio de partida desde el menú.');
});

// frontend/src/core/Input.js
export class InputHandler {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.mouse = {
      x: 0,
      y: 0,
      worldX: 0,
      worldY: 0,
      down: false
    };

    this._setupListeners();
  }

  _setupListeners() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouse.down = true;
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
    });
  }

  // Obtener vector de movimiento 8 direcciones normalizado
  getMovementVector() {
    let vx = 0;
    let vy = 0;

    if (this.keys['KeyW'] || this.keys['ArrowUp']) vy -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) vy += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) vx -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) vx += 1;

    // Normalización diagonal: magnitud constante = 1
    if (vx !== 0 && vy !== 0) {
      vx *= 0.70710678118;
      vy *= 0.70710678118;
    }

    return { vx, vy };
  }

  // Actualizar coordenadas del mouse con respecto al espacio del mundo (cámara)
  updateWorldCoordinates(cameraX, cameraY) {
    this.mouse.worldX = this.mouse.x + cameraX;
    this.mouse.worldY = this.mouse.y + cameraY;
  }
}
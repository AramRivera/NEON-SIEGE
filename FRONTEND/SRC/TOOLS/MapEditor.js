// frontend/src/tools/MapEditor.js
const TILE_SIZE = 64;

// Definición de paleta de elementos (Suelos, Paredes, Marcadores de Entidad)
const PALETTE = [
  { id: 'floor_metal', category: 'floor', name: 'Placa Metal', color: '#161e2e', hasCollision: false },
  { id: 'floor_grid',  category: 'floor', name: 'Rejilla Neón', color: '#0f293a', hasCollision: false },
  { id: 'wall_solid',  category: 'wall',  name: 'Muro Neón',   color: '#00f0ff', hasCollision: true },
  { id: 'wall_hazard', category: 'wall',  name: 'Muro Bloque', color: '#ff0077', hasCollision: true },
  { id: 'wall_pillar', category: 'wall',  name: 'Pilar Central',color: '#6c15a8', hasCollision: true },
  { id: 'spawn_player',category: 'marker',name: 'Spawn Jugador',color: '#39ff14', isPlayerSpawn: true },
  { id: 'spawn_enemy', category: 'marker',name: 'Portal Enemigo',color: '#ffaa00', isEnemySpawn: true }
];

class MapEditor {
  constructor() {
    this.canvas = document.getElementById('editorCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();

    this.mapWidth = 2400;
    this.mapHeight = 1800;
    this.cols = Math.ceil(this.mapWidth / TILE_SIZE);
    this.rows = Math.ceil(this.mapHeight / TILE_SIZE);

    // Matrices de datos
    this.floorLayer = new Array(this.cols * this.rows).fill(null);
    this.wallLayer = new Array(this.cols * this.rows).fill(null);
    this.playerSpawn = { x: 1200, y: 900 };
    this.enemySpawners = [];

    this.selectedTool = PALETTE[0];
    this.camera = { x: 0, y: 0, isDragging: false, lastX: 0, lastY: 0 };
    this.isPainting = false;
    this.isErasing = false;

    this.setupPaletteUI();
    this.setupListeners();
    this.fillDefaultFloor('floor_metal');
    this.render();
  }

  resizeCanvas() {
    this.canvas.width = this.canvas.parentElement.clientWidth;
    this.canvas.height = this.canvas.parentElement.clientHeight;
  }

  fillDefaultFloor(floorId) {
    for (let i = 0; i < this.floorLayer.length; i++) {
      this.floorLayer[i] = floorId;
    }
  }

  setupPaletteUI() {
    const container = document.getElementById('palette-container');
    container.innerHTML = '';

    PALETTE.forEach(item => {
      const card = document.createElement('div');
      card.className = `palette-item ${item.id === this.selectedTool.id ? 'active' : ''}`;
      card.innerHTML = `
        <div class="palette-preview" style="background:${item.color};"></div>
        <span>${item.name}</span>
      `;
      card.onclick = () => {
        document.querySelectorAll('.palette-item').forEach(el => el.classList.remove('active'));
        card.classList.add('active');
        this.selectedTool = item;
      };
      container.appendChild(card);
    });
  }

  setupListeners() {
    window.addEventListener('resize', () => { this.resizeCanvas(); this.render(); });

    // Clics y arrastre sobre el canvas
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { // Clic izquierdo: Pintar
        this.isPainting = true;
        this.applyToolAtCursor(e.clientX, e.clientY);
      } else if (e.button === 2) { // Clic derecho: Borrar
        this.isErasing = true;
        this.eraseAtCursor(e.clientX, e.clientY);
      } else if (e.button === 1) { // Botón central: Arrastrar cámara
        this.camera.isDragging = true;
        this.camera.lastX = e.clientX;
        this.camera.lastY = e.clientY;
      }
    });

    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const worldX = Math.floor(mouseX + this.camera.x);
      const worldY = Math.floor(mouseY + this.camera.y);

      document.getElementById('info-bar').innerText = 
        `Cámara: X:${Math.floor(this.camera.x)} Y:${Math.floor(this.camera.y)} | Mundo: X:${worldX} Y:${worldY} | Herramienta: ${this.selectedTool.name}`;

      if (this.camera.isDragging) {
        this.camera.x -= (e.clientX - this.camera.lastX);
        this.camera.y -= (e.clientY - this.camera.lastY);
        this.camera.lastX = e.clientX;
        this.camera.lastY = e.clientY;
        this.render();
      } else if (this.isPainting) {
        this.applyToolAtCursor(e.clientX, e.clientY);
      } else if (this.isErasing) {
        this.eraseAtCursor(e.clientX, e.clientY);
      }
    });

    window.addEventListener('mouseup', () => {
      this.isPainting = false;
      this.isErasing = false;
      this.camera.isDragging = false;
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Botones de acciones
    document.getElementById('btn-resize').onclick = () => {
      const w = parseInt(document.getElementById('inp-width').value, 10);
      const h = parseInt(document.getElementById('inp-height').value, 10);
      this.resizeMap(w, h);
    };

    document.getElementById('btn-export').onclick = () => this.exportJSON(true);
    document.getElementById('btn-copy').onclick = () => this.exportJSON(false);
    document.getElementById('btn-clear').onclick = () => {
      if (confirm('¿Vaciar todos los obstáculos y marcadores del mapa?')) {
        this.wallLayer.fill(null);
        this.enemySpawners = [];
        this.render();
      }
    };

    // Importar
    const fileInput = document.getElementById('file-input');
    document.getElementById('btn-import').onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => this.importJSON(event.target.result);
      reader.readAsText(file);
    };
  }

  applyToolAtCursor(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const worldX = clientX - rect.left + this.camera.x;
    const worldY = clientY - rect.top + this.camera.y;

    if (worldX < 0 || worldX >= this.mapWidth || worldY < 0 || worldY >= this.mapHeight) return;

    const col = Math.floor(worldX / TILE_SIZE);
    const row = Math.floor(worldY / TILE_SIZE);
    const index = row * this.cols + col;

    if (this.selectedTool.category === 'floor') {
      this.floorLayer[index] = this.selectedTool.id;
    } else if (this.selectedTool.category === 'wall') {
      this.wallLayer[index] = this.selectedTool.id;
    } else if (this.selectedTool.isPlayerSpawn) {
      this.playerSpawn = { x: col * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 };
    } else if (this.selectedTool.isEnemySpawn) {
      const ex = col * TILE_SIZE + TILE_SIZE / 2;
      const ey = row * TILE_SIZE + TILE_SIZE / 2;
      if (!this.enemySpawners.some(s => s.x === ex && s.y === ey)) {
        this.enemySpawners.push({ x: ex, y: ey });
      }
    }
    this.render();
  }

  eraseAtCursor(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const worldX = clientX - rect.left + this.camera.x;
    const worldY = clientY - rect.top + this.camera.y;

    const col = Math.floor(worldX / TILE_SIZE);
    const row = Math.floor(worldY / TILE_SIZE);
    const index = row * this.cols + col;

    this.wallLayer[index] = null;
    const ex = col * TILE_SIZE + TILE_SIZE / 2;
    const ey = row * TILE_SIZE + TILE_SIZE / 2;
    this.enemySpawners = this.enemySpawners.filter(s => s.x !== ex || s.y !== ey);
    this.render();
  }

  resizeMap(newW, newH) {
    this.mapWidth = newW;
    this.mapHeight = newH;
    this.cols = Math.ceil(this.mapWidth / TILE_SIZE);
    this.rows = Math.ceil(this.mapHeight / TILE_SIZE);
    this.floorLayer = new Array(this.cols * this.rows).fill('floor_metal');
    this.wallLayer = new Array(this.cols * this.rows).fill(null);
    this.enemySpawners = [];
    this.render();
  }

  generateMapData() {
    // Convierte las paredes en el arreglo AABB optimizado que consume el motor de colisiones
    const obstacles = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const wallId = this.wallLayer[r * this.cols + c];
        if (wallId) {
          obstacles.push({
            x: c * TILE_SIZE,
            y: r * TILE_SIZE,
            w: TILE_SIZE,
            h: TILE_SIZE,
            type: wallId
          });
        }
      }
    }

    return {
      version: "1.0",
      width: this.mapWidth,
      height: this.mapHeight,
      tileSize: TILE_SIZE,
      playerSpawn: this.playerSpawn,
      enemySpawners: this.enemySpawners,
      obstacles: obstacles
    };
  }

  exportJSON(downloadFile = true) {
    const data = this.generateMapData();
    const jsonStr = JSON.stringify(data, null, 2);

    if (downloadFile) {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'map_arena_1.json';
      a.click();
    } else {
      navigator.clipboard.writeText(jsonStr).then(() => {
        alert('¡JSON del mapa copiado al portapapeles!');
      });
    }
  }

  importJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      this.mapWidth = data.width || 2400;
      this.mapHeight = data.height || 1800;
      this.cols = Math.ceil(this.mapWidth / TILE_SIZE);
      this.rows = Math.ceil(this.mapHeight / TILE_SIZE);

      this.wallLayer = new Array(this.cols * this.rows).fill(null);
      this.floorLayer = new Array(this.cols * this.rows).fill('floor_metal');

      if (data.obstacles) {
        data.obstacles.forEach(obs => {
          const col = Math.floor(obs.x / TILE_SIZE);
          const row = Math.floor(obs.y / TILE_SIZE);
          if (row < this.rows && col < this.cols) {
            this.wallLayer[row * this.cols + col] = obs.type || 'wall_solid';
          }
        });
      }

      this.playerSpawn = data.playerSpawn || { x: 1200, y: 900 };
      this.enemySpawners = data.enemySpawners || [];

      document.getElementById('inp-width').value = this.mapWidth;
      document.getElementById('inp-height').value = this.mapHeight;

      this.render();
      alert('¡Mapa cargado con éxito en el editor!');
    } catch (err) {
      alert('Error al procesar el archivo JSON: ' + err.message);
    }
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    this.ctx.translate(-Math.floor(this.camera.x), -Math.floor(this.camera.y));

    // 1. Dibujar Capa Suelo
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const idx = r * this.cols + c;
        const floorId = this.floorLayer[idx];
        const tileMeta = PALETTE.find(p => p.id === floorId) || PALETTE[0];

        this.ctx.fillStyle = tileMeta.color;
        this.ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);

        this.ctx.strokeStyle = '#080c14';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }

    // 2. Dibujar Capa Paredes / Obstáculos
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const wallId = this.wallLayer[r * this.cols + c];
        if (wallId) {
          const wallMeta = PALETTE.find(p => p.id === wallId);
          this.ctx.fillStyle = wallMeta.color;
          this.ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          this.ctx.strokeStyle = '#ffffff';
          this.ctx.strokeRect(c * TILE_SIZE + 2, r * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        }
      }
    }

    // 3. Dibujar Spawnpoints de Enemigos
    for (const spawner of this.enemySpawners) {
      this.ctx.fillStyle = '#ffaa00';
      this.ctx.beginPath();
      this.ctx.arc(spawner.x, spawner.y, 16, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = '#000';
      this.ctx.font = '10px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('PORTAL', spawner.x, spawner.y);
    }

    // 4. Dibujar Spawnpoint del Jugador
    this.ctx.fillStyle = '#39ff14';
    this.ctx.beginPath();
    this.ctx.arc(this.playerSpawn.x, this.playerSpawn.y, 20, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = '#000';
    this.ctx.font = 'bold 11px monospace';
    this.ctx.fillText('PLAYER', this.playerSpawn.x, this.playerSpawn.y);

    // 5. Marco límite de la Arena
    this.ctx.strokeStyle = '#00f0ff';
    this.ctx.lineWidth = 4;
    this.ctx.strokeRect(0, 0, this.mapWidth, this.mapHeight);

    this.ctx.restore();
  }
}

window.onload = () => new MapEditor();
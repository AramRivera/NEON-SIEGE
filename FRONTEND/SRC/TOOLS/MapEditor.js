// frontend/src/tools/MapEditor.js
// Neon Siege — Editor de Arenas v2

const TILE_SIZE = 64;

const PALETTE = [
  { id: 'floor_metal', category: 'floor', name: 'Piso Metálico', color: '#161e2e', icon: '▦', src: './ASSETS/TILES/floor_metal.png', hasCollision: false },
  { id: 'wall_tech',   category: 'wall',  name: 'Pared Tech',    color: '#00aaff', icon: '█', src: './ASSETS/TILES/wall_tech.png',   hasCollision: true },
  { id: 'spawn_player',category: 'marker',name: 'Spawn Jugador', color: '#39ff14', icon: '☻', isPlayerSpawn: true },
  { id: 'spawn_enemy', category: 'marker',name: 'Portal Enemigo',color:'#ffaa00', icon: '✪', isEnemySpawn: true },
  { id: 'spawn_ammo',  category: 'marker',name: 'Caja Munición', color: '#ffd700', icon: '▣', isAmmoSpawn: true }
];

const STORAGE_KEY = 'neonSiege_mapEditor_autosave';

class MapEditor {
  constructor() {
    this.canvas = document.getElementById('editorCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();

    this.mapWidth = 2400;
    this.mapHeight = 1800;
    this.cols = Math.ceil(this.mapWidth / TILE_SIZE);
    this.rows = Math.ceil(this.mapHeight / TILE_SIZE);

    this.floorLayer = new Array(this.cols * this.rows).fill('floor_metal');
    this.wallLayer = new Array(this.cols * this.rows).fill(null);
    this.playerSpawn = { x: 1200, y: 900 };
    this.enemySpawners = [];
    this.ammoSpawners = [];

    this.selectedTool = PALETTE[0];
    this.brushSize = 1;
    this.brushMode = 'paint';
    this.showGrid = true;

    this.camera = { x: 0, y: 0, zoom: 1, isDragging: false, lastX: 0, lastY: 0 };

    this.isPainting = false;
    this.isErasing = false;
    this.spaceDown = false;
    this.hoverTile = null;
    this.anchorTile = null;

    this.undoStack = [];
    this.redoStack = [];

    this._autoSaveTimer = null;
    this._toastTimer = null;

    this.setupPaletteUI();
    this.setupListeners();
    this._tryLoadAutosave();
        // Cache de imágenes de texturas
    this.tileImages = {};

    this.setupPaletteUI();
    this.setupListeners();
    this._tryLoadAutosave();
    this._loadTileTextures();   // <-- AÑADE ESTA LÍNEA
    this.render();
    this.updateStats();
    this._updateUndoButtons();
    this.render();
    this.updateStats();
    this._updateUndoButtons();
  }

  resizeCanvas() {
    this.canvas.width = this.canvas.parentElement.clientWidth;
    this.canvas.height = this.canvas.parentElement.clientHeight;
  }
    _loadTileTextures() {
    PALETTE.forEach(item => {
      if (!item.src) return;
      const img = new Image();
      img.onload = () => {
        this.tileImages[item.id] = img;
        this.render(); // repintar cuando cargue
      };
      img.onerror = () => {
        console.warn(`[MapEditor] No se pudo cargar textura: ${item.src}`);
      };
      img.src = item.src;
    });
  }

  _getTileImage(id) {
    return this.tileImages[id] || null;
  }

    setupPaletteUI() {
    const container = document.getElementById('palette-container');
    if (!container) return;
    container.innerHTML = '';

    PALETTE.forEach((item, i) => {
      const card = document.createElement('div');
      card.className = `palette-item ${item.id === this.selectedTool.id ? 'active' : ''}`;
      card.dataset.toolId = item.id;
      card.innerHTML = `
        <div class="cat-tag">${item.category}</div>
                <div class="palette-preview" style="background:${item.src ? `url('${item.src}') center/cover` : item.color}; color:#000; text-shadow:0 0 3px #fff;">${item.src ? '' : item.icon}</div>
        <span class="name">${item.name}</span>
      `;
      card.onclick = () => this.selectTool(item);
      card.title = `Atajo: ${i + 1}`;
      container.appendChild(card);
    });
  }

  selectTool(item) {
    this.selectedTool = item;
    document.querySelectorAll('.palette-item').forEach(el => {
      el.classList.toggle('active', el.dataset.toolId === item.id);
    });
  }

  selectToolByIndex(idx) {
    if (idx >= 0 && idx < PALETTE.length) this.selectTool(PALETTE[idx]);
  }

  setupListeners() {
    window.addEventListener('resize', () => { this.resizeCanvas(); this.render(); });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0 && !this.spaceDown) {
        this.isPainting = true;
        const t = this._clientToTile(e.clientX, e.clientY);
        if (this.brushMode === 'line' || this.brushMode === 'rect') {
          this.anchorTile = t;
        } else {
          this._pushUndo();
          this.applyToolAtTile(t);
        }
      } else if (e.button === 2) {
        this.isErasing = true;
        this._pushUndo();
        this.eraseAtCursor(e.clientX, e.clientY);
      } else if (e.button === 1 || this.spaceDown) {
        this.camera.isDragging = true;
        this.camera.lastX = e.clientX;
        this.camera.lastY = e.clientY;
      }
    });

    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const worldX = mouseX / this.camera.zoom + this.camera.x;
      const worldY = mouseY / this.camera.zoom + this.camera.y;
      const tile = this._clientToTile(e.clientX, e.clientY);
      this.hoverTile = tile;

      const info = document.getElementById('info-bar');
      if (info) {
        const modeLabel = { paint: 'Pintar', line: 'Línea', rect: 'Rectángulo', fill: 'Relleno' }[this.brushMode];
        info.innerText = `Cámara: X:${Math.floor(this.camera.x)} Y:${Math.floor(this.camera.y)} | Mundo: X:${Math.floor(worldX)} Y:${Math.floor(worldY)} | Modo: ${modeLabel} | Herramienta: ${this.selectedTool.name}`;
      }

      if (this.camera.isDragging) {
        this.camera.x -= (e.clientX - this.camera.lastX) / this.camera.zoom;
        this.camera.y -= (e.clientY - this.camera.lastY) / this.camera.zoom;
        this.camera.lastX = e.clientX;
        this.camera.lastY = e.clientY;
        this.render();
      } else if (this.isPainting) {
        if (this.brushMode === 'line' || this.brushMode === 'rect') this.render();
        else this.applyToolAtTile(tile, true);
      } else if (this.isErasing) {
        this.eraseAtCursor(e.clientX, e.clientY, true);
      } else {
        this.render();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (this.isPainting && (this.brushMode === 'line' || this.brushMode === 'rect') && this.anchorTile) {
        this._pushUndo();
        const endTile = this._clientToTile(e.clientX, e.clientY);
        if (this.brushMode === 'line') this._drawLineTiles(this.anchorTile, endTile);
        else this._drawRectTiles(this.anchorTile, endTile);
        this.anchorTile = null;
      }
      this.isPainting = false;
      this.isErasing = false;
      this.camera.isDragging = false;
      this.render();
      this._scheduleAutoSave();
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const worldX = mx / this.camera.zoom + this.camera.x;
      const worldY = my / this.camera.zoom + this.camera.y;
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      this.camera.zoom = Math.max(0.2, Math.min(4, this.camera.zoom * factor));
      this.camera.x = worldX - mx / this.camera.zoom;
      this.camera.y = worldY - my / this.camera.zoom;
      this._updateZoomLabel();
      this.render();
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') { this.spaceDown = true; this.canvas.style.cursor = 'grab'; }
      const k = e.key.toLowerCase();
      if (k >= '1' && k <= '9') this.selectToolByIndex(parseInt(k, 10) - 1);
      if (k === 'b') this.brushMode = 'paint';
      if (k === 'l') this.brushMode = 'line';
      if (k === 'r') this.brushMode = 'rect';
      if (k === 'f') this.brushMode = 'fill';
      const sel = document.getElementById('sel-brush-mode');
      if (sel && ['b', 'l', 'r', 'f'].includes(k)) sel.value = this.brushMode;
      if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? this.redo() : this.undo(); }
      if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); this.redo(); }
      if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); this.exportJSON(true); }
      if (k === '+' || k === '=') this._zoomAtCenter(1.15);
      if (k === '-') this._zoomAtCenter(0.87);
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') { this.spaceDown = false; this.canvas.style.cursor = 'crosshair'; }
    });
        const btnResize = document.getElementById('btn-resize');
    if (btnResize) btnResize.onclick = () => {
      const w = parseInt(document.getElementById('inp-width').value, 10);
      const h = parseInt(document.getElementById('inp-height').value, 10);
      this.resizeMap(w, h);
    };

    const inpBrush = document.getElementById('inp-brush');
    if (inpBrush) inpBrush.oninput = (e) => {
      this.brushSize = Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1));
      this.render();
    };

    const selBrush = document.getElementById('sel-brush-mode');
    if (selBrush) selBrush.onchange = (e) => { this.brushMode = e.target.value; };

    const chkGrid = document.getElementById('chk-grid');
    if (chkGrid) chkGrid.onchange = (e) => { this.showGrid = e.target.checked; this.render(); };

    document.getElementById('btn-undo').onclick = () => this.undo();
    document.getElementById('btn-redo').onclick = () => this.redo();

    document.getElementById('btn-export').onclick = () => this.exportJSON(true);
    document.getElementById('btn-copy').onclick = () => this.exportJSON(false);
    document.getElementById('btn-clear').onclick = () => {
      if (confirm('¿Vaciar todos los obstáculos y marcadores del mapa?')) {
        this._pushUndo();
        this.wallLayer.fill(null);
        this.enemySpawners = [];
        this.ammoSpawners = [];
        this.render(); this.updateStats(); this._scheduleAutoSave();
      }
    };

    const fileInput = document.getElementById('file-input');
    document.getElementById('btn-import').onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => this.importJSON(event.target.result);
      reader.readAsText(file);
      fileInput.value = '';
    };

    document.getElementById('btn-zoom-in').onclick = () => this._zoomAtCenter(1.15);
    document.getElementById('btn-zoom-out').onclick = () => this._zoomAtCenter(0.87);
    document.getElementById('btn-zoom-reset').onclick = () => {
      this.camera.zoom = 1; this.camera.x = 0; this.camera.y = 0;
      this._updateZoomLabel(); this.render();
    };
  }

  _zoomAtCenter(factor) {
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const worldX = cx / this.camera.zoom + this.camera.x;
    const worldY = cy / this.camera.zoom + this.camera.y;
    this.camera.zoom = Math.max(0.2, Math.min(4, this.camera.zoom * factor));
    this.camera.x = worldX - cx / this.camera.zoom;
    this.camera.y = worldY - cy / this.camera.zoom;
    this._updateZoomLabel();
    this.render();
  }

  _updateZoomLabel() {
    const el = document.getElementById('zoom-level');
    if (el) el.innerText = Math.round(this.camera.zoom * 100) + '%';
  }

  _clientToTile(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const worldX = (clientX - rect.left) / this.camera.zoom + this.camera.x;
    const worldY = (clientY - rect.top) / this.camera.zoom + this.camera.y;
    return {
      col: Math.floor(worldX / TILE_SIZE),
      row: Math.floor(worldY / TILE_SIZE),
      worldX,
      worldY
    };
  }
    applyToolAtTile(tile, isDrag = false) {
    if (!tile) return;
    const b = this.brushSize;
    for (let dr = 0; dr < b; dr++) {
      for (let dc = 0; dc < b; dc++) {
        this._applySingle(tile.col + dc, tile.row + dr);
      }
    }
    this.render();
    this.updateStats();
    if (!isDrag) this._scheduleAutoSave();
  }

  _applySingle(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
    const index = row * this.cols + col;
    const centerX = col * TILE_SIZE + TILE_SIZE / 2;
    const centerY = row * TILE_SIZE + TILE_SIZE / 2;
    const tool = this.selectedTool;

    if (tool.category === 'floor') {
      this.floorLayer[index] = tool.id;
    } else if (tool.category === 'wall') {
      this.wallLayer[index] = tool.id;
    } else if (tool.isPlayerSpawn) {
      this.playerSpawn = { x: centerX, y: centerY };
    } else if (tool.isEnemySpawn) {
      if (!this.enemySpawners.some(s => s.x === centerX && s.y === centerY)) {
        this.enemySpawners.push({ x: centerX, y: centerY });
      }
    } else if (tool.isAmmoSpawn) {
      if (!this.ammoSpawners.some(s => s.x === centerX && s.y === centerY)) {
        this.ammoSpawners.push({ x: centerX, y: centerY, amount: 20 });
      }
    }
  }

  _floodFill(startCol, startRow) {
    const tool = this.selectedTool;
    if (tool.category === 'marker') return;

    const targetLayer = tool.category === 'floor' ? this.floorLayer : this.wallLayer;
    const targetId = targetLayer[startRow * this.cols + startCol];
    const replaceId = tool.id;
    if (targetId === replaceId) return;

    const stack = [[startCol, startRow]];
    const seen = new Set();

    while (stack.length) {
      const [c, r] = stack.pop();
      if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) continue;
      const key = r * this.cols + c;
      if (seen.has(key)) continue;
      seen.add(key);
      if (targetLayer[key] !== targetId) continue;
      targetLayer[key] = replaceId;
      stack.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
    }
  }

  _drawLineTiles(a, b) {
    let x0 = a.col, y0 = a.row;
    const x1 = b.col, y1 = b.row;
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    while (true) {
      this._applySingleThick(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
    this.updateStats();
  }

  _drawRectTiles(a, b) {
    const x0 = Math.min(a.col, b.col), x1 = Math.max(a.col, b.col);
    const y0 = Math.min(a.row, b.row), y1 = Math.max(a.row, b.row);
    for (let r = y0; r <= y1; r++) {
      for (let c = x0; c <= x1; c++) this._applySingleThick(c, r);
    }
    this.updateStats();
  }

  _applySingleThick(col, row) {
    const b = this.brushSize;
    for (let dr = 0; dr < b; dr++) {
      for (let dc = 0; dc < b; dc++) {
        this._applySingle(col + dc, row + dr);
      }
    }
  }

  eraseAtCursor(clientX, clientY, isDrag = false) {
    const t = this._clientToTile(clientX, clientY);
    const b = this.brushSize;
    for (let dr = 0; dr < b; dr++) {
      for (let dc = 0; dc < b; dc++) {
        const col = t.col + dc, row = t.row + dr;
        const index = row * this.cols + col;
        const centerX = col * TILE_SIZE + TILE_SIZE / 2;
        const centerY = row * TILE_SIZE + TILE_SIZE / 2;
        this.wallLayer[index] = null;
        this.enemySpawners = this.enemySpawners.filter(s => s.x !== centerX || s.y !== centerY);
        this.ammoSpawners = this.ammoSpawners.filter(s => s.x !== centerX || s.y !== centerY);
      }
    }
    this.render();
    this.updateStats();
    if (!isDrag) this._scheduleAutoSave();
  }

  _snapshot() {
    return JSON.stringify({
      floorLayer: this.floorLayer,
      wallLayer: this.wallLayer,
      playerSpawn: this.playerSpawn,
      enemySpawners: this.enemySpawners,
      ammoSpawners: this.ammoSpawners
    });
  }

  _restore(snap) {
    const d = JSON.parse(snap);
    this.floorLayer = d.floorLayer;
    this.wallLayer = d.wallLayer;
    this.playerSpawn = d.playerSpawn;
    this.enemySpawners = d.enemySpawners;
    this.ammoSpawners = d.ammoSpawners;
  }

  _pushUndo() {
    this.undoStack.push(this._snapshot());
    if (this.undoStack.length > 60) this.undoStack.shift();
    this.redoStack = [];
    this._updateUndoButtons();
  }

  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(this._snapshot());
    this._restore(this.undoStack.pop());
    this.render(); this.updateStats(); this._updateUndoButtons(); this._scheduleAutoSave();
  }

  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(this._snapshot());
    this._restore(this.redoStack.pop());
    this.render(); this.updateStats(); this._updateUndoButtons(); this._scheduleAutoSave();
  }

  _updateUndoButtons() {
    const u = document.getElementById('btn-undo');
    const r = document.getElementById('btn-redo');
    if (u) u.disabled = this.undoStack.length === 0;
    if (r) r.disabled = this.redoStack.length === 0;
  }

  _scheduleAutoSave() {
    clearTimeout(this._autoSaveTimer);
    this._autoSaveTimer = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.generateMapData())); } catch (e) {}
    }, 800);
  }

  _tryLoadAutosave() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      this._applyMapData(d);
    } catch (e) {}
  }
    resizeMap(newW, newH) {
    if (!newW || !newH) return;
    this._pushUndo();
    this.mapWidth = newW; this.mapHeight = newH;
    this.cols = Math.ceil(this.mapWidth / TILE_SIZE);
    this.rows = Math.ceil(this.mapHeight / TILE_SIZE);
    this.floorLayer = new Array(this.cols * this.rows).fill('floor_metal');
    this.wallLayer = new Array(this.cols * this.rows).fill(null);
    this.enemySpawners = [];
    this.ammoSpawners = [];
    this.render(); this.updateStats(); this._scheduleAutoSave();
  }

  generateMapData() {
    const obstacles = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const wallId = this.wallLayer[r * this.cols + c];
        if (wallId) {
          obstacles.push({ x: c * TILE_SIZE, y: r * TILE_SIZE, w: TILE_SIZE, h: TILE_SIZE, type: wallId });
        }
      }
    }
    return {
      version: '2.0',
      width: this.mapWidth,
      height: this.mapHeight,
      tileSize: TILE_SIZE,
      playerSpawn: this.playerSpawn,
      enemySpawners: this.enemySpawners,
      ammoSpawners: this.ammoSpawners,
      floor: this._encodeFloor(),
      obstacles
    };
  }

  _encodeFloor() {
    const out = [];
    let cur = this.floorLayer[0];
    let count = 1;
    for (let i = 1; i < this.floorLayer.length; i++) {
      if (this.floorLayer[i] === cur) { count++; }
      else { out.push({ id: cur, count }); cur = this.floorLayer[i]; count = 1; }
    }
    out.push({ id: cur, count });
    return out;
  }

  _decodeFloor(rle, total) {
    const arr = new Array(total).fill('floor_metal');
    let i = 0;
    for (const seg of rle) {
      for (let k = 0; k < seg.count && i < total; k++, i++) arr[i] = seg.id;
    }
    return arr;
  }

  exportJSON(downloadFile = true) {
    const data = this.generateMapData();
    const jsonStr = JSON.stringify(data, null, 2);

    if (downloadFile) {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `neon_arena_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } else {
      navigator.clipboard.writeText(jsonStr).then(
        () => this._toast('¡JSON copiado al portapapeles!'),
        () => this._toast('No se pudo copiar', true)
      );
    }
  }

  importJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      this._pushUndo();
      this._applyMapData(data);
      this._toast('¡Mapa cargado con éxito!');
    } catch (err) {
      this._toast('Error al procesar el JSON: ' + err.message, true);
    }
  }

  _applyMapData(data) {
    this.mapWidth = data.width || 2400;
    this.mapHeight = data.height || 1800;
    this.cols = Math.ceil(this.mapWidth / TILE_SIZE);
    this.rows = Math.ceil(this.mapHeight / TILE_SIZE);
    const total = this.cols * this.rows;

    this.wallLayer = new Array(total).fill(null);

    if (data.floor && Array.isArray(data.floor)) {
      this.floorLayer = this._decodeFloor(data.floor, total);
    } else {
      this.floorLayer = new Array(total).fill('floor_metal');
    }

    if (data.obstacles) {
      data.obstacles.forEach(obs => {
        const col = Math.floor(obs.x / TILE_SIZE);
        const row = Math.floor(obs.y / TILE_SIZE);
        if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
          this.wallLayer[row * this.cols + col] = obs.type || 'wall_solid';
        }
      });
    }

    this.playerSpawn = data.playerSpawn || { x: 1200, y: 900 };
    this.enemySpawners = data.enemySpawners || [];
    this.ammoSpawners = data.ammoSpawners || [];

    const iw = document.getElementById('inp-width');
    const ih = document.getElementById('inp-height');
    if (iw) iw.value = this.mapWidth;
    if (ih) ih.value = this.mapHeight;

    this.render(); this.updateStats(); this._updateUndoButtons(); this._scheduleAutoSave();
  }

  updateStats() {
    let walls = 0;
    for (let i = 0; i < this.wallLayer.length; i++) if (this.wallLayer[i]) walls++;
    const elW = document.getElementById('stat-walls');
    const elE = document.getElementById('stat-enemies');
    const elA = document.getElementById('stat-ammo');
    if (elW) elW.innerText = walls;
    if (elE) elE.innerText = this.enemySpawners.length;
    if (elA) elA.innerText = this.ammoSpawners.length;
  }

  _toast(msg, isError = false) {
    let t = document.getElementById('editor-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'editor-toast';
      t.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);' +
        'background:#0c1a30;border:1px solid #00f0ff;color:#00f0ff;padding:10px 20px;' +
        'border-radius:6px;font-family:Consolas,monospace;font-size:13px;z-index:9999;' +
        'box-shadow:0 0 20px rgba(0,240,255,0.4);transition:opacity .3s;';
      document.body.appendChild(t);
    }
    t.style.borderColor = isError ? '#ff0077' : '#00f0ff';
    t.style.color = isError ? '#ff0077' : '#00f0ff';
    t.innerText = msg;
    t.style.opacity = '1';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { t.style.opacity = '0'; }, 1800);
  }

  _label(text, x, y, color, size) {
    this.ctx.fillStyle = color;
    this.ctx.font = `bold ${size}px monospace`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(text, x, y);
  }

  render() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();

    const z = this.camera.zoom;
    this.ctx.setTransform(z, 0, 0, z, -this.camera.x * z, -this.camera.y * z);

        // 1. Suelos
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const idx = r * this.cols + c;
        const floorId = this.floorLayer[idx];
        const tileMeta = PALETTE.find(p => p.id === floorId) || PALETTE[0];
        const img = this._getTileImage(floorId);

        if (img) {
          this.ctx.drawImage(img, c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        } else {
          this.ctx.fillStyle = tileMeta.color;
          this.ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }
    }

        // 3. Muros
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const wallId = this.wallLayer[r * this.cols + c];
        if (wallId) {
          const wallMeta = PALETTE.find(p => p.id === wallId) || PALETTE[1];
          const img = this._getTileImage(wallId);

          if (img) {
            this.ctx.drawImage(img, c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          } else {
            this.ctx.fillStyle = wallMeta.color;
            this.ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          }

          // Marco sutil para distinguir muro
          this.ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          this.ctx.lineWidth = 2 / z;
          this.ctx.strokeRect(c * TILE_SIZE + 2, r * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        }
      }
    }

    // 3. Muros
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const wallId = this.wallLayer[r * this.cols + c];
        if (wallId) {
          const wallMeta = PALETTE.find(p => p.id === wallId) || PALETTE[2];
          this.ctx.fillStyle = wallMeta.color;
          this.ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          this.ctx.strokeStyle = 'rgba(255,255,255,0.6)';
          this.ctx.lineWidth = 2 / z;
          this.ctx.strokeRect(c * TILE_SIZE + 2, r * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        }
      }
    }

    // 4. Portales enemigos
    for (const s of this.enemySpawners) {
      this.ctx.fillStyle = '#ffaa00';
      this.ctx.beginPath();
      this.ctx.arc(s.x, s.y, 16, 0, Math.PI * 2);
      this.ctx.fill();
      this._label('PORTAL', s.x, s.y, '#000', 9);
    }

    // 5. Cajas de munición
    for (const a of this.ammoSpawners) {
      this.ctx.fillStyle = '#ffd700';
      this.ctx.fillRect(a.x - 14, a.y - 10, 28, 20);
      this.ctx.strokeStyle = '#fff';
      this.ctx.lineWidth = 1.5 / z;
      this.ctx.strokeRect(a.x - 14, a.y - 10, 28, 20);
      this._label('AMMO', a.x, a.y, '#000', 9);
    }

    // 6. Spawn jugador
    this.ctx.fillStyle = '#39ff14';
    this.ctx.beginPath();
    this.ctx.arc(this.playerSpawn.x, this.playerSpawn.y, 20, 0, Math.PI * 2);
    this.ctx.fill();
    this._label('PLAYER', this.playerSpawn.x, this.playerSpawn.y, '#000', 11);

    // 7. Borde de la arena
    this.ctx.strokeStyle = '#00f0ff';
    this.ctx.lineWidth = 4 / z;
    this.ctx.strokeRect(0, 0, this.mapWidth, this.mapHeight);

    // 8. Cursor de pincel (resaltado)
    if (this.hoverTile) {
      const b = this.brushSize;
      this.ctx.strokeStyle = 'rgba(255,0,119,0.9)';
      this.ctx.lineWidth = 2 / z;
      this.ctx.strokeRect(this.hoverTile.col * TILE_SIZE, this.hoverTile.row * TILE_SIZE, TILE_SIZE * b, TILE_SIZE * b);

      // Preview de línea/rect
      if ((this.brushMode === 'line' || this.brushMode === 'rect') && this.isPainting && this.anchorTile) {
        this.ctx.strokeStyle = 'rgba(57,255,20,0.7)';
        this.ctx.setLineDash([8 / z, 6 / z]);
        const a = this.anchorTile;
        if (this.brushMode === 'line') {
          this.ctx.beginPath();
          this.ctx.moveTo(a.col * TILE_SIZE + TILE_SIZE / 2, a.row * TILE_SIZE + TILE_SIZE / 2);
          this.ctx.lineTo(this.hoverTile.col * TILE_SIZE + TILE_SIZE / 2, this.hoverTile.row * TILE_SIZE + TILE_SIZE / 2);
          this.ctx.stroke();
        } else {
          const x0 = Math.min(a.col, this.hoverTile.col) * TILE_SIZE;
          const y0 = Math.min(a.row, this.hoverTile.row) * TILE_SIZE;
          const x1 = Math.max(a.col, this.hoverTile.col) * TILE_SIZE + TILE_SIZE;
          const y1 = Math.max(a.row, this.hoverTile.row) * TILE_SIZE + TILE_SIZE;
          this.ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
        }
        this.ctx.setLineDash([]);
      }
    }

    this.ctx.restore();
  }
}

window.onload = () => new MapEditor();
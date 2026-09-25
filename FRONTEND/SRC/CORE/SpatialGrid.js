// frontend/src/core/SpatialGrid.js
export class SpatialGrid {
  constructor(width, height, cellSize) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);
    this.cells = new Array(this.cols * this.rows).fill(null).map(() => []);
  }

  clear() {
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i].length = 0;
    }
  }

  _getIndices(entity) {
    const r = typeof entity.getHitRadius === 'function' ? entity.getHitRadius() : entity.radius;
    const hitY = typeof entity.getHitY === 'function' ? entity.getHitY() : entity.y;
    const minX = Math.max(0, Math.floor((entity.x - r) / this.cellSize));
    const maxX = Math.min(this.cols - 1, Math.floor((entity.x + r) / this.cellSize));
    const minY = Math.max(0, Math.floor((Math.min(entity.y, hitY) - r) / this.cellSize));
    const maxY = Math.min(this.rows - 1, Math.floor((Math.max(entity.y, hitY) + r) / this.cellSize));
    return { minX, maxX, minY, maxY };
  }

  insert(entity) {
    const { minX, maxX, minY, maxY } = this._getIndices(entity);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        this.cells[y * this.cols + x].push(entity);
      }
    }
  }

  // Consulta qué entidades están en las celdas circundantes de un círculo dado
  query(x, y, radius) {
    const minX = Math.max(0, Math.floor((x - radius) / this.cellSize));
    const maxX = Math.min(this.cols - 1, Math.floor((x + radius) / this.cellSize));
    const minY = Math.max(0, Math.floor((y - radius) / this.cellSize));
    const maxY = Math.min(this.rows - 1, Math.floor((y + radius) / this.cellSize));

    const results = new Set();
    for (let cy = minY; cy <= maxY; cy++) {
      for (let cx = minX; cx <= maxX; cx++) {
        const cell = this.cells[cy * this.cols + cx];
        for (let i = 0; i < cell.length; i++) {
          results.add(cell[i]);
        }
      }
    }
    return results;
  }
}
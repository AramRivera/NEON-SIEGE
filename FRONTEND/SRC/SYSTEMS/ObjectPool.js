/**
 * ObjectPool — reutilización de instancias (balas y partículas).
 * Evita GC en el hot path: get() marca activo; si el pool está lleno, descarta.
 */
export class ObjectPool {
  constructor(factoryFn, capacity) {
    this.factoryFn = factoryFn;
    this.capacity = capacity;
    this.pool = [];

    // Pre-alocación estricta de memoria en arranque
    for (let i = 0; i < capacity; i++) {
      const obj = this.factoryFn();
      obj.active = false;
      this.pool.push(obj);
    }
  }

  // Obtiene un objeto inactivo y lo marca como activo
  get() {
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) {
        this.pool[i].active = true;
        return this.pool[i];
      }
    }
    return null; // Si se llena el pool, descarta silenciosamente para preservar FPS
  }

  // Retorna únicamente los objetos activos para actualizar y dibujar
  getActive() {
    const activeItems = [];
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i].active) {
        activeItems.push(this.pool[i]);
      }
    }
    return activeItems;
  }

  // Desactiva todas las instancias (por ejemplo, al reiniciar partida)
  reset() {
    for (let i = 0; i < this.pool.length; i++) {
      this.pool[i].active = false;
    }
  }
}
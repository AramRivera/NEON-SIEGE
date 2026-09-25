/**
 * ApiService — cliente HTTP del frontend hacia Node.js/Express.
 * BASE_URL: CONFIG.API (por defecto http://localhost:4000/api).
 * Endpoints: POST /scores, GET /scores, GET /stats.
 */
import { CONFIG } from '../config.js';

export class ApiService {
  /** Persiste una partida (nombre, score, oleada, tiempo, kills, jefes). */
  static async saveScore(payload) {
    try {
      const response = await fetch(`${CONFIG.API.BASE_URL}/scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.warn('[ApiService] Error al registrar puntuación:', error);
      return null;
    }
  }

  /** Ranking top 10. */
  static async getTopScores() {
    try {
      const response = await fetch(`${CONFIG.API.BASE_URL}/scores`);
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.warn('[ApiService] Error al consultar top scores:', error);
      return [];
    }
  }

  /** Agregados globales (partidas, kills, jefes, récord). */
  static async getStats() {
    try {
      const response = await fetch(`${CONFIG.API.BASE_URL}/stats`);
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.warn('[ApiService] Error al consultar estadísticas globales:', error);
      return null;
    }
  }
}
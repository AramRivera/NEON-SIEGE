// frontend/src/systems/ApiService.js
import { CONFIG } from '../config.js';

export class ApiService {
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
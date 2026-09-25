/**
 * Controladores de puntuación: validan el body y hablan con db.js.
 * Respuestas JSON consumidas por ApiService.js y MainMenu._fetchLeaderboard.
 */
const db = require('../CONFIG/db.js');

// POST /api/scores - Guardar partida
exports.saveScore = async (req, res) => {
  try {
    const { player, score, wave, timeSurvived, kills, bossesDefeated } = req.body;

    if (!player || typeof score !== 'number') {
      return res.status(400).json({ error: 'Parámetros inválidos. "player" y "score" numérico son obligatorios.' });
    }

    const sanitizedPlayer = String(player).trim().substring(0, 30);
    const saved = await db.insertScore({
      player_name: sanitizedPlayer,
      score: Math.floor(score),
      wave_reached: Math.max(1, parseInt(wave, 10) || 1),
      time_survived_seconds: Math.max(0, parseInt(timeSurvived, 10) || 0),
      enemies_killed: Math.max(0, parseInt(kills, 10) || 0),
      bosses_defeated: Math.max(0, parseInt(bossesDefeated, 10) || 0)
    });

    return res.status(201).json({
      message: 'Partida guardada con éxito',
      record: {
        id: saved.id,
        player_name: saved.player_name,
        score: saved.score,
        wave_reached: saved.wave_reached,
        time_survived_seconds: saved.time_survived_seconds,
        played_at: saved.played_at
      }
    });
  } catch (error) {
    console.error('Error en saveScore:', error);
    return res.status(500).json({ error: 'Error interno del servidor al registrar la puntuación' });
  }
};

// GET /api/scores - Top 10 de jugadores
exports.getTopScores = async (req, res) => {
  try {
    const scores = await db.getAllScores();
    const rows = scores
      .slice()
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (b.time_survived_seconds || 0) - (a.time_survived_seconds || 0);
      })
      .slice(0, 10)
      .map((row) => ({
        id: row.id,
        player: row.player_name,
        score: row.score,
        wave: row.wave_reached,
        timeSurvived: row.time_survived_seconds,
        kills: row.enemies_killed,
        bossesDefeated: row.bosses_defeated,
        date: row.played_at
      }));

    return res.status(200).json(rows);
  } catch (error) {
    console.error('Error en getTopScores:', error);
    return res.status(500).json({ error: 'Error al consultar el ranking' });
  }
};

// GET /api/stats - Métricas globales acumuladas
exports.getStats = async (req, res) => {
  try {
    const scores = await db.getAllScores();
    const stats = {
      totalGamesPlayed: scores.length,
      totalEnemiesKilled: scores.reduce((sum, row) => sum + (row.enemies_killed || 0), 0),
      totalBossesDefeated: scores.reduce((sum, row) => sum + (row.bosses_defeated || 0), 0),
      highestScoreRecord: scores.reduce((max, row) => Math.max(max, row.score || 0), 0)
    };

    return res.status(200).json(stats);
  } catch (error) {
    console.error('Error en getStats:', error);
    return res.status(500).json({ error: 'Error al consultar estadísticas globales' });
  }
};

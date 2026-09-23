// backend/controllers/scoreController.js
const db = require('../CONFIG/db.js');

// POST /api/scores - Guardar partida
exports.saveScore = async (req, res) => {
  try {
    const { player, score, wave, timeSurvived, kills, bossesDefeated } = req.body;

    if (!player || typeof score !== 'number') {
      return res.status(400).json({ error: 'Parámetros inválidos. "player" y "score" numérico son obligatorios.' });
    }

    const sanitizedPlayer = String(player).trim().substring(0, 30);
    const query = `
      INSERT INTO game_scores (player_name, score, wave_reached, time_survived_seconds, enemies_killed, bosses_defeated)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, player_name, score, wave_reached, time_survived_seconds, played_at;
    `;
    const values = [
      sanitizedPlayer,
      Math.floor(score),
      Math.max(1, parseInt(wave, 10) || 1),
      Math.max(0, parseInt(timeSurvived, 10) || 0),
      Math.max(0, parseInt(kills, 10) || 0),
      Math.max(0, parseInt(bossesDefeated, 10) || 0)
    ];

    const result = await db.query(query, values);
    return res.status(201).json({
      message: 'Partida guardada con éxito',
      record: result.rows[0]
    });
  } catch (error) {
    console.error('Error en saveScore:', error);
    return res.status(500).json({ error: 'Error interno del servidor al registrar la puntuación' });
  }
};

// GET /api/scores - Top 10 de jugadores
exports.getTopScores = async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        player_name AS player,
        score,
        wave_reached AS wave,
        time_survived_seconds AS "timeSurvived",
        enemies_killed AS kills,
        bosses_defeated AS "bossesDefeated",
        played_at AS date
      FROM game_scores
      ORDER BY score DESC, time_survived_seconds DESC
      LIMIT 10;
    `;
    const result = await db.query(query);
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error en getTopScores:', error);
    return res.status(500).json({ error: 'Error al consultar el ranking' });
  }
};

// GET /api/stats - Métricas globales acumuladas
exports.getStats = async (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(*)::INT AS "totalGamesPlayed",
        COALESCE(SUM(enemies_killed), 0)::BIGINT AS "totalEnemiesKilled",
        COALESCE(SUM(bosses_defeated), 0)::INT AS "totalBossesDefeated",
        COALESCE(MAX(score), 0)::BIGINT AS "highestScoreRecord"
      FROM game_scores;
    `;
    const result = await db.query(query);
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error en getStats:', error);
    return res.status(500).json({ error: 'Error al consultar estadísticas globales' });
  }
};
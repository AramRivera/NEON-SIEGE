/**
 * Rutas REST montadas en /api.
 * POST /scores → guardar partida
 * GET  /scores → top 10
 * GET  /stats  → métricas globales
 */
const express = require('express');
const router = express.Router();
const scoreController = require('../CONTROLLERS/scoreController');

// Estas rutas se convierten en /api/scores y /api/stats
router.post('/scores', scoreController.saveScore);
router.get('/scores', scoreController.getTopScores);
router.get('/stats', scoreController.getStats);

module.exports = router;
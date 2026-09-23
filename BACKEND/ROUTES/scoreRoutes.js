// backend/routes/scoreRoutes.js
const express = require('express');
const router = express.Router();
const scoreController = require('/controllers/scoreController');

router.post('/scores', scoreController.saveScore);
router.get('/scores', scoreController.getTopScores);
router.get('/stats', scoreController.getStats);

module.exports = router;
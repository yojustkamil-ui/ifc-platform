const express = require('express');
const pool = require('../config/database');
const { authenticateToken, authorizePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const Joi = require('joi');
const logger = require('../config/logger');

const router = express.Router();

// Get prediction accuracy for a user
router.get('/user/:user_id/accuracy', async (req, res, next) => {
  try {
    const { user_id } = req.params;

    const result = await pool.query(
      `SELECT 
        COUNT(*) as total_predictions,
        SUM(CASE WHEN prediction_correct = TRUE THEN 1 ELSE 0 END) as correct_predictions,
        SUM(CASE WHEN prediction_correct = FALSE THEN 1 ELSE 0 END) as incorrect_predictions
       FROM user_predictions
       WHERE user_id = $1`,
      [user_id]
    );

    const stats = result.rows[0];
    const accuracy = stats.total_predictions > 0
      ? ((stats.correct_predictions / stats.total_predictions) * 100).toFixed(2)
      : 0;

    res.json({
      user_id,
      total_predictions: stats.total_predictions,
      correct: stats.correct_predictions,
      incorrect: stats.incorrect_predictions,
      accuracy: parseFloat(accuracy),
    });
  } catch (error) {
    next(error);
  }
});

// Get global prediction leaderboard
router.get('/leaderboard/global', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.avatar,
              COUNT(up.id) as total_predictions,
              SUM(CASE WHEN up.prediction_correct = TRUE THEN 1 ELSE 0 END) as correct_predictions,
              ROUND((SUM(CASE WHEN up.prediction_correct = TRUE THEN 1 ELSE 0 END)::NUMERIC / COUNT(up.id)) * 100, 2) as accuracy
       FROM users u
       LEFT JOIN user_predictions up ON u.id = up.user_id
       WHERE up.id IS NOT NULL
       GROUP BY u.id, u.username, u.avatar
       HAVING COUNT(up.id) >= 5
       ORDER BY accuracy DESC
       LIMIT 50`
    );

    res.json({
      leaderboard: result.rows,
      total_players: result.rows.length,
    });
  } catch (error) {
    next(error);
  }
});

// Update prediction after match ends (Staff only)
const updatePredictionSchema = Joi.object({
  match_id: Joi.number().integer().required(),
});

router.post('/update-after-match/:match_id', authenticateToken, authorizePermission(['manage_matches']), validate(updatePredictionSchema), async (req, res, next) => {
  try {
    const { match_id } = req.validatedData;

    // Get match result
    const matchResult = await pool.query(
      'SELECT home_goals, away_goals FROM matches WHERE id = $1',
      [match_id]
    );

    if (matchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const match = matchResult.rows[0];

    // Determine actual result
    let actualResult;
    if (match.home_goals > match.away_goals) actualResult = 'home_win';
    else if (match.away_goals > match.home_goals) actualResult = 'away_win';
    else actualResult = 'draw';

    // Get all predictions for this match
    const predictionsResult = await pool.query(
      'SELECT * FROM predictions WHERE match_id = $1',
      [match_id]
    );

    // Update each prediction
    for (const prediction of predictionsResult.rows) {
      const isCorrect = prediction.prediction === actualResult;
      await pool.query(
        `INSERT INTO user_predictions (user_id, match_id, prediction, actual_result, prediction_correct)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, match_id) DO UPDATE
         SET actual_result = $4, prediction_correct = $5`,
        [prediction.user_id, match_id, prediction.prediction, actualResult, isCorrect]
      );
    }

    logger.info(`Predictions updated for match ${match_id}`);
    res.json({ success: true, match_id, predictions_updated: predictionsResult.rows.length });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

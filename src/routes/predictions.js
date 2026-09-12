const express = require('express');
const pool = require('../config/database');
const { authenticateToken, authorizePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const Joi = require('joi');
const logger = require('../config/logger');

const router = express.Router();

// Get all predictions for a match
router.get('/match/:match_id', async (req, res, next) => {
  try {
    const { match_id } = req.params;

    // Get match info
    const matchResult = await pool.query(
      'SELECT * FROM matches WHERE id = $1',
      [match_id]
    );

    if (matchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const match = matchResult.rows[0];

    // Get all predictions
    const predictionsResult = await pool.query(
      `SELECT prediction, COUNT(*) as votes
       FROM predictions
       WHERE match_id = $1
       GROUP BY prediction`,
      [match_id]
    );

    const predictions = predictionsResult.rows;
    const totalVotes = predictions.reduce((sum, p) => sum + parseInt(p.votes), 0);

    // Calculate percentages
    const predictionsSummary = {
      home_win: { votes: 0, percentage: 0 },
      draw: { votes: 0, percentage: 0 },
      away_win: { votes: 0, percentage: 0 },
    };

    predictions.forEach(p => {
      if (p.prediction in predictionsSummary) {
        predictionsSummary[p.prediction].votes = parseInt(p.votes);
        predictionsSummary[p.prediction].percentage = totalVotes > 0 ? ((parseInt(p.votes) / totalVotes) * 100).toFixed(1) : 0;
      }
    });

    res.json({
      match_id,
      match_date: match.match_date,
      total_votes: totalVotes,
      predictions: predictionsSummary,
    });
  } catch (error) {
    next(error);
  }
});

// Create prediction (User votes)
const createPredictionSchema = Joi.object({
  match_id: Joi.number().integer().required(),
  prediction: Joi.string().valid('home_win', 'draw', 'away_win').required(),
});

router.post('/', authenticateToken, validate(createPredictionSchema), async (req, res, next) => {
  try {
    const { match_id, prediction } = req.validatedData;
    const user_id = req.user.id;

    // Check if user already predicted
    const existingPrediction = await pool.query(
      'SELECT * FROM predictions WHERE match_id = $1 AND user_id = $2',
      [match_id, user_id]
    );

    if (existingPrediction.rows.length > 0) {
      // Update existing prediction
      const result = await pool.query(
        'UPDATE predictions SET prediction = $1 WHERE match_id = $2 AND user_id = $3 RETURNING *',
        [prediction, match_id, user_id]
      );
      return res.json({ message: 'Prediction updated', prediction: result.rows[0] });
    }

    // Create new prediction
    const result = await pool.query(
      'INSERT INTO predictions (match_id, user_id, prediction) VALUES ($1, $2, $3) RETURNING *',
      [match_id, user_id, prediction]
    );

    logger.info(`Prediction created: User ${user_id} predicted ${prediction} for match ${match_id}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

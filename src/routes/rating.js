const express = require('express');
const pool = require('../config/database');
const { authenticateToken, authorizePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const Joi = require('joi');
const logger = require('../config/logger');

const router = express.Router();

// Get rating configuration
router.get('/config', async (req, res, next) => {
  try {
    // In production, store this in a config table
    const config = {
      min_rating: 0,
      max_rating: 100,
      bronze_threshold: 59,
      bronze_max: 74,
      silver_threshold: 75,
      silver_max: 81,
      gold_threshold: 82,
      gold_max: 89,
      elite_threshold: 90,
      elite_max: 100,
      weights: {
        goals: 0.2,
        assists: 0.15,
        appearances: 0.1,
        average_rating: 0.3,
        awards: 0.15,
        form: 0.1,
      },
      upgrade_threshold: 5, // Points needed to upgrade tier
      downgrade_threshold: 5, // Points to drop tier
    };
    res.json(config);
  } catch (error) {
    next(error);
  }
});

// Calculate player rating
router.post('/calculate', authenticateToken, authorizePermission(['manage_values']), validate(Joi.object({
  player_id: Joi.number().integer().required(),
})), async (req, res, next) => {
  try {
    const { player_id } = req.validatedData;

    const playerResult = await pool.query(
      'SELECT * FROM players WHERE id = $1',
      [player_id]
    );

    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const player = playerResult.rows[0];

    // Calculate rating based on weighted formula
    const baseRating = 60;
    const goalsFactor = (player.goals || 0) * 2;
    const assistsFactor = (player.assists || 0) * 1.5;
    const appearanceFactor = (player.appearances || 0) * 0.5;
    const avgRatingFactor = (player.average_rating || 0) * 5;

    const calculatedRating = Math.min(100, Math.max(0, 
      baseRating + goalsFactor + assistsFactor + appearanceFactor + (avgRatingFactor || 0)
    ));

    const explanation = [
      `Base: ${baseRating}`,
      `+${goalsFactor.toFixed(1)} (Goals: ${player.goals || 0})`,
      `+${assistsFactor.toFixed(1)} (Assists: ${player.assists || 0})`,
      `+${appearanceFactor.toFixed(1)} (Appearances: ${player.appearances || 0})`,
      player.average_rating ? `+${avgRatingFactor.toFixed(1)} (Avg Rating: ${player.average_rating})` : '',
    ].filter(e => e);

    // Determine card tier
    let cardTier = 'BRONZE';
    if (calculatedRating >= 90) cardTier = 'ELITE';
    else if (calculatedRating >= 82) cardTier = 'GOLD';
    else if (calculatedRating >= 75) cardTier = 'SILVER';

    res.json({
      player_id,
      current_rating: player.rating,
      calculated_rating: calculatedRating.toFixed(2),
      difference: (calculatedRating - player.rating).toFixed(2),
      suggested_tier: cardTier,
      current_tier: player.card_tier,
      will_upgrade: calculatedRating > player.rating && cardTier !== player.card_tier,
      explanation,
    });
  } catch (error) {
    next(error);
  }
});

// Update player rating (Staff confirms calculation)
router.patch('/update/:player_id', authenticateToken, authorizePermission(['manage_values']), validate(Joi.object({
  new_rating: Joi.number().min(0).max(100).required(),
  card_tier: Joi.string().valid('BRONZE', 'SILVER', 'GOLD', 'ELITE'),
})), async (req, res, next) => {
  try {
    const { player_id } = req.params;
    const { new_rating, card_tier } = req.validatedData;

    const playerResult = await pool.query(
      'SELECT * FROM players WHERE id = $1',
      [player_id]
    );

    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const player = playerResult.rows[0];
    const oldRating = player.rating;
    const oldTier = player.card_tier;

    // Update player
    const result = await pool.query(
      `UPDATE players SET rating = $1, card_tier = COALESCE($2, card_tier), updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [new_rating, card_tier, player_id]
    );

    // Create new hero card if tier changed
    if (card_tier && card_tier !== oldTier) {
      const currentSeason = new Date().getFullYear().toString();
      await pool.query(
        `INSERT INTO hero_cards (player_id, card_type, rating, market_value, goals, assists, appearances, season, is_current)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)`,
        [player_id, `${card_tier}_HERO`, new_rating, player.market_value, player.goals, player.assists, player.appearances, currentSeason]
      );
    }

    // Log audit
    await pool.query(
      `INSERT INTO audit_logs (staff_id, action, entity_type, entity_id, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'rating_update', 'player', player_id, oldRating, new_rating]
    );

    logger.info(`Player rating updated: ${player_id} (${oldRating} -> ${new_rating}), Tier: ${oldTier} -> ${card_tier || oldTier}`);

    res.json({
      player_id,
      old_rating: oldRating,
      new_rating,
      old_tier: oldTier,
      new_tier: card_tier || oldTier,
      rating_change: (new_rating - oldRating).toFixed(2),
      tier_upgraded: card_tier && card_tier !== oldTier,
    });
  } catch (error) {
    next(error);
  }
});

// Get rating history for player
router.get('/history/:player_id', async (req, res, next) => {
  try {
    const { player_id } = req.params;

    const result = await pool.query(
      `SELECT rating, card_type, created_at FROM hero_cards
       WHERE player_id = $1
       ORDER BY created_at ASC`,
      [player_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No rating history found' });
    }

    const ratings = result.rows.map(r => ({
      rating: r.rating,
      tier: r.card_type.split('_')[0],
      date: r.created_at,
    }));

    const currentRating = ratings[ratings.length - 1].rating;
    const highestRating = Math.max(...ratings.map(r => r.rating));
    const lowestRating = Math.min(...ratings.map(r => r.rating));

    res.json({
      player_id,
      current_rating: currentRating,
      highest_rating: highestRating,
      lowest_rating: lowestRating,
      history: ratings,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

const express = require('express');
const pool = require('../config/database');
const { authenticateToken, authorizePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const Joi = require('joi');
const logger = require('../config/logger');

const router = express.Router();

// Get player value history
router.get('/player/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const playerResult = await pool.query(
      'SELECT id, first_name, last_name, market_value FROM players WHERE id = $1',
      [id]
    );

    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const player = playerResult.rows[0];

    // Get value history from hero cards (each card shows a value snapshot)
    const valueHistory = await pool.query(
      `SELECT market_value, created_at FROM hero_cards WHERE player_id = $1 ORDER BY created_at ASC`,
      [id]
    );

    const history = valueHistory.rows.map(row => ({
      value: row.market_value,
      date: row.created_at,
    }));

    // Calculate stats
    const values = history.map(h => h.value);
    const currentValue = player.market_value;
    const highestValue = Math.max(...values, currentValue);
    const lowestValue = Math.min(...values, currentValue);
    const previousValue = history.length > 0 ? history[history.length - 1].value : currentValue;
    const change = currentValue - previousValue;
    const changePercent = previousValue > 0 ? (change / previousValue * 100).toFixed(2) : 0;

    res.json({
      player_id: player.id,
      player_name: `${player.first_name} ${player.last_name}`,
      current_value: currentValue,
      highest_value: highestValue,
      lowest_value: lowestValue,
      previous_value: previousValue,
      change,
      change_percent: parseFloat(changePercent),
      history,
    });
  } catch (error) {
    next(error);
  }
});

// Calculate and update player market value (AI can suggest, staff confirms)
const calculateValueSchema = Joi.object({
  player_id: Joi.number().integer().required(),
  rating_weight: Joi.number().default(0.3),
  goals_weight: Joi.number().default(0.2),
  assists_weight: Joi.number().default(0.15),
  appearances_weight: Joi.number().default(0.15),
  awards_weight: Joi.number().default(0.2),
});

router.post('/calculate', authenticateToken, authorizePermission(['manage_values']), validate(calculateValueSchema), async (req, res, next) => {
  try {
    const { player_id, rating_weight, goals_weight, assists_weight, appearances_weight, awards_weight } = req.validatedData;

    const playerResult = await pool.query(
      'SELECT * FROM players WHERE id = $1',
      [player_id]
    );

    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const player = playerResult.rows[0];

    // Base value calculation
    const baseValue = 50000; // Starting value
    const ratingFactor = player.rating / 100 * 2000; // Rating contributes
    const goalsFactor = player.goals * 5000; // Each goal adds value
    const assistsFactor = player.assists * 3000; // Each assist adds value
    const appearanceFactor = player.appearances * 1000; // Experience adds value

    // Calculate weighted value
    const calculatedValue = Math.round(
      baseValue +
      (ratingFactor * rating_weight) +
      (goalsFactor * goals_weight) +
      (assistsFactor * assists_weight) +
      (appearanceFactor * appearances_weight)
    );

    // Generate explanation
    const explanation = [
      `+${Math.round(ratingFactor * rating_weight).toLocaleString()} (Rating: ${player.rating})`,
      `+${Math.round(goalsFactor * goals_weight).toLocaleString()} (Goals: ${player.goals})`,
      `+${Math.round(assistsFactor * assists_weight).toLocaleString()} (Assists: ${player.assists})`,
      `+${Math.round(appearanceFactor * appearances_weight).toLocaleString()} (Appearances: ${player.appearances})`,
    ];

    res.json({
      player_id,
      current_value: player.market_value,
      calculated_value: calculatedValue,
      difference: calculatedValue - player.market_value,
      explanation,
    });
  } catch (error) {
    next(error);
  }
});

// Update player market value (Staff confirms)
const updateValueSchema = Joi.object({
  player_id: Joi.number().integer().required(),
  new_value: Joi.number().integer().required(),
});

router.patch('/update', authenticateToken, authorizePermission(['manage_values']), validate(updateValueSchema), async (req, res, next) => {
  try {
    const { player_id, new_value } = req.validatedData;

    const playerResult = await pool.query(
      'SELECT * FROM players WHERE id = $1',
      [player_id]
    );

    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const player = playerResult.rows[0];
    const oldValue = player.market_value;

    // Update player value
    const result = await pool.query(
      'UPDATE players SET market_value = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [new_value, player_id]
    );

    // Log in audit
    await pool.query(
      `INSERT INTO audit_logs (staff_id, action, entity_type, entity_id, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'market_value_update', 'player', player_id, oldValue, new_value]
    );

    logger.info(`Player market value updated: ${player_id} ($${oldValue} -> $${new_value})`);

    res.json({
      player_id,
      old_value: oldValue,
      new_value,
      change: new_value - oldValue,
      change_percent: ((new_value - oldValue) / oldValue * 100).toFixed(2),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

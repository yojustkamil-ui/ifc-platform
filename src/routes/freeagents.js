const express = require('express');
const pool = require('../config/database');
const { authenticateToken, authorizePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const Joi = require('joi');
const logger = require('../config/logger');

const router = express.Router();

// Get all free agents
router.get('/', async (req, res, next) => {
  try {
    const { league_id, position, rating_min, rating_max, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `SELECT p.*, hc.card_type, hc.rating as card_rating
                 FROM players p
                 LEFT JOIN hero_cards hc ON p.id = hc.player_id AND hc.is_current = TRUE
                 WHERE p.team_id IS NULL`;
    const params = [];
    let paramCount = 1;

    if (league_id) {
      query += ` AND p.league_id = $${paramCount++}`;
      params.push(league_id);
    }
    if (position) {
      query += ` AND p.position = $${paramCount++}`;
      params.push(position);
    }
    if (rating_min) {
      query += ` AND p.rating >= $${paramCount++}`;
      params.push(rating_min);
    }
    if (rating_max) {
      query += ` AND p.rating <= $${paramCount++}`;
      params.push(rating_max);
    }

    query += ` ORDER BY p.rating DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM players WHERE team_id IS NULL'
    );

    res.json({
      free_agents: result.rows,
      total: countResult.rows[0].total,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (error) {
    next(error);
  }
});

// Get free agent profile
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const playerResult = await pool.query(
      `SELECT p.*, hc.card_type, hc.rating as card_rating
       FROM players p
       LEFT JOIN hero_cards hc ON p.id = hc.player_id AND hc.is_current = TRUE
       WHERE p.id = $1 AND p.team_id IS NULL`,
      [id]
    );

    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Free agent not found' });
    }

    const player = playerResult.rows[0];

    // Get previous clubs
    const transferResult = await pool.query(
      `SELECT DISTINCT ft.name as club, t.transfer_date FROM transfers t
       LEFT JOIN teams ft ON t.from_team_id = ft.id
       WHERE t.player_id = $1
       ORDER BY t.transfer_date DESC
       LIMIT 5`,
      [id]
    );

    player.previous_clubs = transferResult.rows;

    res.json(player);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

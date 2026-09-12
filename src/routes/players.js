const express = require('express');
const pool = require('../config/database');
const { authenticateToken, authorizePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const Joi = require('joi');
const logger = require('../config/logger');

const router = express.Router();

// Get all players with filters
router.get('/', async (req, res, next) => {
  try {
    const { team_id, league_id, position, rating_min, rating_max, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM players WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (team_id) {
      query += ` AND team_id = $${paramCount++}`;
      params.push(team_id);
    }
    if (league_id) {
      query += ` AND league_id = $${paramCount++}`;
      params.push(league_id);
    }
    if (position) {
      query += ` AND position = $${paramCount++}`;
      params.push(position);
    }
    if (rating_min) {
      query += ` AND rating >= $${paramCount++}`;
      params.push(rating_min);
    }
    if (rating_max) {
      query += ` AND rating <= $${paramCount++}`;
      params.push(rating_max);
    }

    query += ` ORDER BY rating DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    res.json({ players: result.rows, total: result.rows.length });
  } catch (error) {
    next(error);
  }
});

// Get player by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM players WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Create player (Authorized staff only)
const createPlayerSchema = Joi.object({
  first_name: Joi.string().required(),
  last_name: Joi.string().required(),
  position: Joi.string().valid('GK', 'DEF', 'MID', 'FWD').required(),
  team_id: Joi.number().integer(),
  league_id: Joi.number().integer().required(),
  date_of_birth: Joi.date(),
  nationality: Joi.string(),
});

router.post('/', authenticateToken, authorizePermission(['manage_players']), validate(createPlayerSchema), async (req, res, next) => {
  try {
    const { first_name, last_name, position, team_id, league_id, date_of_birth, nationality } = req.validatedData;

    const result = await pool.query(
      'INSERT INTO players (first_name, last_name, position, team_id, league_id, date_of_birth, nationality, rating, market_value) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [first_name, last_name, position, team_id, league_id, date_of_birth, nationality, 75, 50000]
    );

    logger.info(`Player created: ${result.rows[0].id}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

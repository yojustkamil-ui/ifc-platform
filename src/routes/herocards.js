const express = require('express');
const pool = require('../config/database');
const { authenticateToken, authorizePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const Joi = require('joi');
const logger = require('../config/logger');

const router = express.Router();

// Get all hero cards (public)
router.get('/', async (req, res, next) => {
  try {
    const { team_id, league_id, card_tier, position, card_type, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `SELECT hc.*, p.first_name, p.last_name, p.position, p.photo_url, t.name as team_name, t.logo_url as team_logo
                 FROM hero_cards hc
                 JOIN players p ON hc.player_id = p.id
                 LEFT JOIN teams t ON p.team_id = t.id
                 WHERE hc.is_current = TRUE`;
    const params = [];
    let paramCount = 1;

    if (team_id) {
      query += ` AND p.team_id = $${paramCount++}`;
      params.push(team_id);
    }
    if (league_id) {
      query += ` AND p.league_id = $${paramCount++}`;
      params.push(league_id);
    }
    if (card_tier) {
      query += ` AND hc.card_type ILIKE $${paramCount++}`;
      params.push(`%${card_tier}%`);
    }
    if (position) {
      query += ` AND p.position = $${paramCount++}`;
      params.push(position);
    }
    if (card_type) {
      query += ` AND hc.card_type = $${paramCount++}`;
      params.push(card_type);
    }

    query += ` ORDER BY hc.rating DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM hero_cards WHERE is_current = TRUE'
    );

    res.json({
      cards: result.rows,
      total: countResult.rows[0].total,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (error) {
    next(error);
  }
});

// Get hero card by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT hc.*, p.first_name, p.last_name, p.position, p.photo_url, t.name as team_name, t.logo_url as team_logo
       FROM hero_cards hc
       JOIN players p ON hc.player_id = p.id
       LEFT JOIN teams t ON p.team_id = t.id
       WHERE hc.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Hero card not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Get player's hero card history
router.get('/player/:player_id/history', async (req, res, next) => {
  try {
    const { player_id } = req.params;

    const result = await pool.query(
      `SELECT hc.*, p.first_name, p.last_name
       FROM hero_cards hc
       JOIN players p ON hc.player_id = p.id
       WHERE hc.player_id = $1
       ORDER BY hc.created_at DESC`,
      [player_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No hero cards found for this player' });
    }

    res.json({
      player_name: `${result.rows[0].first_name} ${result.rows[0].last_name}`,
      card_count: result.rows.length,
      cards: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// Create hero card for player (Staff only)
const createCardSchema = Joi.object({
  player_id: Joi.number().integer().required(),
  card_type: Joi.string().default('STANDARD'),
  season: Joi.string().required(),
});

router.post('/', authenticateToken, authorizePermission(['manage_hero_cards']), validate(createCardSchema), async (req, res, next) => {
  try {
    const { player_id, card_type, season } = req.validatedData;

    // Get player current stats
    const playerResult = await pool.query(
      'SELECT * FROM players WHERE id = $1',
      [player_id]
    );

    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const player = playerResult.rows[0];

    // Archive previous card
    await pool.query(
      'UPDATE hero_cards SET is_current = FALSE WHERE player_id = $1',
      [player_id]
    );

    // Create new card with current stats
    const result = await pool.query(
      `INSERT INTO hero_cards (player_id, card_type, rating, market_value, goals, assists, appearances, season, is_current)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
       RETURNING *`,
      [player_id, card_type, player.rating, player.market_value, player.goals, player.assists, player.appearances, season]
    );

    logger.info(`Hero card created for player ${player_id}: ${card_type}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

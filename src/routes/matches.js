const express = require('express');
const pool = require('../config/database');
const { authenticateToken, authorizePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const Joi = require('joi');
const logger = require('../config/logger');

const router = express.Router();

// Get all matches with filters
router.get('/', async (req, res, next) => {
  try {
    const { league_id, team_id, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT m.*, ht.name as home_team_name, ht.logo_url as home_logo, at.name as away_team_name, at.logo_url as away_logo FROM matches m JOIN teams ht ON m.home_team_id = ht.id JOIN teams at ON m.away_team_id = at.id WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (league_id) {
      query += ` AND m.league_id = $${paramCount++}`;
      params.push(league_id);
    }
    if (team_id) {
      query += ` AND (m.home_team_id = $${paramCount} OR m.away_team_id = $${paramCount})`;
      params.push(team_id);
      paramCount++;
    }
    if (status) {
      query += ` AND m.match_status = $${paramCount++}`;
      params.push(status);
    }

    query += ` ORDER BY m.match_date DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    res.json({ matches: result.rows, total: result.rows.length });
  } catch (error) {
    next(error);
  }
});

// Get match by ID with detailed info
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get match details
    const matchResult = await pool.query(
      `SELECT m.*, ht.name as home_team_name, ht.logo_url as home_logo, at.name as away_team_name, at.logo_url as away_logo
       FROM matches m
       JOIN teams ht ON m.home_team_id = ht.id
       JOIN teams at ON m.away_team_id = at.id
       WHERE m.id = $1`,
      [id]
    );

    if (matchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const match = matchResult.rows[0];

    // Get match events
    const eventsResult = await pool.query(
      `SELECT me.*, p.first_name, p.last_name FROM match_events me
       LEFT JOIN players p ON me.player_id = p.id
       WHERE me.match_id = $1
       ORDER BY me.minute ASC`,
      [id]
    );

    match.events = eventsResult.rows;

    // Get player ratings for this match
    const ratingsResult = await pool.query(
      `SELECT pr.*, p.first_name, p.last_name FROM player_ratings pr
       JOIN players p ON pr.player_id = p.id
       WHERE pr.match_id = $1
       ORDER BY pr.rating DESC`,
      [id]
    );

    match.player_ratings = ratingsResult.rows;

    res.json(match);
  } catch (error) {
    next(error);
  }
});

// Create match (Staff only)
const createMatchSchema = Joi.object({
  home_team_id: Joi.number().integer().required(),
  away_team_id: Joi.number().integer().required(),
  league_id: Joi.number().integer().required(),
  match_date: Joi.date().required(),
  venue_name: Joi.string(),
  referee_id: Joi.number().integer(),
  matchday: Joi.number().integer(),
});

router.post('/', authenticateToken, authorizePermission(['manage_matches']), validate(createMatchSchema), async (req, res, next) => {
  try {
    const { home_team_id, away_team_id, league_id, match_date, venue_name, referee_id, matchday } = req.validatedData;

    if (home_team_id === away_team_id) {
      return res.status(400).json({ error: 'Home and away teams cannot be the same' });
    }

    const result = await pool.query(
      `INSERT INTO matches (home_team_id, away_team_id, league_id, match_date, venue_name, referee_id, matchday, match_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [home_team_id, away_team_id, league_id, match_date, venue_name, referee_id, matchday, 'upcoming']
    );

    logger.info(`Match created: ${result.rows[0].id}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Record match event (Goal, Card, Substitution, etc.)
const matchEventSchema = Joi.object({
  player_id: Joi.number().integer(),
  event_type: Joi.string().valid('goal', 'assist', 'yellow_card', 'red_card', 'substitution_in', 'substitution_out').required(),
  minute: Joi.number().integer().required(),
  description: Joi.string(),
});

router.post('/:id/events', authenticateToken, authorizePermission(['manage_matches']), validate(matchEventSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { player_id, event_type, minute, description } = req.validatedData;

    // Verify match exists
    const matchCheck = await pool.query('SELECT * FROM matches WHERE id = $1', [id]);
    if (matchCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const result = await pool.query(
      `INSERT INTO match_events (match_id, player_id, event_type, minute, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, player_id, event_type, minute, description]
    );

    // If goal, update player stats
    if (event_type === 'goal' && player_id) {
      await pool.query(
        'UPDATE players SET goals = goals + 1 WHERE id = $1',
        [player_id]
      );
    }

    logger.info(`Match event recorded: ${result.rows[0].id}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Update match score and status
const updateMatchSchema = Joi.object({
  home_goals: Joi.number().integer().min(0),
  away_goals: Joi.number().integer().min(0),
  match_status: Joi.string().valid('upcoming', 'live', 'halftime', 'finished', 'postponed', 'cancelled'),
});

router.patch('/:id', authenticateToken, authorizePermission(['manage_matches']), validate(updateMatchSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { home_goals, away_goals, match_status } = req.validatedData;

    const result = await pool.query(
      `UPDATE matches SET home_goals = COALESCE($1, home_goals), away_goals = COALESCE($2, away_goals), match_status = COALESCE($3, match_status), updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [home_goals, away_goals, match_status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    logger.info(`Match updated: ${id}`);
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Rate player performance in match
const ratePlayerSchema = Joi.object({
  player_id: Joi.number().integer().required(),
  rating: Joi.number().min(0).max(10).required(),
});

router.post('/:id/rate-player', authenticateToken, authorizePermission(['manage_matches']), validate(ratePlayerSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { player_id, rating } = req.validatedData;

    const result = await pool.query(
      `INSERT INTO player_ratings (match_id, player_id, rating)
       VALUES ($1, $2, $3)
       ON CONFLICT DO UPDATE SET rating = $3
       RETURNING *`,
      [id, player_id, rating]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

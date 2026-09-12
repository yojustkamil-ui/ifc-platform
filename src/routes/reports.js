const express = require('express');
const pool = require('../config/database');
const { authenticateToken, authorizePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const Joi = require('joi');
const logger = require('../config/logger');

const router = express.Router();

// Get match report
router.get('/:match_id', async (req, res, next) => {
  try {
    const { match_id } = req.params;

    // Get match details
    const matchResult = await pool.query(
      `SELECT m.*, ht.name as home_team_name, ht.logo_url as home_logo, at.name as away_team_name, at.logo_url as away_logo
       FROM matches m
       JOIN teams ht ON m.home_team_id = ht.id
       JOIN teams at ON m.away_team_id = at.id
       WHERE m.id = $1`,
      [match_id]
    );

    if (matchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const match = matchResult.rows[0];

    // Get match statistics
    const statsResult = await pool.query(
      `SELECT team_id,
              SUM(CASE WHEN event_type = 'goal' THEN 1 ELSE 0 END) as goals,
              SUM(CASE WHEN event_type = 'assist' THEN 1 ELSE 0 END) as assists,
              SUM(CASE WHEN event_type = 'yellow_card' THEN 1 ELSE 0 END) as yellow_cards,
              SUM(CASE WHEN event_type = 'red_card' THEN 1 ELSE 0 END) as red_cards,
              SUM(CASE WHEN event_type IN ('substitution_in', 'substitution_out') THEN 1 ELSE 0 END) as substitutions
       FROM match_events
       WHERE match_id = $1
       GROUP BY team_id`,
      [match_id]
    );

    const stats = {};
    statsResult.rows.forEach(row => {
      stats[`team_${row.team_id}`] = row;
    });

    // Get top performers
    const performersResult = await pool.query(
      `SELECT pr.player_id, p.first_name, p.last_name, pr.rating, p.team_id
       FROM player_ratings pr
       JOIN players p ON pr.player_id = p.id
       WHERE pr.match_id = $1
       ORDER BY pr.rating DESC
       LIMIT 5`,
      [match_id]
    );

    // Get match summary
    const summaryResult = await pool.query(
      `SELECT possession, pass_accuracy, shots, shots_on_target FROM match_summary WHERE match_id = $1`,
      [match_id]
    );

    res.json({
      match: match,
      statistics: stats,
      top_performers: performersResult.rows,
      summary: summaryResult.rows[0] || null,
    });
  } catch (error) {
    next(error);
  }
});

// Create match report (Staff only)
const createReportSchema = Joi.object({
  match_id: Joi.number().integer().required(),
  home_team_possession: Joi.number().min(0).max(100),
  away_team_possession: Joi.number().min(0).max(100),
  home_pass_accuracy: Joi.number().min(0).max(100),
  away_pass_accuracy: Joi.number().min(0).max(100),
  home_shots: Joi.number().integer(),
  away_shots: Joi.number().integer(),
  home_shots_on_target: Joi.number().integer(),
  away_shots_on_target: Joi.number().integer(),
  match_summary: Joi.string(),
  man_of_match: Joi.number().integer(),
});

router.post('/', authenticateToken, authorizePermission(['manage_matches']), validate(createReportSchema), async (req, res, next) => {
  try {
    const { match_id, home_team_possession, away_team_possession, home_pass_accuracy, away_pass_accuracy, home_shots, away_shots, home_shots_on_target, away_shots_on_target, match_summary, man_of_match } = req.validatedData;

    // Create/update summary
    const summaryCheck = await pool.query(
      'SELECT * FROM match_summary WHERE match_id = $1',
      [match_id]
    );

    if (summaryCheck.rows.length > 0) {
      await pool.query(
        `UPDATE match_summary SET possession = $1, pass_accuracy = $2, shots = $3, shots_on_target = $4, match_summary = $5, man_of_match = $6, updated_at = NOW()
         WHERE match_id = $7`,
        [home_team_possession, away_team_possession, home_pass_accuracy, away_pass_accuracy, `${home_shots}-${away_shots}`, `${home_shots_on_target}-${away_shots_on_target}`, match_summary, man_of_match, match_id]
      );
    } else {
      await pool.query(
        `INSERT INTO match_summary (match_id, possession, pass_accuracy, shots, shots_on_target, match_summary, man_of_match)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [match_id, `${home_team_possession}-${away_team_possession}`, `${home_pass_accuracy}-${away_pass_accuracy}`, `${home_shots}-${away_shots}`, `${home_shots_on_target}-${away_shots_on_target}`, match_summary, man_of_match]
      );
    }

    logger.info(`Match report created for match ${match_id}`);
    res.status(201).json({ success: true, match_id });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

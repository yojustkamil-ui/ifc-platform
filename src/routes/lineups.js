const express = require('express');
const pool = require('../config/database');
const { authenticateToken, authorizePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const Joi = require('joi');
const logger = require('../config/logger');

const router = express.Router();

// Get match formations
router.get('/:match_id/formations', async (req, res, next) => {
  try {
    const { match_id } = req.params;

    const result = await pool.query(
      `SELECT formation, team_id, lineup FROM match_lineups WHERE match_id = $1`,
      [match_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No lineups found for this match' });
    }

    const formations = {};
    result.rows.forEach(row => {
      formations[`team_${row.team_id}`] = {
        formation: row.formation,
        lineup: JSON.parse(row.lineup),
      };
    });

    res.json(formations);
  } catch (error) {
    next(error);
  }
});

// Set match lineups and formations
const setLineupSchema = Joi.object({
  team_id: Joi.number().integer().required(),
  formation: Joi.string().required(),
  lineup: Joi.array().items(
    Joi.object({
      player_id: Joi.number().integer().required(),
      position: Joi.string().required(),
      shirt_number: Joi.number().integer(),
    })
  ).required(),
});

router.post('/:match_id/lineups', authenticateToken, authorizePermission(['manage_matches']), validate(setLineupSchema), async (req, res, next) => {
  try {
    const { match_id } = req.params;
    const { team_id, formation, lineup } = req.validatedData;

    // Verify match exists
    const matchCheck = await pool.query('SELECT * FROM matches WHERE id = $1', [match_id]);
    if (matchCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const existingLineup = await pool.query(
      'SELECT * FROM match_lineups WHERE match_id = $1 AND team_id = $2',
      [match_id, team_id]
    );

    if (existingLineup.rows.length > 0) {
      const result = await pool.query(
        `UPDATE match_lineups SET formation = $1, lineup = $2, updated_at = NOW()
         WHERE match_id = $3 AND team_id = $4
         RETURNING *`,
        [formation, JSON.stringify(lineup), match_id, team_id]
      );
      return res.json(result.rows[0]);
    }

    const result = await pool.query(
      `INSERT INTO match_lineups (match_id, team_id, formation, lineup)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [match_id, team_id, formation, JSON.stringify(lineup)]
    );

    logger.info(`Lineup set for match ${match_id}, team ${team_id}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

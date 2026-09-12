const express = require('express');
const pool = require('../config/database');
const { authenticateToken, authorizePermission } = require('../middleware/auth');
const logger = require('../config/logger');

const router = express.Router();

// Get all teams
router.get('/', async (req, res, next) => {
  try {
    const { league_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM teams WHERE 1=1';
    const params = [];

    if (league_id) {
      query += ' AND league_id = $1';
      params.push(league_id);
    }

    query += ' ORDER BY name ASC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await pool.query(query, params);
    res.json({ teams: result.rows });
  } catch (error) {
    next(error);
  }
});

// Get team by ID with squad
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const teamResult = await pool.query(
      'SELECT * FROM teams WHERE id = $1',
      [id]
    );

    if (teamResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const squad = await pool.query(
      'SELECT * FROM players WHERE team_id = $1',
      [id]
    );

    const team = teamResult.rows[0];
    team.squad = squad.rows;

    res.json(team);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

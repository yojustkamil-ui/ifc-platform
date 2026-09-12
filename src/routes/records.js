const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../config/logger');

const router = express.Router();

// Get records
router.get('/', async (req, res, next) => {
  try {
    const { league_id } = req.query;

    const records = {};

    // Most goals
    const goalsResult = await pool.query(
      league_id
        ? 'SELECT * FROM players WHERE league_id = $1 ORDER BY goals DESC LIMIT 1'
        : 'SELECT * FROM players ORDER BY goals DESC LIMIT 1',
      league_id ? [league_id] : []
    );
    if (goalsResult.rows.length > 0) {
      records.most_goals = goalsResult.rows[0];
    }

    // Most assists
    const assistsResult = await pool.query(
      league_id
        ? 'SELECT * FROM players WHERE league_id = $1 ORDER BY assists DESC LIMIT 1'
        : 'SELECT * FROM players ORDER BY assists DESC LIMIT 1',
      league_id ? [league_id] : []
    );
    if (assistsResult.rows.length > 0) {
      records.most_assists = assistsResult.rows[0];
    }

    // Most appearances
    const appearancesResult = await pool.query(
      league_id
        ? 'SELECT * FROM players WHERE league_id = $1 ORDER BY appearances DESC LIMIT 1'
        : 'SELECT * FROM players ORDER BY appearances DESC LIMIT 1',
      league_id ? [league_id] : []
    );
    if (appearancesResult.rows.length > 0) {
      records.most_appearances = appearancesResult.rows[0];
    }

    // Highest rating
    const ratingResult = await pool.query(
      league_id
        ? 'SELECT * FROM players WHERE league_id = $1 ORDER BY rating DESC LIMIT 1'
        : 'SELECT * FROM players ORDER BY rating DESC LIMIT 1',
      league_id ? [league_id] : []
    );
    if (ratingResult.rows.length > 0) {
      records.highest_rating = ratingResult.rows[0];
    }

    // Highest market value
    const valueResult = await pool.query(
      league_id
        ? 'SELECT * FROM players WHERE league_id = $1 ORDER BY market_value DESC LIMIT 1'
        : 'SELECT * FROM players ORDER BY market_value DESC LIMIT 1',
      league_id ? [league_id] : []
    );
    if (valueResult.rows.length > 0) {
      records.highest_market_value = valueResult.rows[0];
    }

    // Most expensive transfer
    const transferResult = await pool.query(
      league_id
        ? `SELECT t.*, p.first_name, p.last_name FROM transfers t
           JOIN players p ON t.player_id = p.id
           WHERE p.league_id = $1 AND t.status = 'completed'
           ORDER BY t.transfer_fee DESC LIMIT 1`
        : `SELECT t.*, p.first_name, p.last_name FROM transfers t
           JOIN players p ON t.player_id = p.id
           WHERE t.status = 'completed'
           ORDER BY t.transfer_fee DESC LIMIT 1`,
      league_id ? [league_id] : []
    );
    if (transferResult.rows.length > 0) {
      records.most_expensive_transfer = transferResult.rows[0];
    }

    res.json(records);
  } catch (error) {
    next(error);
  }
});

// Get specific record
router.get('/:record_type', async (req, res, next) => {
  try {
    const { record_type } = req.params;
    const { league_id, limit = 10 } = req.query;

    let query = '';
    const params = [];

    switch (record_type) {
      case 'top-scorers':
        query = 'SELECT * FROM players' + (league_id ? ' WHERE league_id = $1' : '') + ' ORDER BY goals DESC LIMIT $' + (league_id ? '2' : '1');
        if (league_id) params.push(league_id);
        params.push(limit);
        break;

      case 'top-assists':
        query = 'SELECT * FROM players' + (league_id ? ' WHERE league_id = $1' : '') + ' ORDER BY assists DESC LIMIT $' + (league_id ? '2' : '1');
        if (league_id) params.push(league_id);
        params.push(limit);
        break;

      case 'best-ratings':
        query = 'SELECT * FROM players' + (league_id ? ' WHERE league_id = $1' : '') + ' ORDER BY rating DESC LIMIT $' + (league_id ? '2' : '1');
        if (league_id) params.push(league_id);
        params.push(limit);
        break;

      case 'highest-values':
        query = 'SELECT * FROM players' + (league_id ? ' WHERE league_id = $1' : '') + ' ORDER BY market_value DESC LIMIT $' + (league_id ? '2' : '1');
        if (league_id) params.push(league_id);
        params.push(limit);
        break;

      case 'most-appearances':
        query = 'SELECT * FROM players' + (league_id ? ' WHERE league_id = $1' : '') + ' ORDER BY appearances DESC LIMIT $' + (league_id ? '2' : '1');
        if (league_id) params.push(league_id);
        params.push(limit);
        break;

      default:
        return res.status(400).json({ error: 'Invalid record type' });
    }

    const result = await pool.query(query, params);
    res.json({
      record_type,
      count: result.rows.length,
      players: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

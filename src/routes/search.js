const express = require('express');
const pool = require('../config/database');
const logger = require('../config/logger');

const router = express.Router();

// Global search across players, teams, leagues, news
router.get('/', async (req, res, next) => {
  try {
    const { q, type } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const searchTerm = `%${q}%`;
    const results = {};

    // Search players
    if (!type || type === 'players') {
      const playersResult = await pool.query(
        `SELECT id, first_name, last_name, position, rating, market_value, team_id FROM players
         WHERE CONCAT(first_name, ' ', last_name) ILIKE $1
         LIMIT 10`,
        [searchTerm]
      );
      results.players = playersResult.rows;
    }

    // Search teams
    if (!type || type === 'teams') {
      const teamsResult = await pool.query(
        `SELECT id, name, logo_url, league_id FROM teams
         WHERE name ILIKE $1
         LIMIT 10`,
        [searchTerm]
      );
      results.teams = teamsResult.rows;
    }

    // Search leagues
    if (!type || type === 'leagues') {
      const leaguesResult = await pool.query(
        `SELECT id, name, abbreviation FROM leagues
         WHERE name ILIKE $1
         LIMIT 10`,
        [searchTerm]
      );
      results.leagues = leaguesResult.rows;
    }

    // Search news
    if (!type || type === 'news') {
      const newsResult = await pool.query(
        `SELECT id, headline, category, published_at FROM news
         WHERE headline ILIKE $1 AND published_at IS NOT NULL
         LIMIT 10`,
        [searchTerm]
      );
      results.news = newsResult.rows;
    }

    res.json(results);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

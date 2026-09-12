const express = require('express');
const pool = require('../config/database');
const { authenticateToken, authorizePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const Joi = require('joi');
const logger = require('../config/logger');

const router = express.Router();

// Get all statistics
router.get('/league/:league_id', async (req, res, next) => {
  try {
    const { league_id } = req.params;

    // Top scorers
    const scorersResult = await pool.query(
      `SELECT p.id, p.first_name, p.last_name, p.goals, p.team_id, t.name as team_name
       FROM players p
       JOIN teams t ON p.team_id = t.id
       WHERE p.league_id = $1
       ORDER BY p.goals DESC
       LIMIT 10`,
      [league_id]
    );

    // Top assists
    const assistsResult = await pool.query(
      `SELECT p.id, p.first_name, p.last_name, p.assists, p.team_id, t.name as team_name
       FROM players p
       JOIN teams t ON p.team_id = t.id
       WHERE p.league_id = $1
       ORDER BY p.assists DESC
       LIMIT 10`,
      [league_id]
    );

    // Best ratings
    const ratingsResult = await pool.query(
      `SELECT p.id, p.first_name, p.last_name, p.rating, p.team_id, t.name as team_name
       FROM players p
       JOIN teams t ON p.team_id = t.id
       WHERE p.league_id = $1 AND p.appearances > 0
       ORDER BY p.rating DESC
       LIMIT 10`,
      [league_id]
    );

    res.json({
      top_scorers: scorersResult.rows,
      top_assists: assistsResult.rows,
      best_ratings: ratingsResult.rows,
    });
  } catch (error) {
    next(error);
  }
});

// Get player statistics
router.get('/player/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const playerResult = await pool.query(
      `SELECT p.*, t.name as team_name, l.name as league_name
       FROM players p
       LEFT JOIN teams t ON p.team_id = t.id
       LEFT JOIN leagues l ON p.league_id = l.id
       WHERE p.id = $1`,
      [id]
    );

    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const player = playerResult.rows[0];

    // Get match history
    const matchesResult = await pool.query(
      `SELECT pr.*, m.home_team_id, m.away_team_id, m.home_goals, m.away_goals, m.match_date
       FROM player_ratings pr
       JOIN matches m ON pr.match_id = m.id
       WHERE pr.player_id = $1
       ORDER BY m.match_date DESC
       LIMIT 10`,
      [id]
    );

    player.recent_matches = matchesResult.rows;

    res.json(player);
  } catch (error) {
    next(error);
  }
});

// Get team statistics
router.get('/team/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Team info
    const teamResult = await pool.query(
      'SELECT * FROM teams WHERE id = $1',
      [id]
    );

    if (teamResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const team = teamResult.rows[0];

    // Squad statistics
    const squadResult = await pool.query(
      `SELECT p.id, p.first_name, p.last_name, p.position, p.rating, p.goals, p.assists, p.appearances
       FROM players p
       WHERE p.team_id = $1
       ORDER BY p.rating DESC`,
      [id]
    );

    team.squad = squadResult.rows;

    // Calculate team stats
    const matchesResult = await pool.query(
      `SELECT COUNT(*) as total, 
              SUM(CASE WHEN (home_team_id = $1 AND home_goals > away_goals) OR (away_team_id = $1 AND away_goals > home_goals) THEN 1 ELSE 0 END) as wins,
              SUM(CASE WHEN home_goals = away_goals THEN 1 ELSE 0 END) as draws,
              SUM(CASE WHEN (home_team_id = $1 AND home_goals < away_goals) OR (away_team_id = $1 AND away_goals < home_goals) THEN 1 ELSE 0 END) as losses,
              SUM(CASE WHEN home_team_id = $1 THEN home_goals ELSE away_goals END) as goals_for,
              SUM(CASE WHEN home_team_id = $1 THEN away_goals ELSE home_goals END) as goals_against
       FROM matches
       WHERE (home_team_id = $1 OR away_team_id = $1) AND match_status = 'finished'`,
      [id]
    );

    team.performance = matchesResult.rows[0];

    // Average squad rating
    const avgRatingResult = await pool.query(
      `SELECT AVG(rating) as avg_rating, SUM(market_value) as total_value
       FROM players
       WHERE team_id = $1`,
      [id]
    );

    team.avg_rating = avgRatingResult.rows[0].avg_rating;
    team.total_squad_value = avgRatingResult.rows[0].total_value;

    res.json(team);
  } catch (error) {
    next(error);
  }
});

// Get league standings
router.get('/league/:league_id/standings', async (req, res, next) => {
  try {
    const { league_id } = req.params;

    const standingsResult = await pool.query(
      `SELECT t.id, t.name, t.logo_url,
              COUNT(DISTINCT m.id) as played,
              SUM(CASE WHEN (m.home_team_id = t.id AND m.home_goals > m.away_goals) OR (m.away_team_id = t.id AND m.away_goals > m.home_goals) THEN 1 ELSE 0 END) as wins,
              SUM(CASE WHEN m.home_goals = m.away_goals THEN 1 ELSE 0 END) as draws,
              SUM(CASE WHEN (m.home_team_id = t.id AND m.home_goals < m.away_goals) OR (m.away_team_id = t.id AND m.away_goals < m.home_goals) THEN 1 ELSE 0 END) as losses,
              SUM(CASE WHEN m.home_team_id = t.id THEN m.home_goals ELSE m.away_goals END) as goals_for,
              SUM(CASE WHEN m.home_team_id = t.id THEN m.away_goals ELSE m.home_goals END) as goals_against,
              SUM(CASE WHEN (m.home_team_id = t.id AND m.home_goals > m.away_goals) OR (m.away_team_id = t.id AND m.away_goals > m.home_goals) THEN 3 ELSE 0 END) +
              SUM(CASE WHEN m.home_goals = m.away_goals THEN 1 ELSE 0 END) as points
       FROM teams t
       LEFT JOIN matches m ON (t.id = m.home_team_id OR t.id = m.away_team_id) AND m.match_status = 'finished'
       WHERE t.league_id = $1
       GROUP BY t.id, t.name, t.logo_url
       ORDER BY points DESC`,
      [league_id]
    );

    res.json({ standings: standingsResult.rows });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

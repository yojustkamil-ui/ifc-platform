const express = require('express');
const pool = require('../config/database');
const { authenticateToken, authorizePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const Joi = require('joi');
const logger = require('../config/logger');

const router = express.Router();

// Compare two players
router.get('/players/:id1/vs/:id2', async (req, res, next) => {
  try {
    const { id1, id2 } = req.params;

    // Get both players
    const player1Result = await pool.query(
      `SELECT p.*, t.name as team_name, l.name as league_name
       FROM players p
       LEFT JOIN teams t ON p.team_id = t.id
       LEFT JOIN leagues l ON p.league_id = l.id
       WHERE p.id = $1`,
      [id1]
    );

    const player2Result = await pool.query(
      `SELECT p.*, t.name as team_name, l.name as league_name
       FROM players p
       LEFT JOIN teams t ON p.team_id = t.id
       LEFT JOIN leagues l ON p.league_id = l.id
       WHERE p.id = $1`,
      [id2]
    );

    if (player1Result.rows.length === 0 || player2Result.rows.length === 0) {
      return res.status(404).json({ error: 'One or both players not found' });
    }

    const player1 = player1Result.rows[0];
    const player2 = player2Result.rows[0];

    // Get current hero cards
    const card1Result = await pool.query(
      'SELECT * FROM hero_cards WHERE player_id = $1 AND is_current = TRUE',
      [id1]
    );
    const card2Result = await pool.query(
      'SELECT * FROM hero_cards WHERE player_id = $1 AND is_current = TRUE',
      [id2]
    );

    res.json({
      player1: {
        ...player1,
        hero_card: card1Result.rows[0] || null,
      },
      player2: {
        ...player2,
        hero_card: card2Result.rows[0] || null,
      },
      comparison: {
        rating_advantage: player1.rating > player2.rating ? `Player 1 by ${(player1.rating - player2.rating).toFixed(1)}` : `Player 2 by ${(player2.rating - player1.rating).toFixed(1)}`,
        value_advantage: player1.market_value > player2.market_value ? `Player 1 by $${(player1.market_value - player2.market_value).toLocaleString()}` : `Player 2 by $${(player2.market_value - player1.market_value).toLocaleString()}`,
        goals_advantage: player1.goals > player2.goals ? `Player 1 by ${player1.goals - player2.goals}` : player2.goals > player1.goals ? `Player 2 by ${player2.goals - player1.goals}` : 'Tied',
        assists_advantage: player1.assists > player2.assists ? `Player 1 by ${player1.assists - player2.assists}` : player2.assists > player1.assists ? `Player 2 by ${player2.assists - player1.assists}` : 'Tied',
        appearances_advantage: player1.appearances > player2.appearances ? `Player 1 by ${player1.appearances - player2.appearances}` : player2.appearances > player1.appearances ? `Player 2 by ${player2.appearances - player1.appearances}` : 'Tied',
      },
    });
  } catch (error) {
    next(error);
  }
});

// Compare two teams
router.get('/teams/:id1/vs/:id2', async (req, res, next) => {
  try {
    const { id1, id2 } = req.params;

    // Get both teams with squad stats
    const getTeamStats = async (teamId) => {
      const teamResult = await pool.query('SELECT * FROM teams WHERE id = $1', [teamId]);
      if (teamResult.rows.length === 0) return null;

      const team = teamResult.rows[0];

      const squadResult = await pool.query(
        'SELECT * FROM players WHERE team_id = $1',
        [teamId]
      );
      team.squad = squadResult.rows;

      const statsResult = await pool.query(
        `SELECT COUNT(*) as played,
                SUM(CASE WHEN (home_team_id = $1 AND home_goals > away_goals) OR (away_team_id = $1 AND away_goals > home_goals) THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN home_goals = away_goals THEN 1 ELSE 0 END) as draws,
                SUM(CASE WHEN (home_team_id = $1 AND home_goals < away_goals) OR (away_team_id = $1 AND away_goals < home_goals) THEN 1 ELSE 0 END) as losses,
                SUM(CASE WHEN home_team_id = $1 THEN home_goals ELSE away_goals END) as goals_for,
                SUM(CASE WHEN home_team_id = $1 THEN away_goals ELSE home_goals END) as goals_against
         FROM matches
         WHERE (home_team_id = $1 OR away_team_id = $1) AND match_status = 'finished'`,
        [teamId]
      );
      team.stats = statsResult.rows[0];

      const valueResult = await pool.query(
        'SELECT AVG(rating) as avg_rating, SUM(market_value) as total_value FROM players WHERE team_id = $1',
        [teamId]
      );
      team.squad_value = valueResult.rows[0];

      return team;
    };

    const team1 = await getTeamStats(id1);
    const team2 = await getTeamStats(id2);

    if (!team1 || !team2) {
      return res.status(404).json({ error: 'One or both teams not found' });
    }

    res.json({
      team1,
      team2,
      comparison: {
        squad_value_advantage: team1.squad_value.total_value > team2.squad_value.total_value
          ? `Team 1 by $${(team1.squad_value.total_value - team2.squad_value.total_value).toLocaleString()}`
          : `Team 2 by $${(team2.squad_value.total_value - team1.squad_value.total_value).toLocaleString()}`,
        squad_rating_advantage: team1.squad_value.avg_rating > team2.squad_value.avg_rating
          ? `Team 1 by ${(team1.squad_value.avg_rating - team2.squad_value.avg_rating).toFixed(1)}`
          : `Team 2 by ${(team2.squad_value.avg_rating - team1.squad_value.avg_rating).toFixed(1)}`,
        win_record: team1.stats.wins > team2.stats.wins ? `Team 1: ${team1.stats.wins}W` : `Team 2: ${team2.stats.wins}W`,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

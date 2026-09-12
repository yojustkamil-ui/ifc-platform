const express = require('express');
const pool = require('../config/database');
const logger = require('../config/logger');

const router = express.Router();

// Get head-to-head statistics between two teams
router.get('/teams/:team1_id/vs/:team2_id', async (req, res, next) => {
  try {
    const { team1_id, team2_id } = req.params;

    // Get all matches between teams
    const matchesResult = await pool.query(
      `SELECT * FROM matches
       WHERE (home_team_id = $1 AND away_team_id = $2) OR (home_team_id = $2 AND away_team_id = $1)
       WHERE match_status = 'finished'
       ORDER BY match_date DESC`,
      [team1_id, team2_id]
    );

    // Calculate head-to-head record
    let team1Wins = 0;
    let team2Wins = 0;
    let draws = 0;
    let totalGoalsTeam1 = 0;
    let totalGoalsTeam2 = 0;

    matchesResult.rows.forEach(match => {
      if (match.home_team_id === team1_id) {
        if (match.home_goals > match.away_goals) team1Wins++;
        else if (match.home_goals < match.away_goals) team2Wins++;
        else draws++;
        totalGoalsTeam1 += match.home_goals;
        totalGoalsTeam2 += match.away_goals;
      } else {
        if (match.away_goals > match.home_goals) team1Wins++;
        else if (match.away_goals < match.home_goals) team2Wins++;
        else draws++;
        totalGoalsTeam1 += match.away_goals;
        totalGoalsTeam2 += match.home_goals;
      }
    });

    res.json({
      head_to_head: {
        total_matches: matchesResult.rows.length,
        team1_wins: team1Wins,
        team2_wins: team2Wins,
        draws,
        total_goals_team1: totalGoalsTeam1,
        total_goals_team2: totalGoalsTeam2,
        average_goals_team1: (totalGoalsTeam1 / matchesResult.rows.length).toFixed(2),
        average_goals_team2: (totalGoalsTeam2 / matchesResult.rows.length).toFixed(2),
      },
      recent_matches: matchesResult.rows.slice(0, 10),
    });
  } catch (error) {
    next(error);
  }
});

// Get player head-to-head
router.get('/players/:player1_id/vs/:player2_id', async (req, res, next) => {
  try {
    const { player1_id, player2_id } = req.params;

    // Get both players
    const player1Result = await pool.query(
      'SELECT * FROM players WHERE id = $1',
      [player1_id]
    );
    const player2Result = await pool.query(
      'SELECT * FROM players WHERE id = $1',
      [player2_id]
    );

    if (player1Result.rows.length === 0 || player2Result.rows.length === 0) {
      return res.status(404).json({ error: 'One or both players not found' });
    }

    const player1 = player1Result.rows[0];
    const player2 = player2Result.rows[0];

    // Get direct matchup data (matches where both played)
    const matchupsResult = await pool.query(
      `SELECT m.* FROM matches m
       WHERE EXISTS (SELECT 1 FROM player_ratings pr WHERE pr.player_id = $1 AND pr.match_id = m.id)
       AND EXISTS (SELECT 1 FROM player_ratings pr WHERE pr.player_id = $2 AND pr.match_id = m.id)
       AND m.match_status = 'finished'
       ORDER BY m.match_date DESC`,
      [player1_id, player2_id]
    );

    // Get ratings in those matches
    const ratingsResult = await pool.query(
      `SELECT player_id, AVG(rating) as avg_rating, COUNT(*) as matches
       FROM player_ratings
       WHERE player_id IN ($1, $2) AND match_id IN (SELECT id FROM matches WHERE match_status = 'finished')
       GROUP BY player_id`,
      [player1_id, player2_id]
    );

    res.json({
      player1: {
        ...player1,
        direct_matchup_stats: ratingsResult.rows.find(r => r.player_id === player1_id) || null,
      },
      player2: {
        ...player2,
        direct_matchup_stats: ratingsResult.rows.find(r => r.player_id === player2_id) || null,
      },
      direct_matchups: matchupsResult.rows.length,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

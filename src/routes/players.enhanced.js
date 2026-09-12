const express = require('express');
const pool = require('../config/database');
const { authenticateToken, authorizePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const Joi = require('joi');
const logger = require('../config/logger');

const router = express.Router();

// Get player by ID (updated with more details)
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get player info
    const playerResult = await pool.query(
      `SELECT p.*, t.name as team_name, t.logo_url as team_logo, l.name as league_name
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

    // Get current hero card
    const cardResult = await pool.query(
      `SELECT * FROM hero_cards WHERE player_id = $1 AND is_current = TRUE`,
      [id]
    );

    if (cardResult.rows.length > 0) {
      player.current_card = cardResult.rows[0];
    }

    // Get card history
    const cardHistoryResult = await pool.query(
      `SELECT * FROM hero_cards WHERE player_id = $1 ORDER BY created_at DESC`,
      [id]
    );

    player.card_history = cardHistoryResult.rows;

    // Get transfer history
    const transferResult = await pool.query(
      `SELECT t.*, ft.name as from_team, tt.name as to_team
       FROM transfers t
       LEFT JOIN teams ft ON t.from_team_id = ft.id
       LEFT JOIN teams tt ON t.to_team_id = tt.id
       WHERE t.player_id = $1
       ORDER BY t.transfer_date DESC`,
      [id]
    );

    player.transfer_history = transferResult.rows;

    // Get contract info
    const contractResult = await pool.query(
      'SELECT * FROM contracts WHERE player_id = $1 ORDER BY start_date DESC LIMIT 1',
      [id]
    );

    if (contractResult.rows.length > 0) {
      player.current_contract = contractResult.rows[0];
    }

    // Get social media
    const socialResult = await pool.query(
      'SELECT platform, url FROM social_media_links WHERE player_id = $1',
      [id]
    );

    player.social_media = socialResult.rows;

    res.json(player);
  } catch (error) {
    next(error);
  }
});

// Update player statistics (Staff only)
const updatePlayerStatsSchema = Joi.object({
  goals: Joi.number().integer(),
  assists: Joi.number().integer(),
  appearances: Joi.number().integer(),
  average_rating: Joi.number().min(0).max(10),
  rating: Joi.number().min(0).max(100),
});

router.patch('/:id/stats', authenticateToken, authorizePermission(['manage_players']), validate(updatePlayerStatsSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { goals, assists, appearances, average_rating, rating } = req.validatedData;

    const result = await pool.query(
      `UPDATE players SET
       goals = COALESCE($1, goals),
       assists = COALESCE($2, assists),
       appearances = COALESCE($3, appearances),
       average_rating = COALESCE($4, average_rating),
       rating = COALESCE($5, rating),
       updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [goals, assists, appearances, average_rating, rating, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    logger.info(`Player statistics updated: ${id}`);
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

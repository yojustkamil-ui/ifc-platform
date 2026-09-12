const express = require('express');
const pool = require('../config/database');
const { authenticateToken, authorizePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const Joi = require('joi');
const logger = require('../config/logger');

const router = express.Router();

const CARD_TYPES = {
  STANDARD: { name: 'Standard', rarity: 'common' },
  BRONZE_HERO: { name: 'Bronze Hero', rarity: 'common', rating_min: 59, rating_max: 74 },
  SILVER_HERO: { name: 'Silver Hero', rarity: 'uncommon', rating_min: 75, rating_max: 81 },
  GOLD_HERO: { name: 'Gold Hero', rarity: 'rare', rating_min: 82, rating_max: 89 },
  ELITE_HERO: { name: 'Elite Hero', rarity: 'epic', rating_min: 90, rating_max: 100 },
  TEAM_OF_THE_WEEK: { name: 'Team of the Week', rarity: 'special' },
  PLAYER_OF_THE_MONTH: { name: 'Player of the Month', rarity: 'special' },
  LEAGUE_BEST_XI: { name: 'League Best XI', rarity: 'special' },
  TOURNAMENT_HERO: { name: 'Tournament Hero', rarity: 'special' },
  RECORD_BREAKER: { name: 'Record Breaker', rarity: 'special' },
  FINALS_HERO: { name: 'Finals Hero', rarity: 'special' },
  SEASON_HERO: { name: 'Season Hero', rarity: 'special' },
};

// Get card type details
router.get('/types', (req, res) => {
  res.json({ card_types: CARD_TYPES });
});

// Create special card (Staff only)
const createSpecialCardSchema = Joi.object({
  player_id: Joi.number().integer().required(),
  card_type: Joi.string().valid(...Object.keys(CARD_TYPES)).required(),
  season: Joi.string().required(),
  reason: Joi.string().required(),
});

router.post('/special', authenticateToken, authorizePermission(['manage_hero_cards']), validate(createSpecialCardSchema), async (req, res, next) => {
  try {
    const { player_id, card_type, season, reason } = req.validatedData;

    const playerResult = await pool.query(
      'SELECT * FROM players WHERE id = $1',
      [player_id]
    );

    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const player = playerResult.rows[0];

    // Archive previous card only if it was standard
    const previousCard = await pool.query(
      'SELECT * FROM hero_cards WHERE player_id = $1 AND is_current = TRUE',
      [player_id]
    );

    if (previousCard.rows.length > 0 && !previousCard.rows[0].card_type.includes('HERO')) {
      await pool.query(
        'UPDATE hero_cards SET is_current = FALSE WHERE player_id = $1',
        [player_id]
      );
    }

    // Create special card
    const result = await pool.query(
      `INSERT INTO hero_cards (player_id, card_type, rating, market_value, goals, assists, appearances, season, is_current)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
       RETURNING *`,
      [player_id, card_type, player.rating, player.market_value, player.goals, player.assists, player.appearances, season]
    );

    // Log audit
    await pool.query(
      `INSERT INTO audit_logs (staff_id, action, entity_type, entity_id, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, 'special_card_created', 'hero_card', result.rows[0].id, 'none', card_type]
    );

    logger.info(`Special hero card created: Player ${player_id}, Type: ${card_type}, Reason: ${reason}`);

    res.status(201).json({
      card: result.rows[0],
      card_details: CARD_TYPES[card_type],
      reason,
    });
  } catch (error) {
    next(error);
  }
});

// Get player's all cards (including archived)
router.get('/player/:player_id/all', async (req, res, next) => {
  try {
    const { player_id } = req.params;

    const result = await pool.query(
      `SELECT hc.*, p.first_name, p.last_name
       FROM hero_cards hc
       JOIN players p ON hc.player_id = p.id
       WHERE hc.player_id = $1
       ORDER BY hc.created_at DESC`,
      [player_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No hero cards found' });
    }

    const cards = result.rows.map(card => ({
      ...card,
      card_details: CARD_TYPES[card.card_type] || { name: card.card_type, rarity: 'unknown' },
    }));

    res.json({
      player_name: `${result.rows[0].first_name} ${result.rows[0].last_name}`,
      total_cards: cards.length,
      cards,
    });
  } catch (error) {
    next(error);
  }
});

// Get player card progression timeline
router.get('/player/:player_id/progression', async (req, res, next) => {
  try {
    const { player_id } = req.params;

    const result = await pool.query(
      `SELECT hc.id, hc.card_type, hc.rating, hc.market_value, hc.season, hc.created_at
       FROM hero_cards hc
       WHERE hc.player_id = $1
       ORDER BY hc.created_at ASC`,
      [player_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No progression data found' });
    }

    const progression = result.rows.map((card, index) => ({
      card_number: index + 1,
      card_type: card.card_type,
      rating: card.rating,
      market_value: card.market_value,
      season: card.season,
      date: card.created_at,
      is_upgrade: index > 0 && card.rating > result.rows[index - 1].rating,
      rating_change: index > 0 ? (card.rating - result.rows[index - 1].rating).toFixed(2) : 0,
    }));

    res.json({
      player_id,
      total_cards: progression.length,
      progression,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

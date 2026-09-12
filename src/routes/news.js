const express = require('express');
const pool = require('../config/database');
const { authenticateToken, authorizePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const Joi = require('joi');
const logger = require('../config/logger');

const router = express.Router();

// Get all news
router.get('/', async (req, res, next) => {
  try {
    const { category, team_id, player_id, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT n.*, u.username as author_name FROM news n JOIN users u ON n.author_id = u.id WHERE published_at IS NOT NULL';
    const params = [];
    let paramCount = 1;

    if (category) {
      query += ` AND n.category = $${paramCount++}`;
      params.push(category);
    }
    if (team_id) {
      query += ` AND n.related_team_id = $${paramCount++}`;
      params.push(team_id);
    }
    if (player_id) {
      query += ` AND n.related_player_id = $${paramCount++}`;
      params.push(player_id);
    }

    query += ` ORDER BY n.published_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    res.json({ news: result.rows, total: result.rows.length });
  } catch (error) {
    next(error);
  }
});

// Get news by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT n.*, u.username as author_name FROM news n JOIN users u ON n.author_id = u.id WHERE n.id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'News not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Create news (Staff only)
const createNewsSchema = Joi.object({
  headline: Joi.string().required(),
  content: Joi.string().required(),
  category: Joi.string().required(),
  cover_image_url: Joi.string(),
  related_player_id: Joi.number().integer(),
  related_team_id: Joi.number().integer(),
  related_match_id: Joi.number().integer(),
});

router.post('/', authenticateToken, authorizePermission(['manage_news']), validate(createNewsSchema), async (req, res, next) => {
  try {
    const { headline, content, category, cover_image_url, related_player_id, related_team_id, related_match_id } = req.validatedData;

    const result = await pool.query(
      `INSERT INTO news (headline, content, author_id, category, cover_image_url, related_player_id, related_team_id, related_match_id, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [headline, content, req.user.id, category, cover_image_url, related_player_id, related_team_id, related_match_id]
    );

    logger.info(`News article published: ${result.rows[0].id}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Update news
const updateNewsSchema = Joi.object({
  headline: Joi.string(),
  content: Joi.string(),
  category: Joi.string(),
  cover_image_url: Joi.string(),
});

router.patch('/:id', authenticateToken, authorizePermission(['manage_news']), validate(updateNewsSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { headline, content, category, cover_image_url } = req.validatedData;

    const result = await pool.query(
      `UPDATE news SET headline = COALESCE($1, headline), content = COALESCE($2, content), category = COALESCE($3, category), cover_image_url = COALESCE($4, cover_image_url), updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [headline, content, category, cover_image_url, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'News not found' });
    }

    logger.info(`News updated: ${id}`);
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

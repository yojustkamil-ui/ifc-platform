const express = require('express');
const pool = require('../config/database');
const { authenticateToken, authorizePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const Joi = require('joi');
const logger = require('../config/logger');

const router = express.Router();

// Get all transfers
router.get('/', async (req, res, next) => {
  try {
    const { player_id, team_id, status, type, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `SELECT t.*, p.first_name, p.last_name, ft.name as from_team, ft.logo_url as from_logo, tt.name as to_team, tt.logo_url as to_logo
                 FROM transfers t
                 JOIN players p ON t.player_id = p.id
                 LEFT JOIN teams ft ON t.from_team_id = ft.id
                 LEFT JOIN teams tt ON t.to_team_id = tt.id
                 WHERE 1=1`;
    const params = [];
    let paramCount = 1;

    if (player_id) {
      query += ` AND t.player_id = $${paramCount++}`;
      params.push(player_id);
    }
    if (team_id) {
      query += ` AND (t.from_team_id = $${paramCount} OR t.to_team_id = $${paramCount})`;
      params.push(team_id);
      paramCount++;
    }
    if (status) {
      query += ` AND t.status = $${paramCount++}`;
      params.push(status);
    }
    if (type) {
      query += ` AND t.transfer_type = $${paramCount++}`;
      params.push(type);
    }

    query += ` ORDER BY t.transfer_date DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    res.json({ transfers: result.rows, total: result.rows.length });
  } catch (error) {
    next(error);
  }
});

// Get transfer by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT t.*, p.first_name, p.last_name, ft.name as from_team, tt.name as to_team
       FROM transfers t
       JOIN players p ON t.player_id = p.id
       LEFT JOIN teams ft ON t.from_team_id = ft.id
       LEFT JOIN teams tt ON t.to_team_id = tt.id
       WHERE t.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transfer not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Create transfer offer (Staff only)
const createTransferSchema = Joi.object({
  player_id: Joi.number().integer().required(),
  from_team_id: Joi.number().integer(),
  to_team_id: Joi.number().integer().required(),
  transfer_fee: Joi.number().integer().required(),
  transfer_type: Joi.string().valid('permanent', 'loan').default('permanent'),
});

router.post('/', authenticateToken, authorizePermission(['manage_transfers']), validate(createTransferSchema), async (req, res, next) => {
  try {
    const { player_id, from_team_id, to_team_id, transfer_fee, transfer_type } = req.validatedData;

    // Verify entities exist
    const playerResult = await pool.query('SELECT * FROM players WHERE id = $1', [player_id]);
    if (playerResult.rows.length === 0) {
      return res.status(400).json({ error: 'Player not found' });
    }

    const player = playerResult.rows[0];

    // If from_team_id not provided, use player's current team
    const actualFromTeamId = from_team_id || player.team_id;

    if (actualFromTeamId === to_team_id) {
      return res.status(400).json({ error: 'Cannot transfer player to the same team' });
    }

    const result = await pool.query(
      `INSERT INTO transfers (player_id, from_team_id, to_team_id, transfer_fee, transfer_date, transfer_type, status)
       VALUES ($1, $2, $3, $4, NOW(), $5, $6)
       RETURNING *`,
      [player_id, actualFromTeamId, to_team_id, transfer_fee, transfer_type, 'pending']
    );

    logger.info(`Transfer created: Player ${player_id}, Type: ${transfer_type}, Status: pending`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Update transfer status (Accept/Reject/Counter)
const updateTransferSchema = Joi.object({
  status: Joi.string().valid('pending', 'accepted', 'rejected', 'cancelled', 'completed').required(),
  transfer_fee: Joi.number().integer(),
});

router.patch('/:id', authenticateToken, authorizePermission(['manage_transfers']), validate(updateTransferSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, transfer_fee } = req.validatedData;

    const transferResult = await pool.query('SELECT * FROM transfers WHERE id = $1', [id]);
    if (transferResult.rows.length === 0) {
      return res.status(404).json({ error: 'Transfer not found' });
    }

    const transfer = transferResult.rows[0];

    // Update transfer
    const result = await pool.query(
      `UPDATE transfers SET status = $1, transfer_fee = COALESCE($2, transfer_fee), updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, transfer_fee, id]
    );

    // If transfer accepted/completed, update player's team
    if ((status === 'accepted' || status === 'completed') && transfer.transfer_type === 'permanent') {
      await pool.query(
        'UPDATE players SET team_id = $1 WHERE id = $2',
        [transfer.to_team_id, transfer.player_id]
      );
    }

    logger.info(`Transfer updated: ${id}, Status: ${status}`);
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Get transfer statistics
router.get('/stats/summary', async (req, res, next) => {
  try {
    const { league_id } = req.query;

    // Most expensive transfers
    const expensiveResult = await pool.query(
      `SELECT t.*, p.first_name, p.last_name, ft.name as from_team, tt.name as to_team
       FROM transfers t
       JOIN players p ON t.player_id = p.id
       LEFT JOIN teams ft ON t.from_team_id = ft.id
       LEFT JOIN teams tt ON t.to_team_id = tt.id
       ${league_id ? 'WHERE p.league_id = $1' : ''}
       ORDER BY t.transfer_fee DESC
       LIMIT 10`,
      league_id ? [league_id] : []
    );

    // Transfer activity
    const activityResult = await pool.query(
      `SELECT COUNT(*) as total, 
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
              SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
              SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
              SUM(transfer_fee) as total_fees
       FROM transfers
       ${league_id ? 'WHERE (SELECT league_id FROM players WHERE id = transfers.player_id) = $1' : ''}`,
      league_id ? [league_id] : []
    );

    res.json({
      most_expensive: expensiveResult.rows,
      activity: activityResult.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

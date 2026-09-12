const express = require('express');
const pool = require('../config/database');
const { authenticateToken, authorizePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const Joi = require('joi');
const logger = require('../config/logger');

const router = express.Router();

// Get all contracts
router.get('/', async (req, res, next) => {
  try {
    const { player_id, team_id, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `SELECT c.*, p.first_name, p.last_name, t.name as team_name
                 FROM contracts c
                 JOIN players p ON c.player_id = p.id
                 JOIN teams t ON c.team_id = t.id
                 WHERE 1=1`;
    const params = [];
    let paramCount = 1;

    if (player_id) {
      query += ` AND c.player_id = $${paramCount++}`;
      params.push(player_id);
    }
    if (team_id) {
      query += ` AND c.team_id = $${paramCount++}`;
      params.push(team_id);
    }
    if (status) {
      query += ` AND c.status = $${paramCount++}`;
      params.push(status);
    }

    query += ` ORDER BY c.end_date ASC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    res.json({ contracts: result.rows, total: result.rows.length });
  } catch (error) {
    next(error);
  }
});

// Get contract by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT c.*, p.first_name, p.last_name, t.name as team_name
       FROM contracts c
       JOIN players p ON c.player_id = p.id
       JOIN teams t ON c.team_id = t.id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const contract = result.rows[0];

    // Calculate days until expiration
    const endDate = new Date(contract.end_date);
    const today = new Date();
    const daysUntilExpiration = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
    contract.days_until_expiration = daysUntilExpiration;
    contract.expiring_soon = daysUntilExpiration <= 30 && daysUntilExpiration > 0;
    contract.expired = daysUntilExpiration <= 0;

    res.json(contract);
  } catch (error) {
    next(error);
  }
});

// Create contract (Staff only)
const createContractSchema = Joi.object({
  player_id: Joi.number().integer().required(),
  team_id: Joi.number().integer().required(),
  start_date: Joi.date().required(),
  end_date: Joi.date().required(),
  salary: Joi.number().integer(),
  release_clause: Joi.number().integer(),
});

router.post('/', authenticateToken, authorizePermission(['manage_contracts']), validate(createContractSchema), async (req, res, next) => {
  try {
    const { player_id, team_id, start_date, end_date, salary, release_clause } = req.validatedData;

    // Verify player and team exist
    const playerCheck = await pool.query('SELECT * FROM players WHERE id = $1', [player_id]);
    const teamCheck = await pool.query('SELECT * FROM teams WHERE id = $1', [team_id]);

    if (playerCheck.rows.length === 0 || teamCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Player or team not found' });
    }

    if (end_date <= start_date) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    const result = await pool.query(
      `INSERT INTO contracts (player_id, team_id, start_date, end_date, salary, release_clause, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [player_id, team_id, start_date, end_date, salary, release_clause, 'active']
    );

    // Update player's team
    await pool.query(
      'UPDATE players SET team_id = $1 WHERE id = $2',
      [team_id, player_id]
    );

    logger.info(`Contract created: Player ${player_id} with Team ${team_id}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Update contract (Staff only)
const updateContractSchema = Joi.object({
  salary: Joi.number().integer(),
  release_clause: Joi.number().integer(),
  status: Joi.string().valid('active', 'suspended', 'terminated'),
});

router.patch('/:id', authenticateToken, authorizePermission(['manage_contracts']), validate(updateContractSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { salary, release_clause, status } = req.validatedData;

    const result = await pool.query(
      `UPDATE contracts SET salary = COALESCE($1, salary), release_clause = COALESCE($2, release_clause), status = COALESCE($3, status), updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [salary, release_clause, status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    logger.info(`Contract updated: ${id}`);
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Get expiring contracts (for alerts)
router.get('/alerts/expiring', authenticateToken, authorizePermission(['manage_contracts']), async (req, res, next) => {
  try {
    const { days = 30 } = req.query;

    const result = await pool.query(
      `SELECT c.*, p.first_name, p.last_name, t.name as team_name
       FROM contracts c
       JOIN players p ON c.player_id = p.id
       JOIN teams t ON c.team_id = t.id
       WHERE c.status = 'active' AND c.end_date BETWEEN NOW() AND NOW() + INTERVAL '1 day' * $1
       ORDER BY c.end_date ASC`,
      [days]
    );

    res.json({
      alert_type: 'expiring_contracts',
      days_threshold: days,
      count: result.rows.length,
      contracts: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

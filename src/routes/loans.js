const express = require('express');
const pool = require('../config/database');
const { authenticateToken, authorizePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const Joi = require('joi');
const logger = require('../config/logger');

const router = express.Router();

// Get all loans
router.get('/', async (req, res, next) => {
  try {
    const { player_id, parent_team_id, loan_team_id, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `SELECT l.*, p.first_name, p.last_name, pt.name as parent_team, lt.name as loan_team
                 FROM loans l
                 JOIN players p ON l.player_id = p.id
                 JOIN teams pt ON l.parent_team_id = pt.id
                 JOIN teams lt ON l.loan_team_id = lt.id
                 WHERE 1=1`;
    const params = [];
    let paramCount = 1;

    if (player_id) {
      query += ` AND l.player_id = $${paramCount++}`;
      params.push(player_id);
    }
    if (parent_team_id) {
      query += ` AND l.parent_team_id = $${paramCount++}`;
      params.push(parent_team_id);
    }
    if (loan_team_id) {
      query += ` AND l.loan_team_id = $${paramCount++}`;
      params.push(loan_team_id);
    }
    if (status) {
      query += ` AND l.status = $${paramCount++}`;
      params.push(status);
    }

    query += ` ORDER BY l.loan_end DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    res.json({ loans: result.rows, total: result.rows.length });
  } catch (error) {
    next(error);
  }
});

// Create loan
const createLoanSchema = Joi.object({
  player_id: Joi.number().integer().required(),
  parent_team_id: Joi.number().integer().required(),
  loan_team_id: Joi.number().integer().required(),
  loan_start: Joi.date().required(),
  loan_end: Joi.date().required(),
  loan_fee: Joi.number().integer(),
  buy_option: Joi.number().integer(),
});

router.post('/', authenticateToken, authorizePermission(['manage_transfers']), validate(createLoanSchema), async (req, res, next) => {
  try {
    const { player_id, parent_team_id, loan_team_id, loan_start, loan_end, loan_fee, buy_option } = req.validatedData;

    if (parent_team_id === loan_team_id) {
      return res.status(400).json({ error: 'Parent team and loan team cannot be the same' });
    }

    if (loan_end <= loan_start) {
      return res.status(400).json({ error: 'Loan end date must be after start date' });
    }

    const result = await pool.query(
      `INSERT INTO loans (player_id, parent_team_id, loan_team_id, loan_start, loan_end, loan_fee, buy_option, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [player_id, parent_team_id, loan_team_id, loan_start, loan_end, loan_fee, buy_option, 'active']
    );

    // Update player's team to loan team
    await pool.query(
      'UPDATE players SET team_id = $1 WHERE id = $2',
      [loan_team_id, player_id]
    );

    logger.info(`Loan created: Player ${player_id}, From ${parent_team_id} to ${loan_team_id}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// End/recall loan
const endLoanSchema = Joi.object({
  status: Joi.string().valid('returned', 'bought').required(),
});

router.patch('/:id/end', authenticateToken, authorizePermission(['manage_transfers']), validate(endLoanSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.validatedData;

    const loanResult = await pool.query('SELECT * FROM loans WHERE id = $1', [id]);
    if (loanResult.rows.length === 0) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    const loan = loanResult.rows[0];

    // Update loan
    const result = await pool.query(
      `UPDATE loans SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );

    // If loan returned, restore player to parent team
    if (status === 'returned') {
      await pool.query(
        'UPDATE players SET team_id = $1 WHERE id = $2',
        [loan.parent_team_id, loan.player_id]
      );
    }
    // If loan bought, create permanent transfer
    else if (status === 'bought' && loan.buy_option) {
      await pool.query(
        `INSERT INTO transfers (player_id, from_team_id, to_team_id, transfer_fee, transfer_date, transfer_type, status)
         VALUES ($1, $2, $3, $4, NOW(), $5, $6)`,
        [loan.player_id, loan.parent_team_id, loan.loan_team_id, loan.buy_option, 'permanent', 'completed']
      );
    }

    logger.info(`Loan ended: ${id}, Status: ${status}`);
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

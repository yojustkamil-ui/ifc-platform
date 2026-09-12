const express = require('express');
const pool = require('../config/database');
const router = express.Router();

// Get all leagues
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM leagues ORDER BY name ASC'
    );
    res.json({ leagues: result.rows });
  } catch (error) {
    next(error);
  }
});

// Get league by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM leagues WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'League not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

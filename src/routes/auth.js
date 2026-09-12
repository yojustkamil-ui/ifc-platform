const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { generateAccessToken, generateRefreshToken } = require('../utils/tokenManager');
const logger = require('../config/logger');
const router = express.Router();

// Discord OAuth2 Callback
router.get('/discord/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'No authorization code provided' });
  }

  try {
    // Exchange code for access token
    const tokenResponse = await axios.post(
      'https://discord.com/api/oauth2/token',
      {
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
        scope: 'identify email guilds',
      },
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token } = tokenResponse.data;

    // Get Discord user info
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const discordUser = userResponse.data;
    const { id: discord_id, username, avatar, email } = discordUser;

    // Find or create user in IFC database
    const result = await pool.query(
      'SELECT * FROM users WHERE discord_id = $1',
      [discord_id]
    );

    let user;
    if (result.rows.length > 0) {
      user = result.rows[0];
      // Update avatar
      await pool.query(
        'UPDATE users SET avatar = $1, last_login = NOW() WHERE discord_id = $2',
        [avatar, discord_id]
      );
    } else {
      // Create new user
      const createResult = await pool.query(
        'INSERT INTO users (discord_id, username, email, avatar, role, account_status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [discord_id, username, email, avatar, 'user', 'active']
      );
      user = createResult.rows[0];
    }

    // Fetch user permissions
    const permResult = await pool.query(
      'SELECT permission FROM staff_permissions WHERE staff_id = $1',
      [user.id]
    );

    user.permissions = permResult.rows.map(r => r.permission);

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    logger.info(`User ${user.id} authenticated via Discord`);

    // Redirect to frontend with tokens
    const frontendUrl = new URL(process.env.FRONTEND_URL);
    frontendUrl.searchParams.append('accessToken', accessToken);
    frontendUrl.searchParams.append('refreshToken', refreshToken);
    frontendUrl.searchParams.append('userId', user.id);
    frontendUrl.searchParams.append('role', user.role);

    res.redirect(frontendUrl.toString());
  } catch (error) {
    logger.error('Discord auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Refresh Token
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token required' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.id]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const newAccessToken = generateAccessToken(user);

    res.json({ accessToken: newAccessToken });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

module.exports = router;

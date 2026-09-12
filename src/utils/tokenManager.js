const jwt = require('jsonwebtoken');

const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      discord_id: user.discord_id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
};

const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch (error) {
    return null;
  }
};

module.exports = { generateAccessToken, generateRefreshToken, verifyRefreshToken };

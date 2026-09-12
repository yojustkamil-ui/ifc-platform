const jwt = require('jsonwebtoken');
const logger = require('../config/logger');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    logger.warn('No token provided');
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      logger.warn('Token verification failed:', err.message);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

const authorizePermission = (requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userPermissions = req.user.permissions || [];
    const hasPermission = requiredPermissions.some(perm => userPermissions.includes(perm));

    if (!hasPermission) {
      logger.warn(`User ${req.user.id} unauthorized for permissions: ${requiredPermissions}`);
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

const authorizeRole = (requiredRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasRole = requiredRoles.includes(req.user.role);

    if (!hasRole) {
      logger.warn(`User ${req.user.id} with role ${req.user.role} unauthorized`);
      return res.status(403).json({ error: 'Insufficient role' });
    }

    next();
  };
};

module.exports = { authenticateToken, authorizePermission, authorizeRole };

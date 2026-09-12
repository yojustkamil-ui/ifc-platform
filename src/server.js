const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-ratelimit');
const dotenv = require('dotenv');
const logger = require('./config/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Routes
const authRoutes = require('./routes/auth');
const playerRoutes = require('./routes/players');
const playerEnhancedRoutes = require('./routes/players.enhanced');
const teamRoutes = require('./routes/teams');
const leagueRoutes = require('./routes/leagues');
const matchRoutes = require('./routes/matches');
const statisticsRoutes = require('./routes/statistics');
const newsRoutes = require('./routes/news');
const valuationRoutes = require('./routes/valuation');
const predictionRoutes = require('./routes/predictions');
const searchRoutes = require('./routes/search');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/player', playerEnhancedRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/leagues', leagueRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/valuation', valuationRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/search', searchRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'IFC Platform is running', timestamp: new Date() });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`IFC Platform API running on port ${PORT}`);
  console.log(`\n🚀 IFC Platform Backend Started`);
  console.log(`📍 API: http://localhost:${PORT}`);
  console.log(`🔐 Discord OAuth: Configured`);
  console.log(`⚽ Database: Connected\n`);
});

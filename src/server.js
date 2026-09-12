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
const heroCardsRoutes = require('./routes/herocards');
const ratingRoutes = require('./routes/rating');
const cardProgressionRoutes = require('./routes/cardprogression');
const recordsRoutes = require('./routes/records');
const comparisonRoutes = require('./routes/comparison');
const contractsRoutes = require('./routes/contracts');
const freeAgentsRoutes = require('./routes/freeagents');
const transfersRoutes = require('./routes/transfers');
const loansRoutes = require('./routes/loans');
const lineupsRoutes = require('./routes/lineups');
const reportsRoutes = require('./routes/reports');
const headToHeadRoutes = require('./routes/headtohead');
const predictionAccuracyRoutes = require('./routes/prediction-accuracy');

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
app.use('/api/hero-cards', heroCardsRoutes);
app.use('/api/rating', ratingRoutes);
app.use('/api/cards', cardProgressionRoutes);
app.use('/api/records', recordsRoutes);
app.use('/api/compare', comparisonRoutes);
app.use('/api/contracts', contractsRoutes);
app.use('/api/free-agents', freeAgentsRoutes);
app.use('/api/transfers', transfersRoutes);
app.use('/api/loans', loansRoutes);
app.use('/api/match', lineupsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/h2h', headToHeadRoutes);
app.use('/api/accuracy', predictionAccuracyRoutes);

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
  console.log(`📋 API: http://localhost:${PORT}`);
  console.log(`🔐 Discord OAuth: Configured`);
  console.log(`🎭 Discord Role Verification: Enabled`);
  console.log(`⚽ Match System: Active\n`);
});

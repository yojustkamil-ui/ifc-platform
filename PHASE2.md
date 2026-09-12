# PHASE 2: CORE FOOTBALL DATA ✅

## What's Included

### 🏟️ Match Management
- **GET /api/matches** - Get all matches with filters (league, team, status)
- **GET /api/matches/:id** - Get match details with events and player ratings
- **POST /api/matches** - Create new match
- **POST /api/matches/:id/events** - Record match events (goals, cards, substitutions)
- **PATCH /api/matches/:id** - Update match score and status
- **POST /api/matches/:id/rate-player** - Rate player performance (0-10)

Match Statuses: `upcoming`, `live`, `halftime`, `finished`, `postponed`, `cancelled`

Event Types: `goal`, `assist`, `yellow_card`, `red_card`, `substitution_in`, `substitution_out`

### 📊 Statistics & Leaderboards
- **GET /api/statistics/league/:league_id** - Top scorers, assists, and ratings
- **GET /api/statistics/player/:id** - Player stats and match history
- **GET /api/statistics/team/:id** - Team stats with squad, performance, and value
- **GET /api/statistics/league/:league_id/standings** - League table with points, goals, etc.

### 📰 News System
- **GET /api/news** - Get published news with filters
- **GET /api/news/:id** - Get single news article
- **POST /api/news** - Publish news (staff only)
- **PATCH /api/news/:id** - Update news (staff only)

News Categories: `league_news`, `match_preview`, `match_report`, `transfer_news`, `player_interview`, `team_announcement`, `tournament_news`, `breaking_news`, `awards`, `rankings`

### 💰 Player Valuation
- **GET /api/valuation/player/:id** - Get player value history and stats
- **POST /api/valuation/calculate** - Calculate suggested market value based on statistics
- **PATCH /api/valuation/update** - Update player market value (staff confirms)

Value Calculation Factors:
- Rating weight: 30%
- Goals weight: 20%
- Assists weight: 15%
- Appearances weight: 15%
- Awards weight: 20%

### 🗳️ Predictions
- **GET /api/predictions/match/:match_id** - Get prediction stats for a match
- **POST /api/predictions** - Create/update user prediction

Prediction Options: `home_win`, `draw`, `away_win`

### 🔍 Global Search
- **GET /api/search?q=name&type=players** - Search players, teams, leagues, news

### 👤 Enhanced Player Profiles
- **GET /api/player/:id** - Get complete player profile with:
  - Current hero card
  - Card history
  - Transfer history
  - Current contract
  - Social media links
- **PATCH /api/player/:id/stats** - Update player statistics

## Database Enhancements

New tables utilized:
- `matches` - Match records with scores and status
- `match_events` - Individual events (goals, cards, subs)
- `player_ratings` - Match performance ratings
- `news` - News articles with categories
- `predictions` - User predictions for matches
- `social_media_links` - Player/team social profiles
- `audit_logs` - Staff action tracking

## Key Features

✅ **Real-time Match Tracking**
- Record goals, assists, cards, substitutions
- Update match score and status
- Rate player performance
- Automatically update player statistics

✅ **Dynamic Leaderboards**
- Top scorers, assists, ratings
- League standings with points calculation
- Team performance metrics

✅ **Market Value System**
- AI-suggested calculations based on stats
- Staff confirmation and audit logging
- Value history tracking
- Change explanations

✅ **Community Engagement**
- Match predictions with voting
- Real-time prediction percentages
- News categorization and filtering

✅ **Comprehensive Search**
- Global search across all entities
- Type-specific filtering
- Case-insensitive matching

## Authorization

- **Staff Permissions Required:**
  - `manage_matches` - Create/update matches and events
  - `manage_news` - Publish/edit news
  - `manage_values` - Update player market values
  - `manage_players` - Update player stats

- **Public Access:**
  - View matches, news, statistics
  - View predictions
  - Global search

- **Authenticated Users:**
  - Vote on predictions
  - View enhanced player profiles

## Next Phase: PHASE 3 — HERO SYSTEM

- Hero Card generation and upgrades
- Rating engine with configurable formulas
- Card tier progression (Bronze → Silver → Gold → Elite)
- Special card types (TOTW, MOTM, etc.)
- Card history preservation

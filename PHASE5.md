# PHASE 5: MATCH SYSTEM ✅

## What's Included

### 🟅 Match Lineups & Formations
- **GET /api/match/:match_id/formations** - Get team formations and lineups
- **POST /api/match/:match_id/lineups** - Set lineup and formation (staff)

Lineup Features:
- Formation management (e.g., 4-3-3, 5-2-3)
- Player positions
- Shirt numbers
- JSON lineup storage
- Team-specific formations

### 📋 Match Reports & Statistics
- **GET /api/reports/:match_id** - Get complete match report
- **POST /api/reports** - Create match report (staff)

Report Data:
- Possession percentages (home/away)
- Pass accuracy
- Shots on target
- Fouls and cards
- Top performers
- Man of the Match
- Match summary narrative
- Advanced statistics

### 🔄 Head-to-Head Statistics
- **GET /api/h2h/teams/:team1_id/vs/:team2_id** - Team head-to-head
- **GET /api/h2h/players/:player1_id/vs/:player2_id** - Player head-to-head

Head-to-Head Data:
- Win/loss/draw records
- Direct matchup statistics
- Average goals per game
- Performance in direct matchups
- Recent encounter history
- Goal differences

### 🏆 Prediction Accuracy Tracking
- **GET /api/accuracy/user/:user_id/accuracy** - Individual user accuracy
- **GET /api/accuracy/leaderboard/global** - Global prediction leaderboard
- **POST /api/accuracy/update-after-match/:match_id** - Update predictions after match (staff)

Accuracy Features:
- Correct/incorrect prediction tracking
- Accuracy percentage calculation
- Global leaderboard (top 50)
- Minimum 5 predictions required
- User rankings and statistics
- Automated accuracy updates

## Database Enhancements

**New Tables:**
- `match_lineups` - Team formations and player lineups
- `match_summary` - Match statistics and reports
- `user_predictions` - User prediction tracking and accuracy

**Indexes Added:**
- `idx_match_lineups_match_id`
- `idx_match_summary_match_id`
- `idx_user_predictions_user_id`
- `idx_user_predictions_match_id`
- `idx_user_predictions_correct`

## Key Features

✅ **Advanced Match Tracking**
- Complete lineup management
- Formation recording
- Detailed statistics capture
- Multiple statistic types
- Man of the match selection

✅ **Match Reports**
- Post-match analysis
- Statistical summaries
- Performance metrics
- Key player highlights
- Narrative descriptions

✅ **Head-to-Head Analytics**
- Historical matchup data
- Direct performance comparison
- Team rivalry records
- Player performance in key matchups

✅ **Prediction System**
- User prediction tracking
- Automatic accuracy calculation
- Leaderboard rankings
- Performance statistics
- Competition engagement

## API Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|----------|
| GET | /api/match/:id/formations | Public | View lineups |
| POST | /api/match/:id/lineups | Staff | Set lineup |
| GET | /api/reports/:id | Public | Get report |
| POST | /api/reports | Staff | Create report |
| GET | /api/h2h/teams/:id/:id | Public | Team H2H |
| GET | /api/h2h/players/:id/:id | Public | Player H2H |
| GET | /api/accuracy/user/:id/accuracy | Public | User accuracy |
| GET | /api/accuracy/leaderboard/global | Public | Global board |
| POST | /api/accuracy/update/:id | Staff | Update scores |

## Authorization

- **Staff Permissions Required:**
  - `manage_matches` - Set lineups, create reports, update predictions

- **Public Access:**
  - View lineups and formations
  - View match reports
  - View head-to-head statistics
  - View prediction accuracy and leaderboards

## Workflow

### Before Match
1. Staff sets team formations
2. Staff sets player lineups (positions, shirt numbers)
3. System records lineup for historical reference

### During Match
1. Match events recorded (goals, cards, substitutions)
2. Player ratings updated in real-time
3. Score updates reflected

### After Match
1. Staff creates detailed match report
2. Statistics recorded (possession, passes, shots)
3. Man of the Match selected
4. Match summary written
5. Prediction accuracy automatically calculated
6. User leaderboard updated

## Prediction Accuracy System

**Workflow:**
1. Users make predictions during match preview
2. Predictions stored with user ID and match ID
3. After match completes, staff triggers accuracy update
4. System compares predictions to actual result
5. `prediction_correct` field updated
6. User accuracy percentage calculated
7. Global leaderboard recalculated

**Calculation:**
```
Accuracy = (Correct Predictions / Total Predictions) * 100
```

**Leaderboard Requirements:**
- Minimum 5 total predictions
- Ordered by accuracy (descending)
- Shows top 50 players
- Includes tie-breaking (more predictions)

## Integration Ready

When frontend is built:
- Display lineups before match
- Show live statistics during match
- Display match report after
- View head-to-head records
- Check personal prediction accuracy
- Compete on global leaderboard

## Next Phase: PHASE 6 → MEDIA & NEWS

- News system with images and videos
- Press releases
- Player interviews
- Team announcements
- Social media integration
- Media galleries

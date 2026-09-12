-- PHASE 5: Match System Database Updates

-- Match Lineups Table
CREATE TABLE IF NOT EXISTS match_lineups (
  id SERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id),
  team_id INTEGER NOT NULL REFERENCES teams(id),
  formation VARCHAR(20),
  lineup JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(match_id, team_id)
);

-- Match Summary Table
CREATE TABLE IF NOT EXISTS match_summary (
  id SERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) UNIQUE,
  possession VARCHAR(20),
  pass_accuracy VARCHAR(20),
  shots VARCHAR(20),
  shots_on_target VARCHAR(20),
  match_summary TEXT,
  man_of_match INTEGER REFERENCES players(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User Predictions Table
CREATE TABLE IF NOT EXISTS user_predictions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  match_id INTEGER NOT NULL REFERENCES matches(id),
  prediction VARCHAR(50),
  actual_result VARCHAR(50),
  prediction_correct BOOLEAN,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, match_id)
);

-- Indexes for performance
CREATE INDEX idx_match_lineups_match_id ON match_lineups(match_id);
CREATE INDEX idx_match_summary_match_id ON match_summary(match_id);
CREATE INDEX idx_user_predictions_user_id ON user_predictions(user_id);
CREATE INDEX idx_user_predictions_match_id ON user_predictions(match_id);
CREATE INDEX idx_user_predictions_correct ON user_predictions(prediction_correct);

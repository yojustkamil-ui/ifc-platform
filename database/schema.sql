-- IFC Platform Database Schema

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  discord_id BIGINT UNIQUE,
  username VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  avatar VARCHAR(500),
  role VARCHAR(50) DEFAULT 'user',
  account_status VARCHAR(50) DEFAULT 'active',
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Leagues Table
CREATE TABLE IF NOT EXISTS leagues (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  abbreviation VARCHAR(10),
  country VARCHAR(100),
  logo_url VARCHAR(500),
  founded_year INTEGER,
  description TEXT,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Teams Table
CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  league_id INTEGER NOT NULL REFERENCES leagues(id),
  logo_url VARCHAR(500),
  abbreviation VARCHAR(10),
  manager_id INTEGER REFERENCES users(id),
  assistant_id INTEGER REFERENCES users(id),
  founded_year INTEGER,
  stadium_name VARCHAR(255),
  city VARCHAR(100),
  country VARCHAR(100),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Players Table
CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  user_id INTEGER REFERENCES users(id),
  team_id INTEGER REFERENCES teams(id),
  league_id INTEGER REFERENCES leagues(id),
  position VARCHAR(10),
  shirt_number INTEGER,
  date_of_birth DATE,
  nationality VARCHAR(100),
  photo_url VARCHAR(500),
  rating DECIMAL(5, 2) DEFAULT 75,
  market_value BIGINT DEFAULT 50000,
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  appearances INTEGER DEFAULT 0,
  average_rating DECIMAL(3, 2),
  card_tier VARCHAR(50) DEFAULT 'BRONZE',
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Hero Cards Table
CREATE TABLE IF NOT EXISTS hero_cards (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id),
  card_type VARCHAR(50) DEFAULT 'STANDARD',
  rating DECIMAL(5, 2),
  market_value BIGINT,
  goals INTEGER,
  assists INTEGER,
  appearances INTEGER,
  season VARCHAR(10),
  card_image_url VARCHAR(500),
  is_current BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  archived_at TIMESTAMP
);

-- Contracts Table
CREATE TABLE IF NOT EXISTS contracts (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id),
  team_id INTEGER NOT NULL REFERENCES teams(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  salary BIGINT,
  release_clause BIGINT,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Matches Table
CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  home_team_id INTEGER NOT NULL REFERENCES teams(id),
  away_team_id INTEGER NOT NULL REFERENCES teams(id),
  league_id INTEGER REFERENCES leagues(id),
  match_date TIMESTAMP NOT NULL,
  venue_name VARCHAR(255),
  referee_id INTEGER REFERENCES users(id),
  match_status VARCHAR(50) DEFAULT 'upcoming',
  home_goals INTEGER,
  away_goals INTEGER,
  matchday INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Match Events Table
CREATE TABLE IF NOT EXISTS match_events (
  id SERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id),
  player_id INTEGER REFERENCES players(id),
  event_type VARCHAR(50),
  minute INTEGER,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Player Ratings Table
CREATE TABLE IF NOT EXISTS player_ratings (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id),
  match_id INTEGER REFERENCES matches(id),
  rating DECIMAL(3, 2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Transfers Table
CREATE TABLE IF NOT EXISTS transfers (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id),
  from_team_id INTEGER REFERENCES teams(id),
  to_team_id INTEGER REFERENCES teams(id),
  transfer_fee BIGINT,
  transfer_date DATE,
  transfer_type VARCHAR(50),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Predictions Table
CREATE TABLE IF NOT EXISTS predictions (
  id SERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  prediction VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- News Table
CREATE TABLE IF NOT EXISTS news (
  id SERIAL PRIMARY KEY,
  headline VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  author_id INTEGER NOT NULL REFERENCES users(id),
  category VARCHAR(100),
  cover_image_url VARCHAR(500),
  related_player_id INTEGER REFERENCES players(id),
  related_team_id INTEGER REFERENCES teams(id),
  related_match_id INTEGER REFERENCES matches(id),
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Social Media Links Table
CREATE TABLE IF NOT EXISTS social_media_links (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id),
  team_id INTEGER REFERENCES teams(id),
  platform VARCHAR(50),
  url VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Staff Permissions Table
CREATE TABLE IF NOT EXISTS staff_permissions (
  id SERIAL PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES users(id),
  permission VARCHAR(100),
  granted_at TIMESTAMP DEFAULT NOW()
);

-- Audit Log Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  staff_id INTEGER REFERENCES users(id),
  action VARCHAR(255),
  entity_type VARCHAR(100),
  entity_id INTEGER,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_players_team_id ON players(team_id);
CREATE INDEX idx_players_league_id ON players(league_id);
CREATE INDEX idx_players_rating ON players(rating);
CREATE INDEX idx_teams_league_id ON teams(league_id);
CREATE INDEX idx_matches_home_team_id ON matches(home_team_id);
CREATE INDEX idx_matches_away_team_id ON matches(away_team_id);
CREATE INDEX idx_matches_league_id ON matches(league_id);
CREATE INDEX idx_hero_cards_player_id ON hero_cards(player_id);
CREATE INDEX idx_transfers_player_id ON transfers(player_id);
CREATE INDEX idx_contracts_player_id ON contracts(player_id);
CREATE INDEX idx_contracts_team_id ON contracts(team_id);

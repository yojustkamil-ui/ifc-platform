-- Add Loans Table
CREATE TABLE IF NOT EXISTS loans (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id),
  parent_team_id INTEGER NOT NULL REFERENCES teams(id),
  loan_team_id INTEGER NOT NULL REFERENCES teams(id),
  loan_start DATE NOT NULL,
  loan_end DATE NOT NULL,
  loan_fee BIGINT,
  buy_option BIGINT,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add Discord role requirement to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS discord_roles TEXT[] DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_website_organizer BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS requires_role_verification BOOLEAN DEFAULT TRUE;

-- Add index for loans
CREATE INDEX idx_loans_player_id ON loans(player_id);
CREATE INDEX idx_loans_status ON loans(status);

-- Add transfer history view
CREATE OR REPLACE VIEW player_transfer_history AS
SELECT 
  p.id,
  p.first_name || ' ' || p.last_name as player_name,
  ft.name as from_team,
  tt.name as to_team,
  t.transfer_fee,
  t.transfer_date,
  t.transfer_type,
  t.status
FROM transfers t
JOIN players p ON t.player_id = p.id
LEFT JOIN teams ft ON t.from_team_id = ft.id
LEFT JOIN teams tt ON t.to_team_id = tt.id
ORDER BY t.transfer_date DESC;

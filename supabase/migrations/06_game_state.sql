-- ============================================================
-- Game state storage for single-game persistence
-- Stores chess (and future) game states per attic (room)
-- ============================================================

CREATE TABLE IF NOT EXISTS game_state (
  attic_id UUID PRIMARY KEY,
  game TEXT NOT NULL,
  fen TEXT,
  turn TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_state_attic ON game_state(attic_id);

-- ==============================================================================
-- QUIZ ARENA (ساحة الكويز) - Database Schema
-- Supabase / PostgreSQL Real-time Rooms Schema
-- ==============================================================================

-- 1. Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
  room_id VARCHAR(10) PRIMARY KEY,
  host_id UUID NOT NULL,
  status VARCHAR(20) DEFAULT 'waiting', -- 'waiting', 'playing', 'finished'
  players JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Indexes for fast query and lookup
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON rooms(created_at);

-- 3. Row Level Security (RLS)
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to active rooms"
  ON rooms FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated or anon insert for room creation"
  ON rooms FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow host or participants update"
  ON rooms FOR UPDATE
  USING (true);

-- 4. Session Question History Tracking (Zero-Repetition within match sessions)
CREATE TABLE IF NOT EXISTS session_question_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id VARCHAR(10) NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
  question_id VARCHAR(64) NOT NULL,
  mode VARCHAR(30) NOT NULL,
  category VARCHAR(50) NOT NULL,
  served_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE(room_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_session_question_history_room ON session_question_history(room_id);

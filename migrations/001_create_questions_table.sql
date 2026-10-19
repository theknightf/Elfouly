-- Migration: 001_create_questions_table.sql
-- Description: Create questions table and performance indexes for QUIZ ARENA (ساحة الكويز)

CREATE TABLE IF NOT EXISTS questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mode VARCHAR(50) NOT NULL, -- 'one_two_bank', 'edini_fi_seri', 'hat_fi_qoraybi', 'meen_yezawwed'
  category VARCHAR(100) NOT NULL,
  question_text TEXT,
  correct_answer TEXT,
  options JSONB, -- For multiple-choice modes
  forbidden_words JSONB, -- For 'edini_fi_seri'
  acceptable_answers JSONB, -- For 'meen_yezawwed'
  content_hash VARCHAR(64) UNIQUE,
  is_post_2010_football BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_questions_mode_cat ON questions(mode, category);
CREATE INDEX IF NOT EXISTS idx_questions_content_hash ON questions(content_hash);

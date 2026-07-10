-- ================================================================
-- GreenFlame — Swahili Learning Engine
-- 047_swahili_learning.sql
-- ================================================================

-- ── Words ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS swahili_words (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  swahili       text        NOT NULL,
  french        text        NOT NULL,
  english       text        NOT NULL,
  theme         text        NOT NULL CHECK (theme IN ('commerce','greetings','numbers','community','food','philosophy')),
  difficulty    int         NOT NULL DEFAULT 1 CHECK (difficulty IN (1,2,3)),
  example_sw    text,
  example_fr    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Lessons ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS swahili_lessons (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text        NOT NULL UNIQUE,
  title_fr      text        NOT NULL,
  title_en      text        NOT NULL,
  subtitle_fr   text,
  subtitle_en   text,
  theme         text        NOT NULL,
  level         int         NOT NULL DEFAULT 1,
  emoji         text        NOT NULL DEFAULT '🌍',
  position      int         NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS swahili_lesson_words (
  lesson_id     uuid        NOT NULL REFERENCES swahili_lessons(id) ON DELETE CASCADE,
  word_id       uuid        NOT NULL REFERENCES swahili_words(id)   ON DELETE CASCADE,
  position      int         NOT NULL DEFAULT 0,
  PRIMARY KEY (lesson_id, word_id)
);

-- ── User progress (spaced repetition SM-2) ───────────────────────
CREATE TABLE IF NOT EXISTS user_swahili_progress (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word_id         uuid        NOT NULL REFERENCES swahili_words(id) ON DELETE CASCADE,
  ease_factor     numeric     NOT NULL DEFAULT 2.5,
  interval_days   int         NOT NULL DEFAULT 1,
  repetitions     int         NOT NULL DEFAULT 0,
  next_review_at  timestamptz NOT NULL DEFAULT now(),
  last_reviewed_at timestamptz,
  UNIQUE (user_id, word_id)
);

-- ── User streaks & XP ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_swahili_streaks (
  user_id           uuid  PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak    int   NOT NULL DEFAULT 0,
  longest_streak    int   NOT NULL DEFAULT 0,
  last_activity_date date,
  xp_total          int   NOT NULL DEFAULT 0,
  words_learned     int   NOT NULL DEFAULT 0,
  lessons_completed int   NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ── Completed lessons log ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_swahili_completions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id   uuid        NOT NULL REFERENCES swahili_lessons(id) ON DELETE CASCADE,
  score       int         NOT NULL DEFAULT 0,
  xp_earned   int         NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE swahili_words           ENABLE ROW LEVEL SECURITY;
ALTER TABLE swahili_lessons         ENABLE ROW LEVEL SECURITY;
ALTER TABLE swahili_lesson_words    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_swahili_progress   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_swahili_streaks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_swahili_completions ENABLE ROW LEVEL SECURITY;

-- Words and lessons are public (read-only for everyone)
DROP POLICY IF EXISTS "words_public_read" ON swahili_words;
CREATE POLICY "words_public_read"        ON swahili_words         FOR SELECT USING (true);
DROP POLICY IF EXISTS "lessons_public_read" ON swahili_lessons;
CREATE POLICY "lessons_public_read"      ON swahili_lessons       FOR SELECT USING (true);
DROP POLICY IF EXISTS "lesson_words_public_read" ON swahili_lesson_words;
CREATE POLICY "lesson_words_public_read" ON swahili_lesson_words  FOR SELECT USING (true);

-- Progress: own rows only
DROP POLICY IF EXISTS "progress_own" ON user_swahili_progress;
CREATE POLICY "progress_own"    ON user_swahili_progress    FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "streaks_own" ON user_swahili_streaks;
CREATE POLICY "streaks_own"     ON user_swahili_streaks     FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "completions_own" ON user_swahili_completions;
CREATE POLICY "completions_own" ON user_swahili_completions FOR ALL USING (auth.uid() = user_id);

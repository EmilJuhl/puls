-- =============================================================
-- MIGRATION 004 — Kost-feature med AI-billedanalyse
--
-- Tilføjer:
--   1. meals tabel — AI-analyserede måltider med point
--   2. checkin_id nullable i daily_scores — kost kan eksistere uden checkin
--   3. kost_score kolonne i daily_scores
--   4. Opdateret calculate_and_upsert_score() — bevarer kost_score ved checkin
--   5. Opdaterede leaderboard views med kost_score
--   6. Opdateret spider_chart_7d med kost_pct
--   7. RLS policies for meals
--   8. Realtime for meals
-- =============================================================


-- =============================================================
-- 1. MEALS TABEL
-- =============================================================

CREATE TABLE IF NOT EXISTS meals (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date                DATE    NOT NULL DEFAULT CURRENT_DATE,
  image_url           TEXT    NOT NULL,
  meal_name           TEXT,
  has_vegetables      BOOLEAN DEFAULT FALSE,
  has_protein_source  BOOLEAN DEFAULT FALSE,
  has_fruit           BOOLEAN DEFAULT FALSE,
  is_ultra_processed  BOOLEAN DEFAULT FALSE,
  is_homemade         BOOLEAN DEFAULT FALSE,
  meal_quality        TEXT    CHECK (meal_quality IN ('good', 'mid', 'bad')),
  ai_confidence       TEXT    CHECK (ai_confidence IN ('high', 'medium', 'low')),
  items_detected      JSONB   DEFAULT '[]',
  meal_score          SMALLINT DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meals_user_date ON meals(user_id, date DESC);


-- =============================================================
-- 2. DAILY_SCORES — checkin_id nullable + kost_score kolonne
-- =============================================================

ALTER TABLE daily_scores ALTER COLUMN checkin_id DROP NOT NULL;

ALTER TABLE daily_scores ADD COLUMN IF NOT EXISTS kost_score SMALLINT DEFAULT 0;


-- =============================================================
-- 3. OPDATER SCORE-TRIGGER — bevar kost_score ved checkin-opdateringer
--    (kost_score beregnes af Edge Function, ikke af denne trigger)
-- =============================================================

CREATE OR REPLACE FUNCTION public.calculate_and_upsert_score()
RETURNS TRIGGER AS $$
DECLARE
  v_sleep     SMALLINT := 0;
  v_fysik     SMALLINT := 0;
  v_disciplin SMALLINT := 0;
  v_screen    SMALLINT := 0;
  v_hygiejne  SMALLINT := 0;
  v_kost      SMALLINT := 0;
  v_total     SMALLINT := 0;
BEGIN

  -- ================================================================
  -- SØVN (max 15p)
  -- Optimal søvn for 17-18-årige: 9-10 timer
  -- ================================================================

  IF NEW.sleep_hours >= 9.0 AND NEW.sleep_hours <= 10.0 THEN
    v_sleep := 10;
  ELSIF (NEW.sleep_hours >= 8.0 AND NEW.sleep_hours < 9.0)
     OR (NEW.sleep_hours > 10.0 AND NEW.sleep_hours <= 11.0) THEN
    v_sleep := 7;
  ELSIF (NEW.sleep_hours >= 7.0 AND NEW.sleep_hours < 8.0)
     OR (NEW.sleep_hours > 11.0 AND NEW.sleep_hours <= 12.0) THEN
    v_sleep := 4;
  ELSE
    v_sleep := 1;
  END IF;

  IF NEW.sleep_consistent = TRUE THEN
    v_sleep := v_sleep + 5;
  END IF;


  -- ================================================================
  -- FYSIK (max 30p)
  -- ================================================================

  IF NEW.steps >= 12000 THEN
    v_fysik := v_fysik + 10;
  ELSIF NEW.steps >= 7000 THEN
    v_fysik := v_fysik + 8;
  ELSIF NEW.steps >= 3000 THEN
    v_fysik := v_fysik + 5;
  END IF;

  IF NEW.strength_minutes >= 45 THEN
    v_fysik := v_fysik + 10;
  ELSIF NEW.strength_minutes >= 20 THEN
    v_fysik := v_fysik + 8;
  ELSIF NEW.strength_minutes >= 1 THEN
    v_fysik := v_fysik + 5;
  END IF;

  IF NEW.cardio_minutes >= 30 THEN
    v_fysik := v_fysik + 10;
  ELSIF NEW.cardio_minutes >= 15 THEN
    v_fysik := v_fysik + 8;
  ELSIF NEW.cardio_minutes >= 1 THEN
    v_fysik := v_fysik + 5;
  END IF;


  -- ================================================================
  -- DISCIPLIN (max 35p, kan gå i minus)
  -- ================================================================

  IF NEW.homework_done = TRUE THEN
    v_disciplin := v_disciplin + 8;
  END IF;

  IF NEW.on_time = TRUE THEN
    v_disciplin := v_disciplin + 5;
  END IF;

  IF NEW.skipped_class = TRUE THEN
    v_disciplin := v_disciplin - 10;
  END IF;

  IF NEW.earned_money = TRUE THEN
    v_disciplin := v_disciplin + 5;
  END IF;

  IF NEW.saved_money = TRUE AND NEW.earned_money = TRUE THEN
    v_disciplin := v_disciplin + 7;
  END IF;

  IF NEW.reading_minutes >= 45 THEN
    v_disciplin := v_disciplin + 10;
  ELSIF NEW.reading_minutes >= 20 THEN
    v_disciplin := v_disciplin + 6;
  ELSIF NEW.reading_minutes >= 1 THEN
    v_disciplin := v_disciplin + 3;
  END IF;


  -- ================================================================
  -- SKÆRM (max 15p, kan gå i minus)
  -- ================================================================

  IF NEW.passive_screen_hours <= 2 THEN
    v_screen := v_screen + 5;
  ELSIF NEW.passive_screen_hours <= 4 THEN
    v_screen := v_screen + 2;
  ELSIF NEW.passive_screen_hours <= 6 THEN
    v_screen := v_screen + 0;
  ELSE
    v_screen := v_screen - 3;
  END IF;

  IF NEW.doomscroll_minutes <= 15 THEN
    v_screen := v_screen + 5;
  ELSIF NEW.doomscroll_minutes <= 45 THEN
    v_screen := v_screen + 2;
  ELSIF NEW.doomscroll_minutes <= 90 THEN
    v_screen := v_screen + 0;
  ELSE
    v_screen := v_screen - 5;
  END IF;

  IF NEW.no_porn = TRUE THEN
    v_screen := v_screen + 5;
  END IF;


  -- ================================================================
  -- HYGIEJNE (max 9p)
  -- ================================================================

  IF NEW.brushed_teeth = 2 THEN
    v_hygiejne := v_hygiejne + 4;
  ELSIF NEW.brushed_teeth = 1 THEN
    v_hygiejne := v_hygiejne + 2;
  END IF;

  IF NEW.flossed = TRUE THEN
    v_hygiejne := v_hygiejne + 2;
  END IF;

  IF NEW.cold_shower = TRUE THEN
    v_hygiejne := v_hygiejne + 3;
  END IF;


  -- ================================================================
  -- KOST — hent eksisterende kost_score (beregnes af Edge Function)
  -- ================================================================

  SELECT COALESCE(kost_score, 0) INTO v_kost
  FROM daily_scores
  WHERE user_id = NEW.user_id AND date = NEW.date;


  -- ================================================================
  -- TOTALSCORE
  -- ================================================================

  v_total := v_sleep + v_fysik + v_disciplin + v_screen + v_hygiejne + v_kost;

  INSERT INTO daily_scores (
    user_id, date, checkin_id,
    sleep_score, fysik_score, disciplin_score,
    screen_score, hygiejne_score, kost_score,
    total_score
  )
  VALUES (
    NEW.user_id, NEW.date, NEW.id,
    v_sleep, v_fysik, v_disciplin,
    v_screen, v_hygiejne, v_kost,
    v_total
  )
  ON CONFLICT (user_id, date) DO UPDATE SET
    checkin_id      = NEW.id,
    sleep_score     = v_sleep,
    fysik_score     = v_fysik,
    disciplin_score = v_disciplin,
    screen_score    = v_screen,
    hygiejne_score  = v_hygiejne,
    -- kost_score bevares som-er (opdateres kun af Edge Function)
    total_score     = v_total;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================
-- 4. OPDATER LEADERBOARD VIEWS med kost_score
-- =============================================================

DROP VIEW IF EXISTS spider_chart_7d;
DROP VIEW IF EXISTS leaderboard_30d;
DROP VIEW IF EXISTS leaderboard_today;
DROP VIEW IF EXISTS leaderboard_7d;

CREATE VIEW leaderboard_7d AS
SELECT
  p.id           AS user_id,
  p.display_name,
  p.emoji_avatar,
  p.avatar_config,
  COALESCE(SUM(s.total_score), 0)               AS week_score,
  COALESCE(AVG(s.total_score), 0)::NUMERIC(5,1) AS avg_daily_score,
  COALESCE(SUM(s.sleep_score), 0)     AS week_sleep,
  COALESCE(SUM(s.fysik_score), 0)     AS week_fysik,
  COALESCE(SUM(s.disciplin_score), 0) AS week_disciplin,
  COALESCE(SUM(s.screen_score), 0)    AS week_screen,
  COALESCE(SUM(s.hygiejne_score), 0)  AS week_hygiejne,
  COALESCE(SUM(s.kost_score), 0)      AS week_kost,
  COUNT(s.id) AS days_checked_in,
  RANK() OVER (ORDER BY COALESCE(SUM(s.total_score), 0) DESC) AS rank
FROM profiles p
LEFT JOIN daily_scores s
  ON s.user_id = p.id
  AND s.date >= CURRENT_DATE - INTERVAL '6 days'
GROUP BY p.id, p.display_name, p.emoji_avatar, p.avatar_config;

CREATE VIEW leaderboard_today AS
SELECT
  p.id           AS user_id,
  p.display_name,
  p.emoji_avatar,
  p.avatar_config,
  COALESCE(s.total_score, 0)     AS day_score,
  COALESCE(s.sleep_score, 0)     AS day_sleep,
  COALESCE(s.fysik_score, 0)     AS day_fysik,
  COALESCE(s.disciplin_score, 0) AS day_disciplin,
  COALESCE(s.screen_score, 0)    AS day_screen,
  COALESCE(s.hygiejne_score, 0)  AS day_hygiejne,
  COALESCE(s.kost_score, 0)      AS day_kost,
  CASE WHEN s.id IS NOT NULL THEN 1 ELSE 0 END AS days_checked_in,
  RANK() OVER (ORDER BY COALESCE(s.total_score, 0) DESC) AS rank
FROM profiles p
LEFT JOIN daily_scores s
  ON s.user_id = p.id AND s.date = CURRENT_DATE;

CREATE VIEW leaderboard_30d AS
SELECT
  p.id           AS user_id,
  p.display_name,
  p.emoji_avatar,
  p.avatar_config,
  COALESCE(SUM(s.total_score), 0)               AS month_score,
  COALESCE(AVG(s.total_score), 0)::NUMERIC(5,1) AS avg_daily_score,
  COALESCE(SUM(s.sleep_score), 0)     AS month_sleep,
  COALESCE(SUM(s.fysik_score), 0)     AS month_fysik,
  COALESCE(SUM(s.disciplin_score), 0) AS month_disciplin,
  COALESCE(SUM(s.screen_score), 0)    AS month_screen,
  COALESCE(SUM(s.hygiejne_score), 0)  AS month_hygiejne,
  COALESCE(SUM(s.kost_score), 0)      AS month_kost,
  COUNT(s.id) AS days_checked_in,
  RANK() OVER (ORDER BY COALESCE(SUM(s.total_score), 0) DESC) AS rank
FROM profiles p
LEFT JOIN daily_scores s
  ON s.user_id = p.id
  AND s.date >= CURRENT_DATE - INTERVAL '29 days'
GROUP BY p.id, p.display_name, p.emoji_avatar, p.avatar_config;

-- Spider chart — kost max ~20p/dag → 140p/uge
CREATE VIEW spider_chart_7d AS
SELECT
  p.id           AS user_id,
  p.display_name,
  p.emoji_avatar,
  p.avatar_config,
  LEAST(100, GREATEST(0,
    ROUND(COALESCE(SUM(s.sleep_score), 0)::NUMERIC / (15 * 7) * 100)
  )) AS sleep_pct,
  LEAST(100, GREATEST(0,
    ROUND(COALESCE(SUM(s.fysik_score), 0)::NUMERIC / (30 * 7) * 100)
  )) AS fysik_pct,
  LEAST(100, GREATEST(0,
    ROUND(COALESCE(SUM(s.disciplin_score), 0)::NUMERIC / (35 * 7) * 100)
  )) AS disciplin_pct,
  LEAST(100, GREATEST(0,
    ROUND(COALESCE(SUM(s.screen_score), 0)::NUMERIC / (15 * 7) * 100)
  )) AS screen_pct,
  LEAST(100, GREATEST(0,
    ROUND(COALESCE(SUM(s.hygiejne_score), 0)::NUMERIC / (9 * 7) * 100)
  )) AS hygiejne_pct,
  LEAST(100, GREATEST(0,
    ROUND(COALESCE(SUM(s.kost_score), 0)::NUMERIC / (20 * 7) * 100)
  )) AS kost_pct
FROM profiles p
LEFT JOIN daily_scores s
  ON s.user_id = p.id
  AND s.date >= CURRENT_DATE - INTERVAL '6 days'
GROUP BY p.id, p.display_name, p.emoji_avatar, p.avatar_config;


-- =============================================================
-- 5. RLS FOR MEALS
-- =============================================================

ALTER TABLE meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alle ser måltider"
  ON meals FOR SELECT USING (true);

CREATE POLICY "Opret egne måltider"
  ON meals FOR INSERT WITH CHECK (auth.uid() = user_id);


-- =============================================================
-- 6. REALTIME FOR MEALS
-- =============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE meals;

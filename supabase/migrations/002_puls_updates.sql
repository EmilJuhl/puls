-- =============================================================
-- MIGRATION 002 — Puls App Updates
--
-- Ændringer:
--   1. Søvn-scoring opdateret til optimal 9-10 timer
--   2. RLS: checkins kan redigeres i dag og i går
--   3. Nye leaderboard views: leaderboard_today + leaderboard_30d
--   4. Eksisterende views opdateret med avatar_config
--   5. avatar_config JSONB kolonne tilføjet til profiles
-- =============================================================


-- =============================================================
-- 1. SØVN SCORING — opdater triggerfunktionen
--    Optimal er nu 9-10 timer (17-18-årige)
--    9-10t: 10p | 8-9t/10-11t: 7p | 7-8t/11-12t: 4p | ellers: 1p
-- =============================================================

CREATE OR REPLACE FUNCTION public.calculate_and_upsert_score()
RETURNS TRIGGER AS $$
DECLARE
  v_sleep     SMALLINT := 0;
  v_fysik     SMALLINT := 0;
  v_disciplin SMALLINT := 0;
  v_screen    SMALLINT := 0;
  v_hygiejne  SMALLINT := 0;
  v_total     SMALLINT := 0;
BEGIN

  -- ================================================================
  -- SØVN (max 15p)
  -- Optimal søvn for 17-18-årige: 9-10 timer
  -- ================================================================

  -- Timer: 10p for optimal (9-10t), 7p for næsten-optimal, 4p for acceptabel, 1p ellers
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

  -- Konsistent vækketid (±30 min af fast tid): 5p bonus
  IF NEW.sleep_consistent = TRUE THEN
    v_sleep := v_sleep + 5;
  END IF;


  -- ================================================================
  -- FYSIK (max 30p — alle tre underkategorier vægtes ens: max 10p hver)
  -- ================================================================

  -- Skridt: 0-3k=0, 3-7k=5, 7-12k=8, 12k+=10
  IF NEW.steps >= 12000 THEN
    v_fysik := v_fysik + 10;
  ELSIF NEW.steps >= 7000 THEN
    v_fysik := v_fysik + 8;
  ELSIF NEW.steps >= 3000 THEN
    v_fysik := v_fysik + 5;
  END IF;

  -- Styrketræning: 0min=0, 1-20min=5, 20-45min=8, 45+=10
  IF NEW.strength_minutes >= 45 THEN
    v_fysik := v_fysik + 10;
  ELSIF NEW.strength_minutes >= 20 THEN
    v_fysik := v_fysik + 8;
  ELSIF NEW.strength_minutes >= 1 THEN
    v_fysik := v_fysik + 5;
  END IF;

  -- Cardio: 0min=0, 1-15min=5, 15-30min=8, 30+=10
  IF NEW.cardio_minutes >= 30 THEN
    v_fysik := v_fysik + 10;
  ELSIF NEW.cardio_minutes >= 15 THEN
    v_fysik := v_fysik + 8;
  ELSIF NEW.cardio_minutes >= 1 THEN
    v_fysik := v_fysik + 5;
  END IF;


  -- ================================================================
  -- DISCIPLIN (max 35p, kan gå i minus pga. skippet modul)
  -- ================================================================

  -- Lektier lavet: 8p
  IF NEW.homework_done = TRUE THEN
    v_disciplin := v_disciplin + 8;
  END IF;

  -- Mødt til tiden: 5p
  IF NEW.on_time = TRUE THEN
    v_disciplin := v_disciplin + 5;
  END IF;

  -- Skippet et modul: -10p
  IF NEW.skipped_class = TRUE THEN
    v_disciplin := v_disciplin - 10;
  END IF;

  -- Tjente penge i dag: 5p
  IF NEW.earned_money = TRUE THEN
    v_disciplin := v_disciplin + 5;
  END IF;

  -- Satte penge til side — kun bonus hvis man rent faktisk tjente noget: +7p
  IF NEW.saved_money = TRUE AND NEW.earned_money = TRUE THEN
    v_disciplin := v_disciplin + 7;
  END IF;

  -- Læsning: 0min=0, 1-20min=3, 20-45min=6, 45+=10
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

  -- Passivt skærmbrug: ≤2t=5, 2-4t=2, 4-6t=0, 6t+=-3
  IF NEW.passive_screen_hours <= 2 THEN
    v_screen := v_screen + 5;
  ELSIF NEW.passive_screen_hours <= 4 THEN
    v_screen := v_screen + 2;
  ELSIF NEW.passive_screen_hours <= 6 THEN
    v_screen := v_screen + 0;
  ELSE
    v_screen := v_screen - 3;
  END IF;

  -- Doomscrolling: ≤15min=5, 15-45min=2, 45-90min=0, 90min+=-5
  IF NEW.doomscroll_minutes <= 15 THEN
    v_screen := v_screen + 5;
  ELSIF NEW.doomscroll_minutes <= 45 THEN
    v_screen := v_screen + 2;
  ELSIF NEW.doomscroll_minutes <= 90 THEN
    v_screen := v_screen + 0;
  ELSE
    v_screen := v_screen - 5;
  END IF;

  -- Ingen pornografi: 5p
  IF NEW.no_porn = TRUE THEN
    v_screen := v_screen + 5;
  END IF;


  -- ================================================================
  -- HYGIEJNE (max 9p)
  -- ================================================================

  -- Børstede tænder: 2x=4p, 1x=2p, 0x=0p
  IF NEW.brushed_teeth = 2 THEN
    v_hygiejne := v_hygiejne + 4;
  ELSIF NEW.brushed_teeth = 1 THEN
    v_hygiejne := v_hygiejne + 2;
  END IF;

  -- Tandtråd: 2p
  IF NEW.flossed = TRUE THEN
    v_hygiejne := v_hygiejne + 2;
  END IF;

  -- Koldt bad: 3p
  IF NEW.cold_shower = TRUE THEN
    v_hygiejne := v_hygiejne + 3;
  END IF;


  -- ================================================================
  -- TOTALSCORE
  -- ================================================================

  v_total := v_sleep + v_fysik + v_disciplin + v_screen + v_hygiejne;

  INSERT INTO daily_scores (
    user_id, date, checkin_id,
    sleep_score, fysik_score, disciplin_score,
    screen_score, hygiejne_score,
    total_score
  )
  VALUES (
    NEW.user_id, NEW.date, NEW.id,
    v_sleep, v_fysik, v_disciplin,
    v_screen, v_hygiejne,
    v_total
  )
  ON CONFLICT (user_id, date) DO UPDATE SET
    checkin_id      = NEW.id,
    sleep_score     = v_sleep,
    fysik_score     = v_fysik,
    disciplin_score = v_disciplin,
    screen_score    = v_screen,
    hygiejne_score  = v_hygiejne,
    total_score     = v_total;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================
-- 2. RLS — Tillad redigering af i dag OG i går
-- =============================================================

DROP POLICY IF EXISTS "Brugere kan opdatere egne checkins" ON daily_checkins;
CREATE POLICY "Brugere kan opdatere egne checkins"
  ON daily_checkins FOR UPDATE
  USING (auth.uid() = user_id AND date >= CURRENT_DATE - INTERVAL '1 day');

DROP POLICY IF EXISTS "Brugere kan oprette egne checkins" ON daily_checkins;
CREATE POLICY "Brugere kan oprette egne checkins"
  ON daily_checkins FOR INSERT
  WITH CHECK (auth.uid() = user_id AND date >= CURRENT_DATE - INTERVAL '1 day');


-- =============================================================
-- 3. AVATAR CONFIG — Tilføj JSONB kolonne til profiles
-- =============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_config JSONB DEFAULT NULL;


-- =============================================================
-- 4. LEADERBOARD VIEWS — Opdater med avatar_config + nye views
--
-- DROP først fordi CREATE OR REPLACE ikke kan ændre kolonnerækkefølge
-- (ville forsøge at indsætte avatar_config mellem eksisterende kolonner)
-- =============================================================

DROP VIEW IF EXISTS spider_chart_7d;
DROP VIEW IF EXISTS leaderboard_7d;

-- Opdater eksisterende uge-view med avatar_config
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
  COUNT(s.id) AS days_checked_in,
  RANK() OVER (ORDER BY COALESCE(SUM(s.total_score), 0) DESC) AS rank
FROM profiles p
LEFT JOIN daily_scores s
  ON s.user_id = p.id
  AND s.date >= CURRENT_DATE - INTERVAL '6 days'
GROUP BY p.id, p.display_name, p.emoji_avatar, p.avatar_config;

-- Dag-view (kun i dag)
DROP VIEW IF EXISTS leaderboard_today;
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
  CASE WHEN s.id IS NOT NULL THEN 1 ELSE 0 END AS days_checked_in,
  RANK() OVER (ORDER BY COALESCE(s.total_score, 0) DESC) AS rank
FROM profiles p
LEFT JOIN daily_scores s
  ON s.user_id = p.id AND s.date = CURRENT_DATE;

-- Måned-view (rullende 30 dage)
DROP VIEW IF EXISTS leaderboard_30d;
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
  COUNT(s.id) AS days_checked_in,
  RANK() OVER (ORDER BY COALESCE(SUM(s.total_score), 0) DESC) AS rank
FROM profiles p
LEFT JOIN daily_scores s
  ON s.user_id = p.id
  AND s.date >= CURRENT_DATE - INTERVAL '29 days'
GROUP BY p.id, p.display_name, p.emoji_avatar, p.avatar_config;

-- Spider chart view (spider_chart_7d er allerede droppet ovenfor)
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
  )) AS hygiejne_pct
FROM profiles p
LEFT JOIN daily_scores s
  ON s.user_id = p.id
  AND s.date >= CURRENT_DATE - INTERVAL '6 days'
GROUP BY p.id, p.display_name, p.emoji_avatar, p.avatar_config;

-- =============================================================
-- Livspoint -- Initial Database Schema
-- Migration: 001_initial_schema.sql
--
-- Indeholder:
--   1. Profiles tabel + auto-opret trigger
--   2. Daily checkins tabel med alle sundhedsfelter
--   3. Daily scores tabel med auto-beregning via trigger
--   4. Leaderboard view (rullende 7 dage)
--   5. Row Level Security (RLS) policies
--   6. Realtime aktivering
-- =============================================================


-- =============================================================
-- 1. PROFILES -- Udvider auth.users med app-data
-- =============================================================

CREATE TABLE profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  emoji_avatar TEXT DEFAULT '🌱',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger-funktion: opretter automatisk en profil nar ny bruger registrerer sig
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'Spiller')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: kor handle_new_user() efter hvert INSERT i auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =============================================================
-- 2. DAILY CHECKINS -- En row per bruger per dag
-- =============================================================

CREATE TABLE daily_checkins (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date    DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Sovn (vegtet ca. 20% af total score)
  sleep_hours      NUMERIC(3,1) CHECK (sleep_hours BETWEEN 0 AND 24),
  sleep_quality    SMALLINT     CHECK (sleep_quality BETWEEN 1 AND 10),
  sleep_consistent BOOLEAN      DEFAULT FALSE,

  -- Motion (vegtet ca. 25% af total score)
  steps            INTEGER DEFAULT 0 CHECK (steps >= 0),
  strength_minutes INTEGER DEFAULT 0 CHECK (strength_minutes >= 0),
  cardio_minutes   INTEGER DEFAULT 0 CHECK (cardio_minutes >= 0),

  -- Kost / Ernaering (vegtet ca. 20% af total score)
  fiber_grams        INTEGER      DEFAULT 0 CHECK (fiber_grams >= 0),
  upf_free           BOOLEAN      DEFAULT FALSE,
  fruit_veg_portions SMALLINT     DEFAULT 0 CHECK (fruit_veg_portions >= 0),
  alcohol_units      NUMERIC(3,1) DEFAULT 0 CHECK (alcohol_units >= 0),

  -- Socialt og mental sundhed (vegtet ca. 15% af total score)
  social_conversation BOOLEAN DEFAULT FALSE,
  meditation          BOOLEAN DEFAULT FALSE,

  -- Skaerm og natur (vegtet ca. 10% af total score)
  passive_screen_hours NUMERIC(3,1) DEFAULT 0,
  nature_walk          BOOLEAN      DEFAULT FALSE,

  -- Hormesis og vedligehold (vegtet ca. 10% af total score)
  flossed       BOOLEAN DEFAULT FALSE,
  sauna         BOOLEAN DEFAULT FALSE,
  cold_exposure BOOLEAN DEFAULT FALSE,
  vitamin_d     BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Forhindrer dobbelt-tjek-ind samme dag
  UNIQUE(user_id, date)
);

-- Index til hurtige opslag per bruger
CREATE INDEX idx_checkins_user_date ON daily_checkins(user_id, date DESC);

-- Index til leaderboard-queries
CREATE INDEX idx_checkins_date ON daily_checkins(date DESC);


-- =============================================================
-- 3. DAILY SCORES -- Beregnede scores per bruger per dag
-- =============================================================

CREATE TABLE daily_scores (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  checkin_id UUID NOT NULL REFERENCES daily_checkins(id) ON DELETE CASCADE,

  -- Kategori-scores (beregnes automatisk af trigger nedenfor)
  motion_score    SMALLINT DEFAULT 0,
  sleep_score     SMALLINT DEFAULT 0,
  nutrition_score SMALLINT DEFAULT 0,
  social_score    SMALLINT DEFAULT 0,
  hormesis_score  SMALLINT DEFAULT 0,
  screen_score    SMALLINT DEFAULT 0,

  -- Totalscore saettes eksplicit af triggeren (sum af alle kategorier)
  total_score SMALLINT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- En score-row per bruger per dag
  UNIQUE(user_id, date)
);

-- Index til brugerspecifikke score-opslag
CREATE INDEX idx_scores_user_date ON daily_scores(user_id, date DESC);

-- Index til leaderboard-sortering (nyeste dag, hoejest score)
CREATE INDEX idx_scores_date_total ON daily_scores(date DESC, total_score DESC);


-- =============================================================
-- 4. SCORE-BEREGNING -- Trigger-funktion der korer ved checkin
-- =============================================================

CREATE OR REPLACE FUNCTION public.calculate_and_upsert_score()
RETURNS TRIGGER AS $$
DECLARE
  v_motion    SMALLINT := 0;
  v_sleep     SMALLINT := 0;
  v_nutrition SMALLINT := 0;
  v_social    SMALLINT := 0;
  v_hormesis  SMALLINT := 0;
  v_screen    SMALLINT := 0;
  v_total     SMALLINT := 0;
BEGIN

  -- === MOTION (max ca. 50p) ===

  -- Skridt: 15p for 12000+, 10p for 7000+, 5p for 3000+
  IF NEW.steps >= 12000 THEN
    v_motion := 15;
  ELSIF NEW.steps >= 7000 THEN
    v_motion := 10;
  ELSIF NEW.steps >= 3000 THEN
    v_motion := 5;
  END IF;

  -- Styrketraening: op til 20p (1p per 3 min, maks 60 min taeller)
  v_motion := v_motion + (LEAST(NEW.strength_minutes, 60) / 3);

  -- Cardio: 15p for 60+ min, 10p for 30+, 5p for 15+
  IF NEW.cardio_minutes >= 60 THEN
    v_motion := v_motion + 15;
  ELSIF NEW.cardio_minutes >= 30 THEN
    v_motion := v_motion + 10;
  ELSIF NEW.cardio_minutes >= 15 THEN
    v_motion := v_motion + 5;
  END IF;

  -- === SOVN (max 20p) ===

  -- Timer: 10p for optimal (7-8t), 6p for naesten-optimal, 2p for resten
  IF NEW.sleep_hours >= 7.0 AND NEW.sleep_hours <= 8.0 THEN
    v_sleep := 10;
  ELSIF (NEW.sleep_hours >= 6.0 AND NEW.sleep_hours < 7.0)
     OR (NEW.sleep_hours > 8.0 AND NEW.sleep_hours <= 9.0) THEN
    v_sleep := 6;
  ELSE
    v_sleep := 2;
  END IF;

  -- Sovnkvalitet: 5p for hoj (8-10), 3p for middel (5-7)
  IF NEW.sleep_quality >= 8 THEN
    v_sleep := v_sleep + 5;
  ELSIF NEW.sleep_quality >= 5 THEN
    v_sleep := v_sleep + 3;
  END IF;

  -- Konsistent sengetid: 5p bonus
  IF NEW.sleep_consistent = TRUE THEN
    v_sleep := v_sleep + 5;
  END IF;

  -- === ERNAERING (max 25p) ===

  -- Ingen ultra-forarbejdede fodevarer: 10p
  IF NEW.upf_free = TRUE THEN
    v_nutrition := v_nutrition + 10;
  END IF;

  -- Fiber: 10p for 25g+, 5p for 15g+
  IF NEW.fiber_grams >= 25 THEN
    v_nutrition := v_nutrition + 10;
  ELSIF NEW.fiber_grams >= 15 THEN
    v_nutrition := v_nutrition + 5;
  END IF;

  -- Frugt og gronsager: 5p for 5+ portioner, 3p for 3+
  IF NEW.fruit_veg_portions >= 5 THEN
    v_nutrition := v_nutrition + 5;
  ELSIF NEW.fruit_veg_portions >= 3 THEN
    v_nutrition := v_nutrition + 3;
  END IF;

  -- === SOCIALT OG MENTAL (max 15p) ===

  IF NEW.social_conversation = TRUE THEN
    v_social := v_social + 10;
  END IF;

  IF NEW.meditation = TRUE THEN
    v_social := v_social + 5;
  END IF;

  -- === HORMESIS OG VEDLIGEHOLD (max 12p) ===

  IF NEW.flossed = TRUE THEN
    v_hormesis := v_hormesis + 2;
  END IF;

  IF NEW.sauna = TRUE THEN
    v_hormesis := v_hormesis + 5;
  END IF;

  IF NEW.cold_exposure = TRUE THEN
    v_hormesis := v_hormesis + 3;
  END IF;

  IF NEW.vitamin_d = TRUE THEN
    v_hormesis := v_hormesis + 2;
  END IF;

  -- === SKAERM OG NATUR (max 10p) ===

  -- Passivt skaermbrug: 5p for under 3 timer, 2p for under 6 timer
  IF NEW.passive_screen_hours <= 3 THEN
    v_screen := 5;
  ELSIF NEW.passive_screen_hours <= 6 THEN
    v_screen := 2;
  END IF;

  IF NEW.nature_walk = TRUE THEN
    v_screen := v_screen + 5;
  END IF;

  -- Beregn totalscore som sum af alle kategorier
  v_total := v_motion + v_sleep + v_nutrition + v_social + v_hormesis + v_screen;

  -- Gem eller opdater score-row (UPSERT ved duplicate user_id + date)
  INSERT INTO daily_scores (
    user_id, date, checkin_id,
    motion_score, sleep_score, nutrition_score,
    social_score, hormesis_score, screen_score,
    total_score
  )
  VALUES (
    NEW.user_id, NEW.date, NEW.id,
    v_motion, v_sleep, v_nutrition,
    v_social, v_hormesis, v_screen,
    v_total
  )
  ON CONFLICT (user_id, date) DO UPDATE SET
    checkin_id      = NEW.id,
    motion_score    = v_motion,
    sleep_score     = v_sleep,
    nutrition_score = v_nutrition,
    social_score    = v_social,
    hormesis_score  = v_hormesis,
    screen_score    = v_screen,
    total_score     = v_total;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: beregn og gem score automatisk ved INSERT eller UPDATE pa checkins
CREATE TRIGGER on_checkin_upsert
  AFTER INSERT OR UPDATE ON daily_checkins
  FOR EACH ROW EXECUTE FUNCTION public.calculate_and_upsert_score();


-- =============================================================
-- 5. LEADERBOARD VIEW -- Rullende 7-dages ranking
-- =============================================================

CREATE OR REPLACE VIEW leaderboard_7d AS
SELECT
  p.id             AS user_id,
  p.display_name,
  p.emoji_avatar,
  COALESCE(SUM(s.total_score), 0)               AS week_score,
  COALESCE(AVG(s.total_score), 0)::NUMERIC(5,1) AS avg_daily_score,
  COUNT(s.id)                                    AS days_checked_in,
  RANK() OVER (ORDER BY COALESCE(SUM(s.total_score), 0) DESC) AS rank
FROM profiles p
LEFT JOIN daily_scores s
  ON s.user_id = p.id
  AND s.date >= CURRENT_DATE - INTERVAL '6 days'
GROUP BY p.id, p.display_name, p.emoji_avatar;


-- =============================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- =============================================================

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alle kan se profiler"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Brugere kan opdatere egen profil"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Daily Checkins
ALTER TABLE daily_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brugere kan se alle checkins"
  ON daily_checkins FOR SELECT
  USING (true);

CREATE POLICY "Brugere kan oprette egne checkins"
  ON daily_checkins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Brugere kan opdatere egne checkins"
  ON daily_checkins FOR UPDATE
  USING (auth.uid() = user_id);

-- Daily Scores
ALTER TABLE daily_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alle kan se scores"
  ON daily_scores FOR SELECT
  USING (true);

-- Scores indsaettes kun via trigger (SECURITY DEFINER).
-- Ingen INSERT/UPDATE policy for brugere -- scores kan ikke manipuleres direkte.


-- =============================================================
-- 7. REALTIME -- Aktiver live-opdateringer pa scores
-- =============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE daily_scores;

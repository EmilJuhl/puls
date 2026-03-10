-- =============================================================
-- Puls -- Initial Database Schema
-- Migration: 001_puls_schema.sql
--
-- Indeholder:
--   1. Profiles tabel + auto-opret trigger
--   2. Daily checkins tabel med alle nye felter
--   3. Daily scores tabel med 6 kategori-scores
--   4. Score-beregning via trigger (inkl. minuspoint)
--   5. Leaderboard view (rullende 7 dage)
--   6. Spider chart view (normaliserede 0-100 værdier, rullende 7 dage)
--   7. Notification preferences tabel
--   8. Row Level Security (RLS) policies
--   9. Realtime aktivering
-- =============================================================


-- =============================================================
-- 1. PROFILES -- Udvider auth.users med app-data
-- =============================================================

CREATE TABLE profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  emoji_avatar TEXT DEFAULT '🔥',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger-funktion: opretter automatisk en profil når ny bruger registrerer sig
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

-- Trigger: kør handle_new_user() efter hvert INSERT i auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =============================================================
-- 2. DAILY CHECKINS -- Én row per bruger per dag
--
-- Kategorier: Søvn, Fysik, Disciplin, Skærm, Hygiejne, Social
-- =============================================================

CREATE TABLE daily_checkins (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date    DATE NOT NULL DEFAULT CURRENT_DATE,

  -- SØVN (spider: "Søvn")
  -- sleep_quality er fjernet — kun timer og konsistens tæller
  sleep_hours      NUMERIC(3,1) CHECK (sleep_hours BETWEEN 0 AND 14),
  sleep_consistent BOOLEAN DEFAULT FALSE, -- stod op inden for ±30 min af fast tid?

  -- FYSIK (spider: "Fysik")
  -- Alle tre felter vægtes ens (max 10p hver)
  steps            INTEGER DEFAULT 0 CHECK (steps >= 0),
  strength_minutes INTEGER DEFAULT 0 CHECK (strength_minutes >= 0),
  cardio_minutes   INTEGER DEFAULT 0 CHECK (cardio_minutes >= 0),

  -- DISCIPLIN (spider: "Disciplin")
  -- Kan give minuspoint (skipped_class: -10p)
  homework_done   BOOLEAN DEFAULT FALSE, -- lavet lektier?
  on_time         BOOLEAN DEFAULT FALSE, -- mødt til tiden?
  skipped_class   BOOLEAN DEFAULT FALSE, -- skippede et modul? (MINUS point!)
  earned_money    BOOLEAN DEFAULT FALSE, -- tjente penge i dag?
  saved_money     BOOLEAN DEFAULT FALSE, -- satte penge til side? (kun bonus hvis earned_money = TRUE)
  reading_minutes INTEGER DEFAULT 0 CHECK (reading_minutes >= 0), -- antal minutter læst

  -- SKÆRM (spider: "Skærm")
  -- Lavere forbrug = flere point. Kan give minuspoint.
  passive_screen_hours NUMERIC(3,1) DEFAULT 0 CHECK (passive_screen_hours >= 0),
  doomscroll_minutes   INTEGER      DEFAULT 0 CHECK (doomscroll_minutes >= 0),
  no_porn              BOOLEAN      DEFAULT FALSE,

  -- HYGIEJNE (spider: "Hygiejne")
  -- brushed_teeth: 0 = aldrig, 1 = én gang, 2 = morgen + aften
  brushed_teeth SMALLINT DEFAULT 0 CHECK (brushed_teeth BETWEEN 0 AND 2),
  flossed       BOOLEAN  DEFAULT FALSE,
  cold_shower   BOOLEAN  DEFAULT FALSE,

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
--
-- Bruges til spider chart og leaderboard.
-- Scores kan være negative (disciplin, skærm).
-- =============================================================

CREATE TABLE daily_scores (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  checkin_id UUID NOT NULL REFERENCES daily_checkins(id) ON DELETE CASCADE,

  -- Kategori-scores (beregnes automatisk af trigger nedenfor)
  sleep_score     SMALLINT DEFAULT 0, -- max 15p
  fysik_score     SMALLINT DEFAULT 0, -- max 30p
  disciplin_score SMALLINT DEFAULT 0, -- max 35p (inkl. læsning), kan være negativ
  screen_score    SMALLINT DEFAULT 0, -- max 15p, kan være negativ
  hygiejne_score  SMALLINT DEFAULT 0, -- max 9p

  -- Totalscore = sum af alle kategorier (kan være under 0 på en rigtig dårlig dag)
  total_score SMALLINT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Én score-row per bruger per dag
  UNIQUE(user_id, date)
);

-- Index til brugerspecifikke score-opslag
CREATE INDEX idx_scores_user_date ON daily_scores(user_id, date DESC);

-- Index til leaderboard-sortering
CREATE INDEX idx_scores_date_total ON daily_scores(date DESC, total_score DESC);


-- =============================================================
-- 4. SCORE-BEREGNING -- Trigger-funktion der kører ved checkin
--
-- Pointsystem:
--   Søvn:     max 15p
--   Fysik:    max 30p  (10p per underkategori, alle vægtes ens)
--   Disciplin:max 35p  (inkl. 10p for læsning, kan gå i minus: -10p for skippet modul)
--   Skærm:    max 15p  (kan gå i minus: -3p for >6t, -5p for >90min doomscroll)
--   Hygiejne: max 9p
--
--   Daglig max: ~94p | Realistisk god dag: 50-70p
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
  -- ================================================================

  -- Timer: 10p for optimal søvn (7-8 timer), 6p for næsten-optimal, 2p ellers
  IF NEW.sleep_hours >= 7.0 AND NEW.sleep_hours <= 8.0 THEN
    v_sleep := 10;
  ELSIF (NEW.sleep_hours >= 6.0 AND NEW.sleep_hours < 7.0)
     OR (NEW.sleep_hours > 8.0 AND NEW.sleep_hours <= 9.0) THEN
    v_sleep := 6;
  ELSE
    v_sleep := 2;
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
  -- DISCIPLIN (max 25p, kan gå i minus pga. skippet modul)
  -- ================================================================

  -- Lektier lavet: 8p (den tungeste post — studiet er vigtigt)
  IF NEW.homework_done = TRUE THEN
    v_disciplin := v_disciplin + 8;
  END IF;

  -- Mødt til tiden: 5p
  IF NEW.on_time = TRUE THEN
    v_disciplin := v_disciplin + 5;
  END IF;

  -- Skippet et modul: -10p (snyd har konsekvenser)
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
    v_screen := v_screen + 0; -- ingen point, ingen straf
  ELSE
    v_screen := v_screen - 3; -- over 6 timer er decideret dårligt
  END IF;

  -- Doomscrolling: ≤15min=5, 15-45min=2, 45-90min=0, 90min+=-5
  IF NEW.doomscroll_minutes <= 15 THEN
    v_screen := v_screen + 5;
  ELSIF NEW.doomscroll_minutes <= 45 THEN
    v_screen := v_screen + 2;
  ELSIF NEW.doomscroll_minutes <= 90 THEN
    v_screen := v_screen + 0;
  ELSE
    v_screen := v_screen - 5; -- seriøst problem
  END IF;

  -- Ingen pornografi: 5p
  IF NEW.no_porn = TRUE THEN
    v_screen := v_screen + 5;
  END IF;


  -- ================================================================
  -- HYGIEJNE (max 9p)
  -- Toggles der er nemme at lyve om giver færre point end motion/disciplin
  -- ================================================================

  -- Børstede tænder: 2x=4p, 1x=2p, 0x=0p
  IF NEW.brushed_teeth = 2 THEN
    v_hygiejne := v_hygiejne + 4;
  ELSIF NEW.brushed_teeth = 1 THEN
    v_hygiejne := v_hygiejne + 2;
  END IF;

  -- Tandtråd: 2p (lavt med vilje — nemt at lyve om)
  IF NEW.flossed = TRUE THEN
    v_hygiejne := v_hygiejne + 2;
  END IF;

  -- Koldt bad: 3p (kræver reel indsats)
  IF NEW.cold_shower = TRUE THEN
    v_hygiejne := v_hygiejne + 3;
  END IF;


  -- ================================================================
  -- TOTALSCORE
  -- ================================================================

  v_total := v_sleep + v_fysik + v_disciplin + v_screen + v_hygiejne;

  -- Gem eller opdater score-row (UPSERT ved duplicate user_id + date)
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

-- Trigger: beregn og gem score automatisk ved INSERT eller UPDATE på checkins
CREATE TRIGGER on_checkin_upsert
  AFTER INSERT OR UPDATE ON daily_checkins
  FOR EACH ROW EXECUTE FUNCTION public.calculate_and_upsert_score();


-- =============================================================
-- 5. LEADERBOARD VIEW -- Rullende 7-dages ranking
-- =============================================================

CREATE OR REPLACE VIEW leaderboard_7d AS
SELECT
  p.id           AS user_id,
  p.display_name,
  p.emoji_avatar,

  -- Ugesum af totalscore (bruges til rangering)
  COALESCE(SUM(s.total_score), 0)               AS week_score,
  COALESCE(AVG(s.total_score), 0)::NUMERIC(5,1) AS avg_daily_score,

  -- Kategori-summer (bruges til kategori-chips på leaderboard)
  COALESCE(SUM(s.sleep_score), 0)     AS week_sleep,
  COALESCE(SUM(s.fysik_score), 0)     AS week_fysik,
  COALESCE(SUM(s.disciplin_score), 0) AS week_disciplin,
  COALESCE(SUM(s.screen_score), 0)    AS week_screen,
  COALESCE(SUM(s.hygiejne_score), 0)  AS week_hygiejne,

  -- Antal dage brugeren har checket ind i perioden
  COUNT(s.id) AS days_checked_in,

  -- Rangering baseret på ugesum
  RANK() OVER (ORDER BY COALESCE(SUM(s.total_score), 0) DESC) AS rank

FROM profiles p
LEFT JOIN daily_scores s
  ON s.user_id = p.id
  AND s.date >= CURRENT_DATE - INTERVAL '6 days'
GROUP BY p.id, p.display_name, p.emoji_avatar;


-- =============================================================
-- 6. SPIDER CHART VIEW -- Normaliserede 0-100 værdier per kategori
--
-- Bruges til at tegne en radar/spider chart per spiller.
-- Baseret på rullende 7-dages gennemsnit.
-- Negative scores clamps til 0 (kan ikke vise negativ akse).
--
-- Max points per uge (7 dage × daglig max):
--   Søvn:     7 × 15  = 105p
--   Fysik:    7 × 30  = 210p
--   Disciplin:7 × 35  = 245p  (inkl. læsning)
--   Skærm:    7 × 15  = 105p
--   Hygiejne: 7 × 9   =  63p
-- =============================================================

CREATE OR REPLACE VIEW spider_chart_7d AS
SELECT
  p.id           AS user_id,
  p.display_name,
  p.emoji_avatar,

  -- Søvn: normaliseret til 0-100%, clampet så det aldrig går over 100
  LEAST(100, GREATEST(0,
    ROUND(COALESCE(SUM(s.sleep_score), 0)::NUMERIC / (15 * 7) * 100)
  )) AS sleep_pct,

  -- Fysik: normaliseret til 0-100%
  LEAST(100, GREATEST(0,
    ROUND(COALESCE(SUM(s.fysik_score), 0)::NUMERIC / (30 * 7) * 100)
  )) AS fysik_pct,

  -- Disciplin: clampet til 0 ved negativ ugesum (kan ikke vise negativ akse)
  LEAST(100, GREATEST(0,
    ROUND(COALESCE(SUM(s.disciplin_score), 0)::NUMERIC / (35 * 7) * 100)
  )) AS disciplin_pct,

  -- Skærm: clampet til 0 ved negativ ugesum
  LEAST(100, GREATEST(0,
    ROUND(COALESCE(SUM(s.screen_score), 0)::NUMERIC / (15 * 7) * 100)
  )) AS screen_pct,

  -- Hygiejne: normaliseret til 0-100%
  LEAST(100, GREATEST(0,
    ROUND(COALESCE(SUM(s.hygiejne_score), 0)::NUMERIC / (9 * 7) * 100)
  )) AS hygiejne_pct

FROM profiles p
LEFT JOIN daily_scores s
  ON s.user_id = p.id
  AND s.date >= CURRENT_DATE - INTERVAL '6 days'
GROUP BY p.id, p.display_name, p.emoji_avatar;


-- =============================================================
-- 7. NOTIFICATION PREFERENCES -- Brugerens foretrukne notifikationstidspunkt
--
-- Selve push-notifikationen implementeres later via
-- Supabase Edge Function + cron job.
-- =============================================================

CREATE TABLE notification_preferences (
  user_id        UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  notify_time    TIME    DEFAULT '21:00', -- hvornår vil brugeren mindes om at checke ind?
  notify_enabled BOOLEAN DEFAULT TRUE     -- kan slå notifikationer fra
);


-- =============================================================
-- 8. ROW LEVEL SECURITY (RLS)
-- =============================================================

-- ---- Profiles ------------------------------------------------

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Alle kan se alle profiler (vi er en lukket gruppe af venner)
CREATE POLICY "Alle kan se profiler"
  ON profiles FOR SELECT
  USING (true);

-- Brugere kan oprette deres egen profil (nødvendigt for upsert)
CREATE POLICY "Brugere kan oprette egen profil"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Brugere kan kun opdatere deres egen profil
CREATE POLICY "Brugere kan opdatere egen profil"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);


-- ---- Daily Checkins ------------------------------------------

ALTER TABLE daily_checkins ENABLE ROW LEVEL SECURITY;

-- Alle kan se alle checkins (åben konkurrence i gruppen)
CREATE POLICY "Brugere kan se alle checkins"
  ON daily_checkins FOR SELECT
  USING (true);

-- Brugere kan kun oprette checkins for dem selv
CREATE POLICY "Brugere kan oprette egne checkins"
  ON daily_checkins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Brugere kan kun opdatere egne checkins
CREATE POLICY "Brugere kan opdatere egne checkins"
  ON daily_checkins FOR UPDATE
  USING (auth.uid() = user_id);


-- ---- Daily Scores --------------------------------------------

ALTER TABLE daily_scores ENABLE ROW LEVEL SECURITY;

-- Alle kan se alle scores (bruges til leaderboard og spider chart)
CREATE POLICY "Alle kan se scores"
  ON daily_scores FOR SELECT
  USING (true);

-- Scores indsættes og opdateres KUN via trigger (SECURITY DEFINER).
-- Ingen INSERT/UPDATE policy for brugere — scores kan ikke manipuleres direkte.


-- ---- Notification Preferences --------------------------------

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Brugere kan kun se egne notifikationspræferencer
CREATE POLICY "Brugere kan se egne notifikationspræferencer"
  ON notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

-- Brugere kan oprette deres egne notifikationspræferencer
CREATE POLICY "Brugere kan oprette egne notifikationspræferencer"
  ON notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Brugere kan opdatere egne notifikationspræferencer (ændre tid / slå fra)
CREATE POLICY "Brugere kan opdatere egne notifikationspræferencer"
  ON notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);


-- =============================================================
-- 9. REALTIME -- Aktiver live-opdateringer på scores
-- =============================================================

-- Frontend kan subscribere på ændringer i scores for live leaderboard
ALTER PUBLICATION supabase_realtime ADD TABLE daily_scores;

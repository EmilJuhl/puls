-- =============================================================
-- MIGRATION 003 — Achievement System
--
-- Tabeller:
--   achievements       — master-liste over alle mulige achievements
--   user_achievements  — mange-til-mange: hvilke brugere har hvilke achievements
--
-- Trigger: calculate_achievements() kører efter hver score-upsert
-- og tildeler achievements baseret på streaks og mønstre.
--
-- OBS: Streak-beregning bruger count-i-vindue (ikke gap-detection).
-- Det betyder at N ud af de seneste N dage tæller som streak.
-- Acceptabelt for v1 — kan opgraderes til ægte gap-detection senere.
-- =============================================================


-- =============================================================
-- 1. TABELLER
-- =============================================================

CREATE TABLE IF NOT EXISTS achievements (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  icon        TEXT NOT NULL,
  is_positive BOOLEAN NOT NULL DEFAULT TRUE,
  category    TEXT NOT NULL DEFAULT 'general'
);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES achievements(id),
  earned_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, achievement_id)
);


-- =============================================================
-- 2. RLS
-- =============================================================

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alle kan se achievements"
  ON achievements FOR SELECT USING (true);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alle kan se user_achievements"
  ON user_achievements FOR SELECT USING (true);

-- INSERT kun via trigger (SECURITY DEFINER) — ingen direkte bruger-insert
CREATE POLICY "Ingen direkte bruger-insert paa user_achievements"
  ON user_achievements FOR INSERT WITH CHECK (false);


-- =============================================================
-- 3. ACHIEVEMENT DEFINITIONER
-- =============================================================

INSERT INTO achievements (id, name, description, icon, is_positive, category) VALUES
  -- Positive achievements
  ('maskinen',      'Maskinen',       '7 dage i træk med 80+ point',                    '⚙️',  TRUE,  'streak'),
  ('jernmand',      'Jernmand',       'Trænede 5 eller flere dage på én uge',           '🦾',  TRUE,  'fysik'),
  ('isbjorn',       'Isbjørn',        'Koldt bad 7 dage i træk',                        '🧊',  TRUE,  'hygiejne'),
  ('sovnkonge',     'Søvnkonge',      '9-10 timers søvn 14 dage i træk',               '👑',  TRUE,  'sovn'),
  ('topscorer',     'Topscorer',      'Landet på førstepladsen på leaderboardet',       '🥇',  TRUE,  'konkurrence'),
  ('akademiker',    'Akademiker',     'Lavede lektier 10 dage i træk',                  '📖',  TRUE,  'disciplin'),
  ('bibliotekaren', 'Bibliotekaren',  'Læste 30+ min 7 dage i træk',                   '📚',  TRUE,  'disciplin'),
  ('detox_king',    'Detox-kongen',   'Under 1 times skærm 5 dage i træk',             '📵',  TRUE,  'skarm'),
  ('rig_dreng',     'Rig dreng',      'Tjente og sparede 7 dage i træk',               '💰',  TRUE,  'disciplin'),
  ('tidlig_fugl',   'Tidlig fugl',    'Mødte til tiden 14 dage i træk',                '🐦',  TRUE,  'disciplin'),
  ('marathon_mand', 'Marathon-mand',  'Løb cardio 5 eller flere dage på én uge',       '🏃',  TRUE,  'fysik'),
  ('uge_champion',  'Uge-champion',   '10.000+ skridt 7 dage i træk',                  '👟',  TRUE,  'fysik'),
  ('tandfe',        'Tandfe',         'Brugte tandtråd 14 dage i træk',                '🦷',  TRUE,  'hygiejne'),
  -- Negative achievements
  ('gooner',        'Gooner',         'Satte kryds ved porno 5 dage i træk',           '🤡',  FALSE, 'skarm'),
  ('skolepjaekker', 'Skolepjækker',   'Skippede modul 3+ gange på én uge',             '💀',  FALSE, 'disciplin'),
  ('sofakartoffel', 'Sofakartoffel',  'Under 1000 skridt 3 dage i træk',               '🥔',  FALSE, 'fysik'),
  ('doomscroller',  'Doomscroller',   'Over 3 timers doomscrolling på én dag',         '📱',  FALSE, 'skarm'),
  ('natteugle',     'Natteugle',      'Sov under 6 timer 3 dage i træk',               '🦉',  FALSE, 'sovn'),
  ('frafaldet',     'Frafaldet',      '0 point 3 dage i træk',                         '👻',  FALSE, 'streak'),
  ('slacker',       'Slacker',        'Ingen træning i 7 dage i træk',                 '🛋️',  FALSE, 'fysik'),
  ('zombie',        'Zombie',         'Over 6 timers passiv skærm 5 dage i træk',      '🧟',  FALSE, 'skarm')
ON CONFLICT (id) DO NOTHING;


-- =============================================================
-- 4. ACHIEVEMENT BEREGNINGSFUNKTION
-- =============================================================

CREATE OR REPLACE FUNCTION public.calculate_achievements(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_count INT;
  v_first_place BOOLEAN;
BEGIN

  -- ── MASKINEN: 7 dage i træk med 80+ point ──────────────────
  SELECT COUNT(*) INTO v_count
  FROM daily_scores
  WHERE user_id = p_user_id
    AND date >= CURRENT_DATE - 6
    AND total_score >= 80;
  IF v_count = 7 THEN
    INSERT INTO user_achievements (user_id, achievement_id)
    VALUES (p_user_id, 'maskinen') ON CONFLICT DO NOTHING;
  END IF;

  -- ── JERNMAND: trænet 5+ dage denne uge ─────────────────────
  SELECT COUNT(*) INTO v_count
  FROM daily_checkins
  WHERE user_id = p_user_id
    AND date >= CURRENT_DATE - 6
    AND (strength_minutes >= 1 OR cardio_minutes >= 1);
  IF v_count >= 5 THEN
    INSERT INTO user_achievements (user_id, achievement_id)
    VALUES (p_user_id, 'jernmand') ON CONFLICT DO NOTHING;
  END IF;

  -- ── ISBJØRN: koldt bad 7 dage i træk ───────────────────────
  SELECT COUNT(*) INTO v_count
  FROM daily_checkins
  WHERE user_id = p_user_id
    AND date >= CURRENT_DATE - 6
    AND cold_shower = TRUE;
  IF v_count = 7 THEN
    INSERT INTO user_achievements (user_id, achievement_id)
    VALUES (p_user_id, 'isbjorn') ON CONFLICT DO NOTHING;
  END IF;

  -- ── SØVNKONGE: 9-10t søvn 14 dage i træk ──────────────────
  SELECT COUNT(*) INTO v_count
  FROM daily_checkins
  WHERE user_id = p_user_id
    AND date >= CURRENT_DATE - 13
    AND sleep_hours >= 9.0 AND sleep_hours <= 10.0;
  IF v_count = 14 THEN
    INSERT INTO user_achievements (user_id, achievement_id)
    VALUES (p_user_id, 'sovnkonge') ON CONFLICT DO NOTHING;
  END IF;

  -- ── TOPSCORER: nr. 1 på uge-leaderboard ────────────────────
  SELECT EXISTS(
    SELECT 1 FROM leaderboard_7d
    WHERE user_id = p_user_id AND rank = 1
  ) INTO v_first_place;
  IF v_first_place THEN
    INSERT INTO user_achievements (user_id, achievement_id)
    VALUES (p_user_id, 'topscorer') ON CONFLICT DO NOTHING;
  END IF;

  -- ── AKADEMIKER: lektier 10 dage i træk ─────────────────────
  SELECT COUNT(*) INTO v_count
  FROM daily_checkins
  WHERE user_id = p_user_id
    AND date >= CURRENT_DATE - 9
    AND homework_done = TRUE;
  IF v_count = 10 THEN
    INSERT INTO user_achievements (user_id, achievement_id)
    VALUES (p_user_id, 'akademiker') ON CONFLICT DO NOTHING;
  END IF;

  -- ── BIBLIOTEKAREN: 30+ min læsning 7 dage i træk ───────────
  SELECT COUNT(*) INTO v_count
  FROM daily_checkins
  WHERE user_id = p_user_id
    AND date >= CURRENT_DATE - 6
    AND reading_minutes >= 30;
  IF v_count = 7 THEN
    INSERT INTO user_achievements (user_id, achievement_id)
    VALUES (p_user_id, 'bibliotekaren') ON CONFLICT DO NOTHING;
  END IF;

  -- ── DETOX-KONGEN: <1t skærm 5 dage i træk ──────────────────
  SELECT COUNT(*) INTO v_count
  FROM daily_checkins
  WHERE user_id = p_user_id
    AND date >= CURRENT_DATE - 4
    AND passive_screen_hours < 1.0;
  IF v_count = 5 THEN
    INSERT INTO user_achievements (user_id, achievement_id)
    VALUES (p_user_id, 'detox_king') ON CONFLICT DO NOTHING;
  END IF;

  -- ── RIG DRENG: tjent+sparet 7 dage i træk ──────────────────
  SELECT COUNT(*) INTO v_count
  FROM daily_checkins
  WHERE user_id = p_user_id
    AND date >= CURRENT_DATE - 6
    AND earned_money = TRUE AND saved_money = TRUE;
  IF v_count = 7 THEN
    INSERT INTO user_achievements (user_id, achievement_id)
    VALUES (p_user_id, 'rig_dreng') ON CONFLICT DO NOTHING;
  END IF;

  -- ── TIDLIG FUGL: til tiden 14 dage i træk ──────────────────
  SELECT COUNT(*) INTO v_count
  FROM daily_checkins
  WHERE user_id = p_user_id
    AND date >= CURRENT_DATE - 13
    AND on_time = TRUE;
  IF v_count = 14 THEN
    INSERT INTO user_achievements (user_id, achievement_id)
    VALUES (p_user_id, 'tidlig_fugl') ON CONFLICT DO NOTHING;
  END IF;

  -- ── MARATHON-MAND: cardio 5+ dage/uge ──────────────────────
  SELECT COUNT(*) INTO v_count
  FROM daily_checkins
  WHERE user_id = p_user_id
    AND date >= CURRENT_DATE - 6
    AND cardio_minutes >= 1;
  IF v_count >= 5 THEN
    INSERT INTO user_achievements (user_id, achievement_id)
    VALUES (p_user_id, 'marathon_mand') ON CONFLICT DO NOTHING;
  END IF;

  -- ── UGE-CHAMPION: 10k+ skridt 7 dage i træk ────────────────
  SELECT COUNT(*) INTO v_count
  FROM daily_checkins
  WHERE user_id = p_user_id
    AND date >= CURRENT_DATE - 6
    AND steps >= 10000;
  IF v_count = 7 THEN
    INSERT INTO user_achievements (user_id, achievement_id)
    VALUES (p_user_id, 'uge_champion') ON CONFLICT DO NOTHING;
  END IF;

  -- ── TANDFE: tandtråd 14 dage i træk ────────────────────────
  SELECT COUNT(*) INTO v_count
  FROM daily_checkins
  WHERE user_id = p_user_id
    AND date >= CURRENT_DATE - 13
    AND flossed = TRUE;
  IF v_count = 14 THEN
    INSERT INTO user_achievements (user_id, achievement_id)
    VALUES (p_user_id, 'tandfe') ON CONFLICT DO NOTHING;
  END IF;

  -- ── GOONER: porno 5 dage i træk (negativ) ──────────────────
  SELECT COUNT(*) INTO v_count
  FROM daily_checkins
  WHERE user_id = p_user_id
    AND date >= CURRENT_DATE - 4
    AND no_porn = FALSE;
  IF v_count = 5 THEN
    INSERT INTO user_achievements (user_id, achievement_id)
    VALUES (p_user_id, 'gooner') ON CONFLICT DO NOTHING;
  END IF;

  -- ── SKOLEPJÆKKER: skipped 3+ gange/uge (negativ) ───────────
  SELECT COUNT(*) INTO v_count
  FROM daily_checkins
  WHERE user_id = p_user_id
    AND date >= CURRENT_DATE - 6
    AND skipped_class = TRUE;
  IF v_count >= 3 THEN
    INSERT INTO user_achievements (user_id, achievement_id)
    VALUES (p_user_id, 'skolepjaekker') ON CONFLICT DO NOTHING;
  END IF;

  -- ── SOFAKARTOFFEL: <1000 skridt 3 dage i træk (negativ) ────
  SELECT COUNT(*) INTO v_count
  FROM daily_checkins
  WHERE user_id = p_user_id
    AND date >= CURRENT_DATE - 2
    AND steps < 1000;
  IF v_count = 3 THEN
    INSERT INTO user_achievements (user_id, achievement_id)
    VALUES (p_user_id, 'sofakartoffel') ON CONFLICT DO NOTHING;
  END IF;

  -- ── DOOMSCROLLER: >180 min doomscroll på én dag (negativ) ──
  SELECT COUNT(*) INTO v_count
  FROM daily_checkins
  WHERE user_id = p_user_id
    AND date = CURRENT_DATE
    AND doomscroll_minutes > 180;
  IF v_count >= 1 THEN
    INSERT INTO user_achievements (user_id, achievement_id)
    VALUES (p_user_id, 'doomscroller') ON CONFLICT DO NOTHING;
  END IF;

  -- ── NATTEUGLE: <6t søvn 3 dage i træk (negativ) ───────────
  SELECT COUNT(*) INTO v_count
  FROM daily_checkins
  WHERE user_id = p_user_id
    AND date >= CURRENT_DATE - 2
    AND sleep_hours < 6.0;
  IF v_count = 3 THEN
    INSERT INTO user_achievements (user_id, achievement_id)
    VALUES (p_user_id, 'natteugle') ON CONFLICT DO NOTHING;
  END IF;

  -- ── FRAFALDET: 0 point 3 dage i træk (negativ) ─────────────
  SELECT COUNT(*) INTO v_count
  FROM daily_scores
  WHERE user_id = p_user_id
    AND date >= CURRENT_DATE - 2
    AND total_score <= 0;
  IF v_count = 3 THEN
    INSERT INTO user_achievements (user_id, achievement_id)
    VALUES (p_user_id, 'frafaldet') ON CONFLICT DO NOTHING;
  END IF;

  -- ── SLACKER: ingen træning 7 dage i træk (negativ) ─────────
  SELECT COUNT(*) INTO v_count
  FROM daily_checkins
  WHERE user_id = p_user_id
    AND date >= CURRENT_DATE - 6
    AND strength_minutes = 0 AND cardio_minutes = 0;
  IF v_count = 7 THEN
    INSERT INTO user_achievements (user_id, achievement_id)
    VALUES (p_user_id, 'slacker') ON CONFLICT DO NOTHING;
  END IF;

  -- ── ZOMBIE: 6t+ passiv skærm 5 dage i træk (negativ) ──────
  SELECT COUNT(*) INTO v_count
  FROM daily_checkins
  WHERE user_id = p_user_id
    AND date >= CURRENT_DATE - 4
    AND passive_screen_hours > 6;
  IF v_count = 5 THEN
    INSERT INTO user_achievements (user_id, achievement_id)
    VALUES (p_user_id, 'zombie') ON CONFLICT DO NOTHING;
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================
-- 5. TRIGGER: Kør achievement-beregning efter score-upsert
-- =============================================================

CREATE OR REPLACE FUNCTION public.on_score_upsert_achievements()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.calculate_achievements(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_achievements ON daily_scores;
CREATE TRIGGER trigger_achievements
  AFTER INSERT OR UPDATE ON daily_scores
  FOR EACH ROW EXECUTE FUNCTION public.on_score_upsert_achievements();


-- =============================================================
-- 6. REALTIME — Aktiver live-opdateringer for user_achievements
-- =============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE user_achievements;

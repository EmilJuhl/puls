# Supabase Setup Guide — Livspoint

Trin-for-trin guide til at oprette Supabase-projektet manuelt i browseren.

---

## Trin 1: Opret Supabase-konto og projekt

1. Gå til [supabase.com](https://supabase.com) og klik **"Start your project"**
2. Log ind med GitHub eller opret en ny konto
3. Klik **"New project"** i dit dashboard
4. Udfyld projektdetaljer:
   - **Name:** `livspoint` (eller hvad du ønsker)
   - **Database Password:** Vælg et stærkt kodeord og gem det sikkert
   - **Region:** `EU West (Frankfurt)` — vælg denne for GDPR-compliance og lav latency fra Danmark
5. Klik **"Create new project"** og vent 1-2 minutter mens projektet provisioner

---

## Trin 2: Gem projektets credentials

Når projektet er klar:

1. Gå til **Settings → API** i venstre sidebar
2. Kopiér følgende værdier og gem dem — du skal bruge dem i `.env`-filen:
   - **Project URL** (f.eks. `https://abcdefgh.supabase.co`)
   - **anon / public key** (den lange JWT-string)

> Disse værdier er offentlige og kan bruges på klient-siden. Gem aldrig `service_role` key i frontend-kode.

---

## Trin 3: Konfigurér Email Auth med Magic Link

1. Gå til **Authentication → Providers** i venstre sidebar
2. Find **Email** og klik på det
3. Konfigurér følgende:
   - **Enable Email provider:** Slået TIL
   - **Confirm email:** Slået TIL (brugere bekræfter via magic link i email)
   - **Enable email confirmations:** Slået TIL
4. **Deaktivér password-login** ved at slå **"Enable email signup"** FRA under "Email auth" — eller brug custom SMTP og sæt kun magic link til
5. Gem ændringerne

> Magic link sender en engangslink til brugerens email. Sikrere end passwords og nemmere for ikke-tekniske brugere.

---

## Trin 4: Konfigurér URL-indstillinger

1. Gå til **Authentication → URL Configuration**
2. Sæt **Site URL** til:
   ```
   http://localhost:5173
   ```
   Dette er Vite's standard dev-server adresse.
3. Under **Redirect URLs**, tilføj:
   ```
   http://localhost:5173/**
   ```
4. Gem ændringerne

> Når du deployer til produktion, skal du opdatere Site URL til din produktions-URL og tilføje den til Redirect URLs.

---

## Trin 5: Kør database migration

1. Gå til **SQL Editor** i venstre sidebar
2. Klik **"New query"**
3. Kopiér hele indholdet af `supabase/migrations/001_initial_schema.sql`
4. Indsæt det i SQL Editor
5. Klik **"Run"** (eller tryk `Ctrl+Enter` / `Cmd+Enter`)
6. Tjek at alle statements kørte uden fejl i output-panelet

---

## Trin 6: Verificér opsætningen

### Tjek tabeller
1. Gå til **Table Editor** — du bør se:
   - `profiles`
   - `daily_checkins`
   - `daily_scores`

### Tjek triggers
1. Gå til **Database → Functions** og verificér at disse eksisterer:
   - `handle_new_user`
   - `calculate_and_upsert_score`

### Tjek RLS
1. Gå til **Table Editor → profiles** → klik **"RLS disabled"** knappen
2. Verificér at RLS er **aktiveret** på alle tre tabeller

### Test magic link
1. Gå til **Authentication → Users**
2. Klik **"Invite user"** og send en invitation til din email
3. Tjek at der automatisk oprettes en `profiles`-row når brugeren bekræfter

---

## Trin 7: Opret `.env`-fil

I projektets rodmappe, kopiér `.env.example` til `.env`:

```bash
cp .env.example .env
```

Udfyld med dine credentials fra Trin 2:

```
VITE_SUPABASE_URL=https://DIT-PROJEKT.supabase.co
VITE_SUPABASE_ANON_KEY=din-anon-key-her
```

> `.env` må aldrig committes til git. Tjek at `.gitignore` indeholder `.env`.

---

## Produktion: Deployment-tjekliste

Når du er klar til at deploye:

- [ ] Opdatér **Site URL** i Supabase Authentication → URL Configuration
- [ ] Tilføj produktions-URL til **Redirect URLs**
- [ ] Sæt environment variables i dit hosting-miljø (Vercel, Netlify osv.)
- [ ] Overvej at konfigurere custom SMTP for brugervenlighed (Authentication → SMTP Settings)

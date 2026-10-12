# Nutriscore — project context for Claude Code

This file is a handoff for whichever Claude session works on this repo next. It was written after a session that fixed several bugs and added features in Claude's Cowork environment (no git access there — see "Deployment history" below for why that matters). Read this before making changes; it covers things that are easy to silently re-break.

## Repo layout

The GitHub repo is `Mauke10/NutriScore-2`. The Next.js app lives in the **`nutriscore-app/`** subfolder, not at the repo root, so run all `npm` commands from there (`cd nutriscore-app && npm install && npm run build`). All paths in this file (`app/...`, `lib/...`, `supabase/...`) are relative to `nutriscore-app/`.

## What this app is

A private nutrition + training tracker for two people, Martin and Laura, built around their shared goal of the **Ironman 70.3 Tallinn in August 2027**. It is not a general-purpose product — there are exactly two users, hardcoded as `martin` and `laura` throughout the codebase, no signup flow, no multi-tenancy. Treat "add a feature for a third person" or "make this generic" as out of scope unless explicitly asked.

Both people log into the same app and see each other's data (it's a shared household tool, with a "Compete" tab that turns tracking into head-to-head comparisons). Login is PIN-based, not email/password.

## Stack

- **Next.js 14.2.35, App Router.** Route Handlers under `app/api/*/route.js`, Server + Client Components under `app/`.
- **Supabase (Postgres)** as the only datastore, accessed exclusively through the service-role key server-side (`lib/supabase.js`). No RLS policies are defined for the anon key — RLS is enabled on every table as a safety net, but **all access goes through Next.js API routes**, never direct client-to-Supabase calls.
- **Plain CSS**, no Tailwind, no CSS-in-JS. Everything lives in `app/globals.css`, which has grown into the project's whole design system (CSS custom properties for theming, motion tokens, component classes). Read it before adding UI — there is very likely already a class/token for what you need.
- **lucide-react** for icons.
- **@anthropic-ai/sdk** — used in exactly one place, `app/api/snacks/estimate/route.js`, to estimate calories/macros from a photo of food. Requires `ANTHROPIC_API_KEY`; the route degrades gracefully (returns a clear error, doesn't crash) if that key isn't set.
- No test suite, no CI config, no ORM/migration tool — see "Database" below for how schema changes actually get applied.

## Environment variables

Referenced in code (so all of these need to exist wherever this runs):

| Variable | Used for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase client (both server and the one public reference) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase server client — **never expose this to the client** |
| `SESSION_SECRET` | HMAC-signs the login session cookie (`lib/session.js`); must be a long random string or session creation throws |
| `APP_PIN` | Legacy shared PIN — see "Auth" below, still the fallback path |
| `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REDIRECT_URI` | Strava OAuth connect/sync |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (optional) | Photo-based snack calorie estimation |
| `NEXT_PUBLIC_BUILD_TIME` | **Do not set manually** — `next.config.js` bakes this in automatically at build time (`Date.now()`), used by the auto-update mechanism (see below) |

There's no `.env.example` committed as of this writing — worth adding one if it doesn't exist, listing the above (without real values).

## Auth

Two-tier PIN system, both paths live in `app/api/login/route.js`:

1. **Per-person PIN (current, preferred path).** `people.pin_hash` holds a scrypt hash (`lib/pin.js`: `hashPin`/`verifyPin`, random 16-byte salt, `salt:hash` hex format, timing-safe compare). Set via Settings → "Change your PIN" (`app/api/change-pin/route.js`), scoped so a person can only ever change their own hash.
2. **Shared legacy PIN (fallback).** The original mechanism — one `APP_PIN` env var, checked with `checkPin()` in `lib/session.js`. Login falls back to this when: (a) the person hasn't set their own PIN yet (`pin_hash` is null), or (b) **Supabase is unreachable** — the `pin_hash` lookup is wrapped in try/catch specifically so a Supabase outage/pause never blocks login entirely.

Session: a signed cookie (`nutriscore_session`), HMAC-SHA256 over `personId.issuedAtMs`, 90-day expiry, timing-safe verification. `currentPerson()` in `lib/auth.js` reads it server-side.

**Explicit product decision — do not add without being asked again:** no PIN brute-force/lockout protection. The user considered this and declined it ("The pin thing is no problem right now as it is only to ppl"). Don't add rate-limiting or lockout to the login route as a "security improvement" unasked.

**Migration not yet confirmed run:** `supabase/migration_008_pin_hash.sql` adds the `pin_hash` column. If per-person PINs are erroring in production, check this first — it's possible it was never run against the live Supabase project.

## Database

`supabase/schema.sql` is the full current schema (fresh-install source of truth). Numbered migration files (`migration_002` through `migration_008`) are additive deltas applied by hand — **there is no migration runner**. Each one is written to be safe to re-run (`if not exists` everywhere). When you need a schema change: write a new `migration_00N_description.sql`, and also update `schema.sql` so a fresh install matches. The user runs these manually in the Supabase SQL Editor — there's no automated pipeline, so after writing a migration, tell them explicitly that they need to go run it.

Tables, in brief:
- `people` — exactly two rows (`martin`, `laura`), `pin_hash` nullable (see Auth).
- `weekly_logs` — one row per person per week, unique on `(person_id, week_start)`. The app's edit feature for this table works by resubmitting the same `week_start`, which upserts in place — no PATCH endpoint exists or is needed.
- `bloodwork` — same shape, unique on `(person_id, panel_date)`, same upsert-based edit pattern.
- `food_logs` — meals/snacks, `meal_type` is `'meal' | 'snack'`. Has a real `PATCH /api/snacks` endpoint (partial update by `id`, scoped to the caller's own `person_id`) because there's no natural per-day unique key here — several entries per day are normal.
- `training_sessions` — manually-logged workouts (swim/bike/run/strength/other), also has a real `PATCH /api/training-sessions` for the same reason (multiple sessions per day are normal, no upsert key).
- `recipes` + `recipe_ingredients` — saved meals, shared across both people (not owned by one person). `recipe_ingredients` holds per-100g macros so changing portion size recomputes totals.
- `settings` — one row per person, `calorie_target`/`protein_target`/`swim_goal_km`/`bike_goal_km`/`run_goal_km`/`accent_color`.
- `training_volume` — monthly, Strava-synced (`source: 'strava'`), separate from `training_sessions` on purpose so a re-sync can never clobber or double-count a manually-logged session.
- `strava_accounts`, `daily_notes`, `training_plan` — OAuth tokens, a daily shared whiteboard note, and the planned-activity calendar, respectively.

## Date handling — the single most important gotcha in this codebase

**Never compute "today" with `new Date().toISOString().slice(0, 10)`.** Tallinn is UTC+2/+3, so for roughly 2-3 hours after local midnight, that expression still returns *yesterday's* date. This has caused two real bugs already (both fixed): the 7-day calorie trend silently excluding anything logged right after midnight, and the Compete tab's "today's calories" going blank for the same window.

Always use the helpers in `app/dashboard/utils.js`:
- `todayStr()` — today's date as `YYYY-MM-DD`, local time.
- `localDateStr(d)` — same, for an arbitrary `Date`.
- `mondayOf(d)` — the Monday of that date's week, local time.

If you ever see `toISOString()` used to derive a calendar date anywhere in this codebase, that's almost certainly a bug — grep for it (`grep -rn "toISOString" app/`) as a sanity check after any date-related change.

## Auto-update mechanism (don't "fix" this without understanding why it's shaped this way)

`app/VersionWatcher.js` polls `/api/version` and compares it against `NEXT_PUBLIC_BUILD_TIME` baked into the currently-loaded bundle. If they differ, it reloads the page once — this is what makes a home-screen PWA pick up a new deploy without the user manually closing and reopening it.

It previously caused an infinite reload loop (the bug that opened the last session): every reload re-ran the check, found the same mismatch again, and reloaded again, forever, blocking login. The fix was a `sessionStorage` guard (`nutriscore-reloaded-for-build`) that remembers "I already reloaded for this exact build" so it only ever reloads once per real deploy, with a try/catch fallback for storage-blocked contexts (private browsing). If you touch this file, preserve that guard — removing it reintroduces the reload loop.

## Offline handling

`public/sw.js` is intentionally narrow: it only caches the static app shell (JS/CSS bundle, `public/offline.html`) and only for same-origin GET requests. It explicitly never touches `/api/*` or any non-GET request — this app's data lives in Supabase, so caching an API response would mean showing stale numbers as if current, or letting a save silently "succeed" from cache. Network-first for everything, so a fresh deploy always wins over a cached one (keeps it compatible with VersionWatcher above). `app/OfflineBanner.js` shows a plain-language banner the moment `navigator.onLine` goes false. `app/ServiceWorkerRegister.js` only registers the worker in production (`NODE_ENV !== "production"` bails early) so local dev never fights a stale cache.

## Design tokens (globals.css)

Every font-size, gap/padding/margin and border-radius in `globals.css` uses a token from `:root`. Use them for new UI too, and never hardcode a px value next to them:
- **Type:** `--text-2xs` (10px) … `--text-3xl` (26px). Nothing goes below `--text-2xs`.
- **Spacing:** `--space-0-5` (2px) … `--space-7` (28px), 2px steps, no odd values.
- **Radius:** `--radius-xs` … `--radius-2xl`, plus `--radius-full`. A nested surface is one step smaller than its parent.
- **Per-person colour:** use `--accent` / `--accent-soft`, never `--series-martin` with a `[data-person="laura"]` override. The nearest `[data-person]` ancestor decides the colour, and `.wrap` carries the signed-in person's. `--series-*` is still right where both people show at once (charts, compare columns, dots). The accent vars are declared on `.wrap`/`[data-person]`, not `:root`, because DashboardClient sets custom colours inline on `.wrap`.
- **Contrast:** light-theme `--text-muted`, `--status-good` and `--status-warning` were darkened to pass 4.5:1 as text. Re-check contrast if you change them.
- Small icon buttons get a 44px tap area from an invisible `::after` (see "Tap targets" at the end of the file). Add new small buttons to that list.

## PWA / mobile details worth knowing before touching layout or theming

- `app/layout.js` sets `viewport-fit=cover` + an inline script (`THEME_COLOR_SNIPPET`) that applies the saved theme and a matching `<meta name="theme-color">` *before* first paint, to avoid a flash of the wrong theme/status-bar color. There is deliberately no static `<meta name="theme-color">` tag in the JSX — the script creates the one and only instance. Don't add a second one.
- Three themes exist: light (default), dark, and a green "forest" variant — all as CSS custom properties in `globals.css`, switched via `data-theme` on `<html>`.
- `window.__nutriscoreApplyThemeColor(mode)` is exposed globally by that inline script so `DashboardClient.js` can re-sync the status bar color whenever the person changes theme at runtime or their OS dark-mode setting changes while "match device" is selected.

## Feature inventory (as of this handoff)

Dashboard (`app/dashboard/DashboardClient.js` and friends), per person:
- Calorie ring + a 7-day calorie trend bar chart (`WeekCalorieTrend.js`) showing the median of *tracked* days only against the calorie goal — untracked days are deliberately excluded from the median, not counted as zero.
- Meal/snack logging with a recipe picker (saved meals, ingredient-based macro math in `recipeMath.js`), photo-based calorie estimation via Claude, and **edit-after-logging** for meals/snacks (`PATCH /api/snacks`), weekly logs and bloodwork (both via resubmit-same-key upsert), and training sessions (`PATCH /api/training-sessions`). Default meal type on the add form is `"meal"`, not `"snack"`.
- Weekly log (weight, waist, sessions, RPE, HR zones, sleep, supplements, nutrition adherence, avg calories/protein) and quarterly bloodwork panels (ferritin, B12, folate, vitamin D).
- Training: Strava-synced monthly volume (swim/bike/run) plus manually-logged sessions, combined client-side for goal-progress bars.
- Settings: Strava connect/sync, per-person PIN change (`app/api/change-pin/route.js`).
- Compete tab: weekly head-to-head category wins (`Competition.js`), a side-by-side stat comparison (`CompareColumns.js`) that now includes a **protein-streak counter** (consecutive days protein target was hit; today doesn't break the streak if it just hasn't been logged yet — see `proteinStreak()` in `utils.js`).
- A shared "morning notes" whiteboard and a training-plan calendar.

## Deployment history (context, may no longer be the process once this is in real git)

This project was previously edited entirely inside a Cowork cloud sandbox with **no git access** — every deploy was the user manually dragging the whole project folder into GitHub's web upload UI, after Claude exported it as a zip (excluding `node_modules`/`.next`). That process caused two real problems worth knowing about in case artifacts from it remain in the repo:
1. GitHub's web uploader has a soft per-upload file-count limit, so large batches sometimes got split by top-level folder.
2. A stale zip left in the output directory got reused (zip merges into an existing archive by default instead of overwriting), which briefly reintroduced an old nested duplicate `nutriscore-app/` folder into the repo root. **If you see a folder named `nutriscore-app` nested *inside* the app folder (i.e. `nutriscore-app/nutriscore-app/`), that's leftover cruft from this — safe to delete. The top-level `nutriscore-app/` in the `NutriScore-2` repo is the real app; don't delete that one.**

Now that the project is being worked on with real git access, this entire manual-zip workflow should be unnecessary — use normal commits/pushes instead.

## Working-style notes carried over from the previous session

- The user (Martin) prefers direct, concrete answers over hedged explanations, and communicates casually (mixes English/Estonian). Say what's actually true about the code rather than softening it.
- Verification discipline that proved useful: after any non-trivial change, run `rm -rf .next && npm run build` (clean rebuild) before calling something done — this project has `node_modules` get wiped by environment resets often enough that `npm install` first is sometimes necessary too.
- Before adding a feature, check whether `globals.css` already has a token/class for it — it's intentionally been built up as a shared system (theme tokens, motion tokens, status colors, per-person series colors, card/modal/log-card component classes) rather than one-off styles per component.

---
name: nutriscore-verify
description: Verify a Nutriscore change before calling it done or pushing — clean build, drive the real app in headless Chromium with mocked APIs and a test login, screenshot it on a phone and desktop in light and night schemes, check for hydration errors, and test a new Supabase migration in an in-memory Postgres (re-runnable, matches schema.sql). Use after any UI, API or schema change in this repo, and whenever the user asks to see or mock up how something looks.
---

# Verifying a Nutriscore change

Nothing here touches the live Supabase project or real accounts. The browser
runs against a local production build, and every `/api/*` call is answered by
mock data you write. Migrations run in PGlite (in-memory Postgres). Applying a
migration to live, and pushing, still need the user's go-ahead (see CLAUDE.md).

Scripts live in `.claude/skills/nutriscore-verify/scripts/`. Put scenario
scripts and screenshots in your scratch folder, never in the repo.

## 0. One-time setup per session

```bash
export VERIFY_DIR="$(bash .claude/skills/nutriscore-verify/scripts/setup.sh)"
```

Installs `playwright-core` and `@electric-sql/pglite` (pinned) into a folder
outside the repo. They're test tools, not app dependencies — don't add them to
`nutriscore-app/package.json`. Chromium is the preinstalled headless shell
under `/opt/pw-browsers`; never run `playwright install`.

## 1. Build and serve

```bash
bash .claude/skills/nutriscore-verify/scripts/serve.sh
```

Kills any old server on port 3100 first (an old `next start` keeps serving the
previous build and you'd be testing stale code), does `rm -rf .next && npm run
build`, then serves on `http://127.0.0.1:3100` with throwaway env vars. A build
error here is the first thing to fix. Re-run it after every code change.

## 2. Drive the app

Write a scenario in your scratch folder that imports `harness.mjs`. Start from
`scripts/example-scenario.mjs`. What the harness gives you:

- `openDashboard({ person, api, viewport, mobile })` — signs in as `martin` or
  `laura` with a valid session cookie, routes every `/api/*` to your `api`
  handlers (keyed by pathname; anything unhandled gets `{ entries: [], ok:
  true }`), and opens `/dashboard`. It returns `page`, `errors` (page errors),
  `calls` (every non-GET request: method, path, body) and `close`.
- `openTab(page, "Training")` — bottom-nav tabs: Today, Training, Calendar,
  Body, Compete.
- `setTheme(page, key)` — light, sand, nordic, blush, dark, midnight, ember.
- `fullPage(page, file)` — full-length phone screenshot.
- `daysAgo(n)` / `ymd(date)` — local dates for mock rows.

Mock the shapes the components actually read — check the route file for the
response shape. The common ones:

| Endpoint | Returns |
|---|---|
| `/api/targets` | `{ calorieTarget, proteinTarget, swimGoalKm, bikeGoalKm, runGoalKm }` |
| `/api/snacks?person=` | `{ entries: food_logs rows }` (`mealsHidden` for the partner when sharing is off) |
| `/api/prefs` | `{ raceName, raceDate, dayEndHour, shareMeals, showFiber, stravaAutosync }` |
| `/api/training-feed?person=&from=&to=[&records=1]` | `{ workouts, plans, records }` — workout shape is in that route's `fromStrava`/`fromManual` |
| `/api/training-plan?from=&to=` | `{ entries: plan items, sessions }` |
| `/api/training` | `{ entries: training_volume rows }` |
| `/api/notes?date=` | `{ notes: { martin, laura } }` |
| `/api/strava/status?person=` | `{ connected }` |

Scope selectors to `.mobile-dashboard` or `.desktop-dashboard`: both layouts
are in the page at once and one is hidden by CSS.

What to check, every time:
- **Both people.** Sign in as each, or at least check the partner's side shows
  correctly. Include the case where the partner has no data at all — that's
  real right now.
- **Phone (390×844) and desktop (1280 wide).**
- **A light and a night scheme** (`midnight` is a good night default). Colours
  that are fine in light often go muddy or vanish in night schemes.
- **The flows the change touches.** Click through them and assert on `calls`
  (what got POSTed) and on the text that comes back, not just the screenshot.
- **`errors` is empty.**
- **Tab regressions.** Re-run the scenarios for other tabs if you touched
  shared code (`globals.css`, `utils.js`, `usePersonData.js`, `lib/`).

Look at every screenshot yourself before showing the user: text wrapping where
it shouldn't, things overlapping, empty states, cut-off numbers.

## 3. Hydration check

```bash
node .claude/skills/nutriscore-verify/scripts/hydration.mjs
```

Must print `ok` for all four runs. A mismatch means React re-renders the whole
page on every load. The usual cause in this codebase is a date or `toLocale*`
string rendered on the server: Vercel's clock is UTC, and Node formats `en-GB`
dates differently from browsers. Render date-dependent UI after mount and
format dates by hand, like `TrainingPlanCalendar.js` and `TrainingSection.js`
do. For the exact component and the two strings that differed, run `npx next
dev -p 3102` and load the page. Dev mode prints the full warning in the
console.

## 4. Migrations

```bash
node .claude/skills/nutriscore-verify/scripts/migration-check.mjs supabase/migration_0NN_name.sql \
  [--seed=/scratch/rows.sql] [--query="select * from new_table"]
```

Builds main's `schema.sql`, runs the migration twice, then compares the result
to a fresh build of the working-tree `schema.sql`: columns, constraints,
indexes and RLS. All must say `ok`. Use `--seed` to insert rows the migration
should copy or preserve, and `--query` to see the result. Then show the user the
SQL and wait for their go before applying it to live. Afterwards verify on live
with a read-only query and update the "Migration N applied" line in CLAUDE.md.

## 5. Before saying done

- The build is clean and `hydration.mjs` passes.
- The scenario passes for both people, phone and desktop, light and night.
- Migrations (if any) pass the check.
- `grep -rn "toISOString" nutriscore-app/app/` shows no new calendar-date use
  (see CLAUDE.md on dates).
- CLAUDE.md is updated if you changed behaviour it describes.
- You've sent the user the key screenshots and told them anything you couldn't
  test. For example, a real Strava sync can't be tested from here.

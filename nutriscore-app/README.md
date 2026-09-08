# Nutriscore

A private, two-person web app for Martin and Laura's shared nutrition and training tracker. Each of you logs in with your own profile behind one shared PIN, connects your own Strava account, and logs weekly metrics, bloodwork, and snacks. Everything lives in one shared dashboard with a head-to-head weekly comparison.

This replaces the earlier Claude-artifact version of this tracker, because Claude's live artifacts can't be shared outside the account that published them — this app can be opened by both of you, from your own devices, independently.

## Update — ingredient-based recipes

If you already ran the earlier migration scripts and set up Vercel before this update:

1. **Run one more SQL script.** In Supabase → SQL Editor → New query, paste the contents of `supabase/migration_006_recipe_ingredients.sql` and run it. It adds one new table, `recipe_ingredients` — safe to run even if you're not sure whether you already have it.
2. **Push the updated code to your GitHub repo** the same way as before. Vercel will auto-redeploy once it sees the push.
3. Nothing else changes — no new environment variables, no Strava/Vercel reconfiguration needed.

What's new:

- **Recipes are built from ingredients now.** In the Recipes panel, instead of typing one fixed calorie/protein/carb/fat total, list each ingredient with its grams and its macros per 100g (the number on any nutrition label) — the total is computed for you and stays in sync as you edit.
- **Logging a recipe lets you adjust grams per ingredient.** Pick a saved recipe in the log form and you'll see each ingredient with an editable grams field — "only had 150g of the rice this time" — and the calorie/protein/carb/fat totals recompute live from whatever you actually ate, instead of always logging the recipe's default portion.
- Recipes saved the old way (a fixed total, no ingredients — e.g. the quick "save this as a recipe" tick on a snack) still work exactly as before.

## Update — training calendar, today's plan up top

If you already ran the earlier migration scripts and set up Vercel before this update:

1. **Run one more SQL script.** In Supabase → SQL Editor → New query, paste the contents of `supabase/migration_005_training_plan.sql` and run it. It adds one new table, `training_plan` — safe to run even if you're not sure whether you already have it.
2. **Push the updated code to your GitHub repo** the same way as before. Vercel will auto-redeploy once it sees the push.
3. Nothing else changes — no new environment variables, no Strava/Vercel reconfiguration needed.

What's new:

- **A Training calendar** — a new "Calendar" tab in the bottom nav (between Training and Body) on phone, and an always-visible full-width section on desktop. Tap any day to see and edit what's planned — type free text like "Swim 1.5km" and it saves automatically as you type. Your own entry is editable; your partner's is shown read-only underneath. Each day's cell shows a short chip of each person's plan, in your own colours, so a glance at the month shows who's doing what.
- **Today's plan, front and center** — the old tagline under the "Nutriscore" title is now two small side-by-side boxes showing what each of you has planned for today specifically, pulled straight from the new calendar.

## Update — morning whiteboard, brighter forest theme, tidier UI

If you already ran the earlier migration scripts and set up Vercel before this update:

1. **Run one more SQL script.** In Supabase → SQL Editor → New query, paste the contents of `supabase/migration_004_whiteboard.sql` and run it. It adds one new table, `daily_notes` — safe to run even if you're not sure whether you already have it.
2. **Push the updated code to your GitHub repo** the same way as before. Vercel will auto-redeploy once it sees the push.
3. Nothing else changes — no new environment variables, no Strava/Vercel reconfiguration needed.

What's new:

- **A morning whiteboard on the Compete tab** — leave each other a short note that clears itself out the next day. Your box is editable (it saves automatically as you type); your partner's box is read-only, marked with when they wrote it. It's styled like a literal whiteboard — stays white with handwritten-style text in each of your colours, even in Night or Forest mode. On desktop it sits below both columns, since there's no separate Compete tab there.
- **The Forest theme is brighter and more solid** — less murky, near-black pigment, more a clean, vivid green mixed with white for the card surfaces.
- **The status cards at the top (Iron/ferritin, B12, Vitamin D, HR zones) are smaller**, so they take up less room before you get to the actual data.
- **The head-to-head numbers no longer get selected/highlighted** when you tap or drag across them on a phone.

## Update — colour picker, bright/night mode, dark green theme

If you already ran the earlier migration scripts and set up Vercel before this update:

1. **Run one more SQL script.** In Supabase → SQL Editor → New query, paste the contents of `supabase/migration_003_colors.sql` and run it. It adds one `accent_color` column to `settings` — safe to run even if you're not sure whether you already have it.
2. **Push the updated code to your GitHub repo** the same way as before. Vercel will auto-redeploy once it sees the push.
3. Nothing else changes — no new environment variables, no Strava/Vercel reconfiguration needed.

What's new:

- **A Colour tab in the menu** (top left) — pick your own name colour from a swatch grid or a full custom picker. It replaces the old fixed purple-for-Martin/pink-for-Laura everywhere: your name, dot, calorie ring, badges, buttons. Each person's choice is saved to the shared database, so it shows up correctly on both of your devices.
- **A bright/night slider**, in the same panel — switches the whole app between light and dark, overriding your device's setting. It's remembered per-device (each of your phones/laptops can be set independently).
- **A dark green "Forest" night style** — when night mode is on, a second row lets you pick "Classic" (the original near-black dark mode) or "Forest," a dark green read of the whole dashboard, as an alternative to Classic.

Want to see it before deploying? There's a live click-around preview with sample data — ask and I'll send the link again.

## Update — meals vs snacks, recipes, colors, charts, mobile nav

If you already ran the original `supabase/schema.sql` and set up Vercel before this update, here's what to do:

1. **Run one more SQL script.** In Supabase → SQL Editor → New query, paste the contents of `supabase/migration_002_meals_and_recipes.sql` and run it. It adds a `recipes` table and two new columns to `food_logs` — safe to run even if you're not sure whether you already have them.
2. **Push the updated code to your GitHub repo** the same way you did the first time (drag the unzipped folder's contents into your repo's "Add file → Upload files" page, overwriting what's there, commit). Vercel will auto-redeploy once it sees the push.
3. Nothing else changes — no new environment variables, no Strava/Vercel reconfiguration needed.

What's new:

- **Meals vs snacks** — the log now asks whether something's a *meal* or a *snack*, and tracks each separately (two tiles instead of one), since a mealprepped dinner and a protein bar shouldn't count the same way. The overall calorie balance still adds both together against your target.
- **Saved recipes** — since you're eating the same mealprepped dishes in the same portions a lot, you can now search a shared recipe library right in the log form (type "chicken curry," pick it, done) instead of re-entering or re-estimating it every time. Tick "save this as a recipe" on any logged item to add it to the library.
- **Martin's color is purple, Laura's is pink** everywhere in the app.
- **Training volume shows scaled bar charts** (last 6 months) for weight moved, swim, bike, and run, instead of a single flat number, so a trend is visible at a glance.
- **A bottom nav bar on phone** — Today / Training / Body / Compete — so the dashboard behaves like a native app on a phone screen instead of a squeezed two-column layout. Desktop keeps the original side-by-side view.
- **A menu, top left** — Settings (calorie target, Strava connect/sync, all in one place now) and Recipes (browse every saved recipe, tap one to see and edit all its details — calories, macros, portion note — or delete it).

Want to see it before deploying? There's a live click-around preview with sample data — ask and I'll send the link again.

## What you're setting up

Three free accounts, about 20 minutes total:

1. **Supabase** — the database (weekly logs, bloodwork, snacks, training volume).
2. **Strava API app** — so the dashboard can pull your training data automatically.
3. **Vercel** — hosts the app itself, for free, at a URL you can both open.

Plus one already-have-it: your Anthropic API key, for the snack-photo calorie estimation.

## 1. Supabase (database)

1. Go to [supabase.com](https://supabase.com), sign up, and create a new project (any name, any region close to Estonia works well — e.g. Frankfurt).
2. Once it's provisioned, open **SQL Editor → New query**, paste the entire contents of `supabase/schema.sql` from this project, and click **Run**. This creates every table the app needs (`people`, `weekly_logs`, `bloodwork`, `recipes`, `recipe_ingredients`, `food_logs`, `settings`, `daily_notes`, `training_plan`, `training_volume`, `strava_accounts`) and seeds the two people rows — you do **not** need to also run the individual `migration_00N_*.sql` files, those are only for updating a database that was set up before that feature existed.
3. Go to **Storage** in the left sidebar → **New bucket** → name it exactly `snack-photos` → toggle **Public bucket** on → **Create bucket**. This is where snack photos are stored.
4. Go to **Settings → API**. You'll need three values from this page in step 5 below:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY` (not actually used by the app directly, but keep it handy)
   - **service_role** key (click "Reveal") → `SUPABASE_SERVICE_ROLE_KEY` — keep this one secret, it has full database access

## 2. Strava API app

1. Log in to Strava, go to [strava.com/settings/api](https://www.strava.com/settings/api).
2. Create an API application. For **Authorization Callback Domain**, you'll put in your eventual Vercel domain (see step 3 — you can come back and fix this after you have the URL; a placeholder like `localhost` works to create the app initially).
3. Note the **Client ID** and **Client Secret** shown on that page.
4. Each of you connects your *own* Strava account later, from inside the app itself — this app-level registration is shared, but the connection (which athlete) is per-person.

## 3. Deploy to Vercel

1. Push this project to a GitHub repo (private is fine) — or ask me to do this for you if you'd like a hand.
2. Go to [vercel.com](https://vercel.com), sign up (GitHub login is easiest), **Add New → Project**, import that repo.
3. Before deploying, add these Environment Variables (Project Settings → Environment Variables — or during the import flow):

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | from Supabase step 4 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase step 4 |
   | `SUPABASE_SERVICE_ROLE_KEY` | from Supabase step 4 |
   | `APP_PIN` | pick any PIN you'll both use to log in, e.g. `2468` |
   | `SESSION_SECRET` | a long random string — generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | `ANTHROPIC_API_KEY` | your Anthropic API key from console.anthropic.com |
   | `STRAVA_CLIENT_ID` | from Strava step 2 |
   | `STRAVA_CLIENT_SECRET` | from Strava step 2 |
   | `STRAVA_REDIRECT_URI` | `https://<your-vercel-domain>/api/strava/callback` — you'll only know the exact domain after the first deploy, so deploy once, then come back and set this, then redeploy |

4. Click **Deploy**. Once it's live, note the URL Vercel gives you (e.g. `nutriscore-xyz.vercel.app`).
5. Go back to Strava's API settings page and set **Authorization Callback Domain** to that domain (just the domain, no `https://` or path — e.g. `nutriscore-xyz.vercel.app`).
6. Go back to Vercel, set `STRAVA_REDIRECT_URI` to `https://nutriscore-xyz.vercel.app/api/strava/callback`, and redeploy (Vercel → Deployments → ⋯ → Redeploy) so the new env var takes effect.

## 4. First login

1. Open your Vercel URL. You'll see the login screen — pick Martin or Laura, enter the shared PIN.
2. Each of you should log in from your own device/browser (or the same device, different browser profile) so your session stays as "you" — this matters because your own Strava connection and your own weekly/bloodwork entries are tied to whichever profile you're logged in as.
3. In your own column, click **Connect Strava** and authorize. Do the same on Laura's device for her profile.
4. Click **Sync now** any time to pull the latest month's activities from Strava into the training volume tiles.

## On the photo calorie estimation — open-source vs. the API

You asked whether you could run an open-source vision model yourself instead of paying per-call for the Anthropic API. Short version: you can, but it's a real tradeoff, not a free upgrade.

**What's wired up now** (`app/api/snacks/estimate/route.js`) calls the Claude API with your `ANTHROPIC_API_KEY`. It costs a fraction of a cent per photo, needs zero infrastructure, and gives you Claude's actual vision quality — reasonably good at estimating portion size and identifying mixed plates.

**Self-hosting an open model** (e.g. LLaVA, Qwen2-VL, Moondream) means:

- Renting a GPU server (a model good enough to be useful needs at least ~8–16GB of VRAM) — realistically €50–150+/month for something always-on, or you pay per-request on a serverless GPU provider (Replicate, Runpod), which is often *not* cheaper than the Anthropic API at your volume (a couple of snack photos a day).
- Running your own inference server (Ollama with a vision model, or a small FastAPI wrapper around the model), which you'd then call from this same route instead of the Anthropic SDK — the rest of the app doesn't change, since it just expects JSON back.
- Meaningfully worse accuracy than Claude on food/portion estimation, in practice, unless you fine-tune — which is its own project.

Given you're already planning a passion-project paper on this next year, I'd suggest starting with the Anthropic API as-is (it'll cost you a few euros total over the season) and treating "swap in a self-hosted model and compare accuracy" as an interesting *experiment* for that paper, rather than the production path from day one. If you do want to go that route later, the swap is contained entirely to `app/api/snacks/estimate/route.js` — nothing else in the app needs to change.

## Project structure

- `app/dashboard/` — the main dashboard UI (React client components)
- `app/api/` — all the server routes: login/session, weekly/bloodwork/targets/training CRUD, snack logging + photo estimation, Strava OAuth + sync
- `lib/` — shared server logic: Supabase client, session/PIN auth, Strava API wrapper
- `supabase/schema.sql` — run this once in Supabase's SQL editor

## Local development

```bash
npm install
cp .env.example .env.local   # fill in real values
npm run dev
```

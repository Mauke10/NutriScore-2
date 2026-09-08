-- Nutriscore app schema
-- Run this once in Supabase: Project -> SQL Editor -> New query -> paste -> Run.

create extension if not exists "pgcrypto";

-- The two (and only two, for now) people this app tracks.
create table if not exists people (
  id text primary key,              -- 'martin' | 'laura'
  display_name text not null,
  created_at timestamptz not null default now()
);

insert into people (id, display_name) values
  ('martin', 'Martin'),
  ('laura', 'Laura')
on conflict (id) do nothing;

-- One row per person per week.
create table if not exists weekly_logs (
  id uuid primary key default gen_random_uuid(),
  person_id text not null references people(id),
  week_start date not null,
  weight_kg numeric,
  waist_cm numeric,
  sessions integer,
  avg_rpe numeric,
  hr_base_min integer,
  hr_hard_min integer,
  sleep_avg_hrs numeric,
  supplement_days integer,
  nutrition_adherence_pct numeric,
  calories_avg numeric,
  protein_avg numeric,
  notes text,
  updated_at timestamptz not null default now(),
  unique (person_id, week_start)
);

-- Quarterly-ish bloodwork panels.
create table if not exists bloodwork (
  id uuid primary key default gen_random_uuid(),
  person_id text not null references people(id),
  panel_date date not null,
  ferritin text,
  b12 text,
  folate text,
  vitamin_d text,
  notes text,
  updated_at timestamptz not null default now(),
  unique (person_id, panel_date)
);

-- Saved meals/recipes, mainly for mealprepped dishes eaten in repeat portions
-- (search "chicken curry", pull its saved macros, one-tap log). Shared across
-- both people, not owned by one person — either of you can log from either
-- of your saved recipes.
create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  meal_type text not null default 'meal', -- 'meal' | 'snack' — just the default tag applied when logged from this recipe
  portion_note text,
  created_by text references people(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists recipes_name_idx on recipes (lower(name));

-- Optional per-ingredient breakdown for a recipe (name, grams, macros per
-- 100g). When present, recipes.calories/protein_g/carbs_g/fat_g is kept as a
-- cached total computed from these; logging a recipe can then adjust any
-- ingredient's grams and the macros recompute.
create table if not exists recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  name text not null,
  grams numeric not null default 0,
  calories_per_100g numeric,
  protein_per_100g numeric,
  carbs_per_100g numeric,
  fat_per_100g numeric,
  sort_order int not null default 0
);
create index if not exists recipe_ingredients_recipe_idx on recipe_ingredients (recipe_id);

-- Food log: covers both prepped meals and incidental snacks/extras. meal_type
-- distinguishes the two so a mealprepped dinner is never lumped in with a
-- protein bar for tracking purposes, even though they share this table.
create table if not exists food_logs (
  id uuid primary key default gen_random_uuid(),
  person_id text not null references people(id),
  log_date date not null,
  logged_at timestamptz not null default now(),
  description text not null,
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  notes text,
  meal_type text not null default 'snack', -- 'meal' | 'snack'
  recipe_id uuid references recipes(id),
  source text not null default 'manual', -- 'manual' | 'photo'
  photo_url text,
  created_at timestamptz not null default now()
);
create index if not exists food_logs_person_date_idx on food_logs (person_id, log_date);

-- Daily calorie target, one row per person (upsert in place). accent_color is
-- that person's chosen color for their name/dot/ring/badges throughout the app.
create table if not exists settings (
  person_id text primary key references people(id),
  calorie_target numeric,
  accent_color text
);

-- Shared "morning notes" whiteboard on the Compete tab — one message per
-- person per day, clears itself out the next morning.
create table if not exists daily_notes (
  person_id text not null references people(id),
  note_date date not null,
  message text,
  updated_at timestamptz not null default now(),
  primary key (person_id, note_date)
);

-- Training calendar — one planned-activity line per person per day (e.g.
-- "Swim 1.5km"), shown on the Calendar tab and the "today" strip up top.
create table if not exists training_plan (
  person_id text not null references people(id),
  plan_date date not null,
  activity text,
  updated_at timestamptz not null default now(),
  primary key (person_id, plan_date)
);
create index if not exists training_plan_date_idx on training_plan (plan_date);

-- Monthly training volume, pulled from Strava (weight_moved_kg stays manual / Hevy-later).
create table if not exists training_volume (
  id uuid primary key default gen_random_uuid(),
  person_id text not null references people(id),
  month text not null, -- 'YYYY-MM'
  weight_moved_kg numeric,
  swim_km numeric,
  bike_km numeric,
  run_km numeric,
  source text not null default 'strava',
  notes text,
  updated_at timestamptz not null default now(),
  unique (person_id, month)
);

-- One Strava OAuth connection per person.
create table if not exists strava_accounts (
  person_id text primary key references people(id),
  athlete_id bigint,
  access_token text not null,
  refresh_token text not null,
  expires_at bigint not null, -- unix seconds
  scope text,
  connected_at timestamptz not null default now()
);

-- RLS on, but no public policies: every read/write in this app goes through Next.js
-- API routes using the service-role key, which bypasses RLS. The anon key is not
-- used to talk to these tables directly, so there is nothing to grant it here.
alter table people enable row level security;
alter table weekly_logs enable row level security;
alter table bloodwork enable row level security;
alter table food_logs enable row level security;
alter table settings enable row level security;
alter table training_volume enable row level security;
alter table strava_accounts enable row level security;
alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;
alter table daily_notes enable row level security;
alter table training_plan enable row level security;

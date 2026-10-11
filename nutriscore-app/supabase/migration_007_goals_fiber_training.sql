-- Migration 007: standalone Goals (protein + monthly swim/bike/run targets),
-- fiber tracking on food logs & recipes, and a manual training session log.
-- Run once in Supabase: Project -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run (every statement is if-not-exists / add-column-if-not-exists).

alter table settings add column if not exists protein_target numeric;
alter table settings add column if not exists swim_goal_km numeric;
alter table settings add column if not exists bike_goal_km numeric;
alter table settings add column if not exists run_goal_km numeric;

alter table food_logs add column if not exists fiber_g numeric;
alter table recipes add column if not exists fiber_g numeric;
alter table recipe_ingredients add column if not exists fiber_per_100g numeric;

create table if not exists training_sessions (
  id uuid primary key default gen_random_uuid(),
  person_id text not null references people(id),
  session_date date not null,
  activity_type text not null default 'other',
  distance_km numeric,
  duration_min numeric,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists training_sessions_person_date_idx on training_sessions (person_id, session_date);

alter table training_sessions enable row level security;

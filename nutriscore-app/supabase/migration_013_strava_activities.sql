-- Migration 013: individual Strava activities + how a workout felt.
-- Safe to re-run.
--
-- Until now the Strava sync only stored monthly swim/bike/run totals
-- (training_volume). The Training tab now lists each workout (name, pace,
-- heart rate), counts hours per day/week, finds your longest swim/ride/run,
-- and ticks off Calendar plans, so the sync also keeps one row per activity
-- here. `id` is Strava's own activity id, so re-syncing upserts in place.
-- training_volume stays: the sync still writes its monthly totals (the
-- Compete tab reads them) and weight_moved_kg still lives there.

create table if not exists strava_activities (
  id bigint primary key,
  person_id text not null references people(id),
  activity_date date not null,           -- local start date (Strava's start_date_local)
  start_time timestamptz,
  name text,
  sport text not null default 'other',   -- swim | bike | run | strength | mobility | other
  sport_type text,                       -- Strava's own: Ride, VirtualRide, TrailRun, …
  distance_km numeric,
  moving_min numeric,
  elevation_m numeric,
  avg_speed_kmh numeric,
  avg_hr numeric,
  updated_at timestamptz not null default now()
);
create index if not exists strava_activities_person_date_idx on strava_activities (person_id, activity_date);

alter table strava_activities enable row level security;

-- "How did it feel?" on a hand-logged workout: 1 tough … 4 great, optional.
alter table training_sessions add column if not exists feel smallint;
do $$ begin
  alter table training_sessions add constraint training_sessions_feel_check check (feel between 1 and 4);
exception when duplicate_object then null; end $$;

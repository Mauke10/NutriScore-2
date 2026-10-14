-- Migration 011: settings behind the new side menu (drawer → Settings).
-- Safe to re-run. All per person, on the existing settings row.
--
--   race_name / race_date  countdown at the top of the drawer
--   day_end_hour           0–4: food logged before this hour counts for the
--                          day before (late snacks after midnight)
--   share_meals            false = the other person sees only your totals,
--                          not what you ate (enforced in GET /api/snacks)
--   show_fiber             hide the Fiber macro if you don't track it
--   strava_autosync        pull new Strava activities when the app opens

alter table settings add column if not exists race_name text not null default 'Ironman 70.3 Tallinn';
alter table settings add column if not exists race_date date;
alter table settings add column if not exists day_end_hour smallint not null default 0;
alter table settings add column if not exists share_meals boolean not null default true;
alter table settings add column if not exists show_fiber boolean not null default true;
alter table settings add column if not exists strava_autosync boolean not null default true;

do $$ begin
  alter table settings add constraint settings_day_end_hour_check check (day_end_hour between 0 and 4);
exception when duplicate_object then null; end $$;

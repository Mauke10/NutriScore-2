-- Migration 012: several planned sessions per day (Calendar tab).
-- Safe to re-run.
--
-- training_plan allowed one line per person per day (its primary key is
-- (person_id, plan_date)), so a morning swim + evening run had to share one
-- text box. This table holds one row per planned session instead. The sport
-- isn't stored: lib/trainingSports.js reads it from the text, the same way
-- food emojis are guessed from food names. `done` is the manual tick; a
-- matching manually logged training session also counts as done (worked out
-- in the app, not stored).

create table if not exists training_plan_items (
  id uuid primary key default gen_random_uuid(),
  person_id text not null references people(id),
  plan_date date not null,
  activity text not null,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists training_plan_items_date_idx on training_plan_items (plan_date);

alter table training_plan_items enable row level security;

-- Bring the old one-per-day plans across. Only days with nothing in the new
-- table yet, so re-running doesn't duplicate them. training_plan itself is
-- left in place (nothing reads it any more) and can be dropped later.
insert into training_plan_items (person_id, plan_date, activity, created_at, updated_at)
select p.person_id, p.plan_date, trim(p.activity), p.updated_at, p.updated_at
from training_plan p
where coalesce(trim(p.activity), '') <> ''
  and not exists (
    select 1 from training_plan_items i where i.person_id = p.person_id and i.plan_date = p.plan_date
  );

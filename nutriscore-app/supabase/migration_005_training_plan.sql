-- Adds the shared training calendar — one planned-activity line per person
-- per day (e.g. "Swim 1.5km"), shown on the new Calendar tab and as the
-- "today" strip under the Nutriscore header. Safe to run even if you're not
-- sure whether you already have it — Supabase -> SQL Editor -> New query ->
-- paste -> Run.

create table if not exists training_plan (
  person_id text not null references people(id),
  plan_date date not null,
  activity text,
  updated_at timestamptz not null default now(),
  primary key (person_id, plan_date)
);
create index if not exists training_plan_date_idx on training_plan (plan_date);

alter table training_plan enable row level security;

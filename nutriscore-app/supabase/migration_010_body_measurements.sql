-- Migration 010: body measurements (Body tab → Measurements card).
-- Safe to re-run.
--
-- One row per person per day per body part, so tracking a new part never
-- needs a schema change. `part` is a key from app/dashboard/measurementParts.js
-- ("waist", "thigh", "body_fat") or "custom:<name>" for parts you add
-- yourself. Re-logging the same day overwrites (upsert on the unique key),
-- the same edit-by-resubmitting pattern as weekly_logs.

create table if not exists body_measurements (
  id uuid primary key default gen_random_uuid(),
  person_id text not null references people(id),
  measured_on date not null,
  part text not null,
  value numeric not null,
  created_at timestamptz not null default now(),
  unique (person_id, measured_on, part)
);
create index if not exists body_measurements_person_part_idx on body_measurements (person_id, part, measured_on);

alter table body_measurements enable row level security;

-- Which parts each person has chosen to track, in display order.
alter table settings add column if not exists measurement_parts text[] not null default '{}';

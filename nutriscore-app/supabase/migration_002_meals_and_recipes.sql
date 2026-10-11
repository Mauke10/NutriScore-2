-- Migration 002: meal-vs-snack tracking + saved recipes.
-- Run this once in Supabase -> SQL Editor -> New query, if you already ran
-- the original schema.sql before this file existed. Safe to run more than
-- once (every statement is guarded).

create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  meal_type text not null default 'meal',
  portion_note text,
  created_by text references people(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists recipes_name_idx on recipes (lower(name));
alter table recipes enable row level security;

alter table food_logs add column if not exists meal_type text not null default 'snack';
alter table food_logs add column if not exists recipe_id uuid references recipes(id);

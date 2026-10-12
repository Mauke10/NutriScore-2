-- Migration 009: food database for ingredient-based logging.
-- A searchable `foods` table (per-100g macros) that the ingredient builder
-- in the log form and the recipe editor look things up in, so you only type
-- grams instead of every macro. Seeded from Fineli (Finnish food composition
-- database, THL, CC BY 4.0) by seed_009_fineli_foods.sql, with Estonian
-- names/synonyms for the common stuff; anything missing can be added from
-- the app as your own food (source = 'custom').
-- Run once in Supabase: Project -> SQL Editor -> New query -> paste -> Run,
-- then run seed_009_fineli_foods.sql.
-- Safe to re-run (if-not-exists / create-or-replace everywhere).

-- Trigram index makes "contains" search (ilike '%kana%') fast. Lives in the
-- extensions schema like pgcrypto does, not public.
create extension if not exists pg_trgm with schema extensions;

create table if not exists foods (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'custom', -- 'fineli' | 'custom'
  source_id text,                        -- Fineli FOODID when source = 'fineli'
  name text not null,                    -- display name: Estonian when we have one, else English
  name_en text,
  name_fi text,
  aliases text[] not null default '{}',  -- extra search words ("kana", "riis", "skyr")
  search_text text not null default '',  -- lowercased, accent-stripped names + aliases; written by the app/seed (lib/foodText.js)
  kind text,                             -- 'food' (an ingredient) | 'dish' (a Fineli mixed dish)
  calories_per_100g numeric,
  protein_per_100g numeric,
  carbs_per_100g numeric,
  fat_per_100g numeric,
  fiber_per_100g numeric,
  use_count integer not null default 0,  -- how often either of you has logged it; most-used float to the top of search
  last_used_at timestamptz,
  created_by text references people(id),
  created_at timestamptz not null default now(),
  unique (source, source_id)
);
create index if not exists foods_search_trgm_idx on foods using gin (search_text extensions.gin_trgm_ops);

alter table foods enable row level security;

-- Which food a recipe ingredient was picked from (null for hand-typed ones).
-- The per-100g numbers are still copied onto the ingredient row, so fixing
-- a food later never silently changes an old recipe.
alter table recipe_ingredients add column if not exists food_id uuid references foods(id) on delete set null;

-- Called after logging/saving with ingredients, to rank your usual foods first.
create or replace function bump_food_use(food_ids uuid[])
returns void
language sql
security invoker
set search_path = public
as $$
  update foods set use_count = use_count + 1, last_used_at = now() where id = any(food_ids);
$$;
revoke execute on function bump_food_use(uuid[]) from public, anon, authenticated;

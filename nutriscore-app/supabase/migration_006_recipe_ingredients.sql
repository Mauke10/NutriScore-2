-- Migration 006: ingredient-based recipes.
-- A recipe used to be one fixed total (calories/protein/carbs/fat). Now it
-- can optionally be built from ingredients (name, grams, macros per 100g),
-- so its total is computed from them — and when you log it, you can adjust
-- any ingredient's grams ("only had 150g of the rice this time") and the
-- macros recompute. recipes.calories/protein_g/carbs_g/fat_g stay as they
-- were: a cached total, kept in sync from the ingredients whenever a recipe
-- is saved with them. A recipe saved without ingredients (e.g. the quick
-- "save this as a recipe" tick when logging a snack) still works exactly as
-- before. Safe to run more than once.

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
alter table recipe_ingredients enable row level security;

-- Adds a per-person accent color, used for that person's name/dot/ring/badges
-- everywhere in the app (replaces the old fixed purple-for-Martin,
-- pink-for-Laura). Safe to run even if you're not sure whether you already
-- have it — Supabase -> SQL Editor -> New query -> paste -> Run.

alter table settings add column if not exists accent_color text;

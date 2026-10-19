-- Migration 014: effort marker on manually logged workouts.
-- Which scale depends on the sport (lib/trainingSports.js EFFORTS):
--   run, bike         z1 … z5        (heart-rate / power zones)
--   swim              rpe1 … rpe5    (how hard it felt, 1–5)
--   everything else   light | moderate | hard | max
-- The API only stores a key valid for the session's sport, else null.
-- Safe to re-run.

alter table training_sessions add column if not exists effort text;

-- Migration 008: per-person PIN, settable from Settings instead of sharing
-- one PIN (the APP_PIN env var) between both of you.
-- Run once in Supabase: Project -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run (add-column-if-not-exists).

alter table people add column if not exists pin_hash text;

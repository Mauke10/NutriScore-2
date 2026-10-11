-- Adds the shared "morning notes" whiteboard on the Compete tab — one message
-- per person per day, so you can each leave the other a note that clears
-- itself out the next morning. Safe to run even if you're not sure whether
-- you already have it — Supabase -> SQL Editor -> New query -> paste -> Run.

create table if not exists daily_notes (
  person_id text not null references people(id),
  note_date date not null,
  message text,
  updated_at timestamptz not null default now(),
  primary key (person_id, note_date)
);

alter table daily_notes enable row level security;

import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase";
import { currentPerson } from "../../../lib/auth";

// Returns both people's whiteboard notes for one date.
export async function GET(request) {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "Missing date" }, { status: 400 });

  const supabase = supabaseServer();
  const { data, error } = await supabase.from("daily_notes").select("*").eq("note_date", date);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const notes = { martin: null, laura: null };
  for (const row of data || []) {
    notes[row.person_id] = { message: row.message || "", updatedAt: row.updated_at };
  }
  return NextResponse.json({ notes });
}

// Always sets the logged-in person's own note for the given date.
export async function POST(request) {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const noteDate = body.noteDate;
  if (!noteDate) return NextResponse.json({ error: "Missing noteDate" }, { status: 400 });
  const message = typeof body.message === "string" ? body.message.slice(0, 500) : "";

  const supabase = supabaseServer();
  const { error } = await supabase
    .from("daily_notes")
    .upsert(
      { person_id: me, note_date: noteDate, message, updated_at: new Date().toISOString() },
      { onConflict: "person_id,note_date" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

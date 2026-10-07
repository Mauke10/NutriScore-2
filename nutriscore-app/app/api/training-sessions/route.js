import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase";
import { currentPerson } from "../../../lib/auth";

const TYPES = ["swim", "bike", "run", "strength", "other"];

// Manually logged workouts (there's no Hevy/gym-tracker connector yet, so
// this is the "I did it, just let me type it in" path). Deliberately a
// separate table from training_volume (the Strava-synced one) — see
// migration_007 — so re-syncing Strava can never clobber something you
// logged by hand, and vice versa. The dashboard adds the two together
// client-side when showing "actual vs goal" for the month.
//
// GET /api/training-sessions?person=martin&month=2026-09 — month filters to
// that calendar month (for the goal-progress math); omit it to get the
// most recent entries across all months (for the "recent sessions" list).
export async function GET(request) {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const person = searchParams.get("person");
  const month = searchParams.get("month");
  if (!["martin", "laura"].includes(person)) {
    return NextResponse.json({ error: "Bad person" }, { status: 400 });
  }
  if (month && !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month must be YYYY-MM" }, { status: 400 });
  }

  const supabase = supabaseServer();
  let query = supabase
    .from("training_sessions")
    .select("*")
    .eq("person_id", person)
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (month) {
    query = query.gte("session_date", month + "-01").lt("session_date", nextMonth(month) + "-01");
  } else {
    query = query.limit(60);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data });
}

// POST — log one manual session under the caller's own person_id.
export async function POST(request) {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const sessionDate = (body.sessionDate || "").toString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) {
    return NextResponse.json({ error: "sessionDate must be YYYY-MM-DD" }, { status: 400 });
  }
  const activityType = TYPES.includes(body.activityType) ? body.activityType : "other";

  const row = {
    person_id: me,
    session_date: sessionDate,
    activity_type: activityType,
    distance_km: numOrNull(body.distanceKm),
    duration_min: numOrNull(body.durationMin),
    notes: (body.notes || "").toString()
  };

  const supabase = supabaseServer();
  const { error } = await supabase.from("training_sessions").insert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/training-sessions?id=<uuid> — only your own entries.
export async function DELETE(request) {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = supabaseServer();
  const { error } = await supabase.from("training_sessions").delete().eq("id", id).eq("person_id", me);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

function numOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function nextMonth(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 1)); // m is already next month's index (0-based) since input m is 1-based current month
  return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
}

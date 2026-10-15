import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase";
import { currentPerson } from "../../../lib/auth";

const TYPES = ["swim", "bike", "run", "strength", "mobility", "other"];

// "How did it feel": 1 tough … 4 great, or null.
function feelOrNull(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 4 ? n : null;
}

// Manually logged workouts (there's no Hevy/gym-tracker connector yet, so
// this is the "I did it, just let me type it in" path). Deliberately a
// separate table from training_volume (the Strava-synced one) — see
// migration_007 — so re-syncing Strava can never clobber something you
// logged by hand, and vice versa. The Training tab reads both through
// /api/training-feed.
//
// GET /api/training-sessions?person=martin&month=2026-09 — month filters to
// that calendar month; omit it to get the most recent entries across all
// months.
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
    notes: (body.notes || "").toString(),
    feel: feelOrNull(body.feel)
  };

  const supabase = supabaseServer();
  const { error } = await supabase.from("training_sessions").insert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// PATCH — edit one of your own manually-logged sessions. Unlike weekly_logs
// and bloodwork (unique per date, so resubmitting the same date upserts in
// place), training_sessions allows several rows per day with no natural key
// to resubmit against — each row only has its generated id — so editing
// genuinely needs its own partial-update endpoint, the same shape as the one
// already built for food_logs (PATCH /api/snacks).
export async function PATCH(request) {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const id = (body.id || "").toString();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const row = {};
  if (body.sessionDate !== undefined) {
    const sessionDate = (body.sessionDate || "").toString();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) {
      return NextResponse.json({ error: "sessionDate must be YYYY-MM-DD" }, { status: 400 });
    }
    row.session_date = sessionDate;
  }
  if (body.activityType !== undefined) {
    row.activity_type = TYPES.includes(body.activityType) ? body.activityType : "other";
  }
  if (body.distanceKm !== undefined) row.distance_km = numOrNull(body.distanceKm);
  if (body.durationMin !== undefined) row.duration_min = numOrNull(body.durationMin);
  if (body.notes !== undefined) row.notes = (body.notes || "").toString();
  if (body.feel !== undefined) row.feel = feelOrNull(body.feel);

  if (Object.keys(row).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { error } = await supabase.from("training_sessions").update(row).eq("id", id).eq("person_id", me);
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

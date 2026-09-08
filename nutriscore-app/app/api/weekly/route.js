import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase";
import { currentPerson } from "../../../lib/auth";

// GET /api/weekly?person=martin&limit=60 — either person's data; anyone
// logged in (Martin or Laura) can read both, since this is a shared tracker.
export async function GET(request) {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const person = searchParams.get("person");
  const limit = Math.min(Number(searchParams.get("limit")) || 60, 200);
  if (!["martin", "laura"].includes(person)) {
    return NextResponse.json({ error: "Bad person" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("weekly_logs")
    .select("*")
    .eq("person_id", person)
    .order("week_start", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data });
}

// POST /api/weekly — always writes to the logged-in person's own row for
// that week (upsert). You can't log a week on someone else's behalf here.
export async function POST(request) {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { weekStart } = body || {};
  if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return NextResponse.json({ error: "weekStart must be YYYY-MM-DD" }, { status: 400 });
  }

  const num = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

  const row = {
    person_id: me,
    week_start: weekStart,
    weight_kg: num(body.weightKg),
    waist_cm: num(body.waistCm),
    sessions: num(body.sessions),
    avg_rpe: num(body.avgRpe),
    hr_base_min: num(body.hrBaseMin),
    hr_hard_min: num(body.hrHardMin),
    sleep_avg_hrs: num(body.sleepAvgHrs),
    supplement_days: num(body.supplementDays),
    nutrition_adherence_pct: num(body.nutritionAdherencePct),
    calories_avg: num(body.caloriesAvg),
    protein_avg: num(body.proteinAvg),
    notes: body.notes || "",
    updated_at: new Date().toISOString()
  };

  const supabase = supabaseServer();
  const { error } = await supabase
    .from("weekly_logs")
    .upsert(row, { onConflict: "person_id,week_start" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/weekly?weekStart=YYYY-MM-DD — only your own row.
export async function DELETE(request) {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const weekStart = searchParams.get("weekStart");
  if (!weekStart) return NextResponse.json({ error: "weekStart required" }, { status: 400 });

  const supabase = supabaseServer();
  const { error } = await supabase
    .from("weekly_logs")
    .delete()
    .eq("person_id", me)
    .eq("week_start", weekStart);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

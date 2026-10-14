import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase";
import { currentPerson } from "../../../lib/auth";
import { isValidPartKey } from "../../dashboard/measurementParts";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/measurements?person=martin → { tracked: [partKey…], entries:
// [{ date, part, value }] oldest first }. Waist also pulls in the waist
// numbers from the weekly check-in (dated to the week's Monday) so it isn't
// typed twice; a measurement logged on the same day wins.
export async function GET(request) {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const person = searchParams.get("person");
  if (!["martin", "laura"].includes(person)) return NextResponse.json({ error: "Bad person" }, { status: 400 });

  const supabase = supabaseServer();
  const [settingsRes, entriesRes, weeklyRes] = await Promise.all([
    supabase.from("settings").select("measurement_parts").eq("person_id", person).maybeSingle(),
    supabase.from("body_measurements").select("measured_on, part, value").eq("person_id", person).order("measured_on", { ascending: true }).limit(2000),
    supabase.from("weekly_logs").select("week_start, waist_cm").eq("person_id", person).not("waist_cm", "is", null)
  ]);
  const error = settingsRes.error || entriesRes.error || weeklyRes.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const entries = (entriesRes.data || []).map((r) => ({ date: r.measured_on, part: r.part, value: Number(r.value) }));
  const waistDates = new Set(entries.filter((e) => e.part === "waist").map((e) => e.date));
  for (const w of weeklyRes.data || []) {
    if (!waistDates.has(w.week_start)) entries.push({ date: w.week_start, part: "waist", value: Number(w.waist_cm), fromWeekly: true });
  }
  entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return NextResponse.json({ tracked: settingsRes.data?.measurement_parts || [], entries });
}

// POST /api/measurements — your own numbers for one day.
// JSON { date: "YYYY-MM-DD", values: { waist: "84.5", hips: "" … } }.
// Blank values are skipped (not measured that day), so they never wipe an
// earlier number; re-saving a day overwrites that day's numbers.
export async function POST(request) {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const date = (body.date || "").toString();
  if (!DATE_RE.test(date)) return NextResponse.json({ error: "Pick a date." }, { status: 400 });

  const rows = [];
  for (const [part, raw] of Object.entries(body.values || {})) {
    if (raw === "" || raw == null) continue;
    const value = Number(raw);
    if (!isValidPartKey(part)) return NextResponse.json({ error: "Unknown measurement: " + part }, { status: 400 });
    if (!Number.isFinite(value) || value <= 0 || value > 400) return NextResponse.json({ error: "That number doesn't look right." }, { status: 400 });
    rows.push({ person_id: me, measured_on: date, part, value });
  }
  if (!rows.length) return NextResponse.json({ error: "Fill in at least one number." }, { status: 400 });

  const supabase = supabaseServer();
  const { error } = await supabase.from("body_measurements").upsert(rows, { onConflict: "person_id,measured_on,part" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, saved: rows.length });
}

// PUT /api/measurements — which parts you track: JSON { tracked: [partKey…] }.
// Only changes the list; numbers already logged for a part you stop
// tracking stay in the database and come back if you turn it on again.
export async function PUT(request) {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const tracked = [...new Set(Array.isArray(body.tracked) ? body.tracked : [])].filter(isValidPartKey).slice(0, 30);

  const supabase = supabaseServer();
  const { error } = await supabase.from("settings").upsert({ person_id: me, measurement_parts: tracked }, { onConflict: "person_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, tracked });
}

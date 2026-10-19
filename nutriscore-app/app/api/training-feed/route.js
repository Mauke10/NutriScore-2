import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase";
import { currentPerson } from "../../../lib/auth";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/training-feed?person=martin&from=YYYY-MM-DD&to=YYYY-MM-DD[&records=1]
// Everything the Training tab draws for one person over a date range:
// - workouts: Strava activities and hand-logged sessions in one list, newest
//   first, in one shape (see toWorkout below)
// - plans: their Calendar plans in the range (for "done / planned")
// - records (with records=1): longest single swim, ride and run ever, for the
//   race-distance bars
export async function GET(request) {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const person = searchParams.get("person");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!["martin", "laura"].includes(person)) return NextResponse.json({ error: "Bad person" }, { status: 400 });
  if (!DATE.test(from || "") || !DATE.test(to || "")) {
    return NextResponse.json({ error: "from and to must be YYYY-MM-DD" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const [strava, manual, plans] = await Promise.all([
    supabase.from("strava_activities").select("*").eq("person_id", person).gte("activity_date", from).lte("activity_date", to),
    supabase.from("training_sessions").select("*").eq("person_id", person).gte("session_date", from).lte("session_date", to),
    supabase
      .from("training_plan_items")
      .select("id, plan_date, activity, done")
      .eq("person_id", person)
      .gte("plan_date", from)
      .lte("plan_date", to)
  ]);
  const failed = [strava, manual, plans].find((r) => r.error);
  if (failed) return NextResponse.json({ error: failed.error.message }, { status: 500 });

  const workouts = [...strava.data.map(fromStrava), ...manual.data.map(fromManual)].sort(
    (a, b) => b.date.localeCompare(a.date) || (b.sortKey || "").localeCompare(a.sortKey || "")
  );

  const body = { workouts, plans: plans.data };
  if (searchParams.get("records") === "1") body.records = await records(supabase, person);
  return NextResponse.json(body);
}

// The longest single workout per endurance sport, across both sources.
async function records(supabase, person) {
  const out = {};
  for (const sport of ["swim", "bike", "run"]) {
    const [s, m] = await Promise.all([
      supabase
        .from("strava_activities")
        .select("distance_km, activity_date")
        .eq("person_id", person)
        .eq("sport", sport)
        .not("distance_km", "is", null)
        .order("distance_km", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("training_sessions")
        .select("distance_km, session_date")
        .eq("person_id", person)
        .eq("activity_type", sport)
        .not("distance_km", "is", null)
        .order("distance_km", { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);
    const best = [s.data && { km: Number(s.data.distance_km), date: s.data.activity_date }, m.data && { km: Number(m.data.distance_km), date: m.data.session_date }]
      .filter(Boolean)
      .sort((a, b) => b.km - a.km)[0];
    out[sport] = best || null;
  }
  return out;
}

function fromStrava(a) {
  return {
    id: "strava:" + a.id,
    source: "strava",
    stravaId: String(a.id),
    date: a.activity_date,
    sortKey: a.start_time || "",
    sport: a.sport,
    name: a.name || "",
    distanceKm: a.distance_km != null ? Number(a.distance_km) : null,
    minutes: a.moving_min != null ? Number(a.moving_min) : null,
    speedKmh: a.avg_speed_kmh != null ? Number(a.avg_speed_kmh) : null,
    avgHr: a.avg_hr != null ? Math.round(Number(a.avg_hr)) : null,
    elevationM: a.elevation_m != null ? Math.round(Number(a.elevation_m)) : null,
    feel: null,
    effort: null
  };
}

function fromManual(s) {
  return {
    id: "manual:" + s.id,
    source: "manual",
    sessionId: s.id,
    date: s.session_date,
    sortKey: s.created_at || "",
    sport: s.activity_type || "other",
    name: s.notes || "",
    distanceKm: s.distance_km != null ? Number(s.distance_km) : null,
    minutes: s.duration_min != null ? Number(s.duration_min) : null,
    speedKmh: null,
    avgHr: null,
    elevationM: null,
    feel: s.feel ?? null,
    effort: s.effort ?? null
  };
}

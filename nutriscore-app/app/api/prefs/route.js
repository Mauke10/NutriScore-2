import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase";
import { currentPerson } from "../../../lib/auth";

// The drawer's Settings page (migration 011), stored on the per-person
// settings row next to the calorie targets.
const DEFAULTS = { raceName: "Ironman 70.3 Tallinn", raceDate: null, dayEndHour: 0, shareMeals: true, showFiber: true, stravaAutosync: true };

function toClient(row) {
  if (!row) return { ...DEFAULTS };
  return {
    raceName: row.race_name ?? DEFAULTS.raceName,
    raceDate: row.race_date ?? null,
    dayEndHour: row.day_end_hour ?? 0,
    shareMeals: row.share_meals ?? true,
    showFiber: row.show_fiber ?? true,
    stravaAutosync: row.strava_autosync ?? true
  };
}

// GET /api/prefs → your own settings.
export async function GET() {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("settings")
    .select("race_name, race_date, day_end_hour, share_meals, show_fiber, strava_autosync")
    .eq("person_id", me)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(toClient(data));
}

// POST /api/prefs — partial update of your own settings; fields left out
// stay as they are. { raceName?, raceDate? ("YYYY-MM-DD" | null),
// dayEndHour? (0–4), shareMeals?, showFiber?, stravaAutosync? }
export async function POST(request) {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const row = { person_id: me };
  if ("raceName" in body) row.race_name = (body.raceName || "").toString().trim().slice(0, 60) || DEFAULTS.raceName;
  if ("raceDate" in body) {
    if (body.raceDate === null || body.raceDate === "") row.race_date = null;
    else if (/^\d{4}-\d{2}-\d{2}$/.test(body.raceDate)) row.race_date = body.raceDate;
    else return NextResponse.json({ error: "Bad date" }, { status: 400 });
  }
  if ("dayEndHour" in body) {
    const h = Number(body.dayEndHour);
    if (!Number.isInteger(h) || h < 0 || h > 4) return NextResponse.json({ error: "Day end must be 0–4" }, { status: 400 });
    row.day_end_hour = h;
  }
  for (const [k, col] of [["shareMeals", "share_meals"], ["showFiber", "show_fiber"], ["stravaAutosync", "strava_autosync"]]) {
    if (k in body) row[col] = !!body[k];
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("settings")
    .upsert(row, { onConflict: "person_id" })
    .select("race_name, race_date, day_end_hour, share_meals, show_fiber, strava_autosync")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(toClient(data));
}

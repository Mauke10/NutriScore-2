import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase";
import { currentPerson } from "../../../lib/auth";

// GET /api/targets?person=martin — daily calorie/protein targets plus the
// standing monthly swim/bike/run distance goals, all stored on the same
// per-person settings row (same shape as the original calorie-only target).
export async function GET(request) {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const person = searchParams.get("person");
  if (!["martin", "laura"].includes(person)) {
    return NextResponse.json({ error: "Bad person" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("person_id", person)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    calorieTarget: data ? data.calorie_target : null,
    proteinTarget: data ? data.protein_target : null,
    swimGoalKm: data ? data.swim_goal_km : null,
    bikeGoalKm: data ? data.bike_goal_km : null,
    runGoalKm: data ? data.run_goal_km : null
  });
}

// Always sets the logged-in person's own targets/goals. Any field left out
// of the body is left untouched on the existing row (partial update), so
// the Goals panel's single "Save" can be called whichever fields changed.
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
  if ("calorieTarget" in body) row.calorie_target = numOrNull(body.calorieTarget);
  if ("proteinTarget" in body) row.protein_target = numOrNull(body.proteinTarget);
  if ("swimGoalKm" in body) row.swim_goal_km = numOrNull(body.swimGoalKm);
  if ("bikeGoalKm" in body) row.bike_goal_km = numOrNull(body.bikeGoalKm);
  if ("runGoalKm" in body) row.run_goal_km = numOrNull(body.runGoalKm);

  const supabase = supabaseServer();
  const { error } = await supabase.from("settings").upsert(row, { onConflict: "person_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

function numOrNull(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase";
import { currentPerson } from "../../../lib/auth";

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
    .from("training_volume")
    .select("*")
    .eq("person_id", person)
    .order("month", { ascending: false })
    .limit(36);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data });
}

// Swim/bike/run come from Strava sync. This route only ever sets
// weight_moved_kg (there's no Hevy connector yet) — it never overwrites the
// Strava-derived distance columns, thanks to upsert's partial-update-on-conflict.
export async function POST(request) {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { month } = body || {};
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month must be YYYY-MM" }, { status: 400 });
  }

  const weightMovedKg = body.weightMovedKg === "" || body.weightMovedKg == null ? null : Number(body.weightMovedKg);

  const supabase = supabaseServer();
  const { error } = await supabase
    .from("training_volume")
    .upsert(
      { person_id: me, month, weight_moved_kg: weightMovedKg, updated_at: new Date().toISOString() },
      { onConflict: "person_id,month" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

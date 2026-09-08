import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase";
import { currentPerson } from "../../../lib/auth";

function monthRange(month) {
  const [y, m] = month.split("-").map(Number);
  const start = month + "-01";
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const end = nextY + "-" + String(nextM).padStart(2, "0") + "-01";
  return { start, end };
}

// ?date=YYYY-MM-DD -> both people's activity for that one day.
// ?month=YYYY-MM   -> every entry (both people) in that month, for the calendar grid.
export async function GET(request) {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const month = searchParams.get("month");
  const supabase = supabaseServer();

  if (date) {
    const { data, error } = await supabase.from("training_plan").select("*").eq("plan_date", date);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const entries = { martin: null, laura: null };
    for (const row of data || []) entries[row.person_id] = row.activity || null;
    return NextResponse.json({ entries });
  }

  if (month) {
    const { start, end } = monthRange(month);
    const { data, error } = await supabase
      .from("training_plan")
      .select("*")
      .gte("plan_date", start)
      .lt("plan_date", end);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ entries: data || [] });
  }

  return NextResponse.json({ error: "Missing date or month" }, { status: 400 });
}

// Always sets the logged-in person's own activity for the given date.
export async function POST(request) {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const planDate = body.planDate;
  if (!planDate) return NextResponse.json({ error: "Missing planDate" }, { status: 400 });
  const activity = typeof body.activity === "string" ? body.activity.slice(0, 120) : "";

  const supabase = supabaseServer();
  const { error } = await supabase
    .from("training_plan")
    .upsert(
      { person_id: me, plan_date: planDate, activity, updated_at: new Date().toISOString() },
      { onConflict: "person_id,plan_date" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

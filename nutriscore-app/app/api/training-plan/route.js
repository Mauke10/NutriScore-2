import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase";
import { currentPerson } from "../../../lib/auth";

// Planned sessions for the Calendar tab and the "today" strip — any number
// per person per day (training_plan_items, migration 012).

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function cleanActivity(v) {
  return typeof v === "string" ? v.trim().slice(0, 120) : "";
}

// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD → both people's plans in that range
// (inclusive), oldest first, plus the workouts done in the same range (hand-
// logged and Strava) so the app can tick plans off.
export async function GET(request) {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!DATE.test(from || "") || !DATE.test(to || "")) {
    return NextResponse.json({ error: "from and to must be YYYY-MM-DD" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const [plans, sessions, strava] = await Promise.all([
    supabase
      .from("training_plan_items")
      .select("id, person_id, plan_date, activity, done")
      .gte("plan_date", from)
      .lte("plan_date", to)
      .order("plan_date", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("training_sessions")
      .select("person_id, session_date, activity_type")
      .gte("session_date", from)
      .lte("session_date", to),
    supabase
      .from("strava_activities")
      .select("person_id, activity_date, sport")
      .gte("activity_date", from)
      .lte("activity_date", to)
  ]);
  if (plans.error) return NextResponse.json({ error: plans.error.message }, { status: 500 });
  // Strava activities count as logged sessions too, in the same shape.
  const done = [
    ...(sessions.data || []),
    ...(strava.data || []).map((a) => ({ person_id: a.person_id, session_date: a.activity_date, activity_type: a.sport }))
  ];
  return NextResponse.json({ entries: plans.data || [], sessions: done });
}

// POST { planDate, activity, alsoPartner? } → adds a session to your own
// plan. alsoPartner adds the same line to the other person's day too (for
// sessions you're doing together) — the one place you write to their plan.
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
  const activity = cleanActivity(body.activity);
  if (!DATE.test(planDate || "")) return NextResponse.json({ error: "Missing planDate" }, { status: 400 });
  if (!activity) return NextResponse.json({ error: "What's the plan?" }, { status: 400 });

  const rows = [{ person_id: me, plan_date: planDate, activity }];
  if (body.alsoPartner === true) rows.push({ person_id: me === "martin" ? "laura" : "martin", plan_date: planDate, activity });

  const supabase = supabaseServer();
  const { data, error } = await supabase.from("training_plan_items").insert(rows).select("id, person_id, plan_date, activity, done");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data });
}

// PATCH { id, activity?, planDate?, done? } → your own plans only.
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
  if ("activity" in body) {
    row.activity = cleanActivity(body.activity);
    if (!row.activity) return NextResponse.json({ error: "What's the plan?" }, { status: 400 });
  }
  if ("planDate" in body) {
    if (!DATE.test(body.planDate || "")) return NextResponse.json({ error: "Bad planDate" }, { status: 400 });
    row.plan_date = body.planDate;
  }
  if (typeof body.done === "boolean") row.done = body.done;
  if (Object.keys(row).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  row.updated_at = new Date().toISOString();

  const supabase = supabaseServer();
  const { error } = await supabase.from("training_plan_items").update(row).eq("id", id).eq("person_id", me);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE ?id=<uuid> → your own plans only.
export async function DELETE(request) {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = supabaseServer();
  const { error } = await supabase.from("training_plan_items").delete().eq("id", id).eq("person_id", me);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

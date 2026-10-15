import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase";
import { currentPerson } from "../../../../lib/auth";
import { ensureFreshToken, listActivities, aggregateVolume, activityRow } from "../../../../lib/strava";

// POST /api/strava/sync  { person: 'martin' | 'laura' }
// Anyone logged in can trigger either person's sync (it just re-pulls from
// whichever Strava account that person already connected) — handy for a
// "refresh" button that updates both sides of the dashboard at once.
//
// Pulls this month and last month (so a week that spans the turn of the month
// is complete) — or the last 4 months the first time, when that person has no
// strava_activities rows yet, so the Training tab's 12-week view has history.
// Every activity is upserted into strava_activities on Strava's id; ones that
// were deleted on Strava are removed for the synced range; and each month's
// swim/bike/run totals are rewritten in training_volume (weight_moved_kg is
// never touched). Months are counted by the activity's local start date.
export async function POST(request) {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const person = body.person;
  if (!["martin", "laura"].includes(person)) {
    return NextResponse.json({ error: "Bad person" }, { status: 400 });
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Strava isn't configured yet." }, { status: 500 });
  }

  const supabase = supabaseServer();

  let accessToken;
  try {
    accessToken = await ensureFreshToken(supabase, person, { clientId, clientSecret });
  } catch (e) {
    return NextResponse.json({ error: "Couldn't refresh Strava token: " + e.message }, { status: 502 });
  }
  if (!accessToken) {
    return NextResponse.json({ error: person + " hasn't connected Strava yet." }, { status: 409 });
  }

  const { count } = await supabase.from("strava_activities").select("id", { count: "exact", head: true }).eq("person_id", person);
  const months = lastMonths(count ? 2 : 4); // oldest first
  const firstDay = months[0] + "-01";

  // Two days of slack before the first day: the API filters on UTC epochs,
  // we keep whatever starts on or after the first day in local time.
  const [y, m] = months[0].split("-").map(Number);
  const after = Math.floor(Date.UTC(y, m - 1, 1) / 1000) - 2 * 86400;
  const before = Math.floor(Date.now() / 1000) + 86400;

  let activities;
  try {
    activities = await listActivities(accessToken, after, before);
  } catch (e) {
    return NextResponse.json({ error: "Couldn't fetch activities: " + e.message }, { status: 502 });
  }

  const rows = activities.map((a) => activityRow(person, a)).filter((r) => r.activity_date >= firstDay);
  if (rows.length) {
    const { error } = await supabase.from("strava_activities").upsert(rows, { onConflict: "id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Deleted on Strava → gone here too (only inside the range just fetched).
  let stale = supabase.from("strava_activities").delete().eq("person_id", person).gte("activity_date", firstDay);
  if (rows.length) stale = stale.not("id", "in", "(" + rows.map((r) => r.id).join(",") + ")");
  const { error: delError } = await stale;
  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

  const syncedAt = new Date().toISOString();
  for (const month of months) {
    const inMonth = activities.filter((a) => String(a.start_date_local || a.start_date || "").startsWith(month));
    const { swimKm, bikeKm, runKm } = aggregateVolume(inMonth);
    const { error } = await supabase.from("training_volume").upsert(
      {
        person_id: person,
        month,
        swim_km: swimKm,
        bike_km: bikeKm,
        run_km: runKm,
        source: "strava",
        notes: "Synced from Strava (" + inMonth.length + " activities) — " + syncedAt,
        updated_at: syncedAt
      },
      { onConflict: "person_id,month" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, months, activityCount: rows.length });
}

// The last n months as YYYY-MM, oldest first, ending with this one.
function lastMonths(n) {
  const now = new Date();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"));
  }
  return out;
}

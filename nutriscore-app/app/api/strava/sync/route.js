import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase";
import { currentPerson } from "../../../../lib/auth";
import { ensureFreshToken, listActivities, aggregateVolume, monthEpochRange } from "../../../../lib/strava";

// POST /api/strava/sync  { person: 'martin' | 'laura', month?: 'YYYY-MM' }
// Anyone logged in can trigger either person's sync (it just re-pulls from
// whichever Strava account that person already connected) — handy for a
// "refresh" button that updates both sides of the dashboard at once.
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

  const month = body.month || currentMonth();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month must be YYYY-MM" }, { status: 400 });
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

  const { after, before } = monthEpochRange(month);
  let activities;
  try {
    activities = await listActivities(accessToken, after, before);
  } catch (e) {
    return NextResponse.json({ error: "Couldn't fetch activities: " + e.message }, { status: 502 });
  }

  const { swimKm, bikeKm, runKm } = aggregateVolume(activities);

  const { error } = await supabase.from("training_volume").upsert(
    {
      person_id: person,
      month,
      swim_km: swimKm,
      bike_km: bikeKm,
      run_km: runKm,
      source: "strava",
      notes: "Synced from Strava (" + activities.length + " activities) — " + new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    { onConflict: "person_id,month" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    month,
    activityCount: activities.length,
    swimKm,
    bikeKm,
    runKm
  });
}

function currentMonth() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

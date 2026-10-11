import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase";
import { currentPerson } from "../../../../lib/auth";

// GET /api/strava/status?person=martin — is this person connected, and when.
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
    .from("strava_accounts")
    .select("athlete_id, connected_at")
    .eq("person_id", person)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    connected: !!data,
    athleteId: data ? data.athlete_id : null,
    connectedAt: data ? data.connected_at : null
  });
}

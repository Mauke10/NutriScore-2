import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase";
import { exchangeCodeForToken } from "../../../../lib/strava";

const STATE_COOKIE = "strava_oauth_state";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const returnedState = searchParams.get("state");
  const stravaError = searchParams.get("error"); // e.g. "access_denied" if they cancel

  const dashboardUrl = new URL("/dashboard", request.url);

  if (stravaError) {
    dashboardUrl.searchParams.set("strava_error", stravaError);
    return NextResponse.redirect(dashboardUrl);
  }

  const cookieState = request.cookies.get(STATE_COOKIE)?.value;
  if (!code || !returnedState || !cookieState || returnedState !== cookieState) {
    dashboardUrl.searchParams.set("strava_error", "state_mismatch");
    return NextResponse.redirect(dashboardUrl);
  }

  const personId = cookieState.split(":")[0];
  if (!["martin", "laura"].includes(personId)) {
    dashboardUrl.searchParams.set("strava_error", "bad_state");
    return NextResponse.redirect(dashboardUrl);
  }

  try {
    const token = await exchangeCodeForToken({
      clientId: process.env.STRAVA_CLIENT_ID,
      clientSecret: process.env.STRAVA_CLIENT_SECRET,
      code
    });

    const supabase = supabaseServer();
    const { error } = await supabase.from("strava_accounts").upsert(
      {
        person_id: personId,
        athlete_id: token.athlete?.id ?? null,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: token.expires_at,
        scope: "read,activity:read_all",
        connected_at: new Date().toISOString()
      },
      { onConflict: "person_id" }
    );
    if (error) throw error;

    dashboardUrl.searchParams.set("strava_connected", personId);
  } catch (e) {
    console.error("Strava token exchange failed:", e);
    dashboardUrl.searchParams.set("strava_error", "exchange_failed");
    dashboardUrl.searchParams.set("strava_error_detail", String(e.message || e).slice(0, 200));
  }

  const res = NextResponse.redirect(dashboardUrl);
  res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

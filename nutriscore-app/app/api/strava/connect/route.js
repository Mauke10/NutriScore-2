import { NextResponse } from "next/server";
import crypto from "crypto";
import { currentPerson } from "../../../../lib/auth";
import { stravaAuthorizeUrl } from "../../../../lib/strava";

const STATE_COOKIE = "strava_oauth_state";

export async function GET(request) {
  const me = currentPerson();
  if (!me) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const redirectUri = process.env.STRAVA_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Strava isn't configured yet (STRAVA_CLIENT_ID / STRAVA_REDIRECT_URI missing)." },
      { status: 500 }
    );
  }

  // The state token both prevents CSRF and carries which of the two people is
  // connecting, so the callback knows even if the session cookie's person
  // ever got out of sync with who's actually clicking through Strava's flow.
  const nonce = crypto.randomBytes(16).toString("hex");
  const state = me + ":" + nonce;

  const url = stravaAuthorizeUrl({ clientId, redirectUri, state });
  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600
  });
  return res;
}

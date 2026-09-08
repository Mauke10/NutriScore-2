// Thin wrapper around Strava's OAuth + Activities API (v3). No SDK needed —
// it's a handful of plain REST calls. Docs: https://developers.strava.com/docs/reference/

const AUTH_BASE = "https://www.strava.com/oauth";
const API_BASE = "https://www.strava.com/api/v3";

export function stravaAuthorizeUrl({ clientId, redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: "read,activity:read_all",
    state
  });
  return AUTH_BASE + "/authorize?" + params.toString();
}

export async function exchangeCodeForToken({ clientId, clientSecret, code }) {
  const res = await fetch(AUTH_BASE + "/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code"
    })
  });
  if (!res.ok) {
    throw new Error("Strava token exchange failed: " + res.status + " " + (await res.text()));
  }
  return res.json(); // { access_token, refresh_token, expires_at, athlete: {...}, ... }
}

export async function refreshAccessToken({ clientId, clientSecret, refreshToken }) {
  const res = await fetch(AUTH_BASE + "/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });
  if (!res.ok) {
    throw new Error("Strava token refresh failed: " + res.status + " " + (await res.text()));
  }
  return res.json(); // { access_token, refresh_token, expires_at }
}

// Ensures we have a live access token for this person, refreshing in Supabase
// if the stored one is expired (or about to be). Returns the access token to use.
export async function ensureFreshToken(supabase, personId, { clientId, clientSecret }) {
  const { data: row, error } = await supabase
    .from("strava_accounts")
    .select("*")
    .eq("person_id", personId)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null; // not connected

  const nowSec = Math.floor(Date.now() / 1000);
  if (row.expires_at > nowSec + 60) {
    return row.access_token;
  }

  const refreshed = await refreshAccessToken({
    clientId,
    clientSecret,
    refreshToken: row.refresh_token
  });

  await supabase
    .from("strava_accounts")
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: refreshed.expires_at
    })
    .eq("person_id", personId);

  return refreshed.access_token;
}

// Fetches every activity in [afterEpoch, beforeEpoch), paginating as needed.
export async function listActivities(accessToken, afterEpoch, beforeEpoch) {
  const activities = [];
  let page = 1;
  const perPage = 100;
  for (;;) {
    const params = new URLSearchParams({
      after: String(afterEpoch),
      before: String(beforeEpoch),
      per_page: String(perPage),
      page: String(page)
    });
    const res = await fetch(API_BASE + "/athlete/activities?" + params.toString(), {
      headers: { Authorization: "Bearer " + accessToken }
    });
    if (!res.ok) {
      throw new Error("Strava list activities failed: " + res.status + " " + (await res.text()));
    }
    const batch = await res.json();
    activities.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
    if (page > 20) break; // safety cap — 2000 activities in one month would be unusual
  }
  return activities;
}

// Sums distance (meters -> km) by discipline. sport_type is the modern field;
// fall back to the older "type" field for older activities.
export function aggregateVolume(activities) {
  let swimM = 0;
  let bikeM = 0;
  let runM = 0;
  for (const a of activities) {
    const kind = String(a.sport_type || a.type || "").toLowerCase();
    const distance = Number(a.distance) || 0;
    if (kind.includes("swim")) swimM += distance;
    else if (kind.includes("ride") || kind.includes("bike") || kind.includes("cycl")) bikeM += distance;
    else if (kind.includes("run")) runM += distance;
  }
  return {
    swimKm: Math.round((swimM / 1000) * 100) / 100,
    bikeKm: Math.round((bikeM / 1000) * 100) / 100,
    runKm: Math.round((runM / 1000) * 100) / 100
  };
}

// Month boundaries as Unix seconds, in the server's local time zone semantics
// (good enough here — a training month doesn't need to-the-second precision).
export function monthEpochRange(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  const start = new Date(y, m - 1, 1, 0, 0, 0);
  const end = new Date(y, m, 1, 0, 0, 0); // first instant of next month
  return {
    after: Math.floor(start.getTime() / 1000),
    before: Math.floor(end.getTime() / 1000)
  };
}

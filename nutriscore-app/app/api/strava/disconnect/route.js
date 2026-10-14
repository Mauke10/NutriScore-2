import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase";
import { currentPerson } from "../../../../lib/auth";

// POST /api/strava/disconnect — forget your Strava connection. Tells Strava
// to revoke the app's access (best effort: a stale token mustn't block
// disconnecting), then deletes the stored tokens. Synced training numbers
// stay; "Connect" in the drawer links it again.
export async function POST() {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const supabase = supabaseServer();
  const { data: account } = await supabase.from("strava_accounts").select("access_token").eq("person_id", me).maybeSingle();
  if (account?.access_token) {
    try {
      await fetch("https://www.strava.com/oauth/deauthorize", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "access_token=" + encodeURIComponent(account.access_token)
      });
    } catch {
      // ignore — the local disconnect below is what matters
    }
  }
  const { error } = await supabase.from("strava_accounts").delete().eq("person_id", me);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

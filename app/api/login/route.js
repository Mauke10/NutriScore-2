import { NextResponse } from "next/server";
import { checkPin, createSessionValue, SESSION_COOKIE, VALID_PEOPLE } from "../../../lib/session";
import { verifyPin } from "../../../lib/pin";
import { supabaseServer } from "../../../lib/supabase";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { pin, personId } = body || {};

  if (!VALID_PEOPLE.includes(personId)) {
    return NextResponse.json({ error: "Pick who you are." }, { status: 400 });
  }

  // Once someone's used Settings to set their own PIN, people.pin_hash holds
  // it and that's what's checked from here on — Martin and Laura no longer
  // have to share one PIN. Until then (or if Supabase can't be reached right
  // now — e.g. a paused free-tier project), this falls back to the one
  // shared APP_PIN from the environment, exactly like it always has.
  let pinHash = null;
  try {
    const supabase = supabaseServer();
    const { data: person } = await supabase.from("people").select("pin_hash").eq("id", personId).maybeSingle();
    pinHash = person?.pin_hash || null;
  } catch {
    // Supabase unreachable — fall through to the env-var PIN below instead
    // of blocking login entirely.
  }

  let pinOk = false;
  try {
    pinOk = pinHash ? verifyPin(pin, pinHash) : checkPin(pin);
  } catch (e) {
    return NextResponse.json({ error: "Server isn't configured yet (APP_PIN missing)." }, { status: 500 });
  }

  if (!pinOk) {
    return NextResponse.json({ error: "Wrong PIN." }, { status: 401 });
  }

  const value = createSessionValue(personId);
  const res = NextResponse.json({ ok: true, personId });
  res.cookies.set(SESSION_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 90 * 24 * 60 * 60
  });
  return res;
}

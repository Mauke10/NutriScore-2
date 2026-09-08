import { NextResponse } from "next/server";
import { checkPin, createSessionValue, SESSION_COOKIE, VALID_PEOPLE } from "../../../lib/session";

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

  let pinOk = false;
  try {
    pinOk = checkPin(pin);
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

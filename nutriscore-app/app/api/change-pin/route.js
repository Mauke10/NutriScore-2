import { NextResponse } from "next/server";
import { currentPerson } from "../../../lib/auth";
import { checkPin } from "../../../lib/session";
import { hashPin, verifyPin } from "../../../lib/pin";
import { supabaseServer } from "../../../lib/supabase";

// POST /api/change-pin — { currentPin, newPin }. Lets the logged-in person
// set their own PIN for logging in, stored on their own people row — the
// first time either Martin or Laura does this, they stop sharing one PIN.
export async function POST(request) {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const currentPin = (body.currentPin || "").toString();
  const newPin = (body.newPin || "").toString();

  if (!currentPin) {
    return NextResponse.json({ error: "Enter your current PIN." }, { status: 400 });
  }
  if (newPin.length < 4) {
    return NextResponse.json({ error: "New PIN needs to be at least 4 characters." }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data: person, error: fetchError } = await supabase.from("people").select("pin_hash").eq("id", me).maybeSingle();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  let currentOk = false;
  try {
    currentOk = person?.pin_hash ? verifyPin(currentPin, person.pin_hash) : checkPin(currentPin);
  } catch (e) {
    return NextResponse.json({ error: "Server isn't configured yet (APP_PIN missing)." }, { status: 500 });
  }
  if (!currentOk) {
    return NextResponse.json({ error: "Current PIN is wrong." }, { status: 401 });
  }

  const { error } = await supabase.from("people").update({ pin_hash: hashPin(newPin) }).eq("id", me);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

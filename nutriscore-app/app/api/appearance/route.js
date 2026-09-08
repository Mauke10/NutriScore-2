import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase";
import { currentPerson } from "../../../lib/auth";

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
    .from("settings")
    .select("accent_color")
    .eq("person_id", person)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ accentColor: data ? data.accent_color : null });
}

// Always sets the logged-in person's own accent color.
export async function POST(request) {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const raw = typeof body.accentColor === "string" ? body.accentColor.trim() : "";
  const accentColor = /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : null;

  const supabase = supabaseServer();
  const { error } = await supabase
    .from("settings")
    .upsert({ person_id: me, accent_color: accentColor }, { onConflict: "person_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, accentColor });
}

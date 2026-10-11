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
    .from("bloodwork")
    .select("*")
    .eq("person_id", person)
    .order("panel_date", { ascending: false })
    .limit(40);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data });
}

export async function POST(request) {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { panelDate } = body || {};
  if (!panelDate || !/^\d{4}-\d{2}-\d{2}$/.test(panelDate)) {
    return NextResponse.json({ error: "panelDate must be YYYY-MM-DD" }, { status: 400 });
  }

  const row = {
    person_id: me,
    panel_date: panelDate,
    ferritin: body.ferritin || "",
    b12: body.b12 || "",
    folate: body.folate || "",
    vitamin_d: body.vitaminD || "",
    notes: body.notes || "",
    updated_at: new Date().toISOString()
  };

  const supabase = supabaseServer();
  const { error } = await supabase
    .from("bloodwork")
    .upsert(row, { onConflict: "person_id,panel_date" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request) {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const panelDate = searchParams.get("panelDate");
  if (!panelDate) return NextResponse.json({ error: "panelDate required" }, { status: 400 });

  const supabase = supabaseServer();
  const { error } = await supabase
    .from("bloodwork")
    .delete()
    .eq("person_id", me)
    .eq("panel_date", panelDate);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

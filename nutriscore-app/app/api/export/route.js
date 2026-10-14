import { supabaseServer } from "../../../lib/supabase";
import { currentPerson } from "../../../lib/auth";

// GET /api/export?what=food — your own data as a CSV file (opens in Excel,
// Numbers or Google Sheets). One file per kind of data, oldest first.
const SOURCES = {
  food: { table: "food_logs", order: "log_date", file: "food-log", skip: ["photo_url", "source"] },
  weekly: { table: "weekly_logs", order: "week_start", file: "weekly-check-ins" },
  measurements: { table: "body_measurements", order: "measured_on", file: "measurements" },
  bloodwork: { table: "bloodwork", order: "panel_date", file: "bloodwork" },
  training: { table: "training_sessions", order: "session_date", file: "training-sessions" }
};
const ALWAYS_SKIP = ["id", "person_id"];

export async function GET(request) {
  const me = currentPerson();
  if (!me) return new Response("Not logged in", { status: 401 });
  const what = new URL(request.url).searchParams.get("what");
  const src = SOURCES[what];
  if (!src) return new Response("Unknown export", { status: 400 });

  const supabase = supabaseServer();
  const { data, error } = await supabase.from(src.table).select("*").eq("person_id", me).order(src.order, { ascending: true }).limit(20000);
  if (error) return new Response(error.message, { status: 500 });

  const skip = new Set([...ALWAYS_SKIP, ...(src.skip || [])]);
  const cols = data.length ? Object.keys(data[0]).filter((c) => !skip.has(c)) : [];
  const lines = [cols.join(",")];
  for (const row of data) lines.push(cols.map((c) => csvCell(row[c])).join(","));
  // BOM so Excel reads õ/ä/ü correctly.
  return new Response("﻿" + lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="nutriscore-' + me + "-" + src.file + '.csv"',
      "Cache-Control": "no-store"
    }
  });
}

function csvCell(v) {
  if (v === null || v === undefined) return "";
  const s = Array.isArray(v) ? v.join("|") : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

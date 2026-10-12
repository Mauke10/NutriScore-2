import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase";
import { currentPerson } from "../../../lib/auth";
import { buildSearchText, normalizeFoodText, rankFoods } from "../../../lib/foodText";

const COLUMNS = "id, source, name, name_en, aliases, kind, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, use_count";

// GET /api/foods?q=kana — searches the food database (Fineli + your own
// foods) by any name or synonym; every word must match somewhere, accents
// optional ("lohe riis" finds lõhe and riis entries). Omit q to get the
// foods you two use most, for showing something before anyone types.
export async function GET(request) {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = normalizeFoodText(searchParams.get("q") || "");
  const tokens = q.split(" ").filter(Boolean).slice(0, 5);

  const supabase = supabaseServer();
  let query = supabase.from("foods").select(COLUMNS);
  if (tokens.length) {
    for (const t of tokens) query = query.ilike("search_text", "%" + t + "%");
    query = query.order("use_count", { ascending: false }).limit(300);
  } else {
    query = query.gt("use_count", 0).order("use_count", { ascending: false }).order("last_used_at", { ascending: false }).limit(15);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ranked = tokens.length ? rankFoods(data || [], tokens).slice(0, 20) : data || [];
  return NextResponse.json({ entries: ranked.map(toClient) });
}

// POST /api/foods — add your own food (a branded product, something Fineli
// doesn't have). JSON { name, aliases?: string[] | "a, b", caloriesPer100g,
// proteinPer100g?, carbsPer100g?, fatPer100g?, fiberPer100g? }. Shared
// between both of you, like recipes.
export async function POST(request) {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const name = (body.name || "").toString().trim();
  const calories = numOrNull(body.caloriesPer100g);
  if (!name || calories === null) return NextResponse.json({ error: "Needs a name and kcal per 100g." }, { status: 400 });

  const aliases = (Array.isArray(body.aliases) ? body.aliases : (body.aliases || "").toString().split(","))
    .map((a) => a.toString().trim())
    .filter(Boolean);

  const row = {
    source: "custom",
    name,
    aliases,
    kind: "food",
    calories_per_100g: calories,
    protein_per_100g: numOrNull(body.proteinPer100g),
    carbs_per_100g: numOrNull(body.carbsPer100g),
    fat_per_100g: numOrNull(body.fatPer100g),
    fiber_per_100g: numOrNull(body.fiberPer100g),
    created_by: me
  };
  row.search_text = buildSearchText(row);

  const supabase = supabaseServer();
  const { data, error } = await supabase.from("foods").insert(row).select(COLUMNS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ food: toClient(data) });
}

function toClient(r) {
  return {
    id: r.id,
    name: r.name,
    nameEn: r.name_en && r.name_en !== r.name ? r.name_en : null,
    source: r.source,
    kind: r.kind,
    caloriesPer100g: r.calories_per_100g,
    proteinPer100g: r.protein_per_100g,
    carbsPer100g: r.carbs_per_100g,
    fatPer100g: r.fat_per_100g,
    fiberPer100g: r.fiber_per_100g
  };
}

function numOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

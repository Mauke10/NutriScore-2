import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseServer } from "../../../lib/supabase";
import { currentPerson } from "../../../lib/auth";
import { bumpFoodUse, isUuid, normalizeIngredients, replaceRecipeIngredients } from "../../../lib/recipeIngredients";

const BUCKET = "snack-photos";

// GET /api/snacks?person=martin&limit=300 — optionally &date=YYYY-MM-DD for
// just one day, or &mealType=meal|snack to filter to one or the other.
export async function GET(request) {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const person = searchParams.get("person");
  const date = searchParams.get("date");
  const mealType = searchParams.get("mealType");
  const limit = Math.min(Number(searchParams.get("limit")) || 300, 1000);
  if (!["martin", "laura"].includes(person)) {
    return NextResponse.json({ error: "Bad person" }, { status: 400 });
  }

  const supabase = supabaseServer();
  let query = supabase
    .from("food_logs")
    .select("*")
    .eq("person_id", person)
    .order("log_date", { ascending: false })
    .order("logged_at", { ascending: false })
    .limit(limit);
  if (date) query = query.eq("log_date", date);
  if (mealType === "meal" || mealType === "snack") query = query.eq("meal_type", mealType);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data });
}

// POST /api/snacks — multipart/form-data: description, logDate, calories,
// proteinG, carbsG, fatG, notes, source, mealType ('meal' | 'snack'),
// recipeId (optional, if logged from a saved recipe), saveAsRecipe ('1' to
// also save/update this as a recipe under `description`'s name), ingredients
// (optional JSON array, when it was built from ingredients — saved onto the
// recipe if saveAsRecipe is set, and counts towards each food's use_count so
// your usual foods rank first in search), and an optional "photo" file.
// Always logs under the caller's own person_id.
export async function POST(request) {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const description = (formData.get("description") || "").toString().trim();
  const calories = numOrNull(formData.get("calories"));
  if (!description || calories === null) {
    return NextResponse.json({ error: "Need at least a description and a calorie number." }, { status: 400 });
  }

  const supabase = supabaseServer();
  let photoUrl = null;

  const photo = formData.get("photo");
  if (photo && typeof photo !== "string" && photo.size > 0) {
    const ext = (photo.type && photo.type.split("/")[1]) || "jpg";
    const path = me + "/" + crypto.randomUUID() + "." + ext;
    const buffer = Buffer.from(await photo.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: photo.type || "image/jpeg" });
    if (uploadError) {
      return NextResponse.json({ error: "Photo upload failed: " + uploadError.message }, { status: 500 });
    }
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    photoUrl = pub.publicUrl;
  }

  const mealTypeRaw = (formData.get("mealType") || "snack").toString();
  const mealType = mealTypeRaw === "meal" ? "meal" : "snack";
  const recipeId = (formData.get("recipeId") || "").toString() || null;
  const proteinG = numOrNull(formData.get("proteinG"));
  const carbsG = numOrNull(formData.get("carbsG"));
  const fatG = numOrNull(formData.get("fatG"));
  const fiberG = numOrNull(formData.get("fiberG"));
  let ingredients = null;
  try {
    ingredients = normalizeIngredients(JSON.parse((formData.get("ingredients") || "null").toString()));
  } catch {
    return NextResponse.json({ error: "Bad ingredients" }, { status: 400 });
  }

  const row = {
    person_id: me,
    log_date: (formData.get("logDate") || "").toString() || new Date().toISOString().slice(0, 10),
    description,
    calories,
    protein_g: proteinG,
    carbs_g: carbsG,
    fat_g: fatG,
    fiber_g: fiberG,
    notes: (formData.get("notes") || "").toString(),
    meal_type: mealType,
    recipe_id: recipeId,
    source: photoUrl ? "photo" : "manual",
    photo_url: photoUrl
  };

  const { error } = await supabase.from("food_logs").insert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if ((formData.get("saveAsRecipe") || "").toString() === "1") {
    const { data: existing } = await supabase.from("recipes").select("id").ilike("name", description).maybeSingle();
    const recipeRow = {
      name: description,
      calories,
      protein_g: proteinG,
      carbs_g: carbsG,
      fat_g: fatG,
      fiber_g: fiberG,
      meal_type: mealType,
      updated_at: new Date().toISOString()
    };
    let savedId = existing?.id;
    if (existing) {
      await supabase.from("recipes").update(recipeRow).eq("id", existing.id);
    } else {
      const { data: inserted } = await supabase.from("recipes").insert({ ...recipeRow, created_by: me }).select("id").single();
      savedId = inserted?.id;
    }
    // Only replace the recipe's ingredient breakdown when this log actually
    // had one — a plain-totals save shouldn't wipe an existing breakdown.
    if (savedId && ingredients && ingredients.length) await replaceRecipeIngredients(supabase, savedId, ingredients);
  }

  if (ingredients) await bumpFoodUse(supabase, ingredients.map((ing) => ing.food_id));

  return NextResponse.json({ ok: true });
}

// PATCH /api/snacks — JSON body { id, description?, calories?, proteinG?,
// carbsG?, fatG?, fiberG?, mealType?, logDate?, notes?, recipeId? }.
// recipeId links the entry to a recipe saved from it afterwards ("Save as
// recipe" in the edit window). Only the fields
// present get touched; only your own entries can be edited. For fixing a
// mistake after the fact (wrong meal/snack tag, a typo'd calorie number),
// not for changing who it belongs to or its photo/recipe link.
export async function PATCH(request) {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const id = (body.id || "").toString();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const row = {};
  if (typeof body.description === "string") {
    const d = body.description.trim();
    if (!d) return NextResponse.json({ error: "Description can't be empty." }, { status: 400 });
    row.description = d;
  }
  if ("calories" in body) {
    const c = numOrNull(body.calories);
    if (c === null) return NextResponse.json({ error: "Calories must be a number." }, { status: 400 });
    row.calories = c;
  }
  if ("proteinG" in body) row.protein_g = numOrNull(body.proteinG);
  if ("carbsG" in body) row.carbs_g = numOrNull(body.carbsG);
  if ("fatG" in body) row.fat_g = numOrNull(body.fatG);
  if ("fiberG" in body) row.fiber_g = numOrNull(body.fiberG);
  if (body.mealType === "meal" || body.mealType === "snack") row.meal_type = body.mealType;
  if (typeof body.logDate === "string" && body.logDate) row.log_date = body.logDate;
  if (typeof body.notes === "string") row.notes = body.notes;
  if ("recipeId" in body) row.recipe_id = isUuid(body.recipeId) ? body.recipeId : null;

  if (Object.keys(row).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { error } = await supabase.from("food_logs").update(row).eq("id", id).eq("person_id", me);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/snacks?id=<uuid> — only your own entries.
export async function DELETE(request) {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = supabaseServer();
  const { error } = await supabase.from("food_logs").delete().eq("id", id).eq("person_id", me);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

function numOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

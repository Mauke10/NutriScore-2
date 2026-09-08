import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseServer } from "../../../lib/supabase";
import { currentPerson } from "../../../lib/auth";

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
// also save/update this as a recipe under `description`'s name), and an
// optional "photo" file. Always logs under the caller's own person_id.
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

  const row = {
    person_id: me,
    log_date: (formData.get("logDate") || "").toString() || new Date().toISOString().slice(0, 10),
    description,
    calories,
    protein_g: proteinG,
    carbs_g: carbsG,
    fat_g: fatG,
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
      meal_type: mealType,
      updated_at: new Date().toISOString()
    };
    if (existing) {
      await supabase.from("recipes").update(recipeRow).eq("id", existing.id);
    } else {
      await supabase.from("recipes").insert({ ...recipeRow, created_by: me });
    }
  }

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

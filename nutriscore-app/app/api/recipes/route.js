import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase";
import { currentPerson } from "../../../lib/auth";
import { sumIngredients } from "../../dashboard/recipeMath";
import { asMathIngredients, bumpFoodUse, normalizeIngredients, replaceRecipeIngredients } from "../../../lib/recipeIngredients";

// GET /api/recipes?q=chicken — searches the shared recipe library by name.
// Omit q (or leave it empty) to get the most recently used ones, handy for
// showing a starter list before someone's typed anything. Each entry also
// carries its ingredients (empty array if it's a plain fixed-total recipe),
// so the Recipes panel and the log-form recipe picker can both offer the
// per-ingredient gram editor without a second round trip.
export async function GET(request) {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  const limit = Math.min(Number(searchParams.get("limit")) || 15, 200);

  const supabase = supabaseServer();
  let query = supabase.from("recipes").select("*").order("updated_at", { ascending: false }).limit(limit);
  if (q) query = query.ilike("name", "%" + q + "%");

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (data || []).map((r) => r.id);
  let ingredientsByRecipe = {};
  if (ids.length) {
    const { data: ingRows, error: ingError } = await supabase
      .from("recipe_ingredients")
      .select("*")
      .in("recipe_id", ids)
      .order("sort_order", { ascending: true });
    if (ingError) return NextResponse.json({ error: ingError.message }, { status: 500 });
    (ingRows || []).forEach((row) => {
      (ingredientsByRecipe[row.recipe_id] ||= []).push({
        id: row.id,
        name: row.name,
        grams: row.grams,
        caloriesPer100g: row.calories_per_100g,
        proteinPer100g: row.protein_per_100g,
        carbsPer100g: row.carbs_per_100g,
        fatPer100g: row.fat_per_100g,
        fiberPer100g: row.fiber_per_100g,
        foodId: row.food_id
      });
    });
  }

  const entries = (data || []).map((r) => ({ ...r, ingredients: ingredientsByRecipe[r.id] || [] }));
  return NextResponse.json({ entries });
}

// POST /api/recipes — save (or update, if a recipe with this exact name
// already exists) a recipe. Shared between both of you — either can log
// from something the other saved.
//
// Two ways to send macros: pass ingredients (an array of {name, grams,
// caloriesPer100g, proteinPer100g, carbsPer100g, fatPer100g, fiberPer100g,
// foodId?}) and the totals are computed from them and cached on the recipe row; or,
// for a recipe that's just one fixed total (e.g. the quick "save this as a
// recipe" tick when logging a snack, which doesn't know ingredients), omit
// ingredients (or send an empty list) and pass calories/proteinG/carbsG/
// fatG/fiberG directly. An empty list also clears any old breakdown — so
// editing a totals-only recipe never zeroes its calories.
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
  if (!name) return NextResponse.json({ error: "Recipe needs a name" }, { status: 400 });

  const supabase = supabaseServer();

  const ingredients = normalizeIngredients(body.ingredients);
  const hasIngredients = ingredients !== null;

  const row = {
    name,
    meal_type: body.mealType === "snack" ? "snack" : "meal",
    portion_note: (body.portionNote || "").toString(),
    updated_at: new Date().toISOString()
  };

  if (hasIngredients && ingredients.length) {
    const totals = sumIngredients(asMathIngredients(ingredients));
    row.calories = round1(totals.calories);
    row.protein_g = round1(totals.protein);
    row.carbs_g = round1(totals.carbs);
    row.fat_g = round1(totals.fat);
    row.fiber_g = round1(totals.fiber);
  } else {
    row.calories = numOrNull(body.calories);
    row.protein_g = numOrNull(body.proteinG);
    row.carbs_g = numOrNull(body.carbsG);
    row.fat_g = numOrNull(body.fatG);
    row.fiber_g = numOrNull(body.fiberG);
  }

  let error;
  let recipeId = body.id;
  if (recipeId) {
    // Editing a specific recipe from the Recipes panel — update by id so a
    // rename doesn't get treated as a brand new recipe.
    ({ error } = await supabase.from("recipes").update(row).eq("id", recipeId));
  } else {
    // Quick "save as recipe" from the log form — find-or-update by
    // case-insensitive name match, so re-saving "Chicken curry" refines the
    // existing entry instead of cluttering the list with near-duplicates.
    const { data: existing } = await supabase.from("recipes").select("id").ilike("name", name).maybeSingle();
    if (existing) {
      recipeId = existing.id;
      ({ error } = await supabase.from("recipes").update(row).eq("id", recipeId));
    } else {
      const { data: inserted, error: insertError } = await supabase.from("recipes").insert({ ...row, created_by: me }).select("id").single();
      error = insertError;
      recipeId = inserted?.id;
    }
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (hasIngredients && recipeId) {
    const ingError = await replaceRecipeIngredients(supabase, recipeId, ingredients);
    if (ingError) return NextResponse.json({ error: ingError.message }, { status: 500 });
    await bumpFoodUse(supabase, ingredients.map((ing) => ing.food_id));
  }

  return NextResponse.json({ ok: true, id: recipeId });
}

// DELETE /api/recipes?id=<uuid>
export async function DELETE(request) {
  const me = currentPerson();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = supabaseServer();
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

function numOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

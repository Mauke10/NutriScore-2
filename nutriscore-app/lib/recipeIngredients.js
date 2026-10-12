// Shared by POST /api/recipes and POST /api/snacks ("save as a recipe"):
// turning the client's ingredient list into recipe_ingredients rows, writing
// them, and bumping use_count on the foods they were picked from.

export function normalizeIngredients(raw) {
  if (!Array.isArray(raw)) return null;
  return raw
    .map((ing) => ({
      name: (ing.name || "").toString().trim(),
      grams: numOrNull(ing.grams) ?? 0,
      calories_per_100g: numOrNull(ing.caloriesPer100g),
      protein_per_100g: numOrNull(ing.proteinPer100g),
      carbs_per_100g: numOrNull(ing.carbsPer100g),
      fat_per_100g: numOrNull(ing.fatPer100g),
      fiber_per_100g: numOrNull(ing.fiberPer100g),
      food_id: isUuid(ing.foodId) ? ing.foodId : null
    }))
    .filter((ing) => ing.name);
}

// Rows in the camelCase shape recipeMath.sumIngredients expects.
export function asMathIngredients(rows) {
  return rows.map((ing) => ({
    grams: ing.grams,
    caloriesPer100g: ing.calories_per_100g,
    proteinPer100g: ing.protein_per_100g,
    carbsPer100g: ing.carbs_per_100g,
    fatPer100g: ing.fat_per_100g,
    fiberPer100g: ing.fiber_per_100g
  }));
}

// Ingredients replace whatever was there before (delete-then-insert is
// simplest for a two-person app's tiny recipe list — no ordering/id churn
// to worry about since the client always resends the full list).
export async function replaceRecipeIngredients(supabase, recipeId, rows) {
  const { error: delError } = await supabase.from("recipe_ingredients").delete().eq("recipe_id", recipeId);
  if (delError) return delError;
  if (!rows.length) return null;
  const { error } = await supabase.from("recipe_ingredients").insert(rows.map((ing, i) => ({ ...ing, recipe_id: recipeId, sort_order: i })));
  return error;
}

// Best-effort: a failed counter bump should never fail the save itself.
export async function bumpFoodUse(supabase, foodIds) {
  const ids = [...new Set((foodIds || []).filter(isUuid))];
  if (!ids.length) return;
  try {
    await supabase.rpc("bump_food_use", { food_ids: ids });
  } catch {
    // ignore
  }
}

export function isUuid(v) {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function numOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

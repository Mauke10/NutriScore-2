// Shared math for ingredient-based recipes. Each ingredient stores macros
// per 100g plus a gram amount; scaling the grams (whether editing a saved
// recipe, or adjusting "I only had 150g of the rice this time" while
// logging it) scales that ingredient's contribution linearly. A recipe's
// totals are just the sum across its ingredients.
//
// Plain JS, no "use client" — safe to import from both client components
// and server API routes.

export function scaledIngredient(ing) {
  const grams = numOrZero(ing.grams);
  const factor = grams / 100;
  return {
    calories: numOrZero(ing.caloriesPer100g) * factor,
    protein: numOrZero(ing.proteinPer100g) * factor,
    carbs: numOrZero(ing.carbsPer100g) * factor,
    fat: numOrZero(ing.fatPer100g) * factor
  };
}

export function sumIngredients(ingredients) {
  return (ingredients || []).reduce(
    (totals, ing) => {
      const s = scaledIngredient(ing);
      return {
        calories: totals.calories + s.calories,
        protein: totals.protein + s.protein,
        carbs: totals.carbs + s.carbs,
        fat: totals.fat + s.fat
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

function numOrZero(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

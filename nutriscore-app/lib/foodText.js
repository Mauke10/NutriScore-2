// Text normalisation shared by the foods search API and the Fineli seed
// script (scripts/fineli/build-seed.mjs), so what gets stored in
// foods.search_text and what a search query is compared against always go
// through the same function. Lowercases and strips diacritics, so "lohe"
// finds "lõhe" and "sokolaad" finds "šokolaad" — nobody types õ/ä/ö/ü/š
// reliably on a phone keyboard in a hurry.

export function normalizeFoodText(s) {
  return (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9%.,]+/g, " ")
    .trim();
}

// The searchable blob for one food: every name it goes by plus its aliases.
export function buildSearchText(food) {
  const parts = [food.name, food.name_en, food.name_fi, ...(food.aliases || [])];
  return normalizeFoodText(parts.filter(Boolean).join(" | "));
}

// Most relevant first: foods you actually use, then ones whose name or a
// synonym is exactly / starts with what you typed, then plain ingredients
// before Fineli's mixed dishes, then shorter (more generic) names.
export function rankFoods(rows, tokens) {
  const first = tokens[0];
  const whole = tokens.join(" ");
  return rows
    .map((r) => {
      const name = normalizeFoodText(r.name);
      const aliases = (r.aliases || []).map(normalizeFoodText);
      let score = Math.min(r.use_count || 0, 20) * 5;
      if (aliases.includes(whole) || name === whole) score += 40;
      else if (aliases.some((a) => a.startsWith(first)) || name.startsWith(first)) score += 25;
      if (r.source === "custom" || aliases.length) score += 15; // has an Estonian name, or is one of yours
      if (r.kind !== "dish") score += 8;
      score -= name.length / 15;
      return { r, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.r);
}

// The body parts the Measurements card offers as chips, in the order they're
// shown. `key` is what's stored in body_measurements.part and
// settings.measurement_parts — never rename one, old entries point at it.
// Parts you add yourself are stored as "custom:<name>" (always cm).
export const MEASUREMENT_PARTS = [
  { key: "neck", label: "Neck", unit: "cm" },
  { key: "shoulders", label: "Shoulders", unit: "cm" },
  { key: "chest", label: "Chest", unit: "cm" },
  { key: "upper_arm", label: "Upper arm", unit: "cm" },
  { key: "forearm", label: "Forearm", unit: "cm" },
  { key: "waist", label: "Waist", unit: "cm" },
  { key: "belly", label: "Belly", unit: "cm" },
  { key: "hips", label: "Hips", unit: "cm" },
  { key: "thigh", label: "Thigh", unit: "cm" },
  { key: "calf", label: "Calf", unit: "cm" },
  { key: "body_fat", label: "Body fat", unit: "%" }
];

const BY_KEY = Object.fromEntries(MEASUREMENT_PARTS.map((p) => [p.key, p]));
export const CUSTOM_PREFIX = "custom:";

export function partInfo(key) {
  if (BY_KEY[key]) return BY_KEY[key];
  if (typeof key === "string" && key.startsWith(CUSTOM_PREFIX)) return { key, label: key.slice(CUSTOM_PREFIX.length), unit: "cm", custom: true };
  return null;
}

// Keys the API accepts: the presets above, or "custom:" + 1–30 characters.
export function isValidPartKey(key) {
  if (typeof key !== "string") return false;
  if (BY_KEY[key]) return true;
  const name = key.startsWith(CUSTOM_PREFIX) ? key.slice(CUSTOM_PREFIX.length).trim() : "";
  return name.length > 0 && name.length <= 30;
}

import crypto from "crypto";

const KEYLEN = 64;

// Each person's own PIN, once they've set one, is stored as "saltHex:hashHex"
// in people.pin_hash — never the PIN itself. scrypt is built into Node (no
// extra dependency), which is plenty for a small household app's PIN; this
// isn't guarding a bank account.
export function hashPin(pin) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(pin), salt, KEYLEN);
  return salt.toString("hex") + ":" + hash.toString("hex");
}

export function verifyPin(pin, stored) {
  if (!stored || typeof stored !== "string") return false;
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = crypto.scryptSync(String(pin), salt, expected.length);
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

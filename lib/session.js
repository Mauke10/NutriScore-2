import crypto from "crypto";

export const SESSION_COOKIE = "nutriscore_session";
export const VALID_PEOPLE = ["martin", "laura"];

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "SESSION_SECRET is missing or too short — set a long random string in .env.local"
    );
  }
  return s;
}

function sign(value) {
  return crypto.createHmac("sha256", secret()).update(value).digest("hex");
}

// Cookie value shape: "<personId>.<issuedAtMs>.<signatureHex>"
// Signed so a visitor can't just set person=laura in a cookie themselves.
export function createSessionValue(personId) {
  if (!VALID_PEOPLE.includes(personId)) {
    throw new Error("Unknown person: " + personId);
  }
  const payload = personId + "." + Date.now();
  return payload + "." + sign(payload);
}

// Returns the personId ('martin' | 'laura') if the cookie value is valid and
// not expired, otherwise null. Sessions last 90 days — this is a shared
// two-person household app, not something that needs to re-PIN constantly.
export function readSessionValue(value) {
  if (!value || typeof value !== "string") return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [personId, issuedAtStr, signature] = parts;
  const payload = personId + "." + issuedAtStr;
  const expected = sign(payload);
  const sigBuf = Buffer.from(signature, "hex");
  const expBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  if (!VALID_PEOPLE.includes(personId)) return null;
  const issuedAt = Number(issuedAtStr);
  const maxAgeMs = 90 * 24 * 60 * 60 * 1000;
  if (!issuedAt || Date.now() - issuedAt > maxAgeMs) return null;
  return personId;
}

export function checkPin(candidate) {
  const real = process.env.APP_PIN;
  if (!real) throw new Error("APP_PIN is not set in .env.local");
  if (!candidate || typeof candidate !== "string") return false;
  // Same length check avoids leaking length via early-exit timing on short input.
  const a = Buffer.from(String(candidate).padEnd(32, "\0"));
  const b = Buffer.from(String(real).padEnd(32, "\0"));
  return crypto.timingSafeEqual(a, b) && candidate === real;
}

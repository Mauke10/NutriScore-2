import { cookies } from "next/headers";
import { SESSION_COOKIE, readSessionValue } from "./session";

// Returns 'martin' | 'laura' | null. Use in Server Components and Route
// Handlers (both run in the Node.js runtime by default, so the HMAC check
// in lib/session.js works fine here).
export function currentPerson() {
  const value = cookies().get(SESSION_COOKIE)?.value;
  return readSessionValue(value);
}

// The "other" person, for building the head-to-head / shared views.
export function otherPerson(personId) {
  return personId === "martin" ? "laura" : "martin";
}

// Loads /dashboard as each person (phone and desktop width) with every API
// returning empty data, and fails if React reports a hydration mismatch
// (minified errors #418 / #423 / #425) or any other page error. A mismatch
// makes React throw away the server HTML and re-render everything on load.
// Usual causes here: a date or toLocale* string rendered on the server (its
// clock is UTC and Node's en-GB formatting differs from the browser's), or
// several text nodes inside an SVG <title>. Fix by rendering after mount or
// formatting by hand — see TrainingPlanCalendar.js.
//
//   VERIFY_DIR=... node .claude/skills/nutriscore-verify/scripts/hydration.mjs
import { openDashboard } from "./harness.mjs";

let failed = false;
for (const person of ["martin", "laura"]) {
  for (const [label, viewport, mobile] of [
    ["phone", { width: 390, height: 844 }, true],
    ["desktop", { width: 1280, height: 900 }, false]
  ]) {
    const { errors, close } = await openDashboard({ person, viewport, mobile });
    await close();
    const unique = [...new Set(errors)];
    console.log((unique.length ? "FAIL " : "ok   ") + person + " / " + label + (unique.length ? ": " + unique.join(" | ") : ""));
    if (unique.length) failed = true;
  }
}
if (failed) {
  console.log("\nFor the readable message, run `npx next dev -p 3102` and load /dashboard there — dev mode names the component and the two strings that differed.");
  process.exit(1);
}

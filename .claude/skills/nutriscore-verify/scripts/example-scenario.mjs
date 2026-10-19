// A worked example to copy into your scratch folder and adapt: logs in as
// Martin with a week of food, checks the 7-day trend header, then screenshots
// the Today tab (light + midnight, full page) and the desktop layout.
//
//   VERIFY_DIR=... node .claude/skills/nutriscore-verify/scripts/example-scenario.mjs /path/to/scratch/out
import fs from "node:fs";
import { openDashboard, openTab, setTheme, fullPage, daysAgo } from "./harness.mjs";

const out = process.argv[2] || ".";
fs.mkdirSync(out, { recursive: true });

const snacks = [3050, 2700, 2400, 2980, 2975, 3010].map((kcal, i) => ({
  id: "s" + i,
  log_date: daysAgo(6 - i),
  calories: kcal,
  protein_g: 150 + i * 4,
  meal_type: "meal",
  description: "Test meal"
}));

const { page, errors, close } = await openDashboard({
  person: "martin",
  api: {
    "/api/targets": () => ({ calorieTarget: 2900, proteinTarget: 170 }),
    "/api/snacks": ({ searchParams }) => ({ entries: searchParams.get("person") === "martin" ? snacks : [] }),
    "/api/prefs": () => ({ raceDate: "2027-08-08", dayEndHour: 0, shareMeals: true, showFiber: true, stravaAutosync: false })
  }
});

await openTab(page, "Today");
console.log("trend:", (await page.locator(".mobile-dashboard .week-trend-head").innerText()).replace(/\n/g, " | "));
await fullPage(page, out + "/today-light.png");
await setTheme(page, "midnight");
await fullPage(page, out + "/today-midnight.png");

await setTheme(page, "light");
await page.setViewportSize({ width: 1280, height: 900 });
await page.waitForTimeout(300);
await page.screenshot({ path: out + "/desktop.png" });

console.log("page errors:", errors.length ? errors : "none");
await close();

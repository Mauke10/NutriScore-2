// Shared bits for driving the app in headless Chromium against mocked APIs.
// Import it from a scenario script written in your scratch folder:
//
//   import { openDashboard, fullPage, setTheme, ymd, daysAgo } from "<repo>/.claude/skills/nutriscore-verify/scripts/harness.mjs";
//   const { page, errors, calls, close } = await openDashboard({
//     person: "martin",
//     api: {
//       "/api/targets": () => ({ calorieTarget: 2900, proteinTarget: 170 }),
//       "/api/snacks": ({ searchParams }) => ({ entries: searchParams.get("person") === "martin" ? mySnacks : [] }),
//       "/api/training-sessions": ({ method, body }) => (method === "POST" ? { ok: true } : { entries: [] })
//     }
//   });
//
// Every /api/* request is answered by `api` (keyed by pathname) or, if there's
// no handler, with { entries: [], ok: true }. /api/version always answers
// { buildTime: null } so VersionWatcher never reloads mid-test. Each handled
// non-GET call is recorded in `calls` as [method, pathname, body].
// Needs VERIFY_DIR (see setup.sh) and a server from serve.sh.
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";

const VERIFY_DIR = process.env.VERIFY_DIR;
if (!VERIFY_DIR) throw new Error("Set VERIFY_DIR — run scripts/setup.sh first.");
const req = createRequire(path.join(VERIFY_DIR, "package.json"));
export const { chromium } = req("playwright-core");

// Must match serve.sh.
export const BASE = process.env.BASE_URL || "http://127.0.0.1:3100";
const SESSION_SECRET = "local-test-secret-0123456789abcdef0123456789";

// The session cookie lib/session.js expects: "<person>.<issuedAtMs>.<hmac>".
export function sessionCookie(person) {
  const payload = person + "." + Date.now();
  return payload + "." + crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
}

// The preinstalled headless shell (cloud sessions ship it under /opt/pw-browsers).
export function chromiumPath() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  try {
    const shell = fs.readdirSync(root).filter((d) => d.startsWith("chromium_headless_shell")).sort().pop();
    if (shell) return path.join(root, shell, "chrome-linux", "headless_shell");
  } catch {
    // fall through to Playwright's own lookup
  }
  return undefined;
}

// Local calendar date helpers — same rule as the app: never toISOString().
export const ymd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
export function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymd(d);
}

export async function openDashboard({ person = "martin", api = {}, viewport = { width: 390, height: 844 }, mobile = true, path: route = "/dashboard" } = {}) {
  const browser = await chromium.launch({ executablePath: chromiumPath() });
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: mobile, isMobile: mobile });
  await ctx.addCookies([{ name: "nutriscore_session", value: sessionCookie(person), url: BASE }]);
  const page = await ctx.newPage();
  const errors = [];
  const calls = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  await page.route("**/api/**", async (r) => {
    const request = r.request();
    const url = new URL(request.url());
    const method = request.method();
    let body = null;
    try {
      body = JSON.parse(request.postData() || "null");
    } catch {
      body = request.postData();
    }
    const json = (x, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(x) });
    if (url.pathname === "/api/version") return json({ buildTime: null });
    const handler = api[url.pathname];
    if (method !== "GET") calls.push([method, url.pathname, body]);
    if (!handler) return json({ entries: [], ok: true });
    const out = await handler({ method, searchParams: url.searchParams, body, url });
    return json(out ?? { ok: true });
  });
  await page.goto(BASE + route, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  return { browser, page, errors, calls, close: () => browser.close() };
}

// Mobile bottom-nav tab: "Today" (or Yesterday/weekday), "Training", "Calendar", "Body", "Compete".
export async function openTab(page, name) {
  await page.locator(".bottom-nav button", { hasText: name }).click();
  await page.waitForTimeout(500);
}

// Any key from lib/theme.js: light, sand, nordic, blush, dark, midnight, ember.
export async function setTheme(page, key) {
  await page.evaluate((k) => document.documentElement.setAttribute("data-theme", k), key);
  await page.waitForTimeout(150);
}

// Screenshot of the whole scrolled page at phone width (resizes, shoots, restores).
export async function fullPage(page, file) {
  const vp = page.viewportSize();
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: vp.width, height: h });
  await page.waitForTimeout(250);
  await page.screenshot({ path: file });
  await page.setViewportSize(vp);
}

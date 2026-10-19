// Renders the app icon PNGs into public/icons/ from scripts/icons/stride.mjs:
// for each colour scheme, 32 (favicon), 180 (iPhone home screen), 192 and
// 512 (Android / manifest) and a 512 maskable. Also writes the SVG source.
// Uses the headless Chromium + playwright-core from the nutriscore-verify
// skill:
//
//   export VERIFY_DIR="$(bash ../.claude/skills/nutriscore-verify/scripts/setup.sh)"
//   node scripts/icons/render-icons.mjs        (from nutriscore-app/)
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { SCHEMES, strideSvg } from "./stride.mjs";

const VERIFY_DIR = process.env.VERIFY_DIR;
if (!VERIFY_DIR) throw new Error("Set VERIFY_DIR (see .claude/skills/nutriscore-verify/scripts/setup.sh).");
const { chromium } = createRequire(path.join(VERIFY_DIR, "package.json"))("playwright-core");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = path.join(root, "public/icons");
fs.mkdirSync(out, { recursive: true });

const shell = (() => {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  try {
    const dir = fs.readdirSync(base).filter((d) => d.startsWith("chromium_headless_shell")).sort().pop();
    return dir ? path.join(base, dir, "chrome-linux", "headless_shell") : undefined;
  } catch {
    return undefined;
  }
})();

const browser = await chromium.launch({ executablePath: shell });
const page = await (await browser.newContext({ deviceScaleFactor: 1 })).newPage();
for (const key of Object.keys(SCHEMES)) {
  fs.writeFileSync(path.join(out, `stride-${key}.svg`), strideSvg(key));
  for (const [size, maskable] of [[32, false], [180, false], [192, false], [512, false], [512, true]]) {
    await page.setViewportSize({ width: size, height: size });
    const svg = strideSvg(key, { maskable }).replace("<svg ", `<svg width="${size}" height="${size}" `);
    await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
    const name = `stride-${key}-${size}${maskable ? "-maskable" : ""}.png`;
    await page.locator("svg").screenshot({ path: path.join(out, name), omitBackground: true });
  }
}
await browser.close();
console.log("Wrote " + fs.readdirSync(out).length + " files to public/icons/");

// Checks a new migration WITHOUT touching the live database, using PGlite
// (Postgres compiled to WASM, in memory):
//   1. builds the schema as it is on main (git show origin/main:.../schema.sql)
//   2. runs the migration TWICE — it must be safe to re-run
//   3. builds a fresh database from the working-tree schema.sql
//   4. compares the two: every table's columns (type, nullability, default),
//      constraints, indexes and RLS flag must match, so a fresh install and an
//      upgraded live database end up identical
// Optional: --seed=<file.sql> runs extra SQL after step 1 (rows the migration
// should copy or keep), and --query=<sql> prints a query's rows at the end.
//
//   VERIFY_DIR=... node .claude/skills/nutriscore-verify/scripts/migration-check.mjs supabase/migration_014_x.sql
//   (paths relative to nutriscore-app/, or absolute)
//
// PGlite has no pg_trgm, and Supabase's roles don't exist in it, so lines that
// create extensions or use gin_trgm_ops are stripped and the anon /
// authenticated / service_role roles are created first.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";

const VERIFY_DIR = process.env.VERIFY_DIR;
if (!VERIFY_DIR) throw new Error("Set VERIFY_DIR — run scripts/setup.sh first.");
const req = createRequire(path.join(VERIFY_DIR, "package.json"));
const { PGlite } = req("@electric-sql/pglite");

const repo = execSync("git rev-parse --show-toplevel").toString().trim();
const app = path.join(repo, "nutriscore-app");
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("Usage: migration-check.mjs <migration.sql> [--seed=file.sql] [--query=SQL] [--base=origin/main]");
  process.exit(2);
}
const opt = (k) => args.find((a) => a.startsWith("--" + k + "="))?.slice(k.length + 3);
const resolve = (f) => (path.isAbsolute(f) ? f : path.join(app, f));

const strip = (sql) => sql.split("\n").filter((l) => !/create extension|gin_trgm_ops/i.test(l)).join("\n");
const ROLES = "create role anon; create role authenticated; create role service_role;";
const base = opt("base") || "origin/main";
const oldSchema = execSync("git show " + base + ":nutriscore-app/supabase/schema.sql", { cwd: repo }).toString();
const migration = fs.readFileSync(resolve(file), "utf8");
const newSchema = fs.readFileSync(path.join(app, "supabase/schema.sql"), "utf8");

async function fresh(sql) {
  const db = new PGlite();
  await db.exec(ROLES);
  await db.exec(strip(sql));
  return db;
}

const upgraded = await fresh(oldSchema);
await upgraded.exec("insert into people(id, display_name) values ('martin','Martin'),('laura','Laura') on conflict do nothing");
if (opt("seed")) await upgraded.exec(fs.readFileSync(resolve(opt("seed")), "utf8"));
await upgraded.exec(strip(migration));
console.log("ok   migration ran");
await upgraded.exec(strip(migration));
console.log("ok   migration ran a second time (re-runnable)");

const clean = await fresh(newSchema);

async function describe(db) {
  const q = async (sql) => (await db.query(sql)).rows.map((r) => Object.values(r).join(":")).sort();
  return {
    columns: await q("select table_name, column_name, data_type, is_nullable, coalesce(column_default,'') from information_schema.columns where table_schema='public'"),
    constraints: await q("select conrelid::regclass::text, conname, contype from pg_constraint where connamespace='public'::regnamespace"),
    indexes: await q("select tablename, indexname from pg_indexes where schemaname='public'"),
    rls: await q("select relname, relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r'")
  };
}
const a = await describe(upgraded);
const b = await describe(clean);
let mismatch = false;
for (const k of Object.keys(a)) {
  const onlyUpgraded = a[k].filter((x) => !b[k].includes(x));
  const onlySchema = b[k].filter((x) => !a[k].includes(x));
  if (onlyUpgraded.length || onlySchema.length) {
    mismatch = true;
    console.log("FAIL " + k + " differ");
    for (const x of onlyUpgraded) console.log("     only after migration: " + x);
    for (const x of onlySchema) console.log("     only in schema.sql:   " + x);
  } else {
    console.log("ok   " + k + " match schema.sql");
  }
}
if (opt("query")) console.log((await upgraded.query(opt("query"))).rows);
process.exit(mismatch ? 1 : 0);

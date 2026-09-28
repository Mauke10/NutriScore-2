import { NextResponse } from "next/server";

// Returns the build time baked into whatever code is currently deployed —
// executes fresh on every request, so right after a Vercel deploy this
// immediately reflects the new build. VersionWatcher polls this to
// auto-reload a stale tab or home-screen app instead of needing you to
// close and reopen it to pick up an update.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || null },
    { headers: { "Cache-Control": "no-store" } }
  );
}

import { cookies } from "next/headers";
import { APP_ICONS, ICON_COOKIE, iconKey, iconPath } from "../../../lib/appIcons";

export const dynamic = "force-dynamic";

// The web app manifest, built per request so its icons follow the device's
// chosen app icon colour (the nutriscore_icon cookie, set in the Colour panel).
// Android Chrome re-reads it and updates the home-screen icon on its own.
export async function GET() {
  const key = iconKey(cookies().get(ICON_COOKIE)?.value);
  const bg = APP_ICONS.find((i) => i.key === key).bg;
  const manifest = {
    name: "Nutriscore",
    short_name: "Nutriscore",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: bg,
    theme_color: bg,
    icons: [
      { src: iconPath(key, 192), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: iconPath(key, 512), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: iconPath(key, "512-maskable"), sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "no-store" }
  });
}

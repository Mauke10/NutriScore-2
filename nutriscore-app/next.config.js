/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    // Baked into both server and client bundles at build time (a fresh value
    // every time Vercel runs `next build` for a deploy) â€” lets the running
    // app notice when a newer deploy has gone live. See VersionWatcher.js.
    NEXT_PUBLIC_BUILD_TIME: String(Date.now())
  }
};

module.exports = nextConfig;

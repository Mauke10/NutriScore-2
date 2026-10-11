import { createClient } from "@supabase/supabase-js";

// Server-only client using the service-role key. Every API route runs on the
// server (Next.js route handlers), so this key never reaches the browser.
// Do not import this file from a "use client" component.
let _client = null;

export function supabaseServer() {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — check your .env.local"
    );
  }
  _client = createClient(url, key, {
    auth: { persistSession: false }
  });
  return _client;
}

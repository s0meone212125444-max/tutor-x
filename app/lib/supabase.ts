import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

// Fallbacks let the app build/render before real Supabase keys are added.
// Supports both the new key names (publishable/secret) and the legacy ones (anon/service_role).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const publishable =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "placeholder-anon-key";
const secret =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "placeholder-secret-key";

// Browser client (respects RLS via the logged-in user's session)
export function supabaseBrowser() {
  return createBrowserClient(url, publishable);
}

// Server admin client (secret/service role — bypasses RLS; only used in trusted API routes)
export function supabaseAdmin() {
  return createClient(url, secret, {
    auth: { persistSession: false },
  });
}

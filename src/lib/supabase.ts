import { createClient } from "@supabase/supabase-js";

export function configured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function supabase() {
  if (!configured()) throw new Error("Supabase is not configured. Add server-side environment variables first.");
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "User-Agent": "friends-included-finance-server/1.0" } },
  });
}

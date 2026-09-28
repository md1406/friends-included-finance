import { createClient } from "@supabase/supabase-js";

export function configured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function supabase() {
  if (!configured()) throw new Error("Supabase is not configured. Add server-side environment variables first.");
  const url = process.env.SUPABASE_URL!;
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const serverFetch: typeof fetch = (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("apikey", secretKey);
    headers.set("Authorization", `Bearer ${secretKey}`);
    headers.set("User-Agent", "friends-included-finance-server/1.0");
    return fetch(input, { ...init, headers });
  };
  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: serverFetch },
  });
}

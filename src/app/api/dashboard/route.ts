import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { dashboardData } from "@/lib/services";
import { configured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function connectionDiagnostic() {
  const url = process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  let host = "invalid or missing URL";
  try { host = new URL(url).host; } catch { /* reported above */ }
  const keyKind = key.startsWith("sb_secret_") ? "secret API key" : key.startsWith("eyJ") ? "legacy JWT key" : key ? "unrecognised key format" : "missing key";
  return { host, keyKind };
}

function keyMatchesSuppliedFingerprint(request: Request) {
  const fingerprint = new URL(request.url).searchParams.get("keyFingerprint");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!fingerprint || !/^[a-f0-9]{64}$/.test(fingerprint) || !key) return null;
  const actual = createHash("sha256").update(key).digest("hex");
  return timingSafeEqual(Buffer.from(actual), Buffer.from(fingerprint));
}

export async function GET(request: Request) {
  if (!configured()) return NextResponse.json({ configured: false, dashboard: null, sales: [], expenses: [] });
  const actorName = new URL(request.url).searchParams.get("actorName");
  if (!actorName) return NextResponse.json({ error: "Choose a demonstration role" }, { status: 400 });
  try { return NextResponse.json({ configured: true, ...(await dashboardData(actorName)) }); }
  catch (error) {
    return NextResponse.json({
      configured: true,
      error: error instanceof Error ? error.message : "Dashboard unavailable",
      diagnostic: { ...connectionDiagnostic(), keyMatchesSuppliedFingerprint: keyMatchesSuppliedFingerprint(request) },
    }, { status: 500 });
  }
}

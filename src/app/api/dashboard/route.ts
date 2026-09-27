import { NextResponse } from "next/server";
import { dashboardData } from "@/lib/services";
import { configured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!configured()) return NextResponse.json({ configured: false, dashboard: null, sales: [], expenses: [] });
  const actorName = new URL(request.url).searchParams.get("actorName");
  if (!actorName) return NextResponse.json({ error: "Choose a demonstration role" }, { status: 400 });
  try { return NextResponse.json({ configured: true, ...(await dashboardData(actorName)) }); }
  catch (error) { return NextResponse.json({ configured: true, error: error instanceof Error ? error.message : "Dashboard unavailable" }, { status: 500 }); }
}

import { NextResponse } from "next/server";
import { approveSale } from "@/lib/services";
import { saleDecisionInput } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const parsed = saleDecisionInput.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid decision" }, { status: 400 });
    return NextResponse.json(await approveSale(parsed.data));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not approve sale" }, { status: 400 });
  }
}

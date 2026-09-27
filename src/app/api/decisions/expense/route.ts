import { NextResponse } from "next/server";
import { allocateExpense } from "@/lib/services";
import { expenseDecisionInput } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const parsed = expenseDecisionInput.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid decision" }, { status: 400 });
    return NextResponse.json(await allocateExpense(parsed.data));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not allocate expense" }, { status: 400 });
  }
}

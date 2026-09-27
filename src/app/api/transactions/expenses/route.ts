import { NextResponse } from "next/server";
import { submitExpense } from "@/lib/services";
import { expenseInput } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const parsed = expenseInput.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid expense" }, { status: 400 });
    const expense = await submitExpense(parsed.data);
    return NextResponse.json({ expense }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save expense" }, { status: 400 });
  }
}

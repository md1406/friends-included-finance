import { NextResponse } from "next/server";
import { submitSale } from "@/lib/services";
import { saleInput } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const parsed = saleInput.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid sale" }, { status: 400 });
    const sale = await submitSale(parsed.data);
    return NextResponse.json({ sale }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save sale" }, { status: 400 });
  }
}

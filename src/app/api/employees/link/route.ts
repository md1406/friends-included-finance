import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";

const input = z.object({ actorName: z.literal("Svetlana de Monte Carlo"), employeeName: z.string().min(1), telegramUserId: z.coerce.number().int().positive(), chatId: z.coerce.number().int().positive() });

export async function POST(request: Request) {
  try {
    const parsed = input.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Only Svetlana can link a Telegram account" }, { status: 403 });
    const db = supabase();
    const { data: manager } = await db.from("employees").select("id").eq("name", parsed.data.actorName).eq("role", "manager").maybeSingle();
    if (!manager) return NextResponse.json({ error: "Manager account is unavailable" }, { status: 403 });
    const { error } = await db.from("employees").update({ telegram_user_id: parsed.data.telegramUserId, linked_telegram_chat_id: parsed.data.chatId }).eq("name", parsed.data.employeeName);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not link Telegram" }, { status: 400 });
  }
}

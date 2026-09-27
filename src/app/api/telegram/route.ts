import { NextResponse } from "next/server";
import { submitExpense, submitSale } from "@/lib/services";
import { supabase } from "@/lib/supabase";
import { expenseInput, saleInput } from "@/lib/validation";
import { telegramSend } from "@/lib/integrations";

type TelegramUpdate = { message?: { text?: string; from?: { id: number }; chat: { id: number; type: string } } };

function fields(text: string) { return text.split("|").map((part) => part.trim()); }

export async function POST(request: Request) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret && request.headers.get("x-telegram-bot-api-secret-token") !== expectedSecret) return new NextResponse("Forbidden", { status: 403 });
  const update = (await request.json()) as TelegramUpdate;
  const message = update.message;
  if (!message?.from || !message.text || message.chat.type !== "private") return NextResponse.json({ ok: true });
  const chatId = message.chat.id;
  const reply = async (text: string) => { try { await telegramSend(chatId, text); } catch { /* Telegram retries must not duplicate a saved record. */ } };
  const text = message.text.trim();

  if (text === "/start" || text === "/id") {
    await reply(`Your Telegram user ID: ${message.from.id}. Your private chat ID: ${chatId}. Ask Svetlana to link your user ID before submitting a transaction.`);
    return NextResponse.json({ ok: true });
  }

  try {
    const db = supabase();
    const { data: employee } = await db.from("employees").select("name").eq("telegram_user_id", message.from.id).maybeSingle();
    if (!employee) {
      await reply("Your Telegram account is not linked to a fictional employee. Send /id and ask the manager to complete the link.");
      return NextResponse.json({ ok: true });
    }
    if (text.toLowerCase().startsWith("/sale ")) {
      const [reference, customer, project, description, amount, richardPct, anastasiaPct, jeanClaudePct] = fields(text.slice(6));
      const parsed = saleInput.safeParse({ actorName: employee.name, reference, customer, project, description, amount, richardPct, anastasiaPct, jeanClaudePct });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid sale");
      await submitSale(parsed.data, chatId);
      return NextResponse.json({ ok: true });
    }
    if (text.toLowerCase().startsWith("/expense ")) {
      const [reference, description, category, amount, proposedAllocation] = fields(text.slice(9));
      const parsed = expenseInput.safeParse({ actorName: employee.name, reference, description, category, amount, proposedAllocation });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid expense");
      await submitExpense(parsed.data, chatId);
      return NextResponse.json({ ok: true });
    }
    await reply("Commands:\n/sale S01 | Customer | A | Description | 1000 | 50 | 30 | 20\n/expense E01 | Description | Materials | 120 | A\n/id");
  } catch (error) {
    await reply(`Not recorded: ${error instanceof Error ? error.message : "please correct the details and try again"}`);
  }
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { expenseApprovalMessage, expenseConfirmation, saleApprovalMessage, saleConfirmation, syncExpenseToSheets, syncSaleToSheets, updateNotificationState, updateSyncState } from "@/lib/integrations";
import { supabase } from "@/lib/supabase";

const input = z.object({ actorName: z.literal("Svetlana de Monte Carlo"), reference: z.string().regex(/^[SE][0-9]{2,}$/i).transform((value) => value.toUpperCase()), action: z.enum(["sync", "notification"]) });

export async function POST(request: Request) {
  try {
    const parsed = input.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Only Svetlana can retry a valid reference" }, { status: 403 });
    const db = supabase();
    const { data: manager } = await db.from("employees").select("id").eq("name", parsed.data.actorName).eq("role", "manager").maybeSingle();
    if (!manager) return NextResponse.json({ error: "Manager account is unavailable" }, { status: 403 });
    const isSale = parsed.data.reference.startsWith("S");
    const table = isSale ? "sales" : "expenses";
    const { data: record, error } = await db.from(table).select("*, employees(name)").eq("reference", parsed.data.reference).maybeSingle();
    if (error || !record) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    if (parsed.data.action === "sync") {
      const result = await updateSyncState(db, table, record.reference, () => isSale ? syncSaleToSheets(record) : syncExpenseToSheets(record));
      return NextResponse.json(result);
    }
    const message = isSale
      ? (record.status === "Approved" ? saleApprovalMessage(record, record.proposed_richard_pct !== record.approved_richard_pct || record.proposed_anastasia_pct !== record.approved_anastasia_pct || record.proposed_jean_claude_pct !== record.approved_jean_claude_pct) : saleConfirmation(record))
      : (record.status === "Allocated" ? expenseApprovalMessage(record, record.proposed_allocation !== record.final_allocation) : expenseConfirmation(record));
    return NextResponse.json(await updateNotificationState(db, table, record.reference, record.notification_chat_id, message));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Retry failed" }, { status: 400 });
  }
}

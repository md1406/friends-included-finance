import { google } from "googleapis";

type Syncable = { reference: string; sync_status: string; sync_error: string | null };

const SHEET_HEADERS = {
  Sales: [
    "Reference", "Submitted at", "Submitted by", "Customer", "Project", "Description", "Amount EUR",
    "Proposed Richard %", "Proposed Anastasia %", "Proposed Jean-Claude %",
    "Approved Richard %", "Approved Anastasia %", "Approved Jean-Claude %",
    "Richard commission EUR", "Anastasia commission EUR", "Jean-Claude commission EUR", "Status",
  ],
  Expenses: [
    "Reference", "Submitted at", "Submitted by", "Description", "Category", "Amount EUR",
    "Proposed allocation", "Final allocation", "Status",
  ],
} as const;

function sheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key || !process.env.GOOGLE_SHEETS_SPREADSHEET_ID) throw new Error("Google Sheets is not configured");
  const auth = new google.auth.JWT({ email, key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  return google.sheets({ version: "v4", auth });
}

async function ensureSheetReady(client: ReturnType<typeof google.sheets>, spreadsheetId: string, tab: "Sales" | "Expenses") {
  const metadata = await client.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
  const exists = metadata.data.sheets?.some((sheet) => sheet.properties?.title === tab);
  if (!exists) {
    await client.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] },
    });
  }
  await client.spreadsheets.values.update({
    spreadsheetId,
    range: `${tab}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [SHEET_HEADERS[tab] as unknown as string[]] },
  });
}

async function upsertRow(tab: "Sales" | "Expenses", reference: string, row: (string | number)[]) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
  const client = sheetsClient();
  await ensureSheetReady(client, spreadsheetId, tab);
  const existing = await client.spreadsheets.values.get({ spreadsheetId, range: `${tab}!A:A` });
  const rowIndex = existing.data.values?.findIndex((cells) => cells[0] === reference) ?? -1;
  if (rowIndex >= 0) {
    await client.spreadsheets.values.update({ spreadsheetId, range: `${tab}!A${rowIndex + 1}`, valueInputOption: "USER_ENTERED", requestBody: { values: [row] } });
  } else {
    await client.spreadsheets.values.append({ spreadsheetId, range: `${tab}!A:Z`, valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values: [row] } });
  }
}

export async function syncSaleToSheets(sale: any) {
  await upsertRow("Sales", sale.reference, [
    sale.reference, new Date(sale.submitted_at).toISOString(), sale.employees.name, sale.customer, sale.project,
    sale.description, (sale.amount_cents / 100).toFixed(2),
    sale.proposed_richard_pct, sale.proposed_anastasia_pct, sale.proposed_jean_claude_pct,
    sale.approved_richard_pct ?? "", sale.approved_anastasia_pct ?? "", sale.approved_jean_claude_pct ?? "",
    (sale.richard_commission_cents / 100).toFixed(2), (sale.anastasia_commission_cents / 100).toFixed(2),
    (sale.jean_claude_commission_cents / 100).toFixed(2), sale.status,
  ]);
}

export async function syncExpenseToSheets(expense: any) {
  await upsertRow("Expenses", expense.reference, [
    expense.reference, new Date(expense.submitted_at).toISOString(), expense.employees.name, expense.description,
    expense.category, (expense.amount_cents / 100).toFixed(2), expense.proposed_allocation,
    expense.final_allocation ?? "", expense.status,
  ]);
}

export async function telegramSend(chatId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Telegram bot is not configured");
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!response.ok) throw new Error(`Telegram rejected delivery (${response.status})`);
}

export function saleConfirmation(sale: any) {
  return `Sale ${sale.reference} recorded. ${euro(sale.amount_cents)} for project ${sale.project}. Status: ${sale.status}.`;
}
export function expenseConfirmation(expense: any) {
  return `Expense ${expense.reference} recorded. ${euro(expense.amount_cents)}; proposed allocation: ${expense.proposed_allocation}. Status: ${expense.status}.`;
}
export function saleApprovalMessage(sale: any, changed: boolean) {
  return `Sale ${sale.reference} approved${changed ? " — commission split changed" : ""}. Sale ${euro(sale.amount_cents)}; total commission ${euro(sale.richard_commission_cents + sale.anastasia_commission_cents + sale.jean_claude_commission_cents)}. Richard: ${sale.proposed_richard_pct}% → ${sale.approved_richard_pct}% (${euro(sale.richard_commission_cents)}). Anastasia: ${sale.proposed_anastasia_pct}% → ${sale.approved_anastasia_pct}% (${euro(sale.anastasia_commission_cents)}). Jean-Claude: ${sale.proposed_jean_claude_pct}% → ${sale.approved_jean_claude_pct}% (${euro(sale.jean_claude_commission_cents)}).`;
}
export function expenseApprovalMessage(expense: any, changed: boolean) {
  return `Expense ${expense.reference}${changed ? " — allocation changed" : " — allocation confirmed"}. ${euro(expense.amount_cents)}: ${expense.description}. Proposed: ${expense.proposed_allocation}. Approved: ${expense.final_allocation}.`;
}
function euro(cents: number) { return `€${(cents / 100).toFixed(2)}`; }

export async function updateSyncState(db: any, table: "sales" | "expenses", reference: string, operation: () => Promise<void>) {
  try {
    await operation();
    await db.from(table).update({ sync_status: "Synced", sync_error: null }).eq("reference", reference);
    return { ok: true };
  } catch (error) {
    await db.from(table).update({ sync_status: "Failed", sync_error: error instanceof Error ? error.message : "Unknown sync failure" }).eq("reference", reference);
    return { ok: false };
  }
}

export async function updateNotificationState(db: any, table: "sales" | "expenses", reference: string, chatId: number | null, message: string) {
  if (!chatId) {
    await db.from(table).update({ notification_status: "Not needed", notification_error: "No Telegram recipient linked" }).eq("reference", reference);
    return { ok: false, skipped: true };
  }
  try {
    await telegramSend(chatId, message);
    await db.from(table).update({ notification_status: "Sent", notification_error: null }).eq("reference", reference);
    return { ok: true };
  } catch (error) {
    await db.from(table).update({ notification_status: "Failed", notification_error: error instanceof Error ? error.message : "Unknown Telegram delivery failure" }).eq("reference", reference);
    return { ok: false };
  }
}

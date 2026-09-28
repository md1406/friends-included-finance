import { calculateCommissions, calculateDashboard, euroToCents, type CommissionSplit } from "@/lib/domain";
import { expenseApprovalMessage, expenseConfirmation, saleApprovalMessage, saleConfirmation, syncExpenseToSheets, syncSaleToSheets, updateNotificationState, updateSyncState } from "@/lib/integrations";
import { supabase } from "@/lib/supabase";

const DEMO_EMPLOYEES = [
  { name: "Svetlana de Monte Carlo", role: "manager" },
  { name: "Richard Darling", role: "salesperson" },
  { name: "Anastasia Ferrari", role: "salesperson" },
  { name: "Jean-Claude Bērziņš", role: "salesperson" },
  { name: "Kevin von Whatever", role: "expense_reporter" },
];

async function ensureDemoEmployees(db: any) {
  const { error } = await db.from("employees").upsert(DEMO_EMPLOYEES, { onConflict: "name" });
  if (error) throw new Error(`Employee setup failed: ${error.message}`);
}

async function employeeFor(name: string, allowedRole: "manager" | "salesperson" | "expense_reporter") {
  const db = supabase();
  const { data, error } = await db.from("employees").select("*").eq("name", name).maybeSingle();
  if (error || !data) throw new Error("Selected employee does not exist");
  if (data.role !== allowedRole) throw new Error("This role is not permitted to perform that action");
  return { db, employee: data };
}

async function reserveReference(db: any, reference: string, kind: "sale" | "expense") {
  const { error } = await db.from("transaction_references").insert({ reference, kind });
  if (error) throw new Error("This reference already exists");
}

export async function submitSale(input: any, notificationChatId?: number | null) {
  const { db, employee } = await employeeFor(input.actorName, "salesperson");
  if (!input.reference.startsWith("S")) throw new Error("Sales references must start with S");
  await reserveReference(db, input.reference, "sale");
  const chatId = notificationChatId ?? employee.linked_telegram_chat_id ?? null;
  const { data: sale, error } = await db.from("sales").insert({
    reference: input.reference, salesperson_id: employee.id, notification_chat_id: chatId, customer: input.customer,
    project: input.project, description: input.description, amount_cents: euroToCents(input.amount),
    proposed_richard_pct: input.richardPct, proposed_anastasia_pct: input.anastasiaPct, proposed_jean_claude_pct: input.jeanClaudePct,
  }).select("*, employees!sales_salesperson_id_fkey(name)").single();
  if (error) throw new Error(error.message);
  await updateSyncState(db, "sales", sale.reference, () => syncSaleToSheets(sale));
  if (chatId) await updateNotificationState(db, "sales", sale.reference, chatId, saleConfirmation(sale));
  return sale;
}

export async function submitExpense(input: any, notificationChatId?: number | null) {
  const { db, employee } = await employeeFor(input.actorName, "expense_reporter");
  if (!input.reference.startsWith("E")) throw new Error("Expense references must start with E");
  await reserveReference(db, input.reference, "expense");
  const isOverhead = input.proposedAllocation === "Company overhead";
  const chatId = notificationChatId ?? employee.linked_telegram_chat_id ?? null;
  const { data: expense, error } = await db.from("expenses").insert({
    reference: input.reference, reporter_id: employee.id, notification_chat_id: chatId, description: input.description,
    category: input.category, amount_cents: euroToCents(input.amount), proposed_allocation: input.proposedAllocation,
    status: isOverhead ? "Allocated" : "Awaiting allocation", final_allocation: isOverhead ? "Company overhead" : null,
  }).select("*, employees!expenses_reporter_id_fkey(name)").single();
  if (error) throw new Error(error.message);
  await updateSyncState(db, "expenses", expense.reference, () => syncExpenseToSheets(expense));
  if (chatId) await updateNotificationState(db, "expenses", expense.reference, chatId, expenseConfirmation(expense));
  return expense;
}

export async function approveSale(input: any) {
  const { db, employee } = await employeeFor(input.actorName, "manager");
  const { data: current, error } = await db.from("sales").select("*, employees!sales_salesperson_id_fkey(name)").eq("reference", input.reference).maybeSingle();
  if (error || !current) throw new Error("Sale not found");
  if (current.status === "Approved") return { sale: current, alreadyApproved: true };
  const split: CommissionSplit = { "Richard Darling": input.richardPct, "Anastasia Ferrari": input.anastasiaPct, "Jean-Claude Bērziņš": input.jeanClaudePct };
  const commission = calculateCommissions(current.amount_cents, split);
  const { data: sale, error: updateError } = await db.from("sales").update({
    status: "Approved", approved_richard_pct: input.richardPct, approved_anastasia_pct: input.anastasiaPct,
    approved_jean_claude_pct: input.jeanClaudePct, richard_commission_cents: commission.amounts["Richard Darling"],
    anastasia_commission_cents: commission.amounts["Anastasia Ferrari"], jean_claude_commission_cents: commission.amounts["Jean-Claude Bērziņš"],
    approved_at: new Date().toISOString(), approved_by: employee.id,
  }).eq("reference", input.reference).eq("status", "Pending approval").select("*, employees!sales_salesperson_id_fkey(name)").single();
  if (updateError) throw new Error(updateError.message);
  await updateSyncState(db, "sales", sale.reference, () => syncSaleToSheets(sale));
  const changed = current.proposed_richard_pct !== sale.approved_richard_pct || current.proposed_anastasia_pct !== sale.approved_anastasia_pct || current.proposed_jean_claude_pct !== sale.approved_jean_claude_pct;
  await updateNotificationState(db, "sales", sale.reference, sale.notification_chat_id, saleApprovalMessage(sale, changed));
  return { sale, alreadyApproved: false };
}

export async function allocateExpense(input: any) {
  const { db, employee } = await employeeFor(input.actorName, "manager");
  const { data: current, error } = await db.from("expenses").select("*, employees!expenses_reporter_id_fkey(name)").eq("reference", input.reference).maybeSingle();
  if (error || !current) throw new Error("Expense not found");
  if (current.status === "Allocated") return { expense: current, alreadyAllocated: true };
  const { data: expense, error: updateError } = await db.from("expenses").update({
    status: "Allocated", final_allocation: input.allocation, allocated_at: new Date().toISOString(), allocated_by: employee.id,
  }).eq("reference", input.reference).eq("status", "Awaiting allocation").select("*, employees!expenses_reporter_id_fkey(name)").single();
  if (updateError) throw new Error(updateError.message);
  await updateSyncState(db, "expenses", expense.reference, () => syncExpenseToSheets(expense));
  const changed = current.proposed_allocation !== expense.final_allocation;
  await updateNotificationState(db, "expenses", expense.reference, expense.notification_chat_id, expenseApprovalMessage(expense, changed));
  return { expense, alreadyAllocated: false };
}

export async function dashboardData(actorName: string) {
  const db = supabase();
  let { data: actor, error: actorError } = await db.from("employees").select("id, role").eq("name", actorName).maybeSingle();
  if (actorError) throw new Error(`Employee query failed: ${actorError.message}`);
  if (!actor && !actorError) {
    await ensureDemoEmployees(db);
    ({ data: actor, error: actorError } = await db.from("employees").select("id, role").eq("name", actorName).maybeSingle());
  }
  if (actorError) throw new Error(`Employee query failed: ${actorError.message}`);
  if (!actor) throw new Error("Selected employee does not exist");
  const isManager = actor.role === "manager";
  const [salesResult, expensesResult] = await Promise.all([
    isManager ? db.from("sales").select("*, employees!sales_salesperson_id_fkey(name)").order("submitted_at", { ascending: false }) : db.from("sales").select("*, employees!sales_salesperson_id_fkey(name)").eq("salesperson_id", actor.id).order("submitted_at", { ascending: false }),
    isManager ? db.from("expenses").select("*, employees!expenses_reporter_id_fkey(name)").order("submitted_at", { ascending: false }) : db.from("expenses").select("*, employees!expenses_reporter_id_fkey(name)").eq("reporter_id", actor.id).order("submitted_at", { ascending: false }),
  ]);
  if (salesResult.error) throw new Error(salesResult.error.message);
  if (expensesResult.error) throw new Error(expensesResult.error.message);
  return { dashboard: isManager ? calculateDashboard(salesResult.data as any, expensesResult.data as any) : null, sales: salesResult.data, expenses: expensesResult.data };
}

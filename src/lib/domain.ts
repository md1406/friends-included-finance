export const SALESPEOPLE = ["Richard Darling", "Anastasia Ferrari", "Jean-Claude Bērziņš"] as const;
export type SalespersonName = (typeof SALESPEOPLE)[number];

export type CommissionSplit = Record<SalespersonName, number>;

export function euroToCents(value: number): number {
  return Math.round(value * 100);
}

export function centsToEuro(value: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value / 100);
}

/** Applies the coursework rounding rule deterministically. */
export function calculateCommissions(amountCents: number, split: CommissionSplit) {
  const poolCents = Math.round(amountCents * 0.1);
  const amounts = Object.fromEntries(
    SALESPEOPLE.map((person) => [person, Math.round((poolCents * split[person]) / 100)]),
  ) as Record<SalespersonName, number>;
  const distributed = SALESPEOPLE.reduce((sum, person) => sum + amounts[person], 0);
  const largest = SALESPEOPLE.reduce((winner, person) =>
    split[person] > split[winner] ? person : winner,
  );
  amounts[largest] += poolCents - distributed;
  return { poolCents, amounts };
}

export type SaleRow = {
  status: "Pending approval" | "Approved";
  project: "A" | "B";
  amount_cents: number;
  richard_commission_cents: number;
  anastasia_commission_cents: number;
  jean_claude_commission_cents: number;
};

export type ExpenseRow = {
  status: "Awaiting allocation" | "Allocated";
  amount_cents: number;
  final_allocation: "A" | "B" | "Company overhead" | null;
};

export function calculateDashboard(sales: SaleRow[], expenses: ExpenseRow[]) {
  const projects = {
    A: { income: 0, commissions: 0, expenses: 0 },
    B: { income: 0, commissions: 0, expenses: 0 },
  };
  const commissions = { Richard: 0, Anastasia: 0, "Jean-Claude": 0 };
  let companyIncome = 0;
  let companyCommissions = 0;
  let totalExpenses = 0;
  let overhead = 0;
  let awaitingAllocation = 0;

  for (const sale of sales) {
    if (sale.status !== "Approved") continue;
    const commission = sale.richard_commission_cents + sale.anastasia_commission_cents + sale.jean_claude_commission_cents;
    projects[sale.project].income += sale.amount_cents;
    projects[sale.project].commissions += commission;
    companyIncome += sale.amount_cents;
    companyCommissions += commission;
    commissions.Richard += sale.richard_commission_cents;
    commissions.Anastasia += sale.anastasia_commission_cents;
    commissions["Jean-Claude"] += sale.jean_claude_commission_cents;
  }
  for (const expense of expenses) {
    totalExpenses += expense.amount_cents;
    if (expense.status === "Awaiting allocation") awaitingAllocation += expense.amount_cents;
    if (expense.final_allocation === "A" || expense.final_allocation === "B") projects[expense.final_allocation].expenses += expense.amount_cents;
    if (expense.final_allocation === "Company overhead") overhead += expense.amount_cents;
  }
  return {
    projects: {
      A: { ...projects.A, result: projects.A.income - projects.A.commissions - projects.A.expenses },
      B: { ...projects.B, result: projects.B.income - projects.B.commissions - projects.B.expenses },
    },
    company: { income: companyIncome, commissions: companyCommissions, overhead, awaitingAllocation, expenses: totalExpenses, result: companyIncome - companyCommissions - totalExpenses },
    commissions,
  };
}

"use client";

import { FormEvent, useEffect, useState } from "react";

const roles = ["Svetlana de Monte Carlo", "Richard Darling", "Anastasia Ferrari", "Jean-Claude Bērziņš", "Kevin von Whatever"];
const money = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });
const displayMoney = (cents?: number) => money.format((cents ?? 0) / 100);

type Data = { configured: boolean; error?: string; dashboard: any; sales: any[]; expenses: any[] };

export function FinanceConsole() {
  const [role, setRole] = useState(roles[0]);
  const [data, setData] = useState<Data>({ configured: false, dashboard: null, sales: [], expenses: [] });
  const [notice, setNotice] = useState("");
  const refresh = async () => { const response = await fetch(`/api/dashboard?actorName=${encodeURIComponent(role)}`, { cache: "no-store" }); setData(await response.json()); };
  useEffect(() => { void refresh(); }, [role]);

  async function post(path: string, body: Record<string, unknown>) {
    setNotice("Saving…");
    const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ actorName: role, ...body }) });
    const result = await response.json();
    setNotice(response.ok ? "Saved. Dashboard refreshed." : `Not saved: ${result.error}`);
    if (response.ok) await refresh();
  }

  const isSalesperson = roles.slice(1, 4).includes(role);
  const isManager = role === roles[0];
  const isKevin = role === "Kevin von Whatever";
  const dashboard = data.dashboard;
  const pendingSales = data.sales.filter((sale) => sale.status === "Pending approval");
  const pendingExpenses = data.expenses.filter((expense) => expense.status === "Awaiting allocation");

  return <main className="shell">
    <header className="topbar">
      <div><p className="eyebrow">Friends Included Ltd</p><h1>Finance control room</h1></div>
      <label className="role-picker">Demonstration role<select value={role} onChange={(event) => setRole(event.target.value)}>{roles.map((name) => <option key={name}>{name}</option>)}</select></label>
    </header>

    {!data.configured && <section className="setup"><strong>Setup required.</strong> Add the server-side Supabase variables, run the supplied SQL schema, then refresh this page. No transactions are simulated or stored in the browser.</section>}
    {data.error && <section className="setup error">Database issue: {data.error}</section>}
    {notice && <p className="notice" role="status">{notice}</p>}

    {isManager ? <section className="score-grid" aria-label="Financial dashboard">
      {(["A", "B"] as const).map((project) => <article className="metric-card" key={project}>
        <p>Project {project}</p><strong>{displayMoney(dashboard?.projects?.[project]?.result)}</strong>
        <dl><div><dt>Approved income</dt><dd>{displayMoney(dashboard?.projects?.[project]?.income)}</dd></div><div><dt>Commission expense</dt><dd>{displayMoney(dashboard?.projects?.[project]?.commissions)}</dd></div><div><dt>Allocated expenses</dt><dd>{displayMoney(dashboard?.projects?.[project]?.expenses)}</dd></div></dl>
      </article>)}
      <article className="metric-card company"><p>Company result</p><strong>{displayMoney(dashboard?.company?.result)}</strong><dl><div><dt>Overhead</dt><dd>{displayMoney(dashboard?.company?.overhead)}</dd></div><div><dt>Awaiting allocation</dt><dd>{displayMoney(dashboard?.company?.awaitingAllocation)}</dd></div><div><dt>All commissions</dt><dd>{displayMoney(dashboard?.company?.commissions)}</dd></div></dl></article>
    </section> : <section className="role-note">Only Svetlana can view company financial results. Your submissions and their statuses appear below.</section>}

    <section className="workspace">
      <div className="forms">
        {isSalesperson && <SaleForm onSubmit={(body) => post("/api/transactions/sales", body)} />}
        {isKevin && <ExpenseForm onSubmit={(body) => post("/api/transactions/expenses", body)} />}
        {isManager && <ManagerPanel pendingSales={pendingSales} pendingExpenses={pendingExpenses} post={post} />}
        {!isSalesperson && !isKevin && !isManager && <p>Select a role to begin.</p>}
      </div>
      <aside className="instructions">
        <h2>How to use this</h2>
        <ol>
          <li>Select a demonstration role.</li>
          <li>Salespeople submit sales; Kevin submits expenses.</li>
          <li>Svetlana reviews pending decisions and can correct a proposed split or expense allocation.</li>
          <li>To test Telegram, send <code>/id</code>, then ask Svetlana to link both returned IDs to the correct fictional employee.</li>
        </ol>
        <p>Website and Telegram use the same server-side rules. Pending sales do not count as income; pending expenses remain visible as awaiting allocation.</p>
        <h3>Working links</h3>
        <p><a href="https://t.me/FriendsIncludedFinanceDarjaBot" target="_blank" rel="noreferrer">Telegram bot</a></p>
        <p><a href="https://docs.google.com/spreadsheets/d/1sbOyytBvZ-rMHUwA7se6UYqd4ieQ5CduzV_NIZpjVmk/edit" target="_blank" rel="noreferrer">Google Sheets ledger</a></p>
        <p><a href="https://github.com/md1406/friends-included-finance" target="_blank" rel="noreferrer">GitHub repository</a></p>
        <h3>Telegram commands</h3>
        <code>/id</code>
        <code>/sale S01 | Customer | A | Description | 1000 | 50 | 30 | 20</code>
        <code>/expense E01 | Description | Materials | 120 | A</code>
      </aside>
    </section>

    <section className="records"><h2>Records</h2><div className="tables"><RecordTable title="Sales" rows={data.sales} columns={["reference", "customer", "project", "amount_cents", "status", "sync_status", "notification_status"]} /><RecordTable title="Expenses" rows={data.expenses} columns={["reference", "description", "category", "amount_cents", "status", "sync_status", "notification_status"]} /></div></section>
  </main>;
}

function SaleForm({ onSubmit }: { onSubmit: (body: Record<string, unknown>) => void }) {
  return <section className="panel"><h2>Record a sale</h2><form onSubmit={(event) => { event.preventDefault(); const f = new FormData(event.currentTarget); onSubmit(Object.fromEntries(f)); event.currentTarget.reset(); }}><label>Reference<input name="reference" placeholder="S01" required /></label><label>Customer<input name="customer" required /></label><label>Project<select name="project"><option>A</option><option>B</option></select></label><label className="full">Description<input name="description" required /></label><label>Amount (€)<input name="amount" type="number" min="0.01" step="0.01" required /></label><fieldset><legend>Proposed commission split</legend><label>Richard %<input name="richardPct" type="number" min="0" max="100" required /></label><label>Anastasia %<input name="anastasiaPct" type="number" min="0" max="100" required /></label><label>Jean-Claude %<input name="jeanClaudePct" type="number" min="0" max="100" required /></label></fieldset><button>Save pending sale</button></form></section>;
}

function ExpenseForm({ onSubmit }: { onSubmit: (body: Record<string, unknown>) => void }) {
  return <section className="panel"><h2>Record an expense</h2><form onSubmit={(event) => { event.preventDefault(); const f = new FormData(event.currentTarget); onSubmit(Object.fromEntries(f)); event.currentTarget.reset(); }}><label>Reference<input name="reference" placeholder="E01" required /></label><label>Category<select name="category"><option>Materials</option><option>Travel</option><option>Other</option></select></label><label className="full">Description<input name="description" required /></label><label>Amount (€)<input name="amount" type="number" min="0.01" step="0.01" required /></label><label>Proposed allocation<select name="proposedAllocation"><option>A</option><option>B</option><option>Company overhead</option></select></label><button>Save expense</button></form></section>;
}

function ManagerPanel({ pendingSales, pendingExpenses, post }: { pendingSales: any[]; pendingExpenses: any[]; post: (path: string, body: Record<string, unknown>) => void }) {
  return <section className="panel manager"><h2>Manager decisions</h2><h3>Pending sales</h3>{pendingSales.length === 0 ? <p className="quiet">Nothing awaiting approval.</p> : pendingSales.map((sale) => <form className="decision" key={sale.reference} onSubmit={(event) => { event.preventDefault(); post("/api/decisions/sale", Object.fromEntries(new FormData(event.currentTarget))); }}><strong>{sale.reference} · {displayMoney(sale.amount_cents)} · Project {sale.project}</strong><span>{sale.customer} — {sale.description}</span><input type="hidden" name="reference" value={sale.reference} /><label>Richard %<input name="richardPct" type="number" defaultValue={sale.proposed_richard_pct} min="0" max="100" /></label><label>Anastasia %<input name="anastasiaPct" type="number" defaultValue={sale.proposed_anastasia_pct} min="0" max="100" /></label><label>Jean-Claude %<input name="jeanClaudePct" type="number" defaultValue={sale.proposed_jean_claude_pct} min="0" max="100" /></label><button>Approve sale</button></form>)}<h3>Expense allocation</h3>{pendingExpenses.length === 0 ? <p className="quiet">Nothing awaiting allocation.</p> : pendingExpenses.map((expense) => <form className="decision" key={expense.reference} onSubmit={(event) => { event.preventDefault(); post("/api/decisions/expense", Object.fromEntries(new FormData(event.currentTarget))); }}><strong>{expense.reference} · {displayMoney(expense.amount_cents)}</strong><span>{expense.description}</span><input type="hidden" name="reference" value={expense.reference} /><label>Final allocation<select name="allocation" defaultValue={expense.proposed_allocation}><option>A</option><option>B</option><option>Company overhead</option></select></label><button>Confirm allocation</button></form>)}<h3>Link Telegram employee</h3><form className="compact-form" onSubmit={(event) => { event.preventDefault(); post("/api/employees/link", Object.fromEntries(new FormData(event.currentTarget))); }}><label>Employee<select name="employeeName">{roles.slice(1).map((name) => <option key={name}>{name}</option>)}</select></label><label>Telegram user ID<input name="telegramUserId" type="number" required /></label><label>Private chat ID<input name="chatId" type="number" required /></label><button>Save link</button></form><h3>Retry a failed integration</h3><form className="compact-form" onSubmit={(event) => { event.preventDefault(); post("/api/retry", Object.fromEntries(new FormData(event.currentTarget))); }}><label>Reference<input name="reference" placeholder="S01 or E01" required /></label><label>Retry<select name="action"><option value="sync">Google Sheets sync</option><option value="notification">Telegram notification</option></select></label><button>Retry</button></form></section>;
}

function RecordTable({ title, rows, columns }: { title: string; rows: any[]; columns: string[] }) {
  return <div className="table-wrap"><h3>{title}</h3><table><thead><tr>{columns.map((column) => <th key={column}>{column.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan={columns.length}>No records yet</td></tr> : rows.map((row) => <tr key={row.reference}>{columns.map((column) => <td key={column}>{column === "amount_cents" ? displayMoney(row[column]) : String(row[column] ?? "—")}</td>)}</tr>)}</tbody></table></div>;
}

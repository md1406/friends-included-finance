import assert from "node:assert/strict";
import { calculateCommissions, calculateDashboard } from "../src/lib/domain.ts";

let passed = 0;
function check(name, run) {
  run();
  passed += 1;
  console.log(`PASS ${name}`);
}

check("commission pool is exactly 10% and all cents are distributed", () => {
  const result = calculateCommissions(10_005, {
    "Richard Darling": 34,
    "Anastasia Ferrari": 33,
    "Jean-Claude Bērziņš": 33,
  });
  assert.equal(result.poolCents, 1_001);
  assert.equal(Object.values(result.amounts).reduce((sum, cents) => sum + cents, 0), 1_001);
  assert.equal(result.amounts["Richard Darling"], 341, "the cent difference goes to the largest share");
});

check("coursework test case 1 produces the expected figures", () => {
  const dashboard = calculateDashboard([
    { status: "Approved", project: "A", amount_cents: 100_000, richard_commission_cents: 5_000, anastasia_commission_cents: 3_000, jean_claude_commission_cents: 2_000 },
    { status: "Approved", project: "B", amount_cents: 200_000, richard_commission_cents: 4_000, anastasia_commission_cents: 8_000, jean_claude_commission_cents: 8_000 },
  ], [
    { status: "Allocated", amount_cents: 20_000, final_allocation: "A" },
    { status: "Allocated", amount_cents: 10_000, final_allocation: "Company overhead" },
  ]);
  assert.deepEqual(dashboard.projects.A, { income: 100_000, commissions: 10_000, expenses: 20_000, result: 70_000 });
  assert.deepEqual(dashboard.projects.B, { income: 200_000, commissions: 20_000, expenses: 0, result: 180_000 });
  assert.equal(dashboard.company.result, 240_000);
  assert.deepEqual(dashboard.commissions, { Richard: 9_000, Anastasia: 11_000, "Jean-Claude": 10_000 });
});

check("coursework test case 2 remains cumulative and deducts expenses once", () => {
  const dashboard = calculateDashboard([
    { status: "Approved", project: "A", amount_cents: 100_000, richard_commission_cents: 5_000, anastasia_commission_cents: 3_000, jean_claude_commission_cents: 2_000 },
    { status: "Approved", project: "B", amount_cents: 200_000, richard_commission_cents: 4_000, anastasia_commission_cents: 8_000, jean_claude_commission_cents: 8_000 },
    { status: "Approved", project: "A", amount_cents: 150_000, richard_commission_cents: 3_000, anastasia_commission_cents: 4_500, jean_claude_commission_cents: 7_500 },
    { status: "Approved", project: "B", amount_cents: 80_000, richard_commission_cents: 2_000, anastasia_commission_cents: 2_000, jean_claude_commission_cents: 4_000 },
  ], [
    { status: "Allocated", amount_cents: 20_000, final_allocation: "A" },
    { status: "Allocated", amount_cents: 34_000, final_allocation: "B" },
    { status: "Allocated", amount_cents: 16_000, final_allocation: "Company overhead" },
    { status: "Awaiting allocation", amount_cents: 14_000, final_allocation: null },
  ]);
  assert.deepEqual(dashboard.projects.A, { income: 250_000, commissions: 25_000, expenses: 20_000, result: 205_000 });
  assert.deepEqual(dashboard.projects.B, { income: 280_000, commissions: 28_000, expenses: 34_000, result: 218_000 });
  assert.deepEqual(dashboard.company, { income: 530_000, commissions: 53_000, overhead: 16_000, awaitingAllocation: 14_000, expenses: 84_000, result: 393_000 });
  assert.deepEqual(dashboard.commissions, { Richard: 14_000, Anastasia: 17_500, "Jean-Claude": 21_500 });
});

console.log(`ALL_DOMAIN_TESTS_PASSED count=${passed}`);

import { z } from "zod";

const reference = z.string().trim().regex(/^[SE][0-9]{2,}$/i, "Reference must look like S01 or E01").transform((value) => value.toUpperCase());
const amount = z.coerce.number().positive("Amount must be greater than zero");
const split = z.coerce.number().min(0).max(100);

export const saleInput = z.object({
  actorName: z.string().trim(),
  reference,
  customer: z.string().trim().min(1),
  project: z.enum(["A", "B"]),
  description: z.string().trim().min(1),
  amount,
  richardPct: split,
  anastasiaPct: split,
  jeanClaudePct: split,
}).superRefine((value, ctx) => {
  if (Math.abs(value.richardPct + value.anastasiaPct + value.jeanClaudePct - 100) > 0.0001) {
    ctx.addIssue({ code: "custom", message: "Commission shares must total exactly 100%", path: ["richardPct"] });
  }
});

export const expenseInput = z.object({
  actorName: z.string().trim(),
  reference,
  description: z.string().trim().min(1),
  category: z.enum(["Materials", "Travel", "Other"]),
  amount,
  proposedAllocation: z.enum(["A", "B", "Company overhead"]),
});

export const saleDecisionInput = z.object({
  actorName: z.string().trim(),
  reference,
  richardPct: split,
  anastasiaPct: split,
  jeanClaudePct: split,
}).superRefine((value, ctx) => {
  if (Math.abs(value.richardPct + value.anastasiaPct + value.jeanClaudePct - 100) > 0.0001) {
    ctx.addIssue({ code: "custom", message: "Commission shares must total exactly 100%", path: ["richardPct"] });
  }
});

export const expenseDecisionInput = z.object({
  actorName: z.string().trim(),
  reference,
  allocation: z.enum(["A", "B", "Company overhead"]),
});

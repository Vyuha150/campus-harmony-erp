/**
 * Department budgets — one source for every screen.
 *
 * WHY THIS EXISTS
 *
 * Two tables held "the budget". `BudgetAllocation` is the Finance Officer's: it
 * has a create and edit flow, a category per line and a budget year.
 * `DepartmentBudget` had no screen that wrote to it at all — only the seed did —
 * yet the Dean's and Vice-Chancellor's finance pages read it. The two disagreed
 * (₹50 lakh on the Finance page, ₹4.2 crore on the Dean's), and nothing the
 * Finance Officer changed ever reached the people overseeing the money.
 *
 * Budgets are Finance's to set, so every screen now reads `BudgetAllocation`,
 * summed per department for the latest budget year. A line is matched to a
 * department by the department's name or code, which is how Finance records it.
 */

import { prisma } from './prisma.js';

export interface DepartmentBudgetView {
  departmentId: string | null;
  department: string;
  budgetYear: string;
  allocated: number;
  spent: number;
  remaining: number;
  categories: { name: string; allocated: number; spent: number }[];
}

/** The budget year to report: the latest one Finance has recorded. */
async function latestBudgetYear(institutionId: string): Promise<string | null> {
  const latest = await prisma.budgetAllocation.findFirst({
    where: { institutionId },
    orderBy: { budgetYear: 'desc' },
    select: { budgetYear: true }
  });
  return latest?.budgetYear ?? null;
}

export async function budgetsByDepartment(institutionId: string, budgetYear?: string): Promise<DepartmentBudgetView[]> {
  const year = budgetYear ?? (await latestBudgetYear(institutionId));
  if (!year) return [];

  const [lines, departments] = await Promise.all([
    prisma.budgetAllocation.findMany({ where: { institutionId, budgetYear: year }, orderBy: { category: 'asc' } }),
    prisma.department.findMany({ where: { institutionId }, select: { id: true, name: true, code: true } })
  ]);

  const byKey = new Map<string, { id: string; name: string }>();
  for (const d of departments) {
    byKey.set(d.name.toLowerCase(), d);
    byKey.set(d.code.toLowerCase(), d);
  }

  const grouped = new Map<string, DepartmentBudgetView>();
  for (const line of lines) {
    const match = byKey.get(line.department.trim().toLowerCase());
    const key = match?.id ?? `unmatched:${line.department}`;
    const view = grouped.get(key) ?? {
      departmentId: match?.id ?? null,
      // An unmatched line keeps the label Finance typed rather than vanishing.
      department: match?.name ?? line.department,
      budgetYear: year,
      allocated: 0,
      spent: 0,
      remaining: 0,
      categories: []
    };
    view.allocated += line.allocatedAmount;
    view.spent += line.spentAmount;
    view.categories.push({ name: line.category, allocated: line.allocatedAmount, spent: line.spentAmount });
    grouped.set(key, view);
  }

  return [...grouped.values()]
    .map((v) => ({ ...v, remaining: v.allocated - v.spent }))
    .sort((a, b) => a.department.localeCompare(b.department));
}

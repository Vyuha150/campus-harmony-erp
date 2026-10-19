/**
 * Library service — T-203b, the reference migration.
 *
 * WHY THIS MODULE
 *
 * `library.ts` was 298 lines and 7 endpoints, and it exhibited every defect
 * class the audit found across the other 478. It is small enough to migrate
 * completely and representative enough that the cost measured here is a real
 * estimate for the rest.
 *
 * WHAT WAS WRONG, AND WHAT REPLACED IT
 *
 *   1. NO TENANT SCOPING. `prisma.libraryBook.count()` counted every
 *      institution's books; `findUnique` by id would return another
 *      institution's copy. LibraryBook is now tenant-owned and the Prisma
 *      extension scopes it automatically.
 *
 *   2. NO TRANSACTION, NO LOCK. Two concurrent issues of the same copy both
 *      read `status: 'available'` and both succeeded — one physical book issued
 *      to two students. Now: `FOR UPDATE` on the copy, plus a partial unique
 *      index allowing only one active loan per copy.
 *
 *   3. NO AUDIT. Nothing recorded who issued, renewed or returned anything.
 *
 *   4. CLIENT-SUPPLIED FINES. See `fines.ts` — the caller decided what the
 *      borrower owed. Now computed from policy.
 *
 *   5. NO PAGINATION. `/books` and `/students` returned entire tables.
 *
 *   6. HISTORY DESTROYED ON RETURN. `studentProfileId` was nulled, erasing who
 *      had borrowed the book. Now a retained LibraryLoan row.
 *
 *   7. NO VALIDATION. `String(req.body.isbn)` accepted anything, including a
 *      client-chosen `maxRenewals`.
 *
 *   8. DEAD METRIC. The dashboard counted `status: 'overdue'`, which nothing
 *      ever set — permanently zero. Overdue is now computed from `dueAt`.
 */

import { basePrisma, lockForUpdate } from '../../lib/prisma.js';
import { mutate, toSkipTake, paginated, type PageRequest, type Paginated } from '../../lib/service.js';

export { resolveOwnStudentProfileId } from '../../lib/service.js';
import { recordInTransaction } from '../../lib/audit.js';
import {
  NotFoundError,
  ValidationError,
  BusinessRuleError,
  ConflictError
} from '../../lib/errors.js';
import type { TenantContext } from '../../lib/tenant.js';
import { round2 } from '../finance/money.js';
import { computeFine, accruedFine, isOverdue, type CirculationPolicy } from './fines.js';

/**
 * The institution's circulation policy.
 *
 * Throws if absent rather than substituting defaults. Migration 0012 creates a
 * row per institution; a missing one means something is wrong, and quietly
 * inventing 14-day loans would be the fabrication pattern removed in phase 0.2.
 */
export async function getPolicy(context: TenantContext): Promise<CirculationPolicy> {
  const policy = await basePrisma.libraryPolicy.findFirst({
    where: { institutionId: context.institutionId }
  });

  if (!policy) {
    throw new NotFoundError(
      'Library circulation policy for this institution. It should have been created by migration 0012 — create one before issuing books rather than relying on defaults'
    );
  }

  return {
    loanPeriodDays: policy.loanPeriodDays,
    maxRenewals: policy.maxRenewals,
    renewalDays: policy.renewalDays,
    finePerDay: policy.finePerDay,
    graceDays: policy.graceDays,
    maxFine: policy.maxFine,
    maxBooksPerStudent: policy.maxBooksPerStudent,
    blockIssueAboveFine: policy.blockIssueAboveFine
  };
}

// ─── Catalogue ───────────────────────────────────────────────────────────────

export interface AddCopyInput {
  accessionNumber: string;
  isbn: string;
  title: string;
  author: string;
  category: string;
  publisher?: string | undefined;
  edition?: string | undefined;
}

export async function addCopy(
  context: TenantContext,
  input: AddCopyInput
): Promise<{ id: string; accessionNumber: string; title: string }> {
  const existing = await basePrisma.libraryBook.findFirst({
    where: { institutionId: context.institutionId, accessionNumber: input.accessionNumber },
    select: { id: true }
  });

  if (existing) {
    throw new ConflictError(
      `Accession number ${input.accessionNumber} is already in use in this library.`,
      { field: 'accessionNumber' }
    );
  }

  return mutate(
    context,
    {
      action: 'CREATE',
      module: 'library',
      resource: (r) => `LibraryBook:${(r as { id: string }).id}`,
      details: `Catalogued "${input.title}" (accession ${input.accessionNumber}, ISBN ${input.isbn})`
    },
    async (tx) => {
      const db = tx as never as typeof basePrisma;
      const created = await db.libraryBook.create({
        data: {
          institutionId: context.institutionId,
          accessionNumber: input.accessionNumber,
          isbn: input.isbn,
          title: input.title,
          author: input.author,
          category: input.category,
          publisher: input.publisher ?? null,
          edition: input.edition ?? null,
          status: 'available'
        }
      });
      return { id: created.id, accessionNumber: created.accessionNumber, title: created.title };
    }
  );
}

export interface BookSearch {
  status?: string | undefined;
  query?: string | undefined;
  category?: string | undefined;
}

export interface BookView {
  id: string;
  accessionNumber: string;
  isbn: string;
  title: string;
  author: string;
  category: string;
  status: string;
  loan: {
    id: string;
    studentName: string;
    rollNumber: string;
    dueAt: Date;
    overdue: boolean;
    accruedFine: number;
  } | null;
}

/**
 * Search the catalogue. PAGINATED — the previous version returned every row.
 */
export async function listBooks(
  context: TenantContext,
  search: BookSearch,
  page: PageRequest
): Promise<Paginated<BookView>> {
  const where: Record<string, unknown> = {};

  if (search.status && search.status !== 'all') {
    where.status = search.status;
  }
  if (search.category) {
    where.category = search.category;
  }
  if (search.query && search.query.trim().length > 0) {
    const q = search.query.trim();
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { author: { contains: q, mode: 'insensitive' } },
      { isbn: { contains: q, mode: 'insensitive' } },
      { accessionNumber: { contains: q, mode: 'insensitive' } }
    ];
  }

  const { skip, take } = toSkipTake(page);

  const [rows, total] = await Promise.all([
    basePrisma.libraryBook.findMany({
      where: { ...where, institutionId: context.institutionId },
      orderBy: [{ title: 'asc' }, { accessionNumber: 'asc' }],
      skip,
      take,
      include: {
        loans: {
          where: { status: 'active' },
          take: 1,
          include: { student: { select: { rollNumber: true, userId: true } } }
        }
      }
    }),
    basePrisma.libraryBook.count({ where: { ...where, institutionId: context.institutionId } })
  ]);

  const policy = await getPolicy(context);

  // Borrower names come from User; fetched in one query rather than per row.
  const userIds = rows.flatMap((b) => b.loans.map((l) => l.student.userId));
  const users = userIds.length
    ? await basePrisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true }
      })
    : [];
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  const data: BookView[] = rows.map((book) => {
    const loan = book.loans[0];
    return {
      id: book.id,
      accessionNumber: book.accessionNumber,
      isbn: book.isbn,
      title: book.title,
      author: book.author,
      category: book.category,
      status: book.status,
      loan: loan
        ? {
            id: loan.id,
            studentName: nameById.get(loan.student.userId) ?? loan.student.rollNumber,
            rollNumber: loan.student.rollNumber,
            dueAt: loan.dueAt,
            // Computed, not stored.
            overdue: isOverdue(loan.dueAt),
            accruedFine: accruedFine(loan.dueAt, policy).fine
          }
        : null
    };
  });

  return paginated(data, total, page);
}

/**
 * Borrower lookup for the circulation desk.
 *
 * Replaces the legacy `GET /library/students`, which returned FULL StudentProfile
 * records — every demographic field, to anyone who could reach the library
 * router. A librarian issuing a book needs a name and a roll number; nothing
 * else on that record is theirs to see.
 *
 * Paginated and searchable, because the previous version returned every student
 * in the institution on every page load.
 */
export async function findBorrowers(
  context: TenantContext,
  query: string | undefined,
  page: PageRequest
): Promise<Paginated<{ id: string; rollNumber: string; name: string; openLoans: number }>> {
  const where: Record<string, unknown> = { institutionId: context.institutionId };

  if (query && query.trim().length > 0) {
    const q = query.trim();
    where.OR = [
      { rollNumber: { contains: q, mode: 'insensitive' } },
      { user: { name: { contains: q, mode: 'insensitive' } } }
    ];
  }

  const { skip, take } = toSkipTake(page);

  const [students, total] = await Promise.all([
    basePrisma.studentProfile.findMany({
      where,
      orderBy: { rollNumber: 'asc' },
      skip,
      take,
      // Deliberately narrow. Widening this select is a privacy decision, not a
      // convenience one.
      select: { id: true, rollNumber: true, user: { select: { name: true } } }
    }),
    basePrisma.studentProfile.count({ where })
  ]);

  // Open-loan counts in one query rather than per student.
  const counts = students.length
    ? await basePrisma.libraryLoan.groupBy({
        by: ['studentProfileId'],
        where: {
          institutionId: context.institutionId,
          status: 'active',
          studentProfileId: { in: students.map((s) => s.id) }
        },
        _count: { _all: true }
      })
    : [];

  const openByStudent = new Map(counts.map((c) => [c.studentProfileId, c._count._all]));

  return paginated(
    students.map((s) => ({
      id: s.id,
      rollNumber: s.rollNumber,
      name: s.user.name,
      // Shown at the desk so a librarian sees the borrowing limit approaching
      // before the issue is refused.
      openLoans: openByStudent.get(s.id) ?? 0
    })),
    total,
    page
  );
}

// ─── Circulation ─────────────────────────────────────────────────────────────

export interface IssueResult {
  loanId: string;
  bookTitle: string;
  accessionNumber: string;
  rollNumber: string;
  dueAt: Date;
  loanPeriodDays: number;
}

/**
 * Issue a copy to a student.
 *
 * The copy row is locked `FOR UPDATE` before its availability is read. Without
 * it, two concurrent requests both observe `available` and both write a loan —
 * one physical book, two borrowers, and no way to tell which is real. The
 * partial unique index on active loans is the second line of defence.
 */
export async function issueBook(
  context: TenantContext,
  bookId: string,
  studentProfileId: string
): Promise<IssueResult> {
  const policy = await getPolicy(context);

  const student = await basePrisma.studentProfile.findFirst({
    where: { id: studentProfileId, institutionId: context.institutionId },
    select: { id: true, rollNumber: true }
  });

  if (!student) {
    throw new NotFoundError(`Student ${studentProfileId}`);
  }

  return basePrisma.$transaction(async (tx) => {
    const db = tx as never as typeof basePrisma;

    const bookWhere = { id: bookId, institutionId: context.institutionId };
    await lockForUpdate(db.libraryBook, bookWhere);
    const book = await db.libraryBook.findFirst({
      where: bookWhere,
      select: { id: true, title: true, accessionNumber: true, status: true }
    });
    if (!book) {
      throw new NotFoundError(`Book ${bookId}`);
    }

    if (book.status !== 'available') {
      throw new BusinessRuleError(
        `"${book.title}" (accession ${book.accessionNumber}) is ${book.status} and cannot be issued.`,
        { bookId, status: book.status }
      );
    }

    // ── Borrower eligibility ────────────────────────────────────────────
    const openLoans = await db.libraryLoan.findMany({
      where: {
        institutionId: context.institutionId,
        studentProfileId: student.id,
        status: 'active'
      },
      select: { id: true, dueAt: true }
    });

    if (openLoans.length >= policy.maxBooksPerStudent) {
      throw new BusinessRuleError(
        `${student.rollNumber} already holds ${openLoans.length} book(s); the limit is ${policy.maxBooksPerStudent}.`,
        { current: openLoans.length, limit: policy.maxBooksPerStudent }
      );
    }

    // Unpaid fines on returned loans, plus what is accruing on open ones.
    const unpaid = await db.libraryLoan.findMany({
      where: {
        institutionId: context.institutionId,
        studentProfileId: student.id,
        finePaid: false,
        fineAmount: { gt: 0 }
      },
      select: { fineAmount: true, fineWaivedAmount: true }
    });

    const outstandingFine = round2(
      unpaid.reduce((total, l) => total + (l.fineAmount - l.fineWaivedAmount), 0) +
        openLoans.reduce((total, l) => total + accruedFine(l.dueAt, policy).fine, 0)
    );

    if (outstandingFine > policy.blockIssueAboveFine) {
      throw new BusinessRuleError(
        `${student.rollNumber} owes Rs.${outstandingFine.toFixed(2)} in library fines, above the Rs.${policy.blockIssueAboveFine.toFixed(2)} limit for further borrowing.`,
        { outstandingFine, limit: policy.blockIssueAboveFine }
      );
    }

    // ── Issue ───────────────────────────────────────────────────────────
    const issuedAt = new Date();
    const dueAt = new Date(issuedAt);
    dueAt.setDate(dueAt.getDate() + policy.loanPeriodDays);

    // The partial unique index on active loans is the SECOND line of defence:
    // it holds even when `book.status` disagrees with reality. That is not
    // hypothetical — a seed that set a copy to 'available' while an active loan
    // existed produced exactly this state, and the index caught it.
    //
    // Translated here because the raw P2002 surfaces as "A record with these
    // details already exists", which tells a librarian nothing.
    let loan;
    try {
      loan = await db.libraryLoan.create({
        data: {
          institutionId: context.institutionId,
          bookId: book.id,
          studentProfileId: student.id,
          issuedAt,
          dueAt,
          status: 'active',
          issuedBy: context.userId
        }
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictError(
          `"${book.title}" (accession ${book.accessionNumber}) already has an open loan, even though the copy is marked ${book.status}. The catalogue and circulation records disagree — this copy needs reconciling before it can be issued.`,
          { bookId: book.id, catalogueStatus: book.status }
        );
      }
      throw error;
    }

    await db.libraryBook.updateMany({
      where: { id: book.id, institutionId: context.institutionId },
      data: { status: 'issued', currentLoanId: loan.id }
    });

    await recordInTransaction(tx as never, {
      userId: context.userId,
      role: context.role,
      action: 'CREATE',
      module: 'library',
      resource: `LibraryLoan:${loan.id}`,
      details: `Issued "${book.title}" (accession ${book.accessionNumber}) to ${student.rollNumber}, due ${dueAt.toISOString().slice(0, 10)}`,
      newValue: { bookId: book.id, studentProfileId: student.id, dueAt }
    });

    return {
      loanId: loan.id,
      bookTitle: book.title,
      accessionNumber: book.accessionNumber,
      rollNumber: student.rollNumber,
      dueAt,
      loanPeriodDays: policy.loanPeriodDays
    };
  });
}

export interface ReturnResult {
  loanId: string;
  bookTitle: string;
  rollNumber: string;
  returnedAt: Date;
  daysOverdue: number;
  fine: number;
  fineExplanation: string;
}

/**
 * Return a copy.
 *
 * The fine is COMPUTED here, from the institution's policy and the actual
 * overdue days. The previous endpoint accepted it from the request body.
 */
export async function returnBook(
  context: TenantContext,
  bookId: string
): Promise<ReturnResult> {
  const policy = await getPolicy(context);

  return basePrisma.$transaction(async (tx) => {
    const db = tx as never as typeof basePrisma;

    const bookWhere = { id: bookId, institutionId: context.institutionId };
    await lockForUpdate(db.libraryBook, bookWhere);
    const book = await db.libraryBook.findFirst({
      where: bookWhere,
      select: { id: true, title: true, accessionNumber: true }
    });
    if (!book) {
      throw new NotFoundError(`Book ${bookId}`);
    }

    const loan = await db.libraryLoan.findFirst({
      where: { bookId: book.id, institutionId: context.institutionId, status: 'active' },
      include: { student: { select: { rollNumber: true } } }
    });

    if (!loan) {
      throw new BusinessRuleError(
        `"${book.title}" (accession ${book.accessionNumber}) is not currently on loan, so it cannot be returned.`,
        { bookId }
      );
    }

    const returnedAt = new Date();
    const fine = computeFine(loan.dueAt, returnedAt, policy);

    await db.libraryLoan.updateMany({
      where: { id: loan.id, institutionId: context.institutionId },
      data: {
        status: 'returned',
        returnedAt,
        fineAmount: fine.fine,
        // A fine of zero is settled by definition; anything else is owed until
        // it is actually collected.
        finePaid: fine.fine === 0,
        returnedTo: context.userId
      }
    });

    await db.libraryBook.updateMany({
      where: { id: book.id, institutionId: context.institutionId },
      data: { status: 'available', currentLoanId: null }
    });

    await recordInTransaction(tx as never, {
      userId: context.userId,
      role: context.role,
      action: 'UPDATE',
      module: 'library',
      resource: `LibraryLoan:${loan.id}`,
      details:
        `Returned "${book.title}" (accession ${book.accessionNumber}) from ${loan.student.rollNumber}. ` +
        fine.explanation,
      oldValue: { status: 'active', dueAt: loan.dueAt },
      newValue: { status: 'returned', returnedAt, fineAmount: fine.fine },
      // A fine makes this reviewable; a clean return does not.
      severity: fine.fine > 0 ? 'warning' : 'info'
    });

    return {
      loanId: loan.id,
      bookTitle: book.title,
      rollNumber: loan.student.rollNumber,
      returnedAt,
      daysOverdue: fine.daysOverdue,
      fine: fine.fine,
      fineExplanation: fine.explanation
    };
  });
}

export interface RenewResult {
  loanId: string;
  bookTitle: string;
  previousDueAt: Date;
  dueAt: Date;
  renewalCount: number;
  maxRenewals: number;
}

/**
 * Extend an active loan. Refused once overdue, or past the renewal limit.
 *
 * `restrictToStudentProfileId` enforces borrower ownership for the student-facing
 * route. It is checked INSIDE the transaction, after the row lock, rather than
 * by the caller beforehand — a check performed before the lock can be raced.
 */
export async function renewLoan(
  context: TenantContext,
  bookId: string,
  options: { restrictToStudentProfileId?: string | undefined } = {}
): Promise<RenewResult> {
  const policy = await getPolicy(context);

  return basePrisma.$transaction(async (tx) => {
    const db = tx as never as typeof basePrisma;

    const bookWhere = { id: bookId, institutionId: context.institutionId };
    await lockForUpdate(db.libraryBook, bookWhere);
    const book = await db.libraryBook.findFirst({
      where: bookWhere,
      select: { id: true, title: true }
    });
    if (!book) {
      throw new NotFoundError(`Book ${bookId}`);
    }

    const loan = await db.libraryLoan.findFirst({
      where: { bookId: book.id, institutionId: context.institutionId, status: 'active' }
    });

    if (!loan) {
      throw new BusinessRuleError(`"${book.title}" is not currently on loan.`, { bookId });
    }

    if (
      options.restrictToStudentProfileId &&
      loan.studentProfileId !== options.restrictToStudentProfileId
    ) {
      // Reported as not-found: confirming the loan exists but belongs to someone
      // else tells the caller who has which book.
      throw new NotFoundError(`Loan for book ${bookId}`);
    }

    if (loan.renewalCount >= policy.maxRenewals) {
      throw new BusinessRuleError(
        `This loan has already been renewed ${loan.renewalCount} time(s); the limit is ${policy.maxRenewals}. The book must be returned.`,
        { renewalCount: loan.renewalCount, maxRenewals: policy.maxRenewals }
      );
    }

    if (isOverdue(loan.dueAt)) {
      // The old code renewed overdue books, which let a borrower extend
      // indefinitely and escape the fine entirely.
      const owed = accruedFine(loan.dueAt, policy);
      throw new BusinessRuleError(
        `This loan is already ${owed.daysOverdue} day(s) overdue and cannot be renewed. Return the book and settle the Rs.${owed.fine.toFixed(2)} fine.`,
        { daysOverdue: owed.daysOverdue, accruedFine: owed.fine }
      );
    }

    const previousDueAt = loan.dueAt;
    const dueAt = new Date(previousDueAt);
    dueAt.setDate(dueAt.getDate() + policy.renewalDays);

    await db.libraryLoan.updateMany({
      where: { id: loan.id, institutionId: context.institutionId },
      data: { dueAt, renewalCount: loan.renewalCount + 1 }
    });

    await recordInTransaction(tx as never, {
      userId: context.userId,
      role: context.role,
      action: 'UPDATE',
      module: 'library',
      resource: `LibraryLoan:${loan.id}`,
      details: `Renewed "${book.title}" — due ${previousDueAt.toISOString().slice(0, 10)} → ${dueAt.toISOString().slice(0, 10)} (renewal ${loan.renewalCount + 1} of ${policy.maxRenewals})`,
      oldValue: { dueAt: previousDueAt, renewalCount: loan.renewalCount },
      newValue: { dueAt, renewalCount: loan.renewalCount + 1 }
    });

    return {
      loanId: loan.id,
      bookTitle: book.title,
      previousDueAt,
      dueAt,
      renewalCount: loan.renewalCount + 1,
      maxRenewals: policy.maxRenewals
    };
  });
}

/**
 * Waive a fine.
 *
 * Separate from return, requires a reason, and is audited at `warning`. The old
 * code achieved the same thing by posting `{"fine": 0}` with nothing recorded.
 */
export async function waiveFine(
  context: TenantContext,
  loanId: string,
  amount: number,
  reason: string
): Promise<{ loanId: string; waived: number; remaining: number }> {
  if (reason.trim().length < 10) {
    throw new ValidationError(
      'Waiving a fine requires a reason of at least 10 characters. A written-off charge with no recorded justification is an audit finding.',
      { field: 'reason' }
    );
  }

  const loan = await basePrisma.libraryLoan.findFirst({
    where: { id: loanId, institutionId: context.institutionId }
  });

  if (!loan) {
    throw new NotFoundError(`Loan ${loanId}`);
  }

  const alreadyOwed = round2(loan.fineAmount - loan.fineWaivedAmount);

  if (amount > alreadyOwed) {
    throw new BusinessRuleError(
      `Cannot waive Rs.${amount.toFixed(2)} — only Rs.${alreadyOwed.toFixed(2)} is outstanding on this loan.`,
      { requested: amount, outstanding: alreadyOwed }
    );
  }

  return mutate(
    context,
    {
      action: 'UPDATE',
      module: 'library',
      resource: `LibraryLoan:${loan.id}`,
      details: `Waived Rs.${amount.toFixed(2)} of a Rs.${loan.fineAmount.toFixed(2)} library fine`,
      reason,
      oldValue: { fineWaivedAmount: loan.fineWaivedAmount },
      newValue: { fineWaivedAmount: round2(loan.fineWaivedAmount + amount) },
      severity: 'warning'
    },
    async (tx) => {
      const db = tx as never as typeof basePrisma;
      const waived = round2(loan.fineWaivedAmount + amount);
      const remaining = round2(loan.fineAmount - waived);

      await db.libraryLoan.updateMany({
        where: { id: loan.id, institutionId: context.institutionId },
        data: {
          fineWaivedAmount: waived,
          fineWaiverReason: reason,
          finePaid: remaining <= 0
        }
      });

      return { loanId: loan.id, waived, remaining };
    }
  );
}

// ─── Reporting ───────────────────────────────────────────────────────────────

/**
 * Dashboard counts.
 *
 * `overdueBooks` is derived from `dueAt < now` on active loans. The previous
 * version counted `status = 'overdue'`, which nothing ever assigned — the
 * figure was permanently zero and looked like a working metric.
 *
 * `outstandingFines` is likewise real: the old `collectedFines` summed the fine
 * column on books that had NOT been returned, so it reported uncollected money
 * under a name claiming the opposite.
 */
export async function dashboard(context: TenantContext): Promise<{
  totalCopies: number;
  availableCopies: number;
  issuedCopies: number;
  overdueLoans: number;
  outstandingFines: number;
  activeBorrowers: number;
}> {
  const policy = await getPolicy(context);
  const scope = { institutionId: context.institutionId };

  const [totalCopies, availableCopies, issuedCopies, activeLoans, unpaid] = await Promise.all([
    basePrisma.libraryBook.count({ where: scope }),
    basePrisma.libraryBook.count({ where: { ...scope, status: 'available' } }),
    basePrisma.libraryBook.count({ where: { ...scope, status: 'issued' } }),
    basePrisma.libraryLoan.findMany({
      where: { ...scope, status: 'active' },
      select: { dueAt: true, studentProfileId: true }
    }),
    basePrisma.libraryLoan.findMany({
      where: { ...scope, finePaid: false, fineAmount: { gt: 0 } },
      select: { fineAmount: true, fineWaivedAmount: true }
    })
  ]);

  const overdueLoans = activeLoans.filter((l) => isOverdue(l.dueAt)).length;

  const outstandingFines = round2(
    unpaid.reduce((total, l) => total + (l.fineAmount - l.fineWaivedAmount), 0) +
      activeLoans.reduce((total, l) => total + accruedFine(l.dueAt, policy).fine, 0)
  );

  return {
    totalCopies,
    availableCopies,
    issuedCopies,
    overdueLoans,
    outstandingFines,
    activeBorrowers: new Set(activeLoans.map((l) => l.studentProfileId)).size
  };
}

/** A student's borrowing history. */
export async function studentHistory(
  context: TenantContext,
  studentProfileId: string,
  page: PageRequest
): Promise<Paginated<{
  loanId: string;
  bookId: string;
  title: string;
  author: string | null;
  category: string | null;
  accessionNumber: string;
  renewalCount: number;
  maxRenewals: number;
  issuedAt: Date;
  dueAt: Date;
  returnedAt: Date | null;
  status: string;
  overdue: boolean;
  fine: number;
  finePaid: boolean;
}>> {
  const student = await basePrisma.studentProfile.findFirst({
    where: { id: studentProfileId, institutionId: context.institutionId },
    select: { id: true }
  });

  if (!student) {
    throw new NotFoundError(`Student ${studentProfileId}`);
  }

  const policy = await getPolicy(context);
  const { skip, take } = toSkipTake(page);
  const where = { institutionId: context.institutionId, studentProfileId: student.id };

  const [loans, total] = await Promise.all([
    basePrisma.libraryLoan.findMany({
      where,
      orderBy: { issuedAt: 'desc' },
      skip,
      take,
      include: { book: { select: { title: true, accessionNumber: true, author: true, category: true } } }
    }),
    basePrisma.libraryLoan.count({ where })
  ]);

  return paginated(
    loans.map((loan) => ({
      loanId: loan.id,
      // Renewal is by book (one active loan per copy); the student page renewed
      // by an id it never received.
      bookId: loan.bookId,
      title: loan.book.title,
      author: (loan.book as { author?: string | null }).author ?? null,
      category: (loan.book as { category?: string | null }).category ?? null,
      accessionNumber: loan.book.accessionNumber,
      renewalCount: loan.renewalCount,
      maxRenewals: policy.maxRenewals,
      issuedAt: loan.issuedAt,
      dueAt: loan.dueAt,
      returnedAt: loan.returnedAt,
      status: loan.status,
      overdue: loan.status === 'active' && isOverdue(loan.dueAt),
      // For an open loan the fine is what has accrued so far, not the stored
      // zero — that is the number the borrower actually owes today.
      fine:
        loan.status === 'active'
          ? accruedFine(loan.dueAt, policy).fine
          : round2(loan.fineAmount - loan.fineWaivedAmount),
      finePaid: loan.finePaid
    })),
    total,
    page
  );
}

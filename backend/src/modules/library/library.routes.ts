/**
 * Library routes (T-203b).
 *
 * Thin HTTP layer: parse, validate, call the service, format. No Prisma, no
 * business logic — contrast with the 298-line `routes/library.ts` this replaces,
 * where all of it lived inline.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authorizeRoles } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { entityId } from '../../schemas/common.js';
import { getTenantContext } from '../../lib/tenant.js';
import * as service from './library.service.js';

const router = Router();

function pathParam(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0]! : (value as string);
}

/** Who may catalogue and circulate. */
const LIBRARY_STAFF = authorizeRoles('librarian', 'super_admin', 'registrar');

/**
 * Pagination. Capped at 100 — the previous endpoints returned entire tables,
 * which at institutional scale is a memory-exhaustion path.
 */
const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

router.get(
  '/dashboard',
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ success: true, data: await service.dashboard(getTenantContext(req)) });
  })
);

router.get(
  '/books',
  validate({
    query: pageQuery.extend({
      status: z.enum(['all', 'available', 'issued', 'lost', 'damaged', 'withdrawn']).optional(),
      category: z.string().trim().max(60).optional(),
      query: z.string().trim().max(120).optional()
    })
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as {
      page: number;
      pageSize: number;
      status?: string;
      category?: string;
      query?: string;
    };

    const result = await service.listBooks(
      getTenantContext(req),
      { status: q.status, category: q.category, query: q.query },
      { page: q.page, pageSize: q.pageSize }
    );

    res.json({ success: true, ...result });
  })
);

/**
 * Borrower lookup for the issue dialog.
 *
 * Returns only id, roll number, name and open-loan count — the legacy endpoint
 * this replaces returned complete student profiles.
 */
router.get(
  '/students',
  LIBRARY_STAFF,
  validate({ query: pageQuery.extend({ query: z.string().trim().max(80).optional() }) }),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as { page: number; pageSize: number; query?: string };
    const result = await service.findBorrowers(getTenantContext(req), q.query, {
      page: q.page,
      pageSize: q.pageSize
    });
    res.json({ success: true, ...result });
  })
);

const addCopySchema = z
  .object({
    accessionNumber: z.string().trim().min(1).max(40),
    isbn: z
      .string()
      .trim()
      // Hyphens and spaces are how ISBNs are printed; digits and a trailing X
      // are what they contain.
      .regex(/^[0-9Xx\- ]{10,20}$/, 'ISBN must be 10-20 characters of digits, X, hyphens or spaces'),
    title: z.string().trim().min(1).max(300),
    author: z.string().trim().min(1).max(200),
    category: z.string().trim().min(1).max(60),
    publisher: z.string().trim().max(200).optional(),
    edition: z.string().trim().max(60).optional()
  })
  // `.strict()` is the mass-assignment defence. The previous handler read
  // `maxRenewals` straight from the body, letting a caller catalogue a book
  // with an arbitrary renewal allowance.
  .strict();

router.post(
  '/books',
  LIBRARY_STAFF,
  validate({ body: addCopySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as z.infer<typeof addCopySchema>;
    const created = await service.addCopy(getTenantContext(req), {
      accessionNumber: body.accessionNumber,
      isbn: body.isbn,
      title: body.title,
      author: body.author,
      category: body.category,
      publisher: body.publisher,
      edition: body.edition
    });

    res.status(201).json({
      success: true,
      message: `Catalogued "${created.title}" as accession ${created.accessionNumber}.`,
      data: created
    });
  })
);

router.post(
  '/books/:id/issue',
  LIBRARY_STAFF,
  validate({
    params: z.object({ id: entityId }),
    body: z.object({ studentProfileId: entityId }).strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await service.issueBook(
      getTenantContext(req),
      pathParam(req, 'id'),
      (req.body as { studentProfileId: string }).studentProfileId
    );

    res.status(201).json({
      success: true,
      message: `Issued "${result.bookTitle}" to ${result.rollNumber}, due ${result.dueAt.toISOString().slice(0, 10)} (${result.loanPeriodDays}-day loan).`,
      data: result
    });
  })
);

router.post(
  '/books/:id/renew',
  LIBRARY_STAFF,
  validate({ params: z.object({ id: entityId }) }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await service.renewLoan(getTenantContext(req), pathParam(req, 'id'));
    res.json({
      success: true,
      message: `Renewed to ${result.dueAt.toISOString().slice(0, 10)} (renewal ${result.renewalCount} of ${result.maxRenewals}).`,
      data: result
    });
  })
);

router.post(
  '/books/:id/return',
  LIBRARY_STAFF,
  // No body schema beyond emptiness: the fine is COMPUTED, never supplied.
  // The previous endpoint read it from `req.body.fine`.
  validate({ params: z.object({ id: entityId }), body: z.object({}).strict() }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await service.returnBook(getTenantContext(req), pathParam(req, 'id'));
    res.json({
      success: true,
      message: `Returned "${result.bookTitle}" from ${result.rollNumber}. ${result.fineExplanation}`,
      data: result
    });
  })
);

router.post(
  '/loans/:loanId/waive-fine',
  LIBRARY_STAFF,
  validate({
    params: z.object({ loanId: entityId }),
    body: z
      .object({
        amount: z.number().positive().max(100000),
        reason: z.string().trim().min(10).max(500)
      })
      .strict()
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as { amount: number; reason: string };
    const result = await service.waiveFine(
      getTenantContext(req),
      pathParam(req, 'loanId'),
      body.amount,
      body.reason
    );

    res.json({
      success: true,
      message: `Waived Rs.${result.waived.toFixed(2)}; Rs.${result.remaining.toFixed(2)} remains.`,
      data: result
    });
  })
);

router.get(
  '/students/:studentProfileId/history',
  validate({ params: z.object({ studentProfileId: entityId }), query: pageQuery }),
  asyncHandler(async (req: Request, res: Response) => {
    const ctx = getTenantContext(req);
    const studentProfileId = pathParam(req, 'studentProfileId');
    const q = req.query as unknown as { page: number; pageSize: number };

    // Object-level authorisation: a student sees only their own history.
    // The previous module had none — any authenticated caller could read every
    // student record via `/students`, which returned full profiles unfiltered.
    if (ctx.role === 'student') {
      const own = await service.resolveOwnStudentProfileId(ctx);
      if (own !== studentProfileId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'AUTHORIZATION_ERROR',
            message: 'You may only view your own borrowing history.'
          }
        });
        return;
      }
    }

    const result = await service.studentHistory(ctx, studentProfileId, {
      page: q.page,
      pageSize: q.pageSize
    });

    res.json({ success: true, ...result });
  })
);

export default router;

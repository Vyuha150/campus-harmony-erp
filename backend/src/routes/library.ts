import type { Request, Response } from 'express';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/dashboard', authenticate, async (_req: Request, res: Response) => {
  try {
    const [totalBooks, availableBooks, issuedBooks, overdueBooks, collectedFines] = await Promise.all([
      prisma.libraryBook.count(),
      prisma.libraryBook.count({ where: { status: 'available' } }),
      prisma.libraryBook.count({ where: { status: 'issued' } }),
      prisma.libraryBook.count({ where: { status: 'overdue' } }),
      prisma.libraryBook.aggregate({
        where: { status: { in: ['issued', 'overdue'] } },
        _sum: { fine: true }
      })
    ]);

    res.json({
      success: true,
      data: {
        totalBooks,
        availableBooks,
        issuedBooks,
        overdueBooks,
        collectedFines: Number(collectedFines._sum.fine || 0)
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/books', authenticate, async (req: Request, res: Response) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    if (query.length > 0) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { author: { contains: query, mode: 'insensitive' } },
        { isbn: { contains: query, mode: 'insensitive' } },
        { category: { contains: query, mode: 'insensitive' } }
      ];
    }

    const books = await prisma.libraryBook.findMany({
      where,
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: [{ status: 'asc' }, { title: 'asc' }]
    });

    const normalized = books.map((book) => ({
      ...book,
      studentName: book.student?.user?.name || null,
      studentEmail: book.student?.user?.email || null,
      studentRollNumber: book.student?.rollNumber || null
    }));

    res.json({ success: true, data: normalized });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/students', authenticate, async (_req: Request, res: Response) => {
  try {
    const students = await prisma.studentProfile.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { rollNumber: 'asc' }
    });

    res.json({ success: true, data: students });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/books', authenticate, async (req: Request, res: Response) => {
  try {
    const { isbn, title, author, category, maxRenewals } = req.body || {};

    if (!isbn || !title || !author || !category) {
      return res.status(400).json({ success: false, message: 'isbn, title, author, and category are required' });
    }

    const created = await prisma.libraryBook.create({
      data: {
        isbn: String(isbn).trim(),
        title: String(title).trim(),
        author: String(author).trim(),
        category: String(category).trim(),
        maxRenewals: Number.isFinite(Number(maxRenewals)) ? Number(maxRenewals) : 2,
        status: 'available',
        fine: 0,
        renewalCount: 0
      }
    });

    res.json({ success: true, data: created });
  } catch (error: any) {
    if (String(error?.code) === 'P2002') {
      return res.status(409).json({ success: false, message: 'A book with this ISBN already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/books/:id/issue', authenticate, async (req: Request, res: Response) => {
  try {
    const bookId = String(req.params.id);
    const { studentProfileId, dueDate } = req.body || {};

    if (!studentProfileId) {
      return res.status(400).json({ success: false, message: 'studentProfileId is required' });
    }

    const [book, student] = await Promise.all([
      prisma.libraryBook.findUnique({ where: { id: bookId } }),
      prisma.studentProfile.findUnique({ where: { id: String(studentProfileId) } })
    ]);

    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    if (book.status !== 'available' && book.status !== 'returned') {
      return res.status(400).json({ success: false, message: 'Only available books can be issued' });
    }

    const issueDate = new Date();
    const parsedDueDate = dueDate ? new Date(dueDate) : null;
    const finalDueDate = parsedDueDate && !Number.isNaN(parsedDueDate.getTime())
      ? parsedDueDate
      : new Date(issueDate.getTime() + 14 * 24 * 60 * 60 * 1000);

    const updated = await prisma.libraryBook.update({
      where: { id: bookId },
      data: {
        studentProfileId: student.id,
        issuedDate: issueDate,
        dueDate: finalDueDate,
        returnedDate: null,
        status: 'issued',
        fine: 0,
        renewalCount: 0
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    res.json({
      success: true,
      data: {
        ...updated,
        studentName: updated.student?.user?.name || null,
        studentEmail: updated.student?.user?.email || null,
        studentRollNumber: updated.student?.rollNumber || null
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/books/:id/renew', authenticate, async (req: Request, res: Response) => {
  try {
    const bookId = String(req.params.id);
    const book = await prisma.libraryBook.findUnique({ where: { id: bookId } });

    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }
    if (book.status !== 'issued' && book.status !== 'overdue') {
      return res.status(400).json({ success: false, message: 'Only issued or overdue books can be renewed' });
    }
    if (!book.studentProfileId) {
      return res.status(400).json({ success: false, message: 'Cannot renew a book that is not issued' });
    }
    if ((book.renewalCount ?? 0) >= (book.maxRenewals ?? 0)) {
      return res.status(400).json({ success: false, message: 'Renewal limit reached' });
    }

    const dueBase = book.dueDate ?? new Date();
    const nextDueDate = new Date(dueBase);
    nextDueDate.setDate(nextDueDate.getDate() + 14);

    const updated = await prisma.libraryBook.update({
      where: { id: book.id },
      data: {
        dueDate: nextDueDate,
        renewalCount: (book.renewalCount ?? 0) + 1,
        status: 'issued'
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    res.json({
      success: true,
      data: {
        ...updated,
        studentName: updated.student?.user?.name || null,
        studentEmail: updated.student?.user?.email || null,
        studentRollNumber: updated.student?.rollNumber || null
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/books/:id/return', authenticate, async (req: Request, res: Response) => {
  try {
    const bookId = String(req.params.id);
    const rawFine = req.body?.fine;
    const fine = Number.isFinite(Number(rawFine)) ? Math.max(0, Number(rawFine)) : 0;

    const book = await prisma.libraryBook.findUnique({ where: { id: bookId } });

    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }
    if (book.status !== 'issued' && book.status !== 'overdue') {
      return res.status(400).json({ success: false, message: 'Only issued or overdue books can be returned' });
    }

    const updated = await prisma.libraryBook.update({
      where: { id: book.id },
      data: {
        status: 'returned',
        returnedDate: new Date(),
        fine,
        studentProfileId: null,
        issuedDate: null,
        dueDate: null,
        renewalCount: 0
      }
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
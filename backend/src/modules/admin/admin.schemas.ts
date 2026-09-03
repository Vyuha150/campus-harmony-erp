import { z } from 'zod';
import { personName, email, entityId } from '../../schemas/common.js';

const semesters = z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional();

/**
 * POST /admin/users.
 *
 * `password` has no length/strength check here — `hashPassword()` already
 * runs the real policy (`validatePassword`) and throws a clean
 * ValidationError of its own. Duplicating a guessed policy in zod risks the
 * two silently diverging; this schema only confirms a password was sent.
 * `role`'s validity is likewise left to `adminService.assertKnownRole`,
 * which already produces the same error shape.
 */
export const adminUserCreateSchema = z
  .object({
    name: personName,
    email,
    password: z.string().min(1, 'Password is required.'),
    role: z.string().trim().min(1).max(60),
    departmentId: entityId.optional(),
    designation: z.string().trim().max(160).optional(),
    // Only read when the creator is institution-scoped; a campus-scoped
    // creator's own campusId is used instead regardless of this value.
    campusId: entityId.optional()
  })
  .strict();

/**
 * PUT /admin/users/:id.
 *
 * The handler already whitelists which fields reach Prisma and defers role-
 * change legality to `adminService.assertRoleChangeAllowed` (which also
 * refuses to leave an institution without an administrator) — this schema
 * adds the missing piece: an unrecognised field is refused instead of
 * silently dropped, and each accepted field gets a real shape.
 */
export const adminUserUpdateSchema = z
  .object({
    name: personName.optional(),
    email: email.optional(),
    role: z.string().trim().min(1).max(60).optional(),
    departmentId: entityId.optional(),
    designation: z.string().trim().max(160).optional(),
    // Deprecated free-text predecessor to campusId, still writable here for
    // rows mid-backfill — see the field comment on User.campus.
    campus: z.string().trim().max(160).optional(),
    avatar: z.string().trim().max(2000).optional(),
    password: z.string().min(1).optional()
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update.' });

/**
 * PUT /admin/academic-years/:id.
 *
 * `status` and `semesters[].status` both take the real three-value set the
 * frontend's own selects offer (`AdminSystemConfig.tsx`) — not invented.
 * `semesters` stays loosely typed, matching `academicYearCreateSchema`'s own
 * convention: it's stored as-is in a Json column, and deeply validating a
 * nested UI structure the frontend already owns is where the coupling would
 * start.
 */
export const academicYearUpdateSchema = z
  .object({
    year: z.string().trim().min(1).max(20).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    status: z.enum(['upcoming', 'active', 'completed']).optional(),
    isCurrent: z.boolean().optional(),
    semesters
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update.' });

/**
 * POST /admin/courses.
 *
 * `departmentId` and `facultyId` are unverified in the handler beyond this —
 * see the department/faculty ownership check added alongside this schema in
 * the route itself, which zod cannot express (it needs a database lookup).
 */
export const adminCourseCreateSchema = z
  .object({
    code: z.string().trim().min(1).max(20),
    name: z.string().trim().min(1).max(200),
    credits: z.coerce.number().int().min(0).max(20),
    semester: z.coerce.number().int().min(1).max(12),
    departmentId: entityId,
    facultyId: entityId.optional()
  })
  .strict();

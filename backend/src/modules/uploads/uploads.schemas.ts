import { z } from 'zod';

/**
 * POST /uploads.
 *
 * multer parses this from `multipart/form-data`, so every non-file field
 * arrives as a string (or is absent) — there is no JSON body to validate
 * against Prisma's real column types yet. `isConfidential` accepts a literal
 * boolean too, matching the handler's existing `=== 'true' || === true` check,
 * so a caller that already sends JSON-typed booleans keeps working.
 *
 * `allowedRoles`, when sent, must already be a JSON-encoded array — the
 * handler re-parses it itself rather than trusting a schema-side transform,
 * so this only turns malformed JSON into a clean 400 instead of an uncaught
 * `JSON.parse` throw.
 */
export const uploadMetadataSchema = z
  .object({
    module: z.string().trim().min(1).max(60).optional(),
    visibility: z.enum(['private', 'role_restricted', 'institution']).optional(),
    isConfidential: z.union([z.enum(['true', 'false']), z.boolean()]).optional(),
    ownerUserId: z.string().trim().min(1).max(64).optional(),
    allowedRoles: z
      .string()
      .refine(
        (value) => {
          try {
            return Array.isArray(JSON.parse(value));
          } catch {
            return false;
          }
        },
        { message: 'allowedRoles must be a JSON-encoded array.' }
      )
      .optional(),
    relatedEntityType: z.string().trim().min(1).max(64).optional(),
    relatedEntityId: z.string().trim().min(1).max(64).optional()
  })
  .strict();

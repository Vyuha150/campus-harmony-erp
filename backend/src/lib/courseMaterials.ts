/**
 * Course materials: files uploaded against a course.
 *
 * Stored by the uploads module (`FileMetadata`) with
 * `relatedEntityType: 'Course'` and `relatedEntityId` set to the course, and
 * readable by the roles the uploader allowed. Faculty list them for their own
 * courses; students for the courses they are enrolled in.
 */

import { prisma } from './prisma.js';

export const COURSE_MATERIAL_MODULE = 'course-materials';

export async function listCourseMaterials(institutionId: string, courseId: string) {
  const files = await prisma.fileMetadata.findMany({
    where: { institutionId, relatedEntityType: 'Course', relatedEntityId: courseId, module: COURSE_MATERIAL_MODULE },
    orderBy: { createdAt: 'desc' },
    select: { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true, uploadedBy: true }
  });
  return files.map((f) => ({
    id: f.id,
    name: f.originalName,
    type: f.mimeType,
    sizeBytes: f.sizeBytes,
    uploadedAt: f.createdAt,
    uploadedBy: f.uploadedBy,
    url: `/api/uploads/${f.id}`
  }));
}

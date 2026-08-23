-- ═══════════════════════════════════════════════════════════════════════════
-- 0019 — Foreign keys for the remaining references (Phase 1.2b)
--
-- 0018 constrained the 44 `institutionId` columns. This covers the other 52
-- references: StudentProfile (16), User (12), Campus (7), Department (6),
-- Course (2), Section (2), and one each to Batch, Programme, SchemeCourse,
-- ExamSession, FeeRecord, SportsTeam.
--
-- SURVEYED FIRST — orphan check across all 52 columns returned ZERO. Constraints
-- are being added to data already known to satisfy them, not hoped to.
--
-- ── ON DELETE, and why it differs per column ──────────────────────────────
--
--   Required (NOT NULL) -> RESTRICT
--     A grade with no student, or a payment allocation with no fee record, is
--     not a meaningful row. Deleting the target must fail rather than leave one.
--
--   Optional (NULLABLE) -> SET NULL
--     `Section.classAdvisorUserId` or `Department.hodUserId` are assignments.
--     A departing member of staff should clear the assignment, not block their
--     deletion or destroy the department.
--
-- ── ONE RESOLVED BY EVIDENCE, NOT BY NAME ─────────────────────────────────
--
--   FeedbackResponse.studentId -> "User", NOT "StudentProfile"
--
-- Every other `studentId` in this schema means StudentProfile. This one does
-- not: feedback is anonymised, and it stores a User id. Confirmed by testing the
-- actual values against both candidates before writing this. Matching on the
-- column NAME would have pointed it at the wrong table, and the constraint would
-- have rejected valid feedback forever after.
--
-- ── NOT CONSTRAINED, deliberately ─────────────────────────────────────────
--
--   ClassMessage.facultyId, Committee.facultyId, MenteeAssignment.facultyId,
--   CounselingNote.menteeAssignId, RevaluationRequest.courseResultId,
--   InstitutionalPolicy.supersedesPolicyId
--
-- All have zero rows, so their target could not be confirmed empirically and the
-- name alone is ambiguous (`facultyId` -> FacultyProfile or User?). A wrong
-- guess here is worse than no constraint: it silently rejects valid inserts
-- later. Left for whoever knows the intent.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  -- child table, column, target table, on-delete action
  refs TEXT[][] := ARRAY[
    ['StudentProfile','batchId','Batch','SET NULL'],
    ['AdmissionCycle','campusId','Campus','SET NULL'],
    ['ExamSession','campusId','Campus','SET NULL'],
    ['FacultyProfile','campusId','Campus','SET NULL'],
    ['FileMetadata','campusId','Campus','SET NULL'],
    ['GovernanceCommittee','campusId','Campus','SET NULL'],
    ['InstitutionalPolicy','campusId','Campus','SET NULL'],
    ['StudentProfile','campusId','Campus','SET NULL'],
    ['ClassMessage','courseId','Course','RESTRICT'],
    ['CourseResult','courseId','Course','RESTRICT'],
    ['AccreditationData','departmentId','Department','RESTRICT'],
    ['CurriculumProposal','departmentId','Department','RESTRICT'],
    ['DisciplinaryCase','departmentId','Department','RESTRICT'],
    ['LabInventoryItem','departmentId','Department','RESTRICT'],
    ['PurchaseRequest','departmentId','Department','RESTRICT'],
    ['TimetableSlot','departmentId','Department','RESTRICT'],
    ['HallTicket','sessionId','ExamSession','RESTRICT'],
    ['PaymentAllocation','feeRecordId','FeeRecord','RESTRICT'],
    ['StudentProfile','programmeId','Programme','SET NULL'],
    ['Assessment','schemeCourseId','SchemeCourse','RESTRICT'],
    ['Assessment','sectionId','Section','SET NULL'],
    ['StudentProfile','sectionId','Section','SET NULL'],
    ['SportsAttendance','teamId','SportsTeam','RESTRICT'],
    ['AdmissionApplication','studentProfileId','StudentProfile','SET NULL'],
    ['AntiRaggingAffidavit','studentId','StudentProfile','RESTRICT'],
    ['CourseResult','studentProfileId','StudentProfile','RESTRICT'],
    ['ExamRegistration','studentProfileId','StudentProfile','RESTRICT'],
    ['FitnessRecord','studentId','StudentProfile','RESTRICT'],
    ['HallTicket','studentProfileId','StudentProfile','RESTRICT'],
    ['HostelAccessLog','studentId','StudentProfile','RESTRICT'],
    ['JobOffer','studentId','StudentProfile','RESTRICT'],
    ['MenteeAssignment','studentId','StudentProfile','RESTRICT'],
    ['Payment','studentProfileId','StudentProfile','RESTRICT'],
    ['RecordChangeRequest','studentId','StudentProfile','RESTRICT'],
    ['RevaluationRequest','studentProfileId','StudentProfile','RESTRICT'],
    ['SemesterResult','studentProfileId','StudentProfile','RESTRICT'],
    ['SportsAthlete','studentId','StudentProfile','RESTRICT'],
    ['TransferRequest','studentId','StudentProfile','RESTRICT'],
    ['VerificationRequest','studentId','StudentProfile','RESTRICT'],
    ['FeedbackResponse','studentId','User','RESTRICT'],
    ['CommitteeMember','userId','User','SET NULL'],
    ['Department','hodUserId','User','SET NULL'],
    ['ExamSchedule','paperSetterId','User','SET NULL'],
    ['ExamSchedule','evaluatorId','User','SET NULL'],
    ['FileMetadata','ownerUserId','User','SET NULL'],
    ['GrievanceCase','complainantId','User','SET NULL'],
    ['IDCardRequest','applicantId','User','RESTRICT'],
    ['NotificationDelivery','userId','User','SET NULL'],
    ['PatrolLog','officerId','User','RESTRICT'],
    ['School','deanUserId','User','SET NULL'],
    ['Section','classAdvisorUserId','User','SET NULL'],
    ['SystemAuditLog','userId','User','RESTRICT']
  ];
  r TEXT[]; cname TEXT; orphans BIGINT;
  added INTEGER := 0; skipped INTEGER := 0; problems TEXT := '';
BEGIN
  -- Pass 1: confirm every column is still clean. Adding a constraint over
  -- orphans fails after a full scan and names only one table; this reports all.
  FOREACH r SLICE 1 IN ARRAY refs LOOP
    EXECUTE format(
      'SELECT COUNT(*) FROM %I s WHERE s.%I IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM %I t WHERE t.id = s.%I)',
      r[1], r[2], r[3], r[2]
    ) INTO orphans;

    IF orphans > 0 THEN
      problems := problems || format('  %s.%s -> %s: %s row(s)%s', r[1], r[2], r[3], orphans, chr(10));
    END IF;
  END LOOP;

  IF problems <> '' THEN
    RAISE EXCEPTION
      E'Orphaned references found; no constraints were added:\n%\nResolve these rows first. They are NOT reassigned automatically — attaching a record to the wrong parent is worse than leaving it dangling.',
      problems;
  END IF;

  -- Pass 2: add the constraints.
  FOREACH r SLICE 1 IN ARRAY refs LOOP
    cname := format('%s_%s_fkey', r[1], r[2]);

    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public' AND table_name = r[1]
        AND constraint_name = cname AND constraint_type = 'FOREIGN KEY'
    ) THEN
      skipped := skipped + 1;
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I)
         REFERENCES %I(id) ON DELETE %s ON UPDATE CASCADE',
      r[1], cname, r[2], r[3], r[4]
    );
    added := added + 1;
  END LOOP;

  RAISE NOTICE 'Remaining foreign keys: % added, % already present.', added, skipped;
END $$;

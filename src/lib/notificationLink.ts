/**
 * Where clicking a notification takes the user — the page where they act on it
 * or read the outcome. Every in-app notification carries eventType plus the
 * record it is about (relatedEntityType / relatedEntityId).
 */
export interface NotificationTarget {
  eventType?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}

/** The requester's own page for a record, by type and role. */
function ownPage(entityType: string, role: string): string | null {
  switch (entityType) {
    case 'LeaveRequest':
      return role === 'student' ? null : '/faculty/profile?tab=leave';
    case 'FeeWaiverRequest':
      return '/student/fees?tab=waivers';
    case 'CertificateRequest':
      return role === 'student' ? '/student/profile?tab=certificates' : '/registrar/certificates';
    case 'RecordChangeRequest':
      return role === 'student' ? '/student/profile?tab=corrections' : '/registrar/student-records?tab=changes';
    case 'TimetableChange':
      return '/hod/workload?tab=changes';
    case 'PromotionRequest':
      return role === 'registrar' ? '/registrar/hr' : null;
    case 'AccreditationData':
    case 'AccreditationChecklist':
      return role === 'hod' ? '/hod/accreditation' : role === 'dean' ? '/dean/accreditation' : role === 'iqac_coordinator' ? '/iqac/criteria' : '/registrar/accreditation';
    case 'TransferRequest':
      return role === 'registrar' ? '/registrar/transfers' : null;
    case 'Course':
      return role === 'student' ? '/student/courses' : role === 'faculty' ? '/faculty/courses' : role === 'hod' ? '/hod/workload' : null;
    case 'ExamSchedule':
      return role === 'faculty' ? '/faculty/marks?tab=exam' : role === 'hod' ? '/hod/results' : role === 'coe' ? '/coe/results?tab=moderation' : null;
    case 'CourseResult':
      return role === 'student' ? '/student/examinations?tab=results' : null;
    case 'RevaluationRequest':
      return role === 'student' ? '/student/examinations?tab=revaluation' : '/coe/results?tab=revaluations';
    case 'Department':
      return role === 'admin' || role === 'super_admin' ? '/admin/config' : '/dashboard';
    case 'GrievanceCase':
      return role === 'student' ? '/student/grievances' : role === 'faculty' ? '/faculty/grievances' : role === 'grievance_officer' ? '/grievance/dashboard' : null;
    case 'ClassMessage':
      return role === 'student' ? '/student/communication' : null;
    case 'Publication':
    case 'ResearchProject':
    case 'Patent':
      return role === 'faculty' ? '/faculty/research' : null;
    case 'Assignment':
      return role === 'student' ? '/student/assignments' : role === 'faculty' ? '/faculty/assignments' : null;
    case 'FeeRecord':
      return role === 'student' ? '/student/fees' : '/finance/fees';
    case 'ExamSession':
    case 'ExamRegistration':
      return role === 'student' ? '/student/examinations?tab=registration' : role === 'coe' ? '/coe/exam-sessions' : '/workflows';
    case 'StudentLeaveRequest':
      return role === 'student' ? '/student/leave' : '/workflows';
    case 'HostelAllocation':
    case 'TransportAllocation':
    case 'CampusServiceRequest':
      return role === 'student' ? '/student/services' : '/registrar/campus-services';
    case 'PayrollRecord':
      return role === 'faculty' ? '/faculty/profile?tab=payslips' : '/account?tab=payslips';
    case 'FacultyLessonPlan':
      return role === 'faculty' ? '/faculty/courses' : role === 'hod' ? '/hod/lesson-plans' : '/workflows';
    case 'AQARRecord':
      return role === 'iqac_coordinator' ? '/iqac/reports' : '/workflows';
    case 'BroadcastMessage':
      return '/dashboard';
    case 'ClassSubstitution':
      return role === 'hod' ? '/hod/workload?tab=cover' : '/dashboard';
    default:
      return null;
  }
}

export function notificationLink(n: NotificationTarget, role: string): string | null {
  const type = n.relatedEntityType ?? '';
  const id = n.relatedEntityId ?? '';
  const event = n.eventType ?? '';
  // Waiting on this user: open the approval itself.
  if (event === 'workflow.assigned' && id) return `/workflows?open=${encodeURIComponent(id)}`;
  // A student's timetable / class changes.
  if (role === 'student' && (event.startsWith('timetable.') || event.startsWith('substitution.'))) return '/student/timetable';
  const page = type ? ownPage(type, role) : null;
  if (page) return page;
  // Any other workflow outcome: the request under "My requests".
  if (event.startsWith('workflow.') && id) return `/workflows?open=${encodeURIComponent(id)}`;
  return null;
}

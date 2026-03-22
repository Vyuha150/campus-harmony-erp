import { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/apiService';

function useRoleData<T>(endpoint: string, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchApi(endpoint)
      .then(d => setData(d ?? initial))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [endpoint]);
  return { data, loading, error };
}

// Faculty
export function useFacultyDashboard() { return useRoleData<any>('/faculty/dashboard', null); }
export function useFacultyProfile() { return useRoleData<any>('/faculty/profile', null); }
export function useFacultyCourses() { return useRoleData<any[]>('/faculty/courses', []); }
export function useFacultyAttendanceSessions() { return useRoleData<any[]>('/faculty/attendance/sessions', []); }
export function useFacultyAssignments() { return useRoleData<any[]>('/faculty/assignments', []); }
export function useFacultyMentees() { return useRoleData<any[]>('/faculty/mentees', []); }
export function useFacultyPublications() { return useRoleData<any[]>('/faculty/research/publications', []); }
export function useFacultyProjects() { return useRoleData<any[]>('/faculty/research/projects', []); }
export function useFacultyCommittees() { return useRoleData<any[]>('/faculty/committees', []); }
export function useFacultyGrievances() { return useRoleData<any[]>('/faculty/grievances', []); }
export function useFacultyMessages() { return useRoleData<any[]>('/faculty/messages', []); }

// HOD
export function useHODDashboard() { return useRoleData<any>('/hod/dashboard', null); }
export function useHODFaculty() { return useRoleData<any[]>('/hod/faculty', []); }
export function useHODApprovals() { return useRoleData<any[]>('/hod/approvals', []); }
export function useHODWorkload() { return useRoleData<any[]>('/hod/workload', []); }
export function useHODTimetable() { return useRoleData<any[]>('/hod/timetable', []); }
export function useHODStudents() { return useRoleData<any[]>('/hod/students', []); }
export function useHODResults() { return useRoleData<any[]>('/hod/results', []); }
export function useHODAccreditation() { return useRoleData<any[]>('/hod/accreditation', []); }
export function useHODInventory() { return useRoleData<any[]>('/hod/inventory', []); }
export function useHODGrievances() { return useRoleData<any[]>('/hod/grievances', []); }
export function useHODMessages() { return useRoleData<any[]>('/hod/messages', []); }

// Dean
export function useDeanDashboard() { return useRoleData<any>('/dean/dashboard', null); }
export function useDeanAcademics() { return useRoleData<any>('/dean/academics', null); }
export function useDeanCurriculumProposals() { return useRoleData<any[]>('/dean/curriculum-proposals', []); }
export function useDeanFacultyHR() { return useRoleData<any>('/dean/faculty', null); }
export function useDeanStudentAffairs() { return useRoleData<any>('/dean/student-affairs', null); }
export function useDeanResults() { return useRoleData<any[]>('/dean/results', []); }
export function useDeanFinance() { return useRoleData<any>('/dean/finance', null); }
export function useDeanAccreditation() { return useRoleData<any>('/dean/accreditation', null); }
export function useDeanCoordination() { return useRoleData<any[]>('/dean/events', []); }

// VC
export function useVCDashboard() { return useRoleData<any>('/vc/dashboard', null); }
export function useVCApprovals() { return useRoleData<any[]>('/vc/approvals', []); }
export function useVCPolicies() { return useRoleData<any>('/vc/policies', null); }
export function useVCMeetings() { return useRoleData<any[]>('/vc/meetings', []); }
export function useVCCommunication() { return useRoleData<any[]>('/vc/messages', []); }
export function useVCCompliance() { return useRoleData<any[]>('/vc/compliance', []); }
export function useVCFinance() { return useRoleData<any>('/vc/finance', null); }
export function useVCAnalytics() { return useRoleData<any>('/vc/analytics', null); }

// Registrar
export function useRegistrarDashboard() { return useRoleData<any>('/registrar/dashboard', null); }
export function useRegistrarStudents() { return useRoleData<any[]>('/registrar/students', []); }
export function useRegistrarRecordChanges() { return useRoleData<any[]>('/registrar/record-changes', []); }
export function useRegistrarTransfers() { return useRoleData<any[]>('/registrar/transfers', []); }
export function useRegistrarCertificates() { return useRoleData<any[]>('/registrar/certificates', []); }
export function useRegistrarVerifications() { return useRoleData<any[]>('/registrar/verifications', []); }
export function useRegistrarExams() { return useRoleData<any[]>('/registrar/exams', []); }
export function useRegistrarDocuments() { return useRoleData<any[]>('/registrar/documents', []); }
export function useRegistrarHR() { return useRoleData<any>('/registrar/hr/summary', null); }
export function useRegistrarAccreditation() { return useRoleData<any[]>('/registrar/accreditation', []); }
export function useRegistrarQueries() { return useRoleData<any[]>('/registrar/queries', []); }

// Finance
export function useFinanceDashboard() { return useRoleData<any>('/finance/dashboard', null); }
export function useFinanceFeeStructures() { return useRoleData<any[]>('/finance/fee-structures', []); }
export function useFinancePayments() { return useRoleData<any[]>('/finance/payments', []); }
export function useFinanceDefaulters() { return useRoleData<any[]>('/finance/defaulters', []); }
export function useFinanceJournalEntries() { return useRoleData<any[]>('/finance/journal-entries', []); }
export function useFinancePurchaseOrders() { return useRoleData<any[]>('/finance/purchase-orders', []); }
export function useFinanceVendors() { return useRoleData<any[]>('/finance/vendors', []); }
export function useFinancePayroll() { return useRoleData<any[]>('/finance/payroll', []); }
export function useFinanceReports() { return useRoleData<any>('/finance/reports', null); }
export function useFinanceBudgets() { return useRoleData<any[]>('/finance/budgets', []); }

// Placements
export function usePlacementDashboard() { return useRoleData<any>('/placements/dashboard', null); }
export function usePlacementStudents() { return useRoleData<any[]>('/placements/students', []); }
export function usePlacementCompanies() { return useRoleData<any[]>('/placements/companies', []); }
export function usePlacementDrives() { return useRoleData<any[]>('/placements/drives', []); }
export function usePlacementTraining() { return useRoleData<any[]>('/placements/training', []); }
export function usePlacementReports() { return useRoleData<any>('/placements/reports', null); }

// Sports
export function useSportsDashboard() { return useRoleData<any>('/sports/dashboard', null); }
export function useSportsAthletes() { return useRoleData<any[]>('/sports/athletes', []); }
export function useSportsTeams() { return useRoleData<any[]>('/sports/teams', []); }
export function useSportsFacilities() { return useRoleData<any[]>('/sports/facilities', []); }
export function useSportsInventory() { return useRoleData<any[]>('/sports/inventory', []); }
export function useSportsEvents() { return useRoleData<any[]>('/sports/events', []); }

// Alumni
export function useAlumniDashboard() { return useRoleData<any>('/alumni/dashboard', null); }
export function useAlumniDirectory() { return useRoleData<any[]>('/alumni/directory', []); }
export function useAlumniCommunication() { return useRoleData<any[]>('/alumni/communications', []); }
export function useAlumniEvents() { return useRoleData<any[]>('/alumni/events', []); }
export function useAlumniMentorship() { return useRoleData<any[]>('/alumni/mentorship/programs', []); }
export function useAlumniDonations() { return useRoleData<any[]>('/alumni/donations', []); }
export function useAlumniProgression() { return useRoleData<any>('/alumni/progression/metrics', null); }
export function useAlumniJobs() { return useRoleData<any[]>('/alumni/jobs', []); }

// IQAC
export function useIQACDashboard() { return useRoleData<any>('/iqac/dashboard', null); }
export function useIQACCriteria() { return useRoleData<any[]>('/iqac/criteria', []); }
export function useIQACActions() { return useRoleData<any[]>('/iqac/actions', []); }
export function useIQACDocuments() { return useRoleData<any[]>('/iqac/documents', []); }
export function useIQACFeedback() { return useRoleData<any[]>('/iqac/feedback', []); }
export function useIQACMeetings() { return useRoleData<any[]>('/iqac/meetings', []); }

// Grievance Officer
export function useGrievanceDashboard() { return useRoleData<any>('/grievances/dashboard', null); }
export function useGrievanceCases() { return useRoleData<any[]>('/grievances/cases', []); }
export function useGrievanceCompliance() { return useRoleData<any[]>('/grievances/compliance', []); }
export function useGrievanceReports() { return useRoleData<any>('/grievances/reports', null); }

// Security
export function useSecurityDashboard() { return useRoleData<any>('/security/dashboard', null); }
export function useSecurityVisitors() { return useRoleData<any[]>('/security/visitors', []); }
export function useSecurityIncidents() { return useRoleData<any[]>('/security/incidents', []); }
export function useSecurityPatrols() { return useRoleData<any[]>('/security/patrols', []); }
export function useSecurityVehicles() { return useRoleData<any[]>('/security/vehicle-passes', []); }

// Admin
export function useAdminDashboard() { return useRoleData<any>('/admin/dashboard', null); }
export function useAdminUsers() { return useRoleData<any[]>('/admin/users', []); }
export function useAdminConfig() { return useRoleData<any>('/admin/config', null); }
export function useAdminAuditLogs() { return useRoleData<any[]>('/admin/audit-logs', []); }
export function useAdminNotifications() { return useRoleData<any[]>('/admin/notifications', []); }
export function useAdminCourses() { return useRoleData<any[]>('/admin/courses', []); }
export function useAdminDepartments() { return useRoleData<any[]>('/admin/departments', []); }

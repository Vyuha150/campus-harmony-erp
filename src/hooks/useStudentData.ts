import { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/apiService';

function useStudentEndpoint<T>(endpoint: string, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchApi<T>(endpoint)
      .then((result) => setData(result))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [endpoint]);

  return { data, loading, error };
}

export function useStudentDashboard() {
  return useStudentEndpoint<any>('/students/dashboard', null);
}

export function useStudentProfile() {
  return useStudentEndpoint<any>('/students/profile', null);
}

export function useStudentCourses() {
  return useStudentEndpoint<any[]>('/students/courses', []);
}

export function useStudentAssignments() {
  return useStudentEndpoint<any[]>('/students/assignments', []);
}

export function useStudentExams() {
  return useStudentEndpoint<any[]>('/students/examinations', []);
}

export function useStudentFees() {
  return useStudentEndpoint<any>('/students/fees', null);
}

export function useStudentAttendance() {
  return useStudentEndpoint<any[]>('/students/attendance', []);
}

export function useStudentLibrary() {
  return useStudentEndpoint<any[]>('/students/library', []);
}

export function useStudentPlacements() {
  return useStudentEndpoint<any[]>('/students/placements', []);
}

export function useStudentGrievances() {
  return useStudentEndpoint<any[]>('/students/grievances', []);
}

export function useStudentCertificates() {
  return useStudentEndpoint<any[]>('/students/certificates', []);
}

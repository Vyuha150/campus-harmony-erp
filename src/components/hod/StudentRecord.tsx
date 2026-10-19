import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchApi } from '@/lib/apiService';
import { downloadCsv } from '@/lib/download';
import { cn } from '@/lib/utils';

/** GET /hod/planning/students/:id */
export interface StudentRecordData {
  personal: Record<string, any>;
  academic: { cgpa: number; earnedCredits: number; totalCredits: number; overallAttendance: number | null; mentor: string | null };
  currentCourses: Array<{ code: string; name: string; credits: number; faculty: string | null; attendance: number | null; classesHeld: number; internalMarks: number | null }>;
  semesters: Array<{ semester: number; sgpa: number | null; backlogs: number; courses: Array<{ code: string; name: string; credits: number; grade: string; total: number | null; passed: boolean }> }>;
  assignments: { set: number; submitted: number; graded: number };
  fees: { total: number; paid: number; due: number; overdue: number };
}

const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const date = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString('en-IN') : '—');
const pctClass = (v: number | null) => (v === null ? 'text-muted-foreground' : v < 75 ? 'font-semibold text-destructive' : 'font-semibold text-green-700 dark:text-green-400');

/** The report card the "Report Card" button downloads, built from the same record. */
export function downloadReportCard(r: StudentRecordData) {
  const rows: unknown[][] = [
    ['Name', r.personal.name], ['Roll number', r.personal.rollNumber], ['Programme', `${r.personal.program} ${r.personal.branch}`],
    ['Semester / section', `${r.personal.semester} / ${r.personal.section}`], ['CGPA', r.academic.cgpa],
    ['Overall attendance', r.academic.overallAttendance != null ? `${r.academic.overallAttendance}%` : '—'], ['Mentor', r.academic.mentor ?? '—'], [],
    ['Current semester', 'Course', 'Teacher', 'Attendance %', 'Internal marks'],
    ...r.currentCourses.map((c) => [c.code, c.name, c.faculty ?? '', c.attendance ?? '', c.internalMarks ?? '']), [],
    ['Semester', 'Course', 'Credits', 'Grade', 'Total', 'Result'],
    ...r.semesters.flatMap((s) => [...s.courses.map((c) => [s.semester, `${c.code} ${c.name}`, c.credits, c.grade, c.total ?? '', c.passed ? 'Pass' : 'Fail']), [`SGPA ${s.semester}`, s.sgpa ?? '']])
  ];
  downloadCsv(`report-card-${r.personal.rollNumber}.csv`, ['Field', 'Value'], rows);
}

/**
 * Everything the department holds on one student — what the blueprint gives
 * the HOD: "read-access to all student data of their branch".
 */
export function StudentRecord({ studentId, onLoaded }: { studentId: string; onLoaded?: (r: StudentRecordData) => void }) {
  const [record, setRecord] = useState<StudentRecordData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setRecord(null);
    setError(null);
    fetchApi<StudentRecordData>(`/hod/planning/students/${studentId}`)
      .then((r) => { setRecord(r); onLoaded?.(r); })
      .catch((e) => setError(e?.message || 'Could not load the record.'));
  }, [studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!record) return <p className="text-sm text-muted-foreground">Loading the student record…</p>;
  const p = record.personal;

  return (
    <Tabs defaultValue="overview">
      <TabsList className="flex-wrap">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="courses">This semester</TabsTrigger>
        <TabsTrigger value="results">Results</TabsTrigger>
        <TabsTrigger value="personal">Personal</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ['CGPA', record.academic.cgpa.toFixed(2), record.academic.cgpa < 6 ? 'text-destructive' : ''],
            ['Attendance', record.academic.overallAttendance != null ? `${record.academic.overallAttendance}%` : '—', record.academic.overallAttendance != null && record.academic.overallAttendance < 75 ? 'text-destructive' : ''],
            ['Credits', `${record.academic.earnedCredits}/${record.academic.totalCredits}`, ''],
            ['Backlogs', String(record.semesters.reduce((n, s) => n + s.backlogs, 0)), record.semesters.some((s) => s.backlogs) ? 'text-destructive' : '']
          ].map(([label, value, tone]) => (
            <div key={label} className="rounded-lg border p-3"><p className={cn('text-xl font-bold', tone)}>{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>
          ))}
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Mentor</dt><dd>{record.academic.mentor ?? 'Not assigned'}</dd>
          <dt className="text-muted-foreground">Assignments</dt><dd>{record.assignments.submitted}/{record.assignments.set} submitted · {record.assignments.graded} graded</dd>
          <dt className="text-muted-foreground">Fees</dt>
          <dd>{rupees(record.fees.paid)} paid of {rupees(record.fees.total)}{record.fees.due > 0 && <Badge variant="destructive" className="ml-2 text-[10px]">{rupees(record.fees.due)} due{record.fees.overdue ? ` · ${record.fees.overdue} overdue` : ''}</Badge>}</dd>
        </dl>
      </TabsContent>

      <TabsContent value="courses">
        <Table>
          <TableHeader><TableRow><TableHead>Course</TableHead><TableHead>Teacher</TableHead><TableHead className="text-center">Attendance</TableHead><TableHead className="text-center">Internal</TableHead></TableRow></TableHeader>
          <TableBody>
            {record.currentCourses.map((c) => (
              <TableRow key={c.code}>
                <TableCell><p className="font-medium">{c.code}</p><p className="text-xs text-muted-foreground">{c.name}</p></TableCell>
                <TableCell className="text-sm">{c.faculty ?? '—'}</TableCell>
                <TableCell className={cn('text-center', pctClass(c.attendance))}>{c.attendance != null ? `${c.attendance}%` : '—'}<p className="text-[10px] font-normal text-muted-foreground">{c.classesHeld} classes</p></TableCell>
                <TableCell className="text-center">{c.internalMarks ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TabsContent>

      <TabsContent value="results" className="space-y-3">
        {record.semesters.length === 0 && <p className="text-sm text-muted-foreground">No published results yet.</p>}
        {record.semesters.map((s) => (
          <div key={s.semester} className="rounded-lg border">
            <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2 text-sm">
              <span className="font-semibold">Semester {s.semester}</span>
              <span>SGPA <b>{s.sgpa ?? '—'}</b>{s.backlogs > 0 && <Badge variant="destructive" className="ml-2 text-[10px]">{s.backlogs} backlog{s.backlogs > 1 ? 's' : ''}</Badge>}</span>
            </div>
            <Table>
              <TableBody>
                {s.courses.map((c) => (
                  <TableRow key={c.code}>
                    <TableCell className="py-1.5 text-sm">{c.code} · {c.name}</TableCell>
                    <TableCell className="py-1.5 text-center text-sm">{c.credits} cr</TableCell>
                    <TableCell className={cn('py-1.5 text-center font-semibold', !c.passed && 'text-destructive')}>{c.grade}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}
      </TabsContent>

      <TabsContent value="personal">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          {[
            ['Email', p.email], ['Roll number', p.rollNumber], ['Programme', `${p.program} · ${p.branch}`], ['Batch', p.batch],
            ['Semester / section', `${p.semester} / ${p.section}`], ['Admitted', p.admissionYear], ['Gender', p.gender], ['Date of birth', date(p.dateOfBirth)],
            ['Category', p.category], ['Home state', p.domicileState], ['Hosteller', p.hosteller ? 'Yes' : 'No'], ['Differently abled', p.differentlyAbled ? 'Yes' : 'No']
          ].map(([k, v]) => <div key={k as string} className="contents"><dt className="text-muted-foreground">{k}</dt><dd>{v ?? '—'}</dd></div>)}
        </dl>
      </TabsContent>
    </Tabs>
  );
}

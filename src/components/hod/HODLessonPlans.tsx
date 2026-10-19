import { Fragment, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchApi } from '@/lib/apiService';

const STATUS: Record<string, { label: string; tone: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  not_started: { label: 'No plan', tone: 'destructive' }, draft: { label: 'Draft', tone: 'outline' }, submitted: { label: 'Awaiting approval', tone: 'secondary' },
  approved: { label: 'Approved', tone: 'default' }, returned: { label: 'Returned', tone: 'destructive' }
};

/** Every course's lesson plan in the department: approval and how far teaching has got. */
export default function HODLessonPlans() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  // Courses being taught now (a teacher assigned); earlier semesters' unassigned courses are not planned.
  useEffect(() => { fetchApi<any[]>('/hod/lesson-plans').then((d) => setRows((Array.isArray(d) ? d : []).filter((r) => r.faculty !== 'Unassigned'))).catch(() => setRows([])); }, []);
  const behind = rows.filter((r) => r.behindBy > 0).length;
  const waiting = rows.filter((r) => r.status === 'submitted').length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Lesson plans & syllabus coverage</h1>
            <p className="text-muted-foreground">Faculty submit each course's plan; you approve it (then the Dean) from Approvals. Coverage counts weeks marked taught.</p>
          </div>
          {waiting > 0 && <Button onClick={() => navigate('/workflows')}>{waiting} plan(s) awaiting your approval</Button>}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card><CardContent className="p-4"><p className="text-2xl font-bold">{rows.filter((r) => r.status === 'approved').length}/{rows.length}</p><p className="text-xs text-muted-foreground">Plans approved</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-2xl font-bold">{rows.filter((r) => r.weeksPlanned === 0).length}</p><p className="text-xs text-muted-foreground">Courses with no plan</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-2xl font-bold text-destructive">{behind}</p><p className="text-xs text-muted-foreground">Courses behind schedule</p></CardContent></Card>
        </div>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" />Courses</CardTitle><CardDescription>Click a course to see its weeks</CardDescription></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Course</TableHead><TableHead>Faculty</TableHead><TableHead>Plan</TableHead><TableHead>Coverage</TableHead><TableHead>Schedule</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <Fragment key={r.courseId}>
                    <TableRow className="cursor-pointer" onClick={() => setOpen(open === r.courseId ? null : r.courseId)}>
                      <TableCell><p className="font-medium">{r.code}</p><p className="text-xs text-muted-foreground">{r.name} · sem {r.semester}</p></TableCell>
                      <TableCell className="text-sm">{r.faculty}</TableCell>
                      <TableCell><Badge variant={STATUS[r.status]?.tone ?? 'outline'}>{STATUS[r.status]?.label ?? r.status}</Badge></TableCell>
                      <TableCell className="min-w-[10rem]"><div className="flex items-center gap-2"><Progress value={r.coverage} className="h-2 w-24" /><span className="text-xs">{r.weeksCompleted}/{r.weeksPlanned} weeks</span></div></TableCell>
                      <TableCell className="text-xs">{r.weeksPlanned === 0 ? '—' : r.behindBy > 0 ? <span className="text-destructive">{r.behindBy} week(s) behind</span> : 'On track'}</TableCell>
                    </TableRow>
                    {open === r.courseId && (
                      <TableRow key={`${r.courseId}-weeks`}><TableCell colSpan={5} className="bg-muted/30">
                        {!r.weeks.length && <p className="text-sm text-muted-foreground">No weeks planned.</p>}
                        <div className="grid gap-1 sm:grid-cols-2">{r.weeks.map((w: any) => (
                          <p key={w.week} className="text-xs">W{w.week} · {new Date(w.plannedDate).toLocaleDateString('en-IN')} · {w.topic} <Badge variant={w.status === 'completed' ? 'default' : 'outline'} className="ml-1 text-[10px] capitalize">{w.status}</Badge></p>
                        ))}</div>
                      </TableCell></TableRow>
                    )}
                  </Fragment>
                ))}
                {!rows.length && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No courses in the department.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

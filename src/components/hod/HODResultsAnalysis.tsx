import { downloadCsv } from '@/lib/download';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  BarChart3, Download, TrendingUp, TrendingDown, AlertTriangle, Award, CheckCircle, FileText, Send
} from 'lucide-react';
import { fetchApi, postApi } from '@/lib/apiService';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { CourseResult } from '@/types/hod';
import { ExamResultSheets } from '@/components/shared/ExamResultSheets';

export default function HODResultsAnalysis() {
  const [courseResults, setCourseResults] = useState<any>([]);
  const [_apiLoading, _setApiLoading] = useState(true);
  useEffect(() => {
    fetchApi('/hod/courseresults').then(d => setCourseResults(d)).catch((error) => { console.error('API request failed', error); });
    _setApiLoading(false);
  }, []);

  const { toast } = useToast();
  const [showRemedialDialog, setShowRemedialDialog] = useState(false);
  const [showGradeDialog, setShowGradeDialog] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<CourseResult | null>(null);
  const [remedialNote, setRemedialNote] = useState('');

  // `passPercentage` is `null` for a course with no graded enrolments —
  // summing it directly would coerce `null` to `0`, which drags the
  // department-wide figure down for courses nobody has graded yet, exactly
  // the same way `avgScore` below needed the same guard.
  const coursesWithPass = courseResults.filter((c): c is typeof c & { passPercentage: number } => c.passPercentage !== null);
  const overallPass = coursesWithPass.length > 0
    ? Math.round(coursesWithPass.reduce((s, c) => s + c.passPercentage, 0) / coursesWithPass.length * 10) / 10
    : null;
  // Only courses with a real average (some numeric marks recorded) count
  // toward the department-wide figure. `avgScore` is `null` for a course
  // graded entirely in letters, or not yet graded at all — summing it
  // directly would coerce `null` to `0` and silently pull the department
  // average down for courses that simply have no numeric marks yet.
  const coursesWithAvg = courseResults.filter((c): c is typeof c & { avgScore: number } => c.avgScore !== null);
  const overallAvg = coursesWithAvg.length > 0
    ? Math.round(coursesWithAvg.reduce((s, c) => s + c.avgScore, 0) / coursesWithAvg.length * 10) / 10
    : null;
  const totalFailed = courseResults.reduce((s, c) => s + c.failed, 0);


  const handleDownload = () => {
    if (courseResults.length === 0) {
      toast({ title: 'Nothing to export', description: 'No course results have been published yet.' });
      return;
    }
    downloadCsv(
      `department-results-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Course code', 'Course', 'Semester', 'Faculty', 'Students', 'Passed', 'Failed', 'Pass %', 'Average', 'Highest'],
      (courseResults as any[]).map((c) => [
        c.courseCode, c.courseName, c.semester ?? '', c.faculty, c.totalStudents, c.passed, c.failed,
        c.passPercentage ?? '', c.avgScore ?? '', c.highestScore ?? ''
      ])
    );
  };

  const handleArrangeRemedial = async () => {
    if (selectedCourse) {
      try {
        await postApi(`/hod/courseresults/${selectedCourse.courseCode}/remedial`, { note: remedialNote });
        toast({ title: '📋 Remedial Class Scheduled', description: `Remedial for ${selectedCourse.courseCode} – ${selectedCourse.courseName}. ${remedialNote || 'No additional notes.'}` });
        setShowRemedialDialog(false);
        setRemedialNote('');
      } catch (error: any) {
        toast({ title: 'Action failed', description: error?.message || 'Unable to schedule remedial class', variant: 'destructive' });
      }
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Department Results Analysis</h1>
            <p className="text-muted-foreground">{(() => { const sems = [...new Set((courseResults as any[]).filter((c) => c.passPercentage != null).map((c) => c.semester).filter(Boolean))].sort(); return sems.length ? `Published results for semester ${sems.join(', ')}` : 'No results published yet'; })()}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="mr-1 h-4 w-4" />Download Report
            </Button>
          </div>
        </div>

        {/* End-semester verification: faculty entered → HOD verifies → CoE moderates → Dean publishes */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">End-semester result verification</CardTitle>
            <p className="text-sm text-muted-foreground">Check each paper's marks as entered by the faculty. Verify to send it to the Controller of Examinations, or return it for correction.</p>
          </CardHeader>
          <CardContent>
            <ExamResultSheets mode="hod" />
          </CardContent>
        </Card>

        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: 'Overall Pass %', value: overallPass === null ? 'N/A' : `${overallPass}%`, icon: TrendingUp, color: 'text-green-600 bg-green-100' },
            { label: 'Average Score', value: overallAvg === null ? 'N/A' : overallAvg, icon: BarChart3, color: 'text-blue-600 bg-blue-100' },
            { label: 'Total Failures', value: totalFailed, icon: TrendingDown, color: 'text-destructive bg-destructive/10' },
            { label: 'Courses', value: courseResults.length, icon: CheckCircle, color: 'text-primary bg-primary/10' },
          ].map(s => (
            <Card key={s.label} className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Course-wise Results */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Course-wise Performance</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Faculty</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Passed</TableHead>
                  <TableHead className="text-center">Failed</TableHead>
                  <TableHead className="text-center">Pass %</TableHead>
                  <TableHead className="text-center">Avg Score</TableHead>
                  <TableHead className="text-center">Highest</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courseResults.map(c => (
                  <TableRow key={c.courseCode}>
                    <TableCell>
                      <p className="font-medium text-foreground">{c.courseCode}</p>
                      <p className="text-xs text-muted-foreground">{c.courseName}</p>
                    </TableCell>
                    <TableCell className="text-sm">{c.faculty}</TableCell>
                    <TableCell className="text-center">{c.totalStudents}</TableCell>
                    <TableCell className="text-center text-green-600 font-medium">{c.passed}</TableCell>
                    <TableCell className="text-center text-destructive font-medium">{c.failed}</TableCell>
                    <TableCell className="text-center">
                      {c.passPercentage !== null ? (
                        <div className="flex items-center justify-center gap-2">
                          <Progress value={c.passPercentage} className="w-16 h-1.5" />
                          <span className={`text-xs font-medium ${c.passPercentage < 80 ? 'text-destructive' : 'text-green-600'}`}>
                            {c.passPercentage}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">{c.avgScore ?? 'N/A'}</TableCell>
                    <TableCell className="text-center font-bold text-green-600">{c.highestScore ?? 'N/A'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setSelectedCourse(c); setShowGradeDialog(true); }}>
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Grade Distribution Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courseResults.map(c => (
            <Card key={c.courseCode} className="border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{c.courseCode} – Grade Distribution</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {c.gradeDistribution.map(g => (
                    <div key={g.grade} className="flex items-center gap-2">
                      <span className="w-8 text-xs font-medium text-foreground">{g.grade}</span>
                      <Progress value={(g.count / c.totalStudents) * 100} className="flex-1 h-2" />
                      <span className="w-6 text-xs text-muted-foreground text-right">{g.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Courses needing remedial action. `null < 90` is `true` in
            JavaScript, so a course with no graded enrolments yet would be
            flagged as needing remedial attention for a pass rate that was
            never computed. */}
        {courseResults.filter(c => c.passPercentage !== null && c.passPercentage < 90).length > 0 && (
          <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Courses Needing Attention
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {courseResults.filter(c => c.passPercentage !== null && c.passPercentage < 90).map(c => (
                <div key={c.courseCode} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{c.courseCode} – {c.courseName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{c.failed} students failed</span>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setSelectedCourse(c); setShowRemedialDialog(true); }}>
                      Arrange Remedial
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Remedial Dialog */}
      <Dialog open={showRemedialDialog} onOpenChange={setShowRemedialDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Arrange Remedial – {selectedCourse?.courseCode}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="text-sm space-y-1">
              <p><span className="text-muted-foreground">Course:</span> {selectedCourse?.courseName}</p>
              <p><span className="text-muted-foreground">Faculty:</span> {selectedCourse?.faculty}</p>
              <p><span className="text-muted-foreground">Failed:</span> <span className="text-destructive font-bold">{selectedCourse?.failed} students</span></p>
            </div>
            <Textarea placeholder="Additional instructions for remedial class..." value={remedialNote} onChange={e => setRemedialNote(e.target.value)} rows={3} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowRemedialDialog(false)}>Cancel</Button>
              <Button onClick={handleArrangeRemedial}>
                <FileText className="mr-1 h-4 w-4" />Schedule Remedial
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Grade Detail Dialog */}
      <Dialog open={showGradeDialog} onOpenChange={setShowGradeDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{selectedCourse?.courseCode} – Detailed Analysis</DialogTitle></DialogHeader>
          {selectedCourse && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Course:</span> {selectedCourse.courseName}</div>
                <div><span className="text-muted-foreground">Faculty:</span> {selectedCourse.faculty}</div>
                <div><span className="text-muted-foreground">Pass %:</span> <span className="font-bold">{selectedCourse.passPercentage === null ? 'N/A' : `${selectedCourse.passPercentage}%`}</span></div>
                <div><span className="text-muted-foreground">Avg Score:</span> {selectedCourse.avgScore ?? 'N/A'}</div>
                <div><span className="text-muted-foreground">Highest:</span> {selectedCourse.highestScore ?? 'N/A'}</div>
                <div><span className="text-muted-foreground">Total:</span> {selectedCourse.totalStudents}</div>
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Grade Distribution</p>
                {selectedCourse.gradeDistribution.map(g => (
                  <div key={g.grade} className="flex items-center gap-2">
                    <span className="w-8 text-xs font-medium">{g.grade}</span>
                    <Progress value={(g.count / selectedCourse.totalStudents) * 100} className="flex-1 h-2" />
                    <span className="w-10 text-xs text-right">{g.count} ({Math.round(g.count / selectedCourse.totalStudents * 100)}%)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function Eye(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}

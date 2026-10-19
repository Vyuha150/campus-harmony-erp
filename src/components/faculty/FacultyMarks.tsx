import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, Download, Upload, BarChart3 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { fetchApi, putApi } from '@/lib/apiService';
import { ExamResultSheets } from '@/components/shared/ExamResultSheets';
import { useTabParam } from '@/hooks/useTabParam';
import { useToast } from '@/hooks/use-toast';

export default function FacultyMarks() {
  const tabParam = useTabParam('internal');
  const [facultyCourses, setFacultyCourses] = useState<any>([]);
  const [semesterOptions, setSemesterOptions] = useState<number[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [internalMarks, setInternalMarks] = useState<any>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [submittingMarks, setSubmittingMarks] = useState(false);
  const [_apiLoading, _setApiLoading] = useState(true);

  const loadCourses = async (semester?: string) => {
    const semesterQuery = semester ? `?semester=${semester}` : '';
    const courses = await fetchApi(`/faculty/courses${semesterQuery}`);
    setFacultyCourses(Array.isArray(courses) ? courses : []);
    if (Array.isArray(courses) && courses.length > 0) {
      setSelectedCourseId((prev) => (prev && courses.some((course: any) => course.id === prev) ? prev : courses[0].id));
    } else {
      setSelectedCourseId('');
      setInternalMarks([]);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        const [allCourses, currentSemesterResponse] = await Promise.all([
          fetchApi('/faculty/courses'),
          fetchApi('/faculty/current-semester')
        ]);
        const semesters = Array.from(new Set((Array.isArray(allCourses) ? allCourses : []).map((course: any) => Number(course?.semester)).filter((value) => Number.isFinite(value)))).sort((a: any, b: any) => a - b);
        setSemesterOptions(semesters);
        const apiCurrentSemester = Number((currentSemesterResponse as any)?.currentSemester);
        const defaultSemester = Number.isFinite(apiCurrentSemester) && semesters.includes(apiCurrentSemester)
          ? String(apiCurrentSemester)
          : (semesters.length > 0 ? String(semesters[semesters.length - 1]) : '');
        setSelectedSemester(defaultSemester);
        await loadCourses(defaultSemester);
      } catch (error) {
        console.error('API request failed', error);
      } finally {
        _setApiLoading(false);
      }
    };

    initialize();
  }, []);

  useEffect(() => {
    if (_apiLoading) return;
    loadCourses(selectedSemester).catch((error) => { console.error('API request failed', error); });
  }, [selectedSemester]);

  useEffect(() => {
    if (!selectedCourseId) return;
    // WHAT THIS REPLACES. This used to take the single stored `total` and
    // reverse-engineer a Quiz 1 / Quiz 2 / Midterm / Assignment / Attendance
    // breakdown from it using fixed weights (10% / 10% / 50% / 20% / 10%) —
    // five component scores presented as real marks, when `Enrollment` has
    // never stored anything but one `grade` value. No one ever entered a
    // midterm score of, say, 36; it was `Math.round(total * 0.5)`.
    //
    // It was not just misleading. `updateMarkField` recomputed `total` as the
    // SUM of all five fields on every edit — so editing just the midterm score
    // added the real new midterm to the four still-fabricated components and
    // wrote that as the student's total. A faculty member correcting one
    // number could silently corrupt the other four they never touched.
    fetchApi(`/faculty/marks/${selectedCourseId}`).then((d: any) => {
      const mapped = (Array.isArray(d) ? d : []).map((entry: any) => ({
        ...entry,
        // `''` for ungraded, not `0` — an empty box invites a real mark; a `0`
        // claims one was already given.
        total: entry.total === null ? '' : String(entry.total)
      }));
      setInternalMarks(mapped);
    }).catch((error) => { console.error('API request failed', error); });
  }, [selectedCourseId]);

  const { toast } = useToast();
  const selectedCourse = facultyCourses.find((course: any) => course.id === selectedCourseId);

  const updateMarkField = (studentId: string, value: string) => {
    setInternalMarks((prev: any[]) => prev.map((entry) => (
      entry.studentId === studentId ? { ...entry, total: value } : entry
    )));
  };

  const submitInternalMarks = async () => {
    if (!selectedCourseId) {
      toast({ title: 'Select a course', description: 'Please select a course first.', variant: 'destructive' });
      return;
    }

    try {
      setSubmittingMarks(true);
      await putApi(`/faculty/marks/${selectedCourseId}`, {
        marks: internalMarks.map((entry: any) => ({
          studentId: entry.studentId,
          // An empty box submits as ungraded (`null`), not as a score of 0 —
          // the same distinction the load path now makes in reverse.
          grade: entry.total === '' || entry.total === undefined ? null : String(entry.total)
        }))
      });
      toast({ title: 'Marks submitted', description: 'Internal marks saved successfully.' });
    } catch (error: any) {
      toast({ title: 'Submit failed', description: error?.message || 'Unable to submit marks.', variant: 'destructive' });
    } finally {
      setSubmittingMarks(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Gradebook & Marks Entry</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Upload className="mr-1 h-4 w-4" />Import CSV</Button>
            <Button variant="outline" size="sm"><Download className="mr-1 h-4 w-4" />Export</Button>
          </div>
        </div>

        <div className="flex gap-4">
          <Select value={selectedSemester || 'all'} onValueChange={(value) => setSelectedSemester(value === 'all' ? '' : value)}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Semester" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Semesters</SelectItem>
              {semesterOptions.map((semester) => (
                <SelectItem key={semester} value={String(semester)}>Semester {semester}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
            <SelectTrigger className="w-[280px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {facultyCourses.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.code} – {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs key={tabParam.key} defaultValue={tabParam.defaultValue}>
          <TabsList>
            <TabsTrigger value="internal">Internal Marks</TabsTrigger>
            <TabsTrigger value="exam">End-Semester Entry</TabsTrigger>
          </TabsList>

          <TabsContent value="internal" className="mt-4">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{selectedCourse ? `${selectedCourse.code} – Internal Assessment Marks` : 'Internal Assessment Marks'}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Roll No</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-center">Total Marks (100)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {internalMarks.map((entry) => {
                      const numeric = entry.total === '' ? null : Number(entry.total);
                      const graded = numeric !== null && Number.isFinite(numeric);
                      return (
                        <TableRow key={entry.studentId}>
                          <TableCell className="font-mono">{entry.rollNumber}</TableCell>
                          <TableCell className="font-medium">{entry.studentName}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                className="mx-auto w-20 text-center"
                                placeholder="—"
                                value={entry.total}
                                onChange={(event) => updateMarkField(entry.studentId, event.target.value)}
                              />
                              {graded && (
                                <Badge variant={numeric >= 60 ? 'default' : numeric >= 40 ? 'secondary' : 'destructive'}>
                                  {numeric}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <div className="mt-4 flex justify-end gap-2">
                  <Button onClick={submitInternalMarks} disabled={submittingMarks}>
                    <Save className="mr-1 h-4 w-4" />{submittingMarks ? 'Submitting...' : 'Submit Marks'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="exam" className="mt-4">
            <ExamResultSheets mode="faculty" />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

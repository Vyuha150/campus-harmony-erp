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
import { useToast } from '@/hooks/use-toast';

export default function FacultyMarks() {
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
    fetchApi(`/faculty/marks/${selectedCourseId}`).then((d: any) => {
      const mapped = (Array.isArray(d) ? d : []).map((entry: any) => {
        const total = Number(entry.total || 0);
        return {
          ...entry,
          quiz1: Math.min(10, Math.round(total * 0.1)),
          quiz2: Math.min(10, Math.round(total * 0.1)),
          midterm: Math.min(50, Math.round(total * 0.5)),
          assignment: Math.min(20, Math.round(total * 0.2)),
          attendance: Math.min(10, Math.round(total * 0.1)),
          total
        };
      });
      setInternalMarks(mapped);
    }).catch((error) => { console.error('API request failed', error); });
  }, [selectedCourseId]);

  const { toast } = useToast();
  const selectedCourse = facultyCourses.find((course: any) => course.id === selectedCourseId);

  const updateMarkField = (studentId: string, field: string, value: string) => {
    setInternalMarks((prev: any[]) => prev.map((entry) => {
      if (entry.studentId !== studentId) return entry;
      const next = { ...entry, [field]: Number(value || 0) };
      next.total = Number(next.quiz1 || 0) + Number(next.quiz2 || 0) + Number(next.midterm || 0) + Number(next.assignment || 0) + Number(next.attendance || 0);
      return next;
    }));
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
          grade: String(entry.total)
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

        <Tabs defaultValue="internal">
          <TabsList>
            <TabsTrigger value="internal">Internal Marks</TabsTrigger>
            <TabsTrigger value="exam">End-Semester Entry</TabsTrigger>
          </TabsList>

          <TabsContent value="internal" className="mt-4">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{selectedCourse ? `${selectedCourse.code} – Internal Assessment Marks` : 'Internal Assessment Marks'}</CardTitle>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Quiz 1: /10</span>
                    <span>Quiz 2: /10</span>
                    <span>Midterm: /50</span>
                    <span>Assignment: /20</span>
                    <span>Attendance: /10</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Roll No</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-center">Quiz 1 (10)</TableHead>
                      <TableHead className="text-center">Quiz 2 (10)</TableHead>
                      <TableHead className="text-center">Midterm (50)</TableHead>
                      <TableHead className="text-center">Assignment (20)</TableHead>
                      <TableHead className="text-center">Attendance (10)</TableHead>
                      <TableHead className="text-center">Total (100)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {internalMarks.map((entry) => (
                      <TableRow key={entry.studentId}>
                        <TableCell className="font-mono">{entry.rollNumber}</TableCell>
                        <TableCell className="font-medium">{entry.studentName}</TableCell>
                        <TableCell className="text-center">
                          <Input type="number" className="mx-auto w-16 text-center" value={entry.quiz1} onChange={(event) => updateMarkField(entry.studentId, 'quiz1', event.target.value)} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input type="number" className="mx-auto w-16 text-center" value={entry.quiz2} onChange={(event) => updateMarkField(entry.studentId, 'quiz2', event.target.value)} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input type="number" className="mx-auto w-16 text-center" value={entry.midterm} onChange={(event) => updateMarkField(entry.studentId, 'midterm', event.target.value)} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input type="number" className="mx-auto w-16 text-center" value={entry.assignment} onChange={(event) => updateMarkField(entry.studentId, 'assignment', event.target.value)} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input type="number" className="mx-auto w-16 text-center" value={entry.attendance} onChange={(event) => updateMarkField(entry.studentId, 'attendance', event.target.value)} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={entry.total >= 60 ? 'default' : entry.total >= 40 ? 'secondary' : 'destructive'}>
                            {entry.total}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="outline">Save Draft</Button>
                  <Button onClick={submitInternalMarks} disabled={submittingMarks}>
                    <Save className="mr-1 h-4 w-4" />{submittingMarks ? 'Submitting...' : 'Submit Marks'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="exam" className="mt-4">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">End-Semester Marks Entry</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Roll No</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-center">Theory (70)</TableHead>
                      <TableHead className="text-center">Practical (30)</TableHead>
                      <TableHead className="text-center">Total (100)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {internalMarks.map((entry) => (
                      <TableRow key={entry.studentId}>
                        <TableCell className="font-mono">{entry.rollNumber}</TableCell>
                        <TableCell className="font-medium">{entry.studentName}</TableCell>
                        <TableCell className="text-center"><Input type="number" className="mx-auto w-16 text-center" /></TableCell>
                        <TableCell className="text-center"><Input type="number" className="mx-auto w-16 text-center" /></TableCell>
                        <TableCell className="text-center"><span className="text-muted-foreground">—</span></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-4 flex justify-end">
                  <Button onClick={submitInternalMarks} disabled={submittingMarks}>
                    <Save className="mr-1 h-4 w-4" />{submittingMarks ? 'Submitting...' : 'Submit to Exam Cell'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

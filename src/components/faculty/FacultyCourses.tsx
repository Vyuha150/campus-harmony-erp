import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  BookOpen, Users, Clock, MapPin, BarChart3, ChevronRight,
  CheckCircle2, FileText, Upload, PieChart, Eye
} from 'lucide-react';
import { fetchApi, postApi, putApi, uploadApi, downloadUpload } from '@/lib/apiService';
import { Link } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

/** A percentage, or a dash when there is nothing to compute it from. */
const pct = (value: number | null | undefined) => (value == null ? '—' : `${value}%`);

export default function FacultyCourses() {
  const [facultyCourses, setFacultyCourses] = useState<any>([]);
  const [lessonPlans, setLessonPlans] = useState<any>([]);
  const [semesterOptions, setSemesterOptions] = useState<number[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [courseMarks, setCourseMarks] = useState<any[]>([]);
  const [_apiLoading, _setApiLoading] = useState(true);
  const [isSavingLessonPlan, setIsSavingLessonPlan] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [lessonPlanForm, setLessonPlanForm] = useState<any>(null);
  const { toast } = useToast();

  const toInputDate = (value: any) => {
    if (!value) return '';
    const direct = new Date(value);
    if (!Number.isNaN(direct.getTime())) {
      return direct.toISOString().slice(0, 10);
    }
    const parts = String(value).split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      const rebuilt = new Date(`${year}-${month}-${day}`);
      if (!Number.isNaN(rebuilt.getTime())) {
        return rebuilt.toISOString().slice(0, 10);
      }
    }
    return '';
  };

  const loadCourseData = async (semester?: string) => {
    const semesterQuery = semester ? `?semester=${semester}` : '';
    const [coursesData, lessonPlansData] = await Promise.all([
      fetchApi(`/faculty/courses${semesterQuery}`),
      fetchApi(`/faculty/courses/lesson-plans${semesterQuery}`)
    ]);
    setFacultyCourses(coursesData);
    setLessonPlans(lessonPlansData);
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
        await loadCourseData(defaultSemester);
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
    loadCourseData(selectedSemester).catch((error) => { console.error('API request failed', error); });
  }, [selectedSemester]);

  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const course = selectedCourse ? facultyCourses.find(c => c.id === selectedCourse) : null;
  const courseLessons = course
    ? lessonPlans.filter((lp: any) => lp.courseId === course.id || lp.courseCode === course.code)
    : [];
  // Course materials are real uploads now. This list used to invent a
  // "<topic>.pdf" per lesson plan, and "Upload Material" had no handler.
  const [courseMaterials, setCourseMaterials] = useState<any[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const loadMaterials = async (courseId: string) => {
    try {
      const rows = await fetchApi<any[]>(`/faculty/courses/${courseId}/materials`);
      setCourseMaterials(Array.isArray(rows) ? rows : []);
    } catch {
      setCourseMaterials([]);
    }
  };
  useEffect(() => {
    if (course?.id) loadMaterials(course.id);
    else setCourseMaterials([]);
  }, [course?.id]);
  const uploadMaterial = async () => {
    if (!course?.id || !materialFile) return;
    setUploadingMaterial(true);
    try {
      await uploadApi(materialFile, 'course-materials', {
        visibility: 'role_restricted',
        allowedRoles: ['student', 'faculty', 'hod', 'dean'],
        relatedEntityType: 'Course',
        relatedEntityId: course.id
      });
      await loadMaterials(course.id);
      setUploadOpen(false);
      setMaterialFile(null);
      toast({ title: 'Material uploaded', description: 'Students enrolled in this course can now download it.' });
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setUploadingMaterial(false);
    }
  };

  useEffect(() => {
    if (selectedCourse && !facultyCourses.some((item: any) => item.id === selectedCourse)) {
      setSelectedCourse(null);
    }
  }, [facultyCourses, selectedCourse]);


  useEffect(() => {
    if (!course?.id) {
      setAttendanceHistory([]);
      setCourseMarks([]);
      return;
    }

    fetchApi(`/faculty/attendance/history?courseId=${course.id}`).then(d => setAttendanceHistory(Array.isArray(d) ? d : [])).catch((error) => { console.error('API request failed', error); setAttendanceHistory([]); });
    fetchApi(`/faculty/marks/${course.id}`).then(d => setCourseMarks(Array.isArray(d) ? d : [])).catch((error) => { console.error('API request failed', error); setCourseMarks([]); });
  }, [course?.id]);

  const attendanceTrend = attendanceHistory.slice(0, 6).reverse().map((session: any, index: number) => {
    const total = Array.isArray(session.records) ? session.records.length : (session.totalStudents || 0);
    const present = Array.isArray(session.records)
      ? session.records.filter((record: any) => record.status === 'present' || record.status === 'late').length
      : (session.presentCount || 0);
    const pct = total > 0 ? Math.round((present / total) * 100) : 0;

    return {
      label: session.date ? new Date(session.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : `Session ${index + 1}`,
      value: pct,
    };
  });

  const gradeCounts = courseMarks.reduce((acc: Record<string, number>, mark: any) => {
    const grade = String(mark.grade || 'NA');
    acc[grade] = (acc[grade] || 0) + 1;
    return acc;
  }, {});
  const totalGrades = courseMarks.length;
  const gradeDistribution = Object.entries(gradeCounts).map(([grade, count]: [string, number]) => ({
    grade,
    count,
    pct: totalGrades > 0 ? Math.round((count / totalGrades) * 100) : 0,
  }));





  // Lesson plan approval (HOD → Dean) and adding weeks — there was no way to
  // start a plan, and "Upload Plan" did nothing.
  const [planStatus, setPlanStatus] = useState<Record<string, any>>({});
  const loadPlanStatus = () => fetchApi<any[]>('/faculty/courses/lesson-plan-status')
    .then((d) => setPlanStatus(Object.fromEntries((Array.isArray(d) ? d : []).map((x: any) => [x.courseId, x])))).catch(() => undefined);
  useEffect(() => { loadPlanStatus(); }, []);
  const [newWeek, setNewWeek] = useState<any | null>(null);
  const addWeek = async () => {
    if (!course?.id || !newWeek?.topic?.trim() || !newWeek?.plannedDate) return;
    const next = courseLessons.reduce((m: number, l: any) => Math.max(m, Number(l.weekNumber) || 0), 0) + 1;
    try {
      await putApi(`/faculty/courses/${course.id}/lesson-plans/${next}`, {
        topic: newWeek.topic.trim(), subtopics: String(newWeek.subtopics || '').split(',').map((x: string) => x.trim()).filter(Boolean),
        courseOutcome: newWeek.courseOutcome || 'CO1', plannedDate: newWeek.plannedDate, status: 'pending'
      });
      setNewWeek(null);
      await loadCourseData(selectedSemester);
      loadPlanStatus();
      toast({ title: `Week ${next} added` });
    } catch (error: any) {
      toast({ title: 'Could not add the week', description: error?.message, variant: 'destructive' });
    }
  };
  const submitPlan = async () => {
    if (!course?.id) return;
    try {
      await postApi(`/faculty/courses/${course.id}/lesson-plan/submit`, {});
      toast({ title: 'Lesson plan submitted', description: 'Your HOD reviews it, then the Dean.' });
      loadPlanStatus();
    } catch (error: any) {
      toast({ title: 'Could not submit', description: error?.message, variant: 'destructive' });
    }
  };

  const beginLessonEdit = (lesson: any) => {
    setEditingLessonId(lesson.id);
    setLessonPlanForm({
      topic: lesson.topic || '',
      subtopics: Array.isArray(lesson.subtopics) ? lesson.subtopics.join(', ') : '',
      courseOutcome: lesson.courseOutcome || '',
      plannedDate: toInputDate(lesson.plannedDate),
      status: lesson.status || 'pending'
    });
  };

  const saveLessonPlan = async (lesson: any) => {
    if (!course?.id || !lessonPlanForm) return;
    try {
      setIsSavingLessonPlan(true);
      const updated = await putApi(`/faculty/courses/${course.id}/lesson-plans/${lesson.weekNumber}`, {
        topic: lessonPlanForm.topic,
        subtopics: String(lessonPlanForm.subtopics || '').split(',').map((item) => item.trim()).filter(Boolean),
        courseOutcome: lessonPlanForm.courseOutcome,
        plannedDate: lessonPlanForm.plannedDate,
        status: lessonPlanForm.status
      });
      setLessonPlans((prev: any[]) => prev.map((item) => (item.id === lesson.id ? { ...item, ...updated } : item)));
      setEditingLessonId(null);
      setLessonPlanForm(null);
      toast({ title: 'Lesson updated', description: `Week ${lesson.weekNumber} plan saved.` });
    } catch (error: any) {
      toast({ title: 'Update failed', description: error?.message || 'Unable to update lesson plan.', variant: 'destructive' });
    } finally {
      setIsSavingLessonPlan(false);
    }
  };

  if (course) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedCourse(null)}>← Back to Courses</Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{course.code} – {course.name}</h1>
              <p className="text-muted-foreground">{course.program} Sem {course.semester} Sec {course.section} • {course.credits} Credits</p>
            </div>
            <Select value={selectedSemester || 'all'} onValueChange={(value) => setSelectedSemester(value === 'all' ? '' : value)}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Semester" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Semesters</SelectItem>
                {semesterOptions.map((semester) => (
                  <SelectItem key={semester} value={String(semester)}>Semester {semester}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              {/* Was "Edit Class Details", letting a teacher rewrite the course code,
                  credits, semester and timetable. Those are the HOD's to set
                  (Workload & Timetable); a faculty member sees them here. */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline"><Eye className="mr-1 h-4 w-4" />Class Details</Button>
                </DialogTrigger>
                <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
                  <DialogHeader><DialogTitle>{course.code} – {course.name}</DialogTitle></DialogHeader>
                  <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    {([
                      ['Course code', course.code], ['Credits', course.credits], ['Semester', course.semester],
                      ['Class', course.className], ['Section', course.section], ['Batch', course.batch || '—'],
                      ['Department', course.department || '—'], ['Students', course.totalStudents]
                    ] as Array<[string, unknown]>).map(([label, value]) => (
                      <div key={label} className="flex justify-between border-b border-border py-1.5">
                        <span className="text-muted-foreground">{label}</span><span className="font-medium text-foreground">{String(value ?? '—')}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2">
                    <p className="mb-1 text-sm font-medium">Weekly timetable</p>
                    {(course.schedule || []).length === 0 && <p className="text-sm text-muted-foreground">No timetable slots set.</p>}
                    {(course.schedule || []).map((slot: any, index: number) => (
                      <div key={`${slot.day}-${slot.startTime}-${index}`} className="flex justify-between border-b border-border py-1.5 text-sm last:border-0">
                        <span>{slot.day} {slot.startTime}–{slot.endTime}</span><span className="text-muted-foreground">{slot.room} · {slot.type}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Changes to the course or timetable are made by the Head of Department.</p>
                </DialogContent>
              </Dialog>
              <Link to="/faculty/attendance"><Button size="sm"><CheckCircle2 className="mr-1 h-4 w-4" />Take Attendance</Button></Link>
              <Link to="/faculty/assignments"><Button size="sm" variant="outline"><FileText className="mr-1 h-4 w-4" />Assignments</Button></Link>
              <Link to="/faculty/marks"><Button size="sm" variant="outline"><BarChart3 className="mr-1 h-4 w-4" />Gradebook</Button></Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            {[
              { label: 'Students', value: course.totalStudents, icon: Users },
              { label: 'Avg. Attendance', value: pct(course.averageAttendance), icon: CheckCircle2 },
              { label: 'Syllabus Done', value: pct(course.syllabusCompletion), icon: BookOpen },
              { label: 'Avg. Score', value: pct(course.averageScore), icon: BarChart3 },
            ].map(s => (
              <Card key={s.label} className="border-border">
                <CardContent className="flex items-center gap-3 p-4">
                  <s.icon className="h-6 w-6 text-primary" />
                  <div>
                    <p className="text-xl font-bold text-foreground">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="schedule" className="space-y-4">
            <TabsList>
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
              <TabsTrigger value="lesson">Lesson Plan</TabsTrigger>
              <TabsTrigger value="materials">Materials</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="schedule">
              <Card className="border-border">
                <CardContent className="p-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Day</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Room</TableHead>
                        <TableHead>Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {course.schedule.map((s, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{s.day}</TableCell>
                          <TableCell>{s.startTime} – {s.endTime}</TableCell>
                          <TableCell>{s.room}</TableCell>
                          <TableCell><Badge variant="outline" className="capitalize">{s.type}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="lesson">
              <Card className="border-border">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-lg">Lesson Plan & Syllabus Coverage</CardTitle>
                  <div className="flex items-center gap-2">
                    {(() => { const st = planStatus[course.id]?.status ?? 'draft'; return <Badge variant={st === 'approved' ? 'default' : st === 'returned' ? 'destructive' : 'secondary'} className="capitalize">{st === 'submitted' ? 'Awaiting approval' : st}</Badge>; })()}
                    <Button size="sm" variant="outline" onClick={() => setNewWeek({ topic: '', subtopics: '', courseOutcome: 'CO1', plannedDate: '' })}><Upload className="mr-1 h-4 w-4" />Add week</Button>
                    {!['submitted', 'approved'].includes(planStatus[course.id]?.status) && <Button size="sm" onClick={submitPlan} disabled={courseLessons.length < 4}>Submit for approval</Button>}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Syllabus Completion</span>
                      <span className="font-medium text-foreground">{pct(course.syllabusCompletion)}</span>
                    </div>
                    <Progress value={course.syllabusCompletion ?? 0} className="mt-1 h-2" />
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Week</TableHead>
                        <TableHead>Topic</TableHead>
                        <TableHead>CO</TableHead>
                        <TableHead>Planned</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {courseLessons.map((lp) => (
                        <TableRow key={lp.id}>
                          <TableCell>{lp.weekNumber}</TableCell>
                          <TableCell>
                            {editingLessonId === lp.id ? (
                              <div className="space-y-2">
                                <Input value={lessonPlanForm?.topic || ''} onChange={(event) => setLessonPlanForm((prev: any) => ({ ...prev, topic: event.target.value }))} />
                                <Input value={lessonPlanForm?.subtopics || ''} onChange={(event) => setLessonPlanForm((prev: any) => ({ ...prev, subtopics: event.target.value }))} placeholder="Subtopics comma separated" />
                              </div>
                            ) : (
                              <>
                                <p className="font-medium">{lp.topic}</p>
                                <p className="text-xs text-muted-foreground">{lp.subtopics.join(', ')}</p>
                              </>
                            )}
                          </TableCell>
                          <TableCell>
                            {editingLessonId === lp.id ? (
                              <Input value={lessonPlanForm?.courseOutcome || ''} onChange={(event) => setLessonPlanForm((prev: any) => ({ ...prev, courseOutcome: event.target.value }))} />
                            ) : (
                              <Badge variant="outline" className="text-[10px]">{lp.courseOutcome}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {editingLessonId === lp.id ? (
                              <Input type="date" value={lessonPlanForm?.plannedDate || ''} onChange={(event) => setLessonPlanForm((prev: any) => ({ ...prev, plannedDate: event.target.value }))} />
                            ) : (
                              lp.plannedDate
                            )}
                          </TableCell>
                          <TableCell>
                            {editingLessonId === lp.id ? (
                              <Select value={lessonPlanForm?.status || 'pending'} onValueChange={(value) => setLessonPlanForm((prev: any) => ({ ...prev, status: value }))}>
                                <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">pending</SelectItem>
                                  <SelectItem value="completed">completed</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant={lp.status === 'completed' ? 'default' : 'secondary'} className="capitalize">
                                {lp.status}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {editingLessonId === lp.id ? (
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" onClick={() => { setEditingLessonId(null); setLessonPlanForm(null); }}>Cancel</Button>
                                <Button size="sm" onClick={() => saveLessonPlan(lp)} disabled={isSavingLessonPlan}>{isSavingLessonPlan ? 'Saving...' : 'Save'}</Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => beginLessonEdit(lp)}>Edit</Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="materials">
              <Card className="border-border">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-lg">Course Materials</CardTitle>
                  <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm"><Upload className="mr-1 h-4 w-4" />Upload Material</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Upload material — {course.code}</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label htmlFor="material-file">File</Label>
                          <Input id="material-file" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.txt,.png,.jpg,.jpeg" onChange={(e) => setMaterialFile(e.target.files?.[0] ?? null)} />
                          <p className="text-xs text-muted-foreground">Slides, notes, question banks — PDF, Office documents, images or ZIP, up to 25 MB.</p>
                        </div>
                        <Button className="w-full" onClick={uploadMaterial} disabled={!materialFile || uploadingMaterial}>{uploadingMaterial ? 'Uploading…' : 'Upload'}</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {courseMaterials.map((mat) => (
                      <div key={mat.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium text-foreground">{mat.name}</p>
                            <p className="text-xs text-muted-foreground">{(mat.sizeBytes / 1024).toFixed(0)} KB • uploaded {new Date(mat.uploadedAt).toLocaleDateString('en-IN')}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => downloadUpload(mat.url, mat.name).catch((error) => toast({ title: 'Download failed', description: error?.message, variant: 'destructive' }))}>Download</Button>
                      </div>
                    ))}
                    {courseMaterials.length === 0 && <p className="text-sm text-muted-foreground">No materials available for this course yet.</p>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics">
              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="border-border">
                  <CardHeader><CardTitle className="text-lg">Attendance Trend</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {attendanceTrend.map((entry) => (
                        <div key={entry.label} className="flex items-center gap-3">
                          <span className="w-16 text-xs text-muted-foreground">{entry.label}</span>
                          <Progress value={entry.value} className="h-2 flex-1" />
                          <span className="w-10 text-right text-xs font-medium">{entry.value}%</span>
                        </div>
                      ))}
                      {attendanceTrend.length === 0 && <p className="text-sm text-muted-foreground">No attendance trend available yet.</p>}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border">
                  <CardHeader><CardTitle className="text-lg">Grade Distribution</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {gradeDistribution.map((g) => (
                        <div key={g.grade} className="flex items-center gap-3">
                          <span className="w-24 text-xs text-muted-foreground">{g.grade}</span>
                          <Progress value={g.pct} className="h-2 flex-1" />
                          <span className="w-16 text-right text-xs font-medium">{g.count} ({g.pct}%)</span>
                        </div>
                      ))}
                      {gradeDistribution.length === 0 && <p className="text-sm text-muted-foreground">No grade distribution available yet.</p>}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
          <Dialog open={!!newWeek} onOpenChange={(o) => { if (!o) setNewWeek(null); }}>
            <DialogContent>
              <DialogHeader><DialogTitle>Add a week to the lesson plan</DialogTitle></DialogHeader>
              {newWeek && <div className="grid gap-3">
                <Input placeholder="Topic" value={newWeek.topic} onChange={(e) => setNewWeek({ ...newWeek, topic: e.target.value })} />
                <Input placeholder="Subtopics, comma separated" value={newWeek.subtopics} onChange={(e) => setNewWeek({ ...newWeek, subtopics: e.target.value })} />
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Course outcome (CO1)" value={newWeek.courseOutcome} onChange={(e) => setNewWeek({ ...newWeek, courseOutcome: e.target.value })} />
                  <Input type="date" value={newWeek.plannedDate} onChange={(e) => setNewWeek({ ...newWeek, plannedDate: e.target.value })} />
                </div>
              </div>}
              <DialogFooter><Button variant="outline" onClick={() => setNewWeek(null)}>Cancel</Button><Button onClick={addWeek} disabled={!newWeek?.topic?.trim() || !newWeek?.plannedDate}>Add</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">My Courses & Classes</h1>
          <Select value={selectedSemester || 'all'} onValueChange={(value) => setSelectedSemester(value === 'all' ? '' : value)}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Semester" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Semesters</SelectItem>
              {semesterOptions.map((semester) => (
                <SelectItem key={semester} value={String(semester)}>Semester {semester}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {facultyCourses.map((c) => (
            <Card key={c.id} className="cursor-pointer border-border transition-shadow hover:shadow-md" onClick={() => setSelectedCourse(c.id)}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge className="text-xs">{c.code}</Badge>
                  <Badge variant="outline">{c.credits} Credits</Badge>
                </div>
                <CardTitle className="text-lg">{c.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{c.program} • Sem {c.semester} • Sec {c.section}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-foreground">{c.totalStudents}</p>
                    <p className="text-[10px] text-muted-foreground">Students</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground">{pct(c.averageAttendance)}</p>
                    <p className="text-[10px] text-muted-foreground">Attendance</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground">{pct(c.averageScore)}</p>
                    <p className="text-[10px] text-muted-foreground">Avg Score</p>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Syllabus</span>
                    <span className="font-medium">{pct(c.syllabusCompletion)}</span>
                  </div>
                  <Progress value={c.syllabusCompletion ?? 0} className="mt-1 h-1.5" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {c.schedule.length} sessions/week
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

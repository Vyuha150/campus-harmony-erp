import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  BookOpen, Users, Clock, MapPin, BarChart3, ChevronRight,
  CheckCircle2, FileText, Upload, PieChart, Pencil
} from 'lucide-react';
import { fetchApi, putApi } from '@/lib/apiService';
import { Link } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export default function FacultyCourses() {
  const [facultyCourses, setFacultyCourses] = useState<any>([]);
  const [lessonPlans, setLessonPlans] = useState<any>([]);
  const [semesterOptions, setSemesterOptions] = useState<number[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [courseMarks, setCourseMarks] = useState<any[]>([]);
  const [_apiLoading, _setApiLoading] = useState(true);
  const [isSavingCourseDetails, setIsSavingCourseDetails] = useState(false);
  const [isSavingLessonPlan, setIsSavingLessonPlan] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [courseDetailForm, setCourseDetailForm] = useState<any>(null);
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
  const courseMaterials = courseLessons.map((lp: any) => ({
    name: `${lp.topic}.pdf`,
    type: 'Lesson Note',
    date: lp.plannedDate,
  }));

  useEffect(() => {
    if (selectedCourse && !facultyCourses.some((item: any) => item.id === selectedCourse)) {
      setSelectedCourse(null);
    }
  }, [facultyCourses, selectedCourse]);

  useEffect(() => {
    if (!course) {
      setCourseDetailForm(null);
      return;
    }
    setCourseDetailForm({
      code: course.code || '',
      name: course.name || '',
      credits: Number(course.credits || 0),
      semester: Number(course.semester || 1),
      className: course.className || `${course.code} Section ${course.section || 'A'}`,
      section: course.section || 'A',
      batch: course.batch || '',
      schedule: Array.isArray(course.schedule) ? course.schedule.map((item: any) => ({
        day: item.day || '',
        startTime: item.startTime || '',
        endTime: item.endTime || '',
        room: item.room || '',
        type: item.type || 'lecture'
      })) : []
    });
  }, [course?.id]);

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

  const updateScheduleField = (index: number, key: string, value: string) => {
    setCourseDetailForm((prev: any) => {
      if (!prev) return prev;
      const nextSchedule = [...(prev.schedule || [])];
      nextSchedule[index] = { ...(nextSchedule[index] || {}), [key]: value };
      return { ...prev, schedule: nextSchedule };
    });
  };

  const addScheduleRow = () => {
    setCourseDetailForm((prev: any) => ({
      ...(prev || {}),
      schedule: [...(prev?.schedule || []), { day: 'Monday', startTime: '09:00', endTime: '10:00', room: '', type: 'lecture' }]
    }));
  };

  const removeScheduleRow = (index: number) => {
    setCourseDetailForm((prev: any) => ({
      ...(prev || {}),
      schedule: (prev?.schedule || []).filter((_: any, i: number) => i !== index)
    }));
  };

  const saveCourseDetails = async () => {
    if (!course?.id || !courseDetailForm) return;

    try {
      setIsSavingCourseDetails(true);
      const updated = await putApi(`/faculty/courses/${course.id}/details`, courseDetailForm);
      setFacultyCourses((prev: any[]) => prev.map((item) => (
        item.id === course.id
          ? {
              ...item,
              ...updated,
              averageAttendance: item.averageAttendance,
              syllabusCompletion: item.syllabusCompletion,
              averageScore: item.averageScore
            }
          : item
      )));
      toast({ title: 'Saved', description: 'Class details updated successfully.' });
    } catch (error: any) {
      toast({ title: 'Save failed', description: error?.message || 'Unable to update class details.', variant: 'destructive' });
    } finally {
      setIsSavingCourseDetails(false);
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
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline"><Pencil className="mr-1 h-4 w-4" />Edit Class Details</Button>
                </DialogTrigger>
                <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-3xl">
                  <DialogHeader><DialogTitle>Edit Course and Class Details</DialogTitle></DialogHeader>
                  {courseDetailForm && (
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div><Label>Course Code</Label><Input value={courseDetailForm.code} onChange={(event) => setCourseDetailForm((prev: any) => ({ ...prev, code: event.target.value }))} /></div>
                        <div><Label>Course Name</Label><Input value={courseDetailForm.name} onChange={(event) => setCourseDetailForm((prev: any) => ({ ...prev, name: event.target.value }))} /></div>
                        <div><Label>Credits</Label><Input type="number" value={courseDetailForm.credits} onChange={(event) => setCourseDetailForm((prev: any) => ({ ...prev, credits: Number(event.target.value) }))} /></div>
                        <div><Label>Semester</Label><Input type="number" value={courseDetailForm.semester} onChange={(event) => setCourseDetailForm((prev: any) => ({ ...prev, semester: Number(event.target.value) }))} /></div>
                        <div><Label>Class Name</Label><Input value={courseDetailForm.className} onChange={(event) => setCourseDetailForm((prev: any) => ({ ...prev, className: event.target.value }))} /></div>
                        <div><Label>Section</Label><Input value={courseDetailForm.section} onChange={(event) => setCourseDetailForm((prev: any) => ({ ...prev, section: event.target.value }))} /></div>
                        <div><Label>Batch</Label><Input value={courseDetailForm.batch} onChange={(event) => setCourseDetailForm((prev: any) => ({ ...prev, batch: event.target.value }))} /></div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Class Schedule</Label>
                          <Button type="button" variant="outline" size="sm" onClick={addScheduleRow}>Add Session</Button>
                        </div>
                        {(courseDetailForm.schedule || []).map((slot: any, index: number) => (
                          <div key={`${slot.day}-${index}`} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-6">
                            <Input value={slot.day} onChange={(event) => updateScheduleField(index, 'day', event.target.value)} placeholder="Day" />
                            <Input value={slot.startTime} onChange={(event) => updateScheduleField(index, 'startTime', event.target.value)} placeholder="Start" />
                            <Input value={slot.endTime} onChange={(event) => updateScheduleField(index, 'endTime', event.target.value)} placeholder="End" />
                            <Input value={slot.room} onChange={(event) => updateScheduleField(index, 'room', event.target.value)} placeholder="Room" />
                            <Input value={slot.type} onChange={(event) => updateScheduleField(index, 'type', event.target.value)} placeholder="Type" />
                            <Button type="button" variant="outline" className="text-destructive" onClick={() => removeScheduleRow(index)}>Remove</Button>
                          </div>
                        ))}
                      </div>

                      <Button onClick={saveCourseDetails} disabled={isSavingCourseDetails} className="w-full">
                        {isSavingCourseDetails ? 'Saving...' : 'Save Class Details'}
                      </Button>
                    </div>
                  )}
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
              { label: 'Avg. Attendance', value: `${course.averageAttendance}%`, icon: CheckCircle2 },
              { label: 'Syllabus Done', value: `${course.syllabusCompletion}%`, icon: BookOpen },
              { label: 'Avg. Score', value: `${course.averageScore}%`, icon: BarChart3 },
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
                  <Button size="sm" variant="outline"><Upload className="mr-1 h-4 w-4" />Upload Plan</Button>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Syllabus Completion</span>
                      <span className="font-medium text-foreground">{course.syllabusCompletion}%</span>
                    </div>
                    <Progress value={course.syllabusCompletion} className="mt-1 h-2" />
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
                  <Button size="sm"><Upload className="mr-1 h-4 w-4" />Upload Material</Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {courseMaterials.map((mat) => (
                      <div key={mat.name} className="flex items-center justify-between rounded-lg border border-border p-3">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium text-foreground">{mat.name}</p>
                            <p className="text-xs text-muted-foreground">{mat.type} • {mat.date}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">Download</Button>
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
                    <p className="text-lg font-bold text-foreground">{c.averageAttendance}%</p>
                    <p className="text-[10px] text-muted-foreground">Attendance</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground">{c.averageScore}%</p>
                    <p className="text-[10px] text-muted-foreground">Avg Score</p>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Syllabus</span>
                    <span className="font-medium">{c.syllabusCompletion}%</span>
                  </div>
                  <Progress value={c.syllabusCompletion} className="mt-1 h-1.5" />
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

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BookOpen, Users, Clock, MapPin, BarChart3, ChevronRight,
  CheckCircle2, FileText, Upload, PieChart
} from 'lucide-react';
import { facultyCourses, lessonPlans } from '@/data/facultyMockData';
import { Link } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function FacultyCourses() {
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const course = selectedCourse ? facultyCourses.find(c => c.id === selectedCourse) : null;
  const courseLessons = lessonPlans; // In real app, filter by course

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
            <div className="flex gap-2">
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {courseLessons.map((lp) => (
                        <TableRow key={lp.id}>
                          <TableCell>{lp.weekNumber}</TableCell>
                          <TableCell>
                            <p className="font-medium">{lp.topic}</p>
                            <p className="text-xs text-muted-foreground">{lp.subtopics.join(', ')}</p>
                          </TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{lp.courseOutcome}</Badge></TableCell>
                          <TableCell className="text-sm">{lp.plannedDate}</TableCell>
                          <TableCell>
                            <Badge variant={lp.status === 'completed' ? 'default' : 'secondary'} className="capitalize">
                              {lp.status}
                            </Badge>
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
                    {[
                      { name: 'Unit 1 – Introduction to DS.pdf', type: 'Lecture Notes', date: 'Jan 15, 2026' },
                      { name: 'Linked List Tutorial.pdf', type: 'Tutorial Sheet', date: 'Jan 22, 2026' },
                      { name: 'Assignment 1 – Arrays.pdf', type: 'Assignment', date: 'Jan 29, 2026' },
                      { name: 'Mid-Sem Reference Material.zip', type: 'Reference', date: 'Feb 10, 2026' },
                    ].map((mat) => (
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
                      {['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'].map((w, i) => {
                        const val = [92, 88, 85, 80, 78, 82][i];
                        return (
                          <div key={w} className="flex items-center gap-3">
                            <span className="w-16 text-xs text-muted-foreground">{w}</span>
                            <Progress value={val} className="h-2 flex-1" />
                            <span className="w-10 text-right text-xs font-medium">{val}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border">
                  <CardHeader><CardTitle className="text-lg">Grade Distribution</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {[
                        { grade: 'A+ (90-100)', count: 8, pct: 12 },
                        { grade: 'A (80-89)', count: 15, pct: 23 },
                        { grade: 'B+ (70-79)', count: 20, pct: 31 },
                        { grade: 'B (60-69)', count: 12, pct: 18 },
                        { grade: 'C (50-59)', count: 7, pct: 11 },
                        { grade: 'F (<50)', count: 3, pct: 5 },
                      ].map((g) => (
                        <div key={g.grade} className="flex items-center gap-3">
                          <span className="w-24 text-xs text-muted-foreground">{g.grade}</span>
                          <Progress value={g.pct} className="h-2 flex-1" />
                          <span className="w-16 text-right text-xs font-medium">{g.count} ({g.pct}%)</span>
                        </div>
                      ))}
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
        <h1 className="text-2xl font-bold text-foreground">My Courses & Classes</h1>
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

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Calendar, Clock, BookOpen, Users, AlertTriangle, Shuffle, Plus
} from 'lucide-react';
import { courseAssignments, departmentTimetable, departmentFaculty } from '@/data/hodMockData';
import { useToast } from '@/hooks/use-toast';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const timeSlots = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00'];

export default function HODWorkload() {
  const { toast } = useToast();

  const totalCredits = courseAssignments.reduce((sum, c) => sum + c.credits, 0);
  const totalStudents = courseAssignments.reduce((sum, c) => sum + c.students, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Workload & Timetable</h1>
            <p className="text-muted-foreground">Manage course assignments and department timetable</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => toast({ title: 'Conflict Check', description: 'No timetable conflicts found.' })}>
              <AlertTriangle className="mr-1 h-4 w-4" />Check Conflicts
            </Button>
            <Button size="sm" onClick={() => toast({ title: 'Course Assigned' })}>
              <Plus className="mr-1 h-4 w-4" />Assign Course
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: 'Courses Offered', value: courseAssignments.length, icon: BookOpen },
            { label: 'Total Credits', value: totalCredits, icon: Clock },
            { label: 'Faculty Assigned', value: new Set(courseAssignments.map(c => c.facultyId)).size, icon: Users },
            { label: 'Students Enrolled', value: totalStudents, icon: Users },
          ].map(s => (
            <Card key={s.label} className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <s.icon className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="assignments">
          <TabsList>
            <TabsTrigger value="assignments">Course Assignments</TabsTrigger>
            <TabsTrigger value="timetable">Timetable Grid</TabsTrigger>
            <TabsTrigger value="workload">Faculty Workload</TabsTrigger>
          </TabsList>

          <TabsContent value="assignments" className="mt-4">
            <Card className="border-border">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Faculty</TableHead>
                      <TableHead className="text-center">Credits</TableHead>
                      <TableHead className="text-center">Sem</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead className="text-center">Students</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {courseAssignments.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono font-medium">{c.courseCode}</TableCell>
                        <TableCell className="font-medium text-foreground">{c.courseName}</TableCell>
                        <TableCell className="text-sm">{c.assignedFaculty}</TableCell>
                        <TableCell className="text-center">{c.credits}</TableCell>
                        <TableCell className="text-center">{c.semester}</TableCell>
                        <TableCell>{c.section}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.schedule}</TableCell>
                        <TableCell className="text-center">{c.students}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-[10px]">{c.type}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timetable" className="mt-4">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Department Timetable – Current Semester</CardTitle>
                  <Select defaultValue="all">
                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sections</SelectItem>
                      <SelectItem value="a">Section A</SelectItem>
                      <SelectItem value="b">Section B</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Time</TableHead>
                      {days.map(d => <TableHead key={d} className="text-center">{d}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timeSlots.map(time => (
                      <TableRow key={time}>
                        <TableCell className="font-mono text-sm font-medium">{time}</TableCell>
                        {days.map(day => {
                          const slot = departmentTimetable.find(
                            t => t.day === day && t.startTime === time
                          );
                          return (
                            <TableCell key={day} className="text-center p-1">
                              {slot ? (
                                <div className={`rounded-lg p-2 text-xs ${
                                  slot.type === 'lab' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                                  'bg-primary/10 text-primary'
                                }`}>
                                  <p className="font-semibold">{slot.courseCode}</p>
                                  <p className="text-[10px]">{slot.faculty.split(' ').pop()}</p>
                                  <p className="text-[10px] text-muted-foreground">{slot.room}</p>
                                </div>
                              ) : (
                                <span className="text-muted-foreground/30">—</span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workload" className="mt-4">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Faculty Workload Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Faculty</TableHead>
                      <TableHead>Designation</TableHead>
                      <TableHead className="text-center">Courses</TableHead>
                      <TableHead className="text-center">Hours/Week</TableHead>
                      <TableHead className="text-center">Total Students</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departmentFaculty.map(f => {
                      const courses = courseAssignments.filter(c => c.facultyId === f.id);
                      const students = courses.reduce((s, c) => s + c.students, 0);
                      const overloaded = f.weeklyHours > 18;
                      return (
                        <TableRow key={f.id}>
                          <TableCell className="font-medium">{f.name}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{f.designation}</Badge></TableCell>
                          <TableCell className="text-center">{f.coursesAssigned}</TableCell>
                          <TableCell className="text-center">
                            <span className={overloaded ? 'text-destructive font-bold' : ''}>{f.weeklyHours}h</span>
                          </TableCell>
                          <TableCell className="text-center">{students}</TableCell>
                          <TableCell>
                            {f.isOnLeave ? (
                              <Badge variant="destructive" className="text-[10px]">On Leave</Badge>
                            ) : overloaded ? (
                              <Badge variant="secondary" className="text-[10px]">Overloaded</Badge>
                            ) : (
                              <Badge variant="default" className="text-[10px]">Normal</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

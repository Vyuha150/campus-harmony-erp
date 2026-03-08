import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Calendar, Clock, BookOpen, Users, AlertTriangle, Plus, Shuffle, Download, CheckCircle
} from 'lucide-react';
import { courseAssignments as initialAssignments, departmentTimetable, departmentFaculty } from '@/data/hodMockData';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { CourseAssignment } from '@/types/hod';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const timeSlots = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00'];

export default function HODWorkload() {
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<CourseAssignment[]>(initialAssignments);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showSubDialog, setShowSubDialog] = useState(false);
  const [sectionFilter, setSectionFilter] = useState('all');
  const [newCourse, setNewCourse] = useState({ courseCode: '', courseName: '', credits: '3', semester: '5', section: 'A', faculty: '', type: 'theory' });

  const totalCredits = assignments.reduce((sum, c) => sum + c.credits, 0);
  const totalStudents = assignments.reduce((sum, c) => sum + c.students, 0);
  const onLeaveFaculty = departmentFaculty.filter(f => f.isOnLeave);
  const freeFaculty = departmentFaculty.filter(f => !f.isOnLeave && f.weeklyHours < 16);

  const handleAssignCourse = () => {
    const fac = departmentFaculty.find(f => f.id === newCourse.faculty);
    if (!fac || !newCourse.courseCode || !newCourse.courseName) {
      toast({ title: 'Missing Fields', description: 'Please fill all required fields', variant: 'destructive' });
      return;
    }
    const newItem: CourseAssignment = {
      id: `ca-${Date.now()}`,
      courseCode: newCourse.courseCode,
      courseName: newCourse.courseName,
      credits: parseInt(newCourse.credits),
      semester: parseInt(newCourse.semester),
      section: newCourse.section,
      assignedFaculty: fac.name,
      facultyId: fac.id,
      schedule: 'TBD',
      students: 0,
      type: newCourse.type as 'theory' | 'lab' | 'tutorial',
    };
    setAssignments(prev => [...prev, newItem]);
    toast({ title: 'Course Assigned', description: `${newCourse.courseCode} assigned to ${fac.name}` });
    setShowAssignDialog(false);
    setNewCourse({ courseCode: '', courseName: '', credits: '3', semester: '5', section: 'A', faculty: '', type: 'theory' });
  };

  const handleCheckConflicts = () => {
    // Simulate conflict check
    const conflicts: string[] = [];
    const slotMap = new Map<string, string>();
    departmentTimetable.forEach(s => {
      const key = `${s.day}-${s.startTime}-${s.faculty}`;
      if (slotMap.has(key)) {
        conflicts.push(`${s.faculty}: ${slotMap.get(key)} & ${s.courseCode} on ${s.day} ${s.startTime}`);
      } else {
        slotMap.set(key, s.courseCode);
      }
    });
    if (conflicts.length === 0) {
      toast({ title: '✅ No Conflicts Found', description: 'All timetable slots are conflict-free.' });
    } else {
      toast({ title: '⚠️ Conflicts Detected', description: conflicts.join('; '), variant: 'destructive' });
    }
  };

  const handleSubstitution = (absentFac: string) => {
    if (freeFaculty.length > 0) {
      const sub = freeFaculty[0];
      toast({ title: '✅ Substitution Arranged', description: `${sub.name} will substitute for ${absentFac} today.` });
      setShowSubDialog(false);
    } else {
      toast({ title: 'No Free Faculty', description: 'All faculty are currently occupied.', variant: 'destructive' });
    }
  };

  const handleRemoveAssignment = (id: string) => {
    setAssignments(prev => prev.filter(a => a.id !== id));
    toast({ title: 'Assignment Removed' });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Workload & Timetable</h1>
            <p className="text-muted-foreground">Manage course assignments and department timetable</p>
          </div>
          <div className="flex gap-2">
            {onLeaveFaculty.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setShowSubDialog(true)}>
                <Shuffle className="mr-1 h-4 w-4" />Arrange Substitution ({onLeaveFaculty.length})
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleCheckConflicts}>
              <AlertTriangle className="mr-1 h-4 w-4" />Check Conflicts
            </Button>
            <Button size="sm" onClick={() => setShowAssignDialog(true)}>
              <Plus className="mr-1 h-4 w-4" />Assign Course
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: 'Courses Offered', value: assignments.length, icon: BookOpen },
            { label: 'Total Credits', value: totalCredits, icon: Clock },
            { label: 'Faculty Assigned', value: new Set(assignments.map(c => c.facultyId)).size, icon: Users },
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
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map(c => (
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
                        <TableCell>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => handleRemoveAssignment(c.id)}>
                            Remove
                          </Button>
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
                  <div className="flex gap-2">
                    <Select value={sectionFilter} onValueChange={setSectionFilter}>
                      <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sections</SelectItem>
                        <SelectItem value="a">Section A</SelectItem>
                        <SelectItem value="b">Section B</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={() => toast({ title: 'Timetable Exported', description: 'PDF downloaded successfully' })}>
                      <Download className="mr-1 h-4 w-4" />Export
                    </Button>
                  </div>
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
                                <div className={`rounded-lg p-2 text-xs cursor-pointer hover:ring-2 hover:ring-primary/50 ${
                                  slot.type === 'lab' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                                  'bg-primary/10 text-primary'
                                }`} onClick={() => toast({ title: slot.courseCode, description: `${slot.courseName} • ${slot.faculty} • ${slot.room} • ${slot.section}` })}>
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
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departmentFaculty.map(f => {
                      const courses = assignments.filter(c => c.facultyId === f.id);
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
                          <TableCell>
                            {f.isOnLeave && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setShowSubDialog(true); }}>
                                <Shuffle className="mr-1 h-3 w-3" />Substitute
                              </Button>
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

      {/* Assign Course Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign New Course</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Course Code</Label>
                <Input placeholder="CS801" value={newCourse.courseCode} onChange={e => setNewCourse(p => ({ ...p, courseCode: e.target.value }))} />
              </div>
              <div>
                <Label>Course Name</Label>
                <Input placeholder="Course title..." value={newCourse.courseName} onChange={e => setNewCourse(p => ({ ...p, courseName: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Credits</Label>
                <Select value={newCourse.credits} onValueChange={v => setNewCourse(p => ({ ...p, credits: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['1','2','3','4'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Semester</Label>
                <Select value={newCourse.semester} onValueChange={v => setNewCourse(p => ({ ...p, semester: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['1','2','3','4','5','6','7','8'].map(s => <SelectItem key={s} value={s}>Sem {s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type</Label>
                <Select value={newCourse.type} onValueChange={v => setNewCourse(p => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="theory">Theory</SelectItem>
                    <SelectItem value="lab">Lab</SelectItem>
                    <SelectItem value="tutorial">Tutorial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Assign Faculty</Label>
              <Select value={newCourse.faculty} onValueChange={v => setNewCourse(p => ({ ...p, faculty: v }))}>
                <SelectTrigger><SelectValue placeholder="Select faculty..." /></SelectTrigger>
                <SelectContent>
                  {departmentFaculty.filter(f => !f.isOnLeave).map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.name} ({f.weeklyHours}h/wk)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAssignDialog(false)}>Cancel</Button>
              <Button onClick={handleAssignCourse}>
                <CheckCircle className="mr-1 h-4 w-4" />Assign Course
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Substitution Dialog */}
      <Dialog open={showSubDialog} onOpenChange={setShowSubDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Arrange Faculty Substitution</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Faculty On Leave Today:</p>
              {onLeaveFaculty.map(f => (
                <div key={f.id} className="flex items-center justify-between p-2 border border-border rounded-lg mb-2">
                  <div>
                    <p className="text-sm font-medium">{f.name}</p>
                    <p className="text-xs text-muted-foreground">{f.leaveType} • {f.coursesAssigned} courses</p>
                  </div>
                  <Button size="sm" onClick={() => handleSubstitution(f.name)}>
                    <Shuffle className="mr-1 h-3 w-3" />Assign Sub
                  </Button>
                </div>
              ))}
            </div>
            {freeFaculty.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Available Faculty ({"<"}16h/wk):</p>
                {freeFaculty.map(f => (
                  <div key={f.id} className="flex items-center justify-between p-2 text-sm">
                    <span>{f.name}</span>
                    <Badge variant="outline" className="text-[10px]">{f.weeklyHours}h/wk</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Calendar, Clock, BookOpen, Users, AlertTriangle, Plus, Shuffle, Download, CheckCircle
} from 'lucide-react';
import { deleteApi, fetchApi, postApi, putApi } from '@/lib/apiService';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { CourseAssignment } from '@/types/hod';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const timeSlots = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00'];

export default function HODWorkload() {
  const [courseAssignments, setCourseAssignments] = useState<any[]>([]);
  const [courseOptions, setCourseOptions] = useState<any>({ courses: [], rooms: [] });
  const [departmentTimetable, setDepartmentTimetable] = useState<any>([]);
  const [departmentFaculty, setDepartmentFaculty] = useState<any>([]);
  const [_apiLoading, _setApiLoading] = useState(true);
  useEffect(() => {
    fetchApi('/hod/workload').then(d => setCourseAssignments(d)).catch((error) => { console.error('API request failed', error); });
    fetchApi('/hod/workload/course-options').then(d => setCourseOptions(d || { courses: [], rooms: [] })).catch((error) => { console.error('API request failed', error); });
    fetchApi('/hod/timetable').then(d => setDepartmentTimetable(d)).catch((error) => { console.error('API request failed', error); });
    fetchApi('/hod/faculty').then(d => setDepartmentFaculty(d)).catch((error) => { console.error('API request failed', error); });
    _setApiLoading(false);
  }, []);

  const { toast } = useToast();
  const [assignments, setAssignments] = useState<CourseAssignment[]>([]);
  useEffect(() => {
    setAssignments(courseAssignments);
  }, [courseAssignments]);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showSubDialog, setShowSubDialog] = useState(false);
  const [newCourse, setNewCourse] = useState({ courseId: '', section: '', faculty: '', type: 'theory', studentEmails: '', roomId: '', day: 'Monday', startTime: '09:00', endTime: '10:00' });
  const [editingCourse, setEditingCourse] = useState<any>(null);

  const totalCredits = assignments.reduce((sum, c) => sum + c.credits, 0);
  const totalStudents = assignments.reduce((sum, c) => sum + c.students, 0);
  const onLeaveFaculty = departmentFaculty.filter(f => f.isOnLeave);
  const freeFaculty = departmentFaculty.filter(f => !f.isOnLeave && f.weeklyHours < 16);

  const handleAssignCourse = async () => {
    const fac = departmentFaculty.find(f => f.id === newCourse.faculty);
    const selectedCourse = (courseOptions.courses || []).find((course: any) => course.id === newCourse.courseId);
    if (!fac || !selectedCourse || !newCourse.section || !newCourse.roomId || !newCourse.day || !newCourse.startTime || !newCourse.endTime) {
      toast({ title: 'Missing Fields', description: 'Please fill all required fields', variant: 'destructive' });
      return;
    }
    try {
      const newItem = await postApi<CourseAssignment>('/hod/workload/course', {
        courseId: selectedCourse.id,
        semester: selectedCourse.semester,
        section: newCourse.section,
        facultyId: fac.id,
        type: newCourse.type,
        studentEmails: newCourse.studentEmails,
        roomId: newCourse.roomId,
        day: newCourse.day,
        startTime: newCourse.startTime,
        endTime: newCourse.endTime,
      });
      setAssignments(prev => [...prev, newItem]);
      toast({ title: 'Class Created', description: `${selectedCourse.code} section ${newCourse.section} assigned to ${fac.name}` });
      setShowAssignDialog(false);
      setNewCourse({ courseId: '', section: '', faculty: '', type: 'theory', studentEmails: '', roomId: '', day: 'Monday', startTime: '09:00', endTime: '10:00' });
    } catch (error: any) {
      toast({ title: 'Creation failed', description: error?.message || 'Unable to create class', variant: 'destructive' });
    }
  };

  const handleOpenEdit = (item: any) => {
    setEditingCourse({
      id: item.id,
      courseCode: item.courseCode,
      courseName: item.courseName,
      credits: String(item.credits ?? 0),
      semester: String(item.semester ?? 1),
      section: item.section || 'A',
      faculty: item.facultyId || '',
      type: item.type || 'theory',
      roomId: (courseOptions.rooms || []).find((room: any) => room.name === item.room)?.id || '',
      day: item.day || 'Monday',
      startTime: item.startTime || '09:00',
      endTime: item.endTime || '10:00',
      studentEmails: '',
    });
    setShowEditDialog(true);
  };

  const handleUpdateCourse = async () => {
    if (!editingCourse?.id) return;
    try {
      const updated = await putApi<any>(`/hod/workload/course/${editingCourse.id}`, {
        courseCode: editingCourse.courseCode,
        courseName: editingCourse.courseName,
        credits: Number(editingCourse.credits),
        semester: Number(editingCourse.semester),
        section: editingCourse.section,
        facultyId: editingCourse.faculty,
        type: editingCourse.type,
        studentEmails: editingCourse.studentEmails,
        roomId: editingCourse.roomId,
        day: editingCourse.day,
        startTime: editingCourse.startTime,
        endTime: editingCourse.endTime,
      });
      setAssignments((prev) => prev.map((course) => (course.id === updated.id ? updated : course)));
      setShowEditDialog(false);
      setEditingCourse(null);
      toast({ title: 'Class Updated', description: `${updated.courseCode} updated successfully.` });
    } catch (error: any) {
      toast({ title: 'Update failed', description: error?.message || 'Unable to update class/course details', variant: 'destructive' });
    }
  };

  const handleCheckConflicts = () => {
    postApi<{ conflicts: string[] }>('/hod/workload/check-conflicts', {})
      .then((result) => {
        const conflicts = Array.isArray(result?.conflicts) ? result.conflicts : [];
        if (conflicts.length === 0) {
          toast({ title: '✅ No Conflicts Found', description: 'All timetable slots are conflict-free.' });
        } else {
          toast({ title: '⚠️ Conflicts Detected', description: conflicts.join('; '), variant: 'destructive' });
        }
      })
      .catch((error: any) => {
        toast({ title: 'Action failed', description: error?.message || 'Unable to check timetable conflicts', variant: 'destructive' });
      });
  };

  const handleSubstitution = async (absentFac: string) => {
    if (freeFaculty.length > 0) {
      const sub = freeFaculty[0];
      try {
        await putApi('/hod/workload/assign', {
          absentFaculty: absentFac,
          substituteFacultyId: sub.id,
        });
        toast({ title: '✅ Substitution Arranged', description: `${sub.name} will substitute for ${absentFac} today.` });
        setShowSubDialog(false);
      } catch (error: any) {
        toast({ title: 'Action failed', description: error?.message || 'Unable to arrange substitution', variant: 'destructive' });
      }
    } else {
      toast({ title: 'No Free Faculty', description: 'All faculty are currently occupied.', variant: 'destructive' });
    }
  };

  const handleRemoveAssignment = async (id: string) => {
    try {
      await deleteApi(`/hod/workload/course/${id}`);
      setAssignments(prev => prev.filter(a => a.id !== id));
      toast({ title: 'Assignment Removed' });
    } catch (error: any) {
      toast({ title: 'Delete failed', description: error?.message || 'Unable to remove assignment', variant: 'destructive' });
    }
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
              <Plus className="mr-1 h-4 w-4" />Class Creation
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
                    <Button variant="outline" size="sm" onClick={async () => {
                      try {
                        await postApi('/hod/timetable/export', { format: 'pdf' });
                        toast({ title: 'Timetable Exported', description: 'PDF downloaded successfully' });
                      } catch (error: any) {
                        toast({ title: 'Export failed', description: error?.message || 'Unable to export timetable', variant: 'destructive' });
                      }
                    }}>
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
                                }`} onClick={() => toast({ title: slot.courseCode, description: `${slot.courseName} • ${slot.faculty} • ${slot.room}` })}>
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

      {/* Class Creation Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Class Creation</DialogTitle></DialogHeader>
          <div className="space-y-4">
              <div>
                <Label>Select Existing Course</Label>
                <Select value={newCourse.courseId} onValueChange={v => setNewCourse(p => ({ ...p, courseId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select course..." /></SelectTrigger>
                  <SelectContent>
                    {(courseOptions.courses || []).map((course: any) => (
                      <SelectItem key={course.id} value={course.id}>{course.code} - {course.name} (Sem {course.semester})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Semester</Label>
                <Input value={String((courseOptions.courses || []).find((course: any) => course.id === newCourse.courseId)?.semester || '')} disabled />
              </div>
              <div>
                <Label>Credits</Label>
                <Input value={String((courseOptions.courses || []).find((course: any) => course.id === newCourse.courseId)?.credits || '')} disabled />
              </div>
              <div>
                <Label>Section</Label>
                <Input
                  value={newCourse.section}
                  placeholder="e.g. A"
                  onChange={e => setNewCourse(p => ({ ...p, section: e.target.value.toUpperCase() }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Day</Label>
                <Select value={newCourse.day} onValueChange={v => setNewCourse(p => ({ ...p, day: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {days.map((day) => <SelectItem key={day} value={day}>{day}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Room / Lab</Label>
                <Select value={newCourse.roomId} onValueChange={v => setNewCourse(p => ({ ...p, roomId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select room..." /></SelectTrigger>
                  <SelectContent>
                    {(courseOptions.rooms || []).map((room: any) => (
                      <SelectItem key={room.id} value={room.id}>{room.name} ({room.type})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Time</Label>
                <Input type="time" value={newCourse.startTime} onChange={e => setNewCourse(p => ({ ...p, startTime: e.target.value }))} />
              </div>
              <div>
                <Label>End Time</Label>
                <Input type="time" value={newCourse.endTime} onChange={e => setNewCourse(p => ({ ...p, endTime: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Student Emails (comma or newline separated)</Label>
              <Textarea
                placeholder="student1@college.edu, student2@college.edu"
                value={newCourse.studentEmails}
                onChange={e => setNewCourse(p => ({ ...p, studentEmails: e.target.value }))}
                rows={3}
              />
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
                <CheckCircle className="mr-1 h-4 w-4" />Create Class
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Class Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update Class & Course</DialogTitle></DialogHeader>
          {editingCourse && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Course Code</Label>
                  <Input value={editingCourse.courseCode} onChange={e => setEditingCourse((p: any) => ({ ...p, courseCode: e.target.value }))} />
                </div>
                <div>
                  <Label>Course Name</Label>
                  <Input value={editingCourse.courseName} onChange={e => setEditingCourse((p: any) => ({ ...p, courseName: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <Label>Credits</Label>
                  <Input type="number" value={editingCourse.credits} onChange={e => setEditingCourse((p: any) => ({ ...p, credits: e.target.value }))} />
                </div>
                <div>
                  <Label>Semester</Label>
                  <Input type="number" value={editingCourse.semester} onChange={e => setEditingCourse((p: any) => ({ ...p, semester: e.target.value }))} />
                </div>
                <div>
                  <Label>Section</Label>
                  <Input value={editingCourse.section} onChange={e => setEditingCourse((p: any) => ({ ...p, section: e.target.value.toUpperCase() }))} />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={editingCourse.type} onValueChange={v => setEditingCourse((p: any) => ({ ...p, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="theory">Theory</SelectItem>
                      <SelectItem value="lab">Lab</SelectItem>
                      <SelectItem value="tutorial">Tutorial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Day</Label>
                  <Select value={editingCourse.day} onValueChange={v => setEditingCourse((p: any) => ({ ...p, day: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {days.map((day) => <SelectItem key={day} value={day}>{day}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Room / Lab</Label>
                  <Select value={editingCourse.roomId} onValueChange={v => setEditingCourse((p: any) => ({ ...p, roomId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select room..." /></SelectTrigger>
                    <SelectContent>
                      {(courseOptions.rooms || []).map((room: any) => (
                        <SelectItem key={room.id} value={room.id}>{room.name} ({room.type})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start Time</Label>
                  <Input type="time" value={editingCourse.startTime} onChange={e => setEditingCourse((p: any) => ({ ...p, startTime: e.target.value }))} />
                </div>
                <div>
                  <Label>End Time</Label>
                  <Input type="time" value={editingCourse.endTime} onChange={e => setEditingCourse((p: any) => ({ ...p, endTime: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Assign Faculty</Label>
                <Select value={editingCourse.faculty} onValueChange={v => setEditingCourse((p: any) => ({ ...p, faculty: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select faculty..." /></SelectTrigger>
                  <SelectContent>
                    {departmentFaculty.map((faculty) => (
                      <SelectItem key={faculty.id} value={faculty.id}>{faculty.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Student Emails (replace current class list)</Label>
                <Textarea
                  placeholder="student1@college.edu, student2@college.edu"
                  value={editingCourse.studentEmails}
                  onChange={e => setEditingCourse((p: any) => ({ ...p, studentEmails: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
                <Button onClick={handleUpdateCourse}>Save Changes</Button>
              </div>
            </div>
          )}
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

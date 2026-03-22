import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  GraduationCap, CheckCircle, XCircle, Clock
} from 'lucide-react';
import { deleteApi, fetchApi, postApi, putApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';
import { CurriculumProposal } from '@/types/dean';

export default function DeanAcademics() {
  const [departmentSummaries, setDepartmentSummaries] = useState<any>([]);
  const [curriculumProposals, setCurriculumProposals] = useState<any>([]);
  const [classOptions, setClassOptions] = useState<any>({ courses: [], faculty: [] });
  const [classes, setClasses] = useState<any[]>([]);
  const [_apiLoading, _setApiLoading] = useState(true);
  useEffect(() => {
    Promise.allSettled([
      fetchApi('/dean/academics').then(d => setDepartmentSummaries(Array.isArray(d) ? d : [])),
      fetchApi('/dean/curriculum-proposals').then(d => setCurriculumProposals(Array.isArray(d) ? d : [])),
      fetchApi('/dean/class-management/options').then(d => setClassOptions(d || { courses: [], faculty: [], rooms: [] })),
      fetchApi('/dean/class-management').then(d => setClasses(Array.isArray(d) ? d : [])),
    ]).finally(() => _setApiLoading(false));
  }, []);

  const { toast } = useToast();
  const [proposals, setProposals] = useState<CurriculumProposal[]>([]);
  const [rejectDialog, setRejectDialog] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showCreateClassDialog, setShowCreateClassDialog] = useState(false);
  const [showEditClassDialog, setShowEditClassDialog] = useState(false);
  const [newClass, setNewClass] = useState({ courseId: '', facultyId: '', section: '', type: 'theory', studentEmails: '', roomId: '', day: 'Monday', startTime: '09:00', endTime: '10:00' });
  const [editingClass, setEditingClass] = useState<any>(null);

  useEffect(() => {
    setProposals(Array.isArray(curriculumProposals) ? curriculumProposals : []);
  }, [curriculumProposals]);

  const approveProposal = async (id: string) => {
    const cp = proposals.find((p) => p.id === id);
    try {
      const updated = await putApi(`/dean/curriculum-proposals/${id}`, { status: 'approved' });
      setProposals((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
      toast({ title: 'Proposal approved', description: cp?.title });
    } catch (error: any) {
      toast({ title: 'Approval failed', description: error?.message || 'Unable to update proposal', variant: 'destructive' });
    }
  };

  const rejectProposal = async () => {
    if (!rejectDialog) return;
    const cp = proposals.find((p) => p.id === rejectDialog);
    try {
      const updated = await putApi(`/dean/curriculum-proposals/${rejectDialog}`, { status: 'rejected' });
      setProposals((prev) => prev.map((p) => (p.id === rejectDialog ? { ...p, ...updated } : p)));
      toast({ title: 'Rejected', description: `${cp?.title} – ${rejectReason || 'No reason'}` });
      setRejectDialog(null);
      setRejectReason('');
    } catch (error: any) {
      toast({ title: 'Rejection failed', description: error?.message || 'Unable to update proposal', variant: 'destructive' });
    }
  };

  const handleCreateClass = async () => {
    const selectedCourse = classOptions.courses?.find((course: any) => course.id === newClass.courseId);
    if (!selectedCourse || !newClass.facultyId || !newClass.section || !newClass.roomId || !newClass.day || !newClass.startTime || !newClass.endTime) {
      toast({ title: 'Missing Fields', description: 'Please select course, faculty and section', variant: 'destructive' });
      return;
    }
    try {
      const created = await postApi('/dean/class-management', {
        courseId: newClass.courseId,
        semester: selectedCourse.semester,
        facultyId: newClass.facultyId,
        section: newClass.section,
        type: newClass.type,
        studentEmails: newClass.studentEmails,
        roomId: newClass.roomId,
        day: newClass.day,
        startTime: newClass.startTime,
        endTime: newClass.endTime,
      });
      setClasses((prev) => [...prev, created]);
      setShowCreateClassDialog(false);
      setNewClass({ courseId: '', facultyId: '', section: '', type: 'theory', studentEmails: '', roomId: '', day: 'Monday', startTime: '09:00', endTime: '10:00' });
      toast({ title: 'Class Created', description: `${created.courseCode} section ${created.section} created.` });
    } catch (error: any) {
      toast({ title: 'Creation failed', description: error?.message || 'Unable to create class', variant: 'destructive' });
    }
  };

  const handleOpenEditClass = (item: any) => {
    setEditingClass({
      id: item.id,
      courseCode: item.courseCode,
      courseName: item.courseName,
      credits: String(item.credits ?? 0),
      semester: String(item.semester ?? 1),
      facultyId: item.facultyId || '',
      section: item.section || 'A',
      type: item.type || 'theory',
      roomId: (classOptions.rooms || []).find((room: any) => room.name === item.room)?.id || '',
      day: item.day || 'Monday',
      startTime: item.startTime || '09:00',
      endTime: item.endTime || '10:00',
      studentEmails: Array.isArray(item.studentEmails) ? item.studentEmails.join(', ') : '',
    });
    setShowEditClassDialog(true);
  };

  const handleUpdateClass = async () => {
    if (!editingClass?.id) return;
    try {
      const updated = await putApi(`/dean/class-management/${editingClass.id}`, {
        courseCode: editingClass.courseCode,
        courseName: editingClass.courseName,
        credits: Number(editingClass.credits),
        semester: Number(editingClass.semester),
        facultyId: editingClass.facultyId,
        section: editingClass.section,
        type: editingClass.type,
        studentEmails: editingClass.studentEmails,
        roomId: editingClass.roomId,
        day: editingClass.day,
        startTime: editingClass.startTime,
        endTime: editingClass.endTime,
      });
      setClasses((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setShowEditClassDialog(false);
      setEditingClass(null);
      toast({ title: 'Class Updated', description: `${updated.courseCode} section ${updated.section} updated.` });
    } catch (error: any) {
      toast({ title: 'Update failed', description: error?.message || 'Unable to update class', variant: 'destructive' });
    }
  };

  const handleDeleteClass = async (classId: string) => {
    if (!window.confirm('Delete this class? This will remove class enrollment links.')) return;

    try {
      await deleteApi(`/dean/class-management/${classId}`);
      setClasses((prev) => prev.filter((item) => item.id !== classId));
      toast({ title: 'Class Deleted', description: 'Class was removed successfully.' });
    } catch (error: any) {
      toast({ title: 'Delete failed', description: error?.message || 'Unable to delete class', variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Academic Oversight</h1>
          <p className="text-muted-foreground">Review department academics and approve curriculum changes</p>
        </div>

        <Tabs defaultValue="departments">
          <TabsList>
            <TabsTrigger value="departments">Department Academics</TabsTrigger>
            <TabsTrigger value="curriculum">Curriculum Proposals ({proposals.filter(p => p.status === 'pending_dean').length})</TabsTrigger>
            <TabsTrigger value="classes">Class Management</TabsTrigger>
          </TabsList>

          <TabsContent value="departments" className="mt-4">
            <Card className="border-border">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-center">Students</TableHead>
                      <TableHead className="text-center">Faculty</TableHead>
                      <TableHead className="text-center">Courses</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departmentSummaries.map(d => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium text-foreground">{d.name}</TableCell>
                        <TableCell className="text-center">{d.totalStudents}</TableCell>
                        <TableCell className="text-center">{d.totalFaculty}</TableCell>
                        <TableCell className="text-center">{d.courses}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="curriculum" className="mt-4 space-y-4">
            {proposals.map(cp => (
              <Card key={cp.id} className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px]">{cp.department}</Badge>
                        <Badge variant="secondary" className="text-[10px] capitalize">{cp.type.replace('_', ' ')}</Badge>
                        {cp.bosApproved && <Badge className="text-[10px] bg-green-100 text-green-700">BoS Approved</Badge>}
                        {cp.status !== 'pending_dean' && (
                          <Badge variant={cp.status === 'sent_to_ac' ? 'default' : cp.status === 'approved' ? 'default' : 'destructive'} className="text-[10px] capitalize">
                            {cp.status === 'sent_to_ac' ? 'Sent to AC' : cp.status.replace('_', ' ')}
                          </Badge>
                        )}
                      </div>
                      <p className="font-medium text-foreground">{cp.title}</p>
                      <p className="text-sm text-muted-foreground mt-1">{cp.description}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Proposed by {cp.proposedBy} • {cp.submittedAt}</p>
                    </div>
                    {cp.status === 'pending_dean' && (
                      <div className="flex shrink-0 gap-1.5 ml-4">
                        <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50"
                          onClick={() => approveProposal(cp.id)}>
                          <CheckCircle className="mr-1 h-4 w-4" />Approve
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive"
                          onClick={() => setRejectDialog(cp.id)}>
                          <XCircle className="mr-1 h-4 w-4" />Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="classes" className="mt-4 space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setShowCreateClassDialog(true)}>Create Class</Button>
            </div>
            <Card className="border-border">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course</TableHead>
                      <TableHead className="text-center">Semester</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead>Faculty</TableHead>
                      <TableHead className="text-center">Students</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classes.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <p className="font-medium text-foreground">{item.courseCode}</p>
                          <p className="text-xs text-muted-foreground">{item.courseName}</p>
                        </TableCell>
                        <TableCell className="text-center">{item.semester}</TableCell>
                        <TableCell>{item.section}</TableCell>
                        <TableCell>{item.room || '-'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.schedule || '-'}</TableCell>
                        <TableCell>{item.assignedFaculty}</TableCell>
                        <TableCell className="text-center">{item.students}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleOpenEditClass(item)}>Edit</Button>
                            <Button variant="destructive" size="sm" onClick={() => handleDeleteClass(item.id)}>Delete</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!rejectDialog} onOpenChange={() => { setRejectDialog(null); setRejectReason(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Curriculum Proposal</DialogTitle>
            <DialogDescription>Provide feedback for the department.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Reason for rejection or feedback..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setRejectDialog(null); setRejectReason(''); }}>Cancel</Button>
            <Button variant="destructive" onClick={rejectProposal}><XCircle className="mr-1 h-4 w-4" />Reject</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateClassDialog} onOpenChange={setShowCreateClassDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Class</DialogTitle>
            <DialogDescription>Link class to an existing course and semester, then assign faculty and students.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Course</Label>
              <Select value={newClass.courseId} onValueChange={(value) => setNewClass((prev) => ({ ...prev, courseId: value }))}>
                <SelectTrigger><SelectValue placeholder="Select course..." /></SelectTrigger>
                <SelectContent>
                  {(classOptions.courses || []).map((course: any) => (
                    <SelectItem key={course.id} value={course.id}>{course.code} - {course.name} (Sem {course.semester})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Semester</Label>
                <Input value={String(classOptions.courses?.find((course: any) => course.id === newClass.courseId)?.semester || '')} disabled />
              </div>
              <div>
                <Label>Section</Label>
                <Input
                  value={newClass.section}
                  placeholder="e.g. A"
                  onChange={(event) => setNewClass((prev) => ({ ...prev, section: event.target.value.toUpperCase() }))}
                />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={newClass.type} onValueChange={(value) => setNewClass((prev) => ({ ...prev, type: value }))}>
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
                <Select value={newClass.day} onValueChange={(value) => setNewClass((prev) => ({ ...prev, day: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => (
                      <SelectItem key={day} value={day}>{day}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Room / Lab</Label>
                <Select value={newClass.roomId} onValueChange={(value) => setNewClass((prev) => ({ ...prev, roomId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Select room..." /></SelectTrigger>
                  <SelectContent>
                    {(classOptions.rooms || []).map((room: any) => (
                      <SelectItem key={room.id} value={room.id}>{room.name} ({room.type})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Time</Label>
                <Input type="time" value={newClass.startTime} onChange={(event) => setNewClass((prev) => ({ ...prev, startTime: event.target.value }))} />
              </div>
              <div>
                <Label>End Time</Label>
                <Input type="time" value={newClass.endTime} onChange={(event) => setNewClass((prev) => ({ ...prev, endTime: event.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Faculty</Label>
              <Select value={newClass.facultyId} onValueChange={(value) => setNewClass((prev) => ({ ...prev, facultyId: value }))}>
                <SelectTrigger><SelectValue placeholder="Select faculty..." /></SelectTrigger>
                <SelectContent>
                  {(classOptions.faculty || []).map((faculty: any) => (
                    <SelectItem key={faculty.id} value={faculty.id}>{faculty.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Student Emails</Label>
              <Textarea placeholder="student1@college.edu, student2@college.edu" value={newClass.studentEmails} onChange={(event) => setNewClass((prev) => ({ ...prev, studentEmails: event.target.value }))} rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateClassDialog(false)}>Cancel</Button>
              <Button onClick={handleCreateClass}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditClassDialog} onOpenChange={setShowEditClassDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update Class & Course</DialogTitle></DialogHeader>
          {editingClass && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Course Code</Label>
                  <Input value={editingClass.courseCode} onChange={(event) => setEditingClass((prev: any) => ({ ...prev, courseCode: event.target.value }))} />
                </div>
                <div>
                  <Label>Course Name</Label>
                  <Input value={editingClass.courseName} onChange={(event) => setEditingClass((prev: any) => ({ ...prev, courseName: event.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <Label>Credits</Label>
                  <Input type="number" value={editingClass.credits} onChange={(event) => setEditingClass((prev: any) => ({ ...prev, credits: event.target.value }))} />
                </div>
                <div>
                  <Label>Semester</Label>
                  <Input type="number" value={editingClass.semester} onChange={(event) => setEditingClass((prev: any) => ({ ...prev, semester: event.target.value }))} />
                </div>
                <div>
                  <Label>Section</Label>
                  <Input value={editingClass.section} onChange={(event) => setEditingClass((prev: any) => ({ ...prev, section: event.target.value.toUpperCase() }))} />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={editingClass.type} onValueChange={(value) => setEditingClass((prev: any) => ({ ...prev, type: value }))}>
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
                  <Select value={editingClass.day} onValueChange={(value) => setEditingClass((prev: any) => ({ ...prev, day: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => (
                        <SelectItem key={day} value={day}>{day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Room / Lab</Label>
                  <Select value={editingClass.roomId} onValueChange={(value) => setEditingClass((prev: any) => ({ ...prev, roomId: value }))}>
                    <SelectTrigger><SelectValue placeholder="Select room..." /></SelectTrigger>
                    <SelectContent>
                      {(classOptions.rooms || []).map((room: any) => (
                        <SelectItem key={room.id} value={room.id}>{room.name} ({room.type})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start Time</Label>
                  <Input type="time" value={editingClass.startTime} onChange={(event) => setEditingClass((prev: any) => ({ ...prev, startTime: event.target.value }))} />
                </div>
                <div>
                  <Label>End Time</Label>
                  <Input type="time" value={editingClass.endTime} onChange={(event) => setEditingClass((prev: any) => ({ ...prev, endTime: event.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Faculty</Label>
                <Select value={editingClass.facultyId} onValueChange={(value) => setEditingClass((prev: any) => ({ ...prev, facultyId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Select faculty..." /></SelectTrigger>
                  <SelectContent>
                    {(classOptions.faculty || []).map((faculty: any) => (
                      <SelectItem key={faculty.id} value={faculty.id}>{faculty.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Student Emails (replace current class list)</Label>
                <Textarea value={editingClass.studentEmails} onChange={(event) => setEditingClass((prev: any) => ({ ...prev, studentEmails: event.target.value }))} rows={3} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowEditClassDialog(false)}>Cancel</Button>
                <Button onClick={handleUpdateClass}>Save Changes</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { CheckCircle, XCircle } from 'lucide-react';
import { deleteApi, fetchApi, postApi, putApi, promptForDeleteReason } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';

const ALL = 'all';
const emptyClass = { courseId: '', facultyId: '', section: '', studentEmails: '' };

/**
 * Academic oversight across every department: department figures, curriculum
 * proposals from HODs, and class sections. A class's timetable is not set here
 * — it is set in the HOD's Workload & Timetable and approved by the Dean.
 */
export default function DeanAcademics() {
  const { toast } = useToast();
  const [departmentSummaries, setDepartmentSummaries] = useState<any[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [options, setOptions] = useState<{ departments: any[]; courses: any[]; faculty: any[] }>({ departments: [], courses: [], faculty: [] });
  const [classes, setClasses] = useState<any[]>([]);
  const [deptFilter, setDeptFilter] = useState(ALL);

  const loadClasses = (dept: string) => {
    const q = dept === ALL ? '' : `?departmentId=${dept}`;
    fetchApi<any[]>(`/dean/class-management${q}`).then((d) => setClasses(Array.isArray(d) ? d : [])).catch(() => setClasses([]));
  };
  useEffect(() => {
    fetchApi<any[]>('/dean/academics').then((d) => setDepartmentSummaries(Array.isArray(d) ? d : [])).catch(() => undefined);
    fetchApi<any[]>('/dean/curriculum-proposals').then((d) => setProposals(Array.isArray(d) ? d : [])).catch(() => undefined);
    fetchApi<any>('/dean/class-management/options').then((d) => setOptions({ departments: d?.departments ?? [], courses: d?.courses ?? [], faculty: d?.faculty ?? [] })).catch(() => undefined);
  }, []);
  useEffect(() => { loadClasses(deptFilter); }, [deptFilter]);

  const deptName = (id: string) => options.departments.find((d) => d.id === id)?.name ?? '';

  // ── Curriculum ─────────────────────────────────────────────────────────────
  const [rejectDialog, setRejectDialog] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const decide = async (id: string, status: 'approved' | 'rejected', note?: string) => {
    const cp = proposals.find((p) => p.id === id);
    try {
      const updated = await putApi<any>(`/dean/curriculum-proposals/${id}`, { status, ...(note ? { note } : {}) });
      setProposals((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
      toast({ title: status === 'approved' ? 'Proposal approved' : 'Proposal rejected', description: `${cp?.title} — the HOD has been notified.` });
      setRejectDialog(null);
      setRejectReason('');
    } catch (error: any) {
      toast({ title: 'Decision failed', description: error?.message || 'Unable to update proposal', variant: 'destructive' });
    }
  };
  const rejectProposal = () => {
    if (!rejectDialog) return;
    // The approval engine refuses a rejection without a reason; it used not to be sent at all.
    if (rejectReason.trim().length < 10) {
      toast({ title: 'Add a reason', description: 'Tell the department why (at least 10 characters).', variant: 'destructive' });
      return;
    }
    decide(rejectDialog, 'rejected', rejectReason.trim());
  };

  // ── Classes ────────────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [newClass, setNewClass] = useState(emptyClass);
  const [editing, setEditing] = useState<any>(null);
  const chosenCourse = options.courses.find((c) => c.id === newClass.courseId);
  const facultyFor = (departmentId?: string) => options.faculty.filter((f) => !departmentId || f.departmentId === departmentId);
  const coursesInView = useMemo(() => options.courses.filter((c) => deptFilter === ALL || c.departmentId === deptFilter), [options.courses, deptFilter]);

  const createClass = async () => {
    if (!chosenCourse || !newClass.facultyId || !newClass.section.trim()) {
      toast({ title: 'Missing fields', description: 'Choose a course, a teacher and a section.', variant: 'destructive' });
      return;
    }
    try {
      const created = await postApi<any>('/dean/class-management', {
        courseId: chosenCourse.id, semester: chosenCourse.semester, facultyId: newClass.facultyId,
        section: newClass.section.trim(), studentEmails: newClass.studentEmails
      });
      setClasses((prev) => [...prev, created]);
      setCreateOpen(false);
      setNewClass(emptyClass);
      toast({ title: 'Class created', description: `${created.courseCode} section ${created.section} · ${created.students} student(s). Its timetable is set by the HOD in Workload & Timetable.` });
    } catch (error: any) {
      toast({ title: 'Creation failed', description: error?.message || 'Unable to create class', variant: 'destructive' });
    }
  };

  const openEdit = (item: any) => setEditing({
    id: item.id, departmentId: item.departmentId, courseCode: item.courseCode, courseName: item.courseName,
    credits: String(item.credits ?? 0), semester: String(item.semester ?? 1), facultyId: item.facultyId || '',
    section: item.section || 'A', studentEmails: Array.isArray(item.studentEmails) ? item.studentEmails.join(', ') : ''
  });
  const saveEdit = async () => {
    if (!editing?.id) return;
    try {
      const updated = await putApi<any>(`/dean/class-management/${editing.id}`, {
        courseCode: editing.courseCode, courseName: editing.courseName, credits: Number(editing.credits), semester: Number(editing.semester),
        ...(editing.facultyId ? { facultyId: editing.facultyId } : {}), section: editing.section, studentEmails: editing.studentEmails
      });
      setClasses((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setEditing(null);
      toast({ title: 'Class updated', description: `${updated.courseCode} section ${updated.section}.` });
    } catch (error: any) {
      toast({ title: 'Update failed', description: error?.message || 'Unable to update class', variant: 'destructive' });
    }
  };
  const deleteClass = async (item: any) => {
    if (!window.confirm(`Delete ${item.courseCode} section ${item.section}? Its ${item.students} student enrolment(s) in this section are removed.`)) return;
    const reason = promptForDeleteReason('this class');
    if (!reason) return;
    try {
      await deleteApi(`/dean/class-management/${item.id}`, { reason });
      setClasses((prev) => prev.filter((c) => c.id !== item.id));
      toast({ title: 'Class deleted', description: `${item.courseCode} section ${item.section}` });
    } catch (error: any) {
      toast({ title: 'Delete failed', description: error?.message || 'Unable to delete class', variant: 'destructive' });
    }
  };

  const pendingCount = proposals.filter((p) => p.status === 'pending_dean').length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Academic Oversight</h1>
          <p className="text-muted-foreground">Every department's academics, curriculum proposals from HODs, and class sections</p>
        </div>

        <Tabs defaultValue="departments">
          <TabsList>
            <TabsTrigger value="departments">Department Academics</TabsTrigger>
            <TabsTrigger value="curriculum">Curriculum Proposals{pendingCount > 0 && <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">{pendingCount}</Badge>}</TabsTrigger>
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
                      <TableHead className="text-center">Students per faculty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departmentSummaries.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium text-foreground">{d.name}</TableCell>
                        <TableCell className="text-center">{d.totalStudents}</TableCell>
                        <TableCell className="text-center">{d.totalFaculty}</TableCell>
                        <TableCell className="text-center">{d.courses}</TableCell>
                        <TableCell className="text-center">{d.totalFaculty ? (d.totalStudents / d.totalFaculty).toFixed(1) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="curriculum" className="mt-4 space-y-4">
            {proposals.length === 0 && <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No curriculum proposals from HODs.</p>}
            {proposals.map((cp) => (
              <Card key={cp.id} className="border-border">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{cp.departmentName ?? deptName(cp.departmentId)}</Badge>
                        <Badge variant="secondary" className="text-[10px] capitalize">{String(cp.type).replace(/_/g, ' ')}</Badge>
                        {cp.bosApproved && <Badge className="bg-green-100 text-[10px] text-green-700">BoS Approved</Badge>}
                        {cp.status !== 'pending_dean' && (
                          <Badge variant={cp.status === 'approved' || cp.status === 'sent_to_ac' ? 'default' : 'destructive'} className="text-[10px] capitalize">
                            {cp.status === 'sent_to_ac' ? 'Sent to AC' : String(cp.status).replace(/_/g, ' ')}
                          </Badge>
                        )}
                      </div>
                      <p className="font-medium text-foreground">{cp.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{cp.description}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">Proposed by {cp.proposedBy} • {new Date(cp.submittedAt).toLocaleDateString('en-IN')}</p>
                    </div>
                    {cp.status === 'pending_dean' && (
                      <div className="flex shrink-0 gap-1.5">
                        <Button size="sm" variant="outline" className="border-green-200 text-green-600 hover:bg-green-50" onClick={() => decide(cp.id, 'approved')}>
                          <CheckCircle className="mr-1 h-4 w-4" />Approve
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => setRejectDialog(cp.id)}>
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="w-[280px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All departments</SelectItem>
                  {options.departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={() => { setNewClass(emptyClass); setCreateOpen(true); }}>Create Class</Button>
            </div>
            <Card className="border-border">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-center">Sem</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Weekly timetable</TableHead>
                      <TableHead>Teacher</TableHead>
                      <TableHead className="text-center">Students</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classes.length === 0 && <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No classes in this department.</TableCell></TableRow>}
                    {classes.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <p className="font-medium text-foreground">{item.courseCode}</p>
                          <p className="text-xs text-muted-foreground">{item.courseName}</p>
                        </TableCell>
                        <TableCell className="text-xs">{item.department}</TableCell>
                        <TableCell className="text-center">{item.semester}</TableCell>
                        <TableCell>{item.section}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.schedule}</TableCell>
                        <TableCell className={item.facultyId ? '' : 'text-amber-600'}>{item.assignedFaculty}</TableCell>
                        <TableCell className="text-center">{item.students}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => openEdit(item)}>Edit</Button>
                            <Button variant="destructive" size="sm" onClick={() => deleteClass(item)}>Delete</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <p className="text-xs text-muted-foreground">Class timetables are proposed by HODs in Workload & Timetable and come to you for approval.</p>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!rejectDialog} onOpenChange={() => { setRejectDialog(null); setRejectReason(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject curriculum proposal</DialogTitle>
            <DialogDescription>The HOD sees this reason.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Reason (at least 10 characters)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialog(null); setRejectReason(''); }}>Cancel</Button>
            <Button variant="destructive" onClick={rejectProposal}><XCircle className="mr-1 h-4 w-4" />Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a class</DialogTitle>
            <DialogDescription>A section of a course with its teacher and students. The HOD schedules it in Workload & Timetable.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Course</Label>
              <Select value={newClass.courseId} onValueChange={(v) => setNewClass({ ...newClass, courseId: v, facultyId: '' })}>
                <SelectTrigger><SelectValue placeholder="Choose a course" /></SelectTrigger>
                <SelectContent>
                  {(coursesInView.length ? coursesInView : options.courses).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.code} – {c.name} (Sem {c.semester}{deptFilter === ALL ? ` · ${deptName(c.departmentId)}` : ''})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Section</Label><Input value={newClass.section} placeholder="e.g. B" onChange={(e) => setNewClass({ ...newClass, section: e.target.value.toUpperCase() })} /></div>
              <div>
                <Label>Teacher</Label>
                <Select value={newClass.facultyId} onValueChange={(v) => setNewClass({ ...newClass, facultyId: v })} disabled={!chosenCourse}>
                  <SelectTrigger><SelectValue placeholder={chosenCourse ? 'Choose a teacher' : 'Choose a course first'} /></SelectTrigger>
                  <SelectContent>{facultyFor(chosenCourse?.departmentId).map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Student emails</Label>
              <Textarea rows={3} placeholder="Comma or line separated — students of the course's department" value={newClass.studentEmails} onChange={(e) => setNewClass({ ...newClass, studentEmails: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createClass}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit class & course</DialogTitle>
            <DialogDescription>Code, name, credits and semester change the course for every section.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Course code</Label><Input value={editing.courseCode} onChange={(e) => setEditing({ ...editing, courseCode: e.target.value })} /></div>
                <div><Label>Section</Label><Input value={editing.section} onChange={(e) => setEditing({ ...editing, section: e.target.value.toUpperCase() })} /></div>
              </div>
              <div><Label>Course name</Label><Input value={editing.courseName} onChange={(e) => setEditing({ ...editing, courseName: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Credits</Label><Input type="number" min={0} value={editing.credits} onChange={(e) => setEditing({ ...editing, credits: e.target.value })} /></div>
                <div><Label>Semester</Label><Input type="number" min={1} max={10} value={editing.semester} onChange={(e) => setEditing({ ...editing, semester: e.target.value })} /></div>
              </div>
              <div>
                <Label>Teacher</Label>
                <Select value={editing.facultyId} onValueChange={(v) => setEditing({ ...editing, facultyId: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose a teacher" /></SelectTrigger>
                  <SelectContent>{facultyFor(editing.departmentId).map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Student emails</Label><Textarea rows={4} value={editing.studentEmails} onChange={(e) => setEditing({ ...editing, studentEmails: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

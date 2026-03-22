import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { deleteApi, fetchApi, postApi, putApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';

type CourseRow = {
  id: string;
  code: string;
  name: string;
  credits: number;
  semester: number;
  students?: number;
};

type ProposalRow = {
  id: string;
  department: string;
  proposedBy: string;
  type: 'new_course' | 'syllabus_update' | 'program_change' | 'elective_addition';
  title: string;
  description: string;
  submittedAt: string;
  bosApproved: boolean;
  status: 'pending_dean' | 'approved' | 'sent_to_ac' | 'rejected';
};

export default function HODCourseManagement() {
  const { toast } = useToast();
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openProposal, setOpenProposal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', name: '', credits: '3', semester: '1' });
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [proposalForm, setProposalForm] = useState({ type: 'new_course', title: '', description: '', bosApproved: false });

  const loadData = async () => {
    try {
      const [courseData, proposalData] = await Promise.all([
        fetchApi<CourseRow[]>('/hod/course-management'),
        fetchApi<ProposalRow[]>('/hod/curriculum-proposals')
      ]);
      setCourses(Array.isArray(courseData) ? courseData : []);
      setProposals(Array.isArray(proposalData) ? proposalData : []);
    } catch (error: any) {
      toast({ title: 'Load failed', description: error?.message || 'Unable to load courses', variant: 'destructive' });
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalStudents = useMemo(
    () => courses.reduce((sum, item) => sum + Number(item.students || 0), 0),
    [courses]
  );

  const resetForm = () => setForm({ code: '', name: '', credits: '3', semester: '1' });

  const handleCreate = async () => {
    if (!form.code || !form.name || !form.credits || !form.semester) {
      toast({ title: 'Missing fields', description: 'Please enter code, name, credits and semester', variant: 'destructive' });
      return;
    }

    try {
      const created = await postApi<CourseRow>('/hod/course-management', {
        code: form.code,
        name: form.name,
        credits: Number(form.credits),
        semester: Number(form.semester),
      });

      setCourses((prev) => [...prev, { ...created, students: 0 }]);
      setOpenCreate(false);
      resetForm();
      toast({ title: 'Course created', description: `${created.code} has been created` });
    } catch (error: any) {
      toast({ title: 'Create failed', description: error?.message || 'Unable to create course', variant: 'destructive' });
    }
  };

  const openEditDialog = (item: CourseRow) => {
    setEditingId(item.id);
    setForm({
      code: item.code,
      name: item.name,
      credits: String(item.credits),
      semester: String(item.semester),
    });
    setOpenEdit(true);
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    try {
      const updated = await putApi<CourseRow>(`/hod/course-management/${editingId}`, {
        code: form.code,
        name: form.name,
        credits: Number(form.credits),
        semester: Number(form.semester),
      });

      setCourses((prev) =>
        prev.map((item) =>
          item.id === editingId
            ? {
                ...item,
                ...updated,
              }
            : item
        )
      );

      setOpenEdit(false);
      setEditingId(null);
      resetForm();
      toast({ title: 'Course updated', description: `${updated.code} has been updated` });
    } catch (error: any) {
      toast({ title: 'Update failed', description: error?.message || 'Unable to update course', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this course?')) return;
    try {
      await deleteApi(`/hod/course-management/${id}`);
      setCourses((prev) => prev.filter((item) => item.id !== id));
      toast({ title: 'Course deleted' });
    } catch (error: any) {
      toast({ title: 'Delete failed', description: error?.message || 'Unable to delete course', variant: 'destructive' });
    }
  };

  const handleCreateProposal = async () => {
    if (!proposalForm.type || !proposalForm.title.trim() || !proposalForm.description.trim()) {
      toast({ title: 'Missing fields', description: 'Please fill proposal type, title and description', variant: 'destructive' });
      return;
    }
    try {
      const created = await postApi<ProposalRow>('/hod/curriculum-proposals', proposalForm);
      setProposals((prev) => [created, ...prev]);
      setOpenProposal(false);
      setProposalForm({ type: 'new_course', title: '', description: '', bosApproved: false });
      toast({ title: 'Proposal submitted', description: 'Sent to Dean for review' });
    } catch (error: any) {
      toast({ title: 'Submit failed', description: error?.message || 'Unable to submit proposal', variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Course Management</h1>
          <p className="text-muted-foreground">Manage courses and submit curriculum proposals to Dean</p>
        </div>

        <Tabs defaultValue="courses">
          <TabsList>
            <TabsTrigger value="courses">Courses</TabsTrigger>
            <TabsTrigger value="proposals">Curriculum Proposals</TabsTrigger>
          </TabsList>

          <TabsContent value="courses" className="mt-4 space-y-4">
            <div className="flex items-center justify-end">
              <Button size="sm" onClick={() => setOpenCreate(true)}>
                <Plus className="mr-1 h-4 w-4" />New Course
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Courses</p><p className="text-2xl font-bold">{courses.length}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Enrollment</p><p className="text-2xl font-bold">{totalStudents}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Faculty Allocation</p><p className="text-sm font-semibold">Class-wise via Workload & Timetable</p></CardContent></Card>
            </div>

            <Card>
              <CardHeader><CardTitle>Department Courses</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-center">Semester</TableHead>
                      <TableHead className="text-center">Credits</TableHead>
                      <TableHead className="text-center">Students</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {courses.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.code}</TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell className="text-center">{item.semester}</TableCell>
                        <TableCell className="text-center">{item.credits}</TableCell>
                        <TableCell className="text-center">{item.students || 0}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditDialog(item)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(item.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="proposals" className="mt-4 space-y-4">
            <div className="flex items-center justify-end">
              <Button size="sm" onClick={() => setOpenProposal(true)}>
                <Plus className="mr-1 h-4 w-4" />New Proposal
              </Button>
            </div>
            <Card>
              <CardHeader><CardTitle>Submitted Proposals</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>BoS</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {proposals.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <p className="font-medium">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        </TableCell>
                        <TableCell className="capitalize">{item.type.replace('_', ' ')}</TableCell>
                        <TableCell>{item.bosApproved ? 'Yes' : 'No'}</TableCell>
                        <TableCell>
                          <Badge variant={item.status === 'approved' || item.status === 'sent_to_ac' ? 'default' : item.status === 'rejected' ? 'destructive' : 'secondary'} className="capitalize text-[10px]">
                            {item.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.submittedAt}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Course</DialogTitle></DialogHeader>
          <CourseForm form={form} setForm={setForm} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpenCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Course</DialogTitle></DialogHeader>
          <CourseForm form={form} setForm={setForm} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpenEdit(false)}>Cancel</Button>
            <Button onClick={handleUpdate}>Update</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openProposal} onOpenChange={setOpenProposal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Curriculum Proposal</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Type</Label>
              <Select value={proposalForm.type} onValueChange={(value) => setProposalForm((prev) => ({ ...prev, type: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new_course">New Course</SelectItem>
                  <SelectItem value="syllabus_update">Syllabus Update</SelectItem>
                  <SelectItem value="program_change">Program Change</SelectItem>
                  <SelectItem value="elective_addition">Elective Addition</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Title</Label>
              <Input value={proposalForm.title} onChange={(e) => setProposalForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Proposal title" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={proposalForm.description} onChange={(e) => setProposalForm((prev) => ({ ...prev, description: e.target.value }))} rows={4} placeholder="Proposal details" />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="bosApproved"
                type="checkbox"
                checked={proposalForm.bosApproved}
                onChange={(e) => setProposalForm((prev) => ({ ...prev, bosApproved: e.target.checked }))}
              />
              <Label htmlFor="bosApproved">BoS Approved</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpenProposal(false)}>Cancel</Button>
              <Button onClick={handleCreateProposal}>Submit Proposal</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function CourseForm({
  form,
  setForm,
}: {
  form: { code: string; name: string; credits: string; semester: string };
  setForm: React.Dispatch<React.SetStateAction<{ code: string; name: string; credits: string; semester: string }>>;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Course Code</Label>
          <Input value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} placeholder="CSE301" />
        </div>
        <div>
          <Label>Course Name</Label>
          <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Database Systems" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Credits</Label>
          <Input type="number" min="1" max="8" value={form.credits} onChange={(e) => setForm((p) => ({ ...p, credits: e.target.value }))} />
        </div>
        <div>
          <Label>Semester</Label>
          <Input type="number" min="1" max="8" value={form.semester} onChange={(e) => setForm((p) => ({ ...p, semester: e.target.value }))} />
        </div>
      </div>
    </div>
  );
}

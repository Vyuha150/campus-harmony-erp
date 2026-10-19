import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { deleteApi, fetchApi, postApi, putApi, promptForDeleteReason } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';

type CourseRow = { id: string; code: string; name: string; credits: number; semester: number; students?: number; department?: string | null; departmentId?: string; faculty?: string | null };
const ALL = 'all';
const emptyForm = { code: '', name: '', credits: '3', semester: '1', departmentId: '' };

/**
 * The courses every department offers. Was limited to the Dean's own
 * department, and editing a course silently removed its teacher.
 */
export default function DeanCourseManagement() {
  const { toast } = useToast();
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [ownDepartment, setOwnDepartment] = useState<string>('');
  const [deptFilter, setDeptFilter] = useState(ALL);
  const [search, setSearch] = useState('');
  const [openCreate, setOpenCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const loadData = async (dept: string) => {
    try {
      const q = dept === ALL ? '' : `?departmentId=${dept}`;
      const data = await fetchApi<CourseRow[]>(`/dean/course-management${q}`);
      setCourses(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast({ title: 'Load failed', description: error?.message || 'Unable to load courses', variant: 'destructive' });
    }
  };
  useEffect(() => {
    fetchApi<any>('/dean/course-management/options').then((d) => {
      setDepartments(d?.departments ?? []);
      setOwnDepartment(d?.department?.id ?? '');
    }).catch(() => undefined);
  }, []);
  useEffect(() => { loadData(deptFilter); }, [deptFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? courses.filter((c) => `${c.code} ${c.name}`.toLowerCase().includes(q)) : courses;
  }, [courses, search]);
  const totalStudents = useMemo(() => courses.reduce((sum, item) => sum + Number(item.students || 0), 0), [courses]);

  const handleCreate = async () => {
    if (!form.code.trim() || !form.name.trim() || !form.credits || !form.semester || !form.departmentId) {
      toast({ title: 'Missing fields', description: 'Enter the department, code, name, credits and semester.', variant: 'destructive' });
      return;
    }
    try {
      const created = await postApi<CourseRow>('/dean/course-management', {
        code: form.code.trim(), name: form.name.trim(), credits: Number(form.credits), semester: Number(form.semester), departmentId: form.departmentId
      });
      if (deptFilter === ALL || deptFilter === form.departmentId) setCourses((prev) => [...prev, created]);
      setOpenCreate(false);
      setForm(emptyForm);
      toast({ title: 'Course created', description: `${created.code} in ${created.department}. Its HOD can now allocate a teacher and schedule it.` });
    } catch (error: any) {
      toast({ title: 'Create failed', description: error?.message || 'Unable to create course', variant: 'destructive' });
    }
  };

  const openEditDialog = (item: CourseRow) => {
    setEditingId(item.id);
    setForm({ code: item.code, name: item.name, credits: String(item.credits), semester: String(item.semester), departmentId: item.departmentId ?? '' });
  };
  const handleUpdate = async () => {
    if (!editingId) return;
    try {
      const updated = await putApi<CourseRow>(`/dean/course-management/${editingId}`, {
        code: form.code.trim(), name: form.name.trim(), credits: Number(form.credits), semester: Number(form.semester)
      });
      setCourses((prev) => prev.map((c) => (c.id === editingId ? { ...c, ...updated } : c)));
      setEditingId(null);
      setForm(emptyForm);
      toast({ title: 'Course updated', description: `${updated.code} updated` });
    } catch (error: any) {
      toast({ title: 'Update failed', description: error?.message || 'Unable to update course', variant: 'destructive' });
    }
  };
  const handleDelete = async (item: CourseRow) => {
    if (item.students) {
      toast({ title: 'Cannot delete', description: `${item.code} has ${item.students} enrolled student(s). Remove the enrolments first.`, variant: 'destructive' });
      return;
    }
    const reason = promptForDeleteReason(`course ${item.code}`);
    if (!reason) return;
    try {
      await deleteApi(`/dean/course-management/${item.id}`, { reason });
      setCourses((prev) => prev.filter((c) => c.id !== item.id));
      toast({ title: 'Course deleted', description: item.code });
    } catch (error: any) {
      toast({ title: 'Delete failed', description: error?.message || 'Unable to delete course', variant: 'destructive' });
    }
  };

  const formFields = (creating: boolean) => (
    <div className="space-y-3">
      {creating && (
        <div>
          <Label>Department</Label>
          <Select value={form.departmentId} onValueChange={(v) => setForm((p) => ({ ...p, departmentId: v }))}>
            <SelectTrigger><SelectValue placeholder="Which department offers it" /></SelectTrigger>
            <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      <div><Label>Course code</Label><Input value={form.code} placeholder="e.g. CSE507" onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} /></div>
      <div><Label>Course name</Label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Credits</Label><Input type="number" min={0} max={20} value={form.credits} onChange={(e) => setForm((p) => ({ ...p, credits: e.target.value }))} /></div>
        <div><Label>Semester</Label><Input type="number" min={1} max={10} value={form.semester} onChange={(e) => setForm((p) => ({ ...p, semester: e.target.value }))} /></div>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Course Management</h1>
            <p className="text-muted-foreground">Courses offered by every department</p>
          </div>
          <Button onClick={() => { setForm({ ...emptyForm, departmentId: deptFilter !== ALL ? deptFilter : ownDepartment }); setOpenCreate(true); }}>
            <Plus className="mr-2 h-4 w-4" />New Course
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card><CardContent className="p-4"><p className="text-2xl font-bold">{courses.length}</p><p className="text-xs text-muted-foreground">Courses</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-2xl font-bold">{totalStudents}</p><p className="text-xs text-muted-foreground">Enrolments</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-2xl font-bold">{courses.filter((c) => !c.faculty).length}</p><p className="text-xs text-muted-foreground">Without a teacher</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
            <CardTitle className="text-lg">Courses</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Input placeholder="Search code or name" value={search} onChange={(e) => setSearch(e.target.value)} className="w-[200px]" />
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All departments</SelectItem>
                  {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead className="text-center">Sem</TableHead>
                  <TableHead className="text-center">Credits</TableHead>
                  <TableHead className="text-center">Students</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.length === 0 && <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No courses match.</TableCell></TableRow>}
                {visible.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono font-medium">{item.code}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="text-xs">{item.department}</TableCell>
                    <TableCell className={item.faculty ? 'text-sm' : 'text-sm text-amber-600'}>{item.faculty ?? 'Unassigned'}</TableCell>
                    <TableCell className="text-center">{item.semester}</TableCell>
                    <TableCell className="text-center">{item.credits}</TableCell>
                    <TableCell className="text-center">{item.students ?? 0}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" title="Edit" onClick={() => openEditDialog(item)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" className="text-destructive" title={item.students ? 'Has enrolled students' : 'Delete'} onClick={() => handleDelete(item)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create course</DialogTitle><DialogDescription>The department's HOD allocates a teacher and puts it on the timetable.</DialogDescription></DialogHeader>
          {formFields(true)}
          <DialogFooter><Button variant="outline" onClick={() => setOpenCreate(false)}>Cancel</Button><Button onClick={handleCreate}>Create</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editingId !== null} onOpenChange={(open) => { if (!open) { setEditingId(null); setForm(emptyForm); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit course</DialogTitle><DialogDescription>The teacher and timetable are unchanged.</DialogDescription></DialogHeader>
          {formFields(false)}
          <DialogFooter><Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button><Button onClick={handleUpdate}>Update</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

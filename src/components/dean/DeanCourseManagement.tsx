import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export default function DeanCourseManagement() {
  const { toast } = useToast();
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', name: '', credits: '3', semester: '1' });

  const loadData = async () => {
    try {
      const courseData = await fetchApi<CourseRow[]>('/dean/course-management');
      setCourses(Array.isArray(courseData) ? courseData : []);
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
      const created = await postApi<CourseRow>('/dean/course-management', {
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
      const updated = await putApi<CourseRow>(`/dean/course-management/${editingId}`, {
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
      await deleteApi(`/dean/course-management/${id}`);
      setCourses((prev) => prev.filter((item) => item.id !== id));
      toast({ title: 'Course deleted' });
    } catch (error: any) {
      toast({ title: 'Delete failed', description: error?.message || 'Unable to delete course', variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Course Management</h1>
            <p className="text-muted-foreground">Manage departmental courses and faculty allocation</p>
          </div>
          <Button size="sm" onClick={() => setOpenCreate(true)}>
            <Plus className="mr-1 h-4 w-4" />New Course
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Courses</p><p className="text-2xl font-bold">{courses.length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Enrollment</p><p className="text-2xl font-bold">{totalStudents}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Faculty Allocation</p><p className="text-sm font-semibold">Class-wise via Academic Oversight</p></CardContent></Card>
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
          <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Machine Learning" />
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

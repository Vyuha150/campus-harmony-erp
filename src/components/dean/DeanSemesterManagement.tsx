import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil } from 'lucide-react';
import { fetchApi, postApi, putApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';

type AcademicYear = {
  id: string;
  year: string;
  startDate: string;
  endDate: string;
  status: string;
  isCurrent: boolean;
  semesters?: unknown;
};

export default function DeanSemesterManagement() {
  const { toast } = useToast();
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    year: '',
    startDate: '',
    endDate: '',
    status: 'upcoming',
    isCurrent: false,
    semestersText: '',
  });

  const loadData = async () => {
    try {
      const data = await fetchApi<AcademicYear[]>('/dean/semester-management/academic-years');
      setYears(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast({ title: 'Load failed', description: error?.message || 'Unable to load academic years', variant: 'destructive' });
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const parseSemesters = (raw: string) => {
    const names = raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    return names.map((name, index) => ({ number: index + 1, name }));
  };

  const reset = () => {
    setForm({ year: '', startDate: '', endDate: '', status: 'upcoming', isCurrent: false, semestersText: '' });
    setEditingId(null);
  };

  const handleCreate = async () => {
    if (!form.year || !form.startDate || !form.endDate) {
      toast({ title: 'Missing fields', description: 'Please enter year, start date, and end date', variant: 'destructive' });
      return;
    }

    try {
      const created = await postApi<AcademicYear>('/dean/semester-management/academic-years', {
        year: form.year,
        startDate: form.startDate,
        endDate: form.endDate,
        status: form.status,
        isCurrent: form.isCurrent,
        semesters: parseSemesters(form.semestersText),
      });
      setYears((prev) => [created, ...prev]);
      setOpenCreate(false);
      reset();
      toast({ title: 'Academic year created', description: created.year });
    } catch (error: any) {
      toast({ title: 'Create failed', description: error?.message || 'Unable to create academic year', variant: 'destructive' });
    }
  };

  const startEdit = (item: AcademicYear) => {
    setEditingId(item.id);
    const semesterNames = Array.isArray(item.semesters)
      ? item.semesters.map((entry: any) => String(entry?.name || '')).filter(Boolean).join(', ')
      : '';

    setForm({
      year: item.year,
      startDate: item.startDate ? new Date(item.startDate).toISOString().slice(0, 10) : '',
      endDate: item.endDate ? new Date(item.endDate).toISOString().slice(0, 10) : '',
      status: item.status || 'upcoming',
      isCurrent: Boolean(item.isCurrent),
      semestersText: semesterNames,
    });
    setOpenEdit(true);
  };

  const handleUpdate = async () => {
    if (!editingId) return;

    try {
      const updated = await putApi<AcademicYear>(`/dean/semester-management/academic-years/${editingId}`, {
        year: form.year,
        startDate: form.startDate,
        endDate: form.endDate,
        status: form.status,
        isCurrent: form.isCurrent,
        semesters: parseSemesters(form.semestersText),
      });

      setYears((prev) => prev.map((item) => (item.id === editingId ? updated : item)));
      setOpenEdit(false);
      reset();
      toast({ title: 'Academic year updated', description: updated.year });
    } catch (error: any) {
      toast({ title: 'Update failed', description: error?.message || 'Unable to update academic year', variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Semester Management</h1>
            <p className="text-muted-foreground">Create academic years and define semester structure</p>
          </div>
          <Button size="sm" onClick={() => setOpenCreate(true)}>
            <Plus className="mr-1 h-4 w-4" />New Academic Year
          </Button>
        </div>

        <Card>
          <CardHeader><CardTitle>Academic Years</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Current</TableHead>
                  <TableHead>Semesters</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {years.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.year}</TableCell>
                    <TableCell>{new Date(item.startDate).toLocaleDateString('en-IN')}</TableCell>
                    <TableCell>{new Date(item.endDate).toLocaleDateString('en-IN')}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{item.status}</Badge></TableCell>
                    <TableCell>{item.isCurrent ? 'Yes' : 'No'}</TableCell>
                    <TableCell>{Array.isArray(item.semesters) ? item.semesters.length : 0}</TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(item)}>
                          <Pencil className="h-4 w-4" />
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
          <DialogHeader><DialogTitle>Create Academic Year</DialogTitle></DialogHeader>
          <YearForm form={form} setForm={setForm} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpenCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Academic Year</DialogTitle></DialogHeader>
          <YearForm form={form} setForm={setForm} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpenEdit(false)}>Cancel</Button>
            <Button onClick={handleUpdate}>Update</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function YearForm({
  form,
  setForm,
}: {
  form: { year: string; startDate: string; endDate: string; status: string; isCurrent: boolean; semestersText: string };
  setForm: React.Dispatch<React.SetStateAction<{ year: string; startDate: string; endDate: string; status: string; isCurrent: boolean; semestersText: string }>>;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Academic Year</Label>
          <Input value={form.year} onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))} placeholder="2026-2027" />
        </div>
        <div>
          <Label>Start Date</Label>
          <Input type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} />
        </div>
        <div>
          <Label>End Date</Label>
          <Input type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Status</Label>
          <Input value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} placeholder="upcoming" />
        </div>
        <div>
          <Label>Current Year</Label>
          <div className="flex h-10 items-center gap-2 rounded-md border px-3">
            <input
              type="checkbox"
              checked={form.isCurrent}
              onChange={(e) => setForm((p) => ({ ...p, isCurrent: e.target.checked }))}
            />
            <span className="text-sm text-muted-foreground">Mark as current academic year</span>
          </div>
        </div>
      </div>
      <div>
        <Label>Semesters (comma separated)</Label>
        <Textarea
          value={form.semestersText}
          onChange={(e) => setForm((p) => ({ ...p, semestersText: e.target.value }))}
          placeholder="Semester 1, Semester 2"
          rows={3}
        />
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ClipboardList, CheckCircle, Clock, AlertTriangle, Send, Users, Calendar, FileText, Download, Plus, Pencil, Trash2 } from 'lucide-react';
import { deleteApi, fetchApi, postApi, putApi } from '@/lib/apiService';
import { ExamProgress } from '@/types/registrar';

const statusColors: Record<string, string> = {
  scheduling: 'bg-blue-50 text-blue-700',
  ongoing: 'bg-amber-50 text-amber-700',
  evaluation: 'bg-purple-50 text-purple-700',
  mark_entry: 'bg-purple-50 text-purple-700',
  moderation: 'bg-orange-50 text-orange-700',
  published: 'bg-emerald-50 text-emerald-700',
};

function normalizeStatus(status: string): ExamProgress['status'] {
  if (status === 'evaluation') return 'mark_entry';
  if (status === 'completed') return 'published';
  if (status === 'scheduling' || status === 'ongoing' || status === 'mark_entry' || status === 'moderation' || status === 'published') {
    return status;
  }
  return 'scheduling';
}

function getSafeCounts(exam: ExamProgress) {
  const totalStudents = Math.max(0, Number((exam as any).totalStudents) || 0);
  const enteredRaw = Math.max(0, Number((exam as any).marksEntered) || 0);
  const status = normalizeStatus(String((exam as any).status || 'scheduling'));
  const marksEntered = status === 'published' || exam.resultsPublished ? totalStudents : Math.min(enteredRaw, totalStudents);
  return { totalStudents, marksEntered, status };
}

export default function COEExamOversight() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [exams, setExams] = useState<ExamProgress[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<ExamProgress | null>(null);
  const [createForm, setCreateForm] = useState({
    examName: '',
    semester: '',
    program: '',
    totalStudents: '',
    startDate: '',
    endDate: '',
    coordinator: '',
  });
  const [editForm, setEditForm] = useState({
    examName: '',
    semester: '',
    program: '',
    totalStudents: '',
    marksEntered: '',
    status: 'scheduling',
    startDate: '',
    endDate: '',
    coordinator: '',
  });

  useEffect(() => {
    fetchApi<ExamProgress[]>('/coe/exams')
      .then((data) => setExams(Array.isArray(data) ? data : []))
      .catch((error) => {
        console.error('API request failed', error);
        toast({ title: 'Unable to load exams', description: error?.message || 'Please retry', variant: 'destructive' });
      });
  }, [toast]);

  const handleAdvanceStatus = async (exam: ExamProgress) => {
    const steps: ExamProgress['status'][] = ['scheduling', 'ongoing', 'mark_entry', 'moderation', 'published'];
    const currentStatus = normalizeStatus(String((exam as any).status || 'scheduling'));
    const idx = steps.indexOf(currentStatus);
    if (idx < 0 || idx >= steps.length - 1) return;

    const nextStatus = steps[idx + 1];
    const updatePayload: any = { status: nextStatus };
    if (nextStatus === 'published') {
      updatePayload.resultsPublished = true;
      updatePayload.marksEntered = exam.totalStudents;
    }

    try {
      const updated = await putApi<ExamProgress>(`/coe/exams/${exam.id}`, updatePayload);
      setExams((prev) => prev.map((item) => (item.id === exam.id ? updated : item)));
      toast({ title: 'Status updated', description: `${exam.examName} moved to ${nextStatus.replace('_', ' ')}.` });
    } catch (error: any) {
      toast({ title: 'Update failed', description: error?.message || 'Unable to advance status', variant: 'destructive' });
    }
  };

  const createExam = async () => {
    if (!createForm.examName || !createForm.semester || !createForm.program || !createForm.totalStudents || !createForm.startDate || !createForm.endDate) {
      toast({ title: 'Missing fields', description: 'Fill all required exam details.', variant: 'destructive' });
      return;
    }

    try {
      const created = await postApi<ExamProgress>('/coe/exams', {
        examName: createForm.examName,
        semester: createForm.semester,
        program: createForm.program,
        totalStudents: Number(createForm.totalStudents),
        startDate: createForm.startDate,
        endDate: createForm.endDate,
        coordinator: createForm.coordinator,
      });

      setExams((prev) => [created, ...prev]);
      setCreateOpen(false);
      setCreateForm({ examName: '', semester: '', program: '', totalStudents: '', startDate: '', endDate: '', coordinator: '' });
      toast({ title: 'Exam created', description: `${created.examName} added to exam pipeline.` });
    } catch (error: any) {
      toast({ title: 'Create failed', description: error?.message || 'Unable to create exam', variant: 'destructive' });
    }
  };

  const openEdit = (exam: ExamProgress) => {
    setSelectedExam(exam);
    setEditForm({
      examName: exam.examName,
      semester: exam.semester,
      program: exam.program,
      totalStudents: String(exam.totalStudents),
      marksEntered: String(exam.marksEntered),
      status: exam.status,
      startDate: new Date(exam.startDate).toISOString().slice(0, 10),
      endDate: new Date(exam.endDate).toISOString().slice(0, 10),
      coordinator: exam.coordinator,
    });
    setEditOpen(true);
  };

  const saveExam = async () => {
    if (!selectedExam) return;
    try {
      const updated = await putApi<ExamProgress>(`/coe/exams/${selectedExam.id}`, {
        examName: editForm.examName,
        semester: editForm.semester,
        program: editForm.program,
        totalStudents: Number(editForm.totalStudents),
        marksEntered: Number(editForm.marksEntered),
        status: editForm.status,
        startDate: editForm.startDate,
        endDate: editForm.endDate,
        coordinator: editForm.coordinator,
        resultsPublished: editForm.status === 'published'
      });
      setExams((prev) => prev.map((item) => (item.id === selectedExam.id ? updated : item)));
      setEditOpen(false);
      setSelectedExam(null);
      toast({ title: 'Exam updated', description: `${updated.examName} updated.` });
    } catch (error: any) {
      toast({ title: 'Update failed', description: error?.message || 'Unable to update exam', variant: 'destructive' });
    }
  };

  const confirmDelete = (exam: ExamProgress) => {
    setSelectedExam(exam);
    setDeleteOpen(true);
  };

  const deleteExam = async () => {
    if (!selectedExam) return;
    try {
      await deleteApi(`/coe/exams/${selectedExam.id}`);
      setExams((prev) => prev.filter((item) => item.id !== selectedExam.id));
      setDeleteOpen(false);
      const deletedName = selectedExam.examName;
      setSelectedExam(null);
      toast({ title: 'Exam deleted', description: `${deletedName} removed from pipeline.` });
    } catch (error: any) {
      toast({ title: 'Delete failed', description: error?.message || 'Unable to delete exam', variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">COE Exam Oversight</h1>
            <p className="text-muted-foreground">Monitor exam lifecycle and move completed exams to result submission.</p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => toast({ title: 'Exported', description: 'Exam progress report downloaded.' })}>
            <Download className="h-4 w-4" /> Export Report
          </Button>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Create Exam
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: 'Total Exams', value: exams.length, icon: ClipboardList },
            { label: 'Results Published', value: exams.filter((e) => getSafeCounts(e).status === 'published' || e.resultsPublished).length, icon: CheckCircle },
            { label: 'In Progress', value: exams.filter((e) => ['ongoing', 'mark_entry', 'moderation'].includes(getSafeCounts(e).status)).length, icon: Clock },
            { label: 'Upcoming', value: exams.filter((e) => getSafeCounts(e).status === 'scheduling').length, icon: Calendar },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <s.icon className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          {exams.map((exam) => (
            <Card key={exam.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                {(() => {
                  const { totalStudents, marksEntered, status } = getSafeCounts(exam);
                  const completion = totalStudents > 0 ? Math.round((marksEntered / totalStudents) * 100) : 0;
                  return (
                <div className="flex items-start gap-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${statusColors[status] || statusColors.scheduling}`}>
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm">{exam.examName} - {exam.semester}</p>
                      <Badge className={`text-[10px] ${statusColors[status] || statusColors.scheduling}`}>{status.replace('_', ' ')}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{exam.program} • Coordinator: {exam.coordinator}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <Calendar className="h-3 w-3" /> {new Date(exam.startDate).toLocaleDateString('en-IN')} - {new Date(exam.endDate).toLocaleDateString('en-IN')}
                      <span>•</span>
                      <Users className="h-3 w-3" /> {totalStudents} students
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Progress value={completion} className="h-2 flex-1" />
                      <span className="text-xs font-medium">{completion}% marks entered</span>
                    </div>
                    {marksEntered < totalStudents && status === 'mark_entry' && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> {totalStudents - marksEntered} marks pending entry
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    {status !== 'published' && (
                      <Button size="sm" className="h-7 text-xs gap-1" onClick={() => handleAdvanceStatus(exam)}>
                        <CheckCircle className="h-3 w-3" /> Advance
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openEdit(exam)}>
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => navigate('/coe/results')}>
                      <Send className="h-3 w-3" /> Submit Results
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => toast({ title: 'Hall Tickets', description: `Hall tickets generated for ${exam.totalStudents} students.` })}>
                      <FileText className="h-3 w-3" /> Hall Tickets
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive" onClick={() => confirmDelete(exam)}>
                      <Trash2 className="h-3 w-3" /> Delete
                    </Button>
                  </div>
                </div>
                  );
                })()}
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Exam Cycle</DialogTitle>
              <DialogDescription>Update exam details and lifecycle status.</DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <Label>Exam Name</Label>
                <Input value={editForm.examName} onChange={(e) => setEditForm((p) => ({ ...p, examName: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Semester</Label>
                  <Input value={editForm.semester} onChange={(e) => setEditForm((p) => ({ ...p, semester: e.target.value }))} />
                </div>
                <div>
                  <Label>Program</Label>
                  <Input value={editForm.program} onChange={(e) => setEditForm((p) => ({ ...p, program: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Total Students</Label>
                  <Input type="number" value={editForm.totalStudents} onChange={(e) => setEditForm((p) => ({ ...p, totalStudents: e.target.value }))} />
                </div>
                <div>
                  <Label>Marks Entered</Label>
                  <Input type="number" value={editForm.marksEntered} onChange={(e) => setEditForm((p) => ({ ...p, marksEntered: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(value) => setEditForm((p) => ({ ...p, status: value as ExamProgress['status'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduling">Scheduling</SelectItem>
                    <SelectItem value="ongoing">Ongoing</SelectItem>
                    <SelectItem value="mark_entry">Mark Entry</SelectItem>
                    <SelectItem value="moderation">Moderation</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start Date</Label>
                  <Input type="date" value={editForm.startDate} onChange={(e) => setEditForm((p) => ({ ...p, startDate: e.target.value }))} />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input type="date" value={editForm.endDate} onChange={(e) => setEditForm((p) => ({ ...p, endDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Coordinator</Label>
                <Input value={editForm.coordinator} onChange={(e) => setEditForm((p) => ({ ...p, coordinator: e.target.value }))} />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button onClick={saveExam}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Exam Cycle</DialogTitle>
              <DialogDescription>
                Delete {selectedExam?.examName || 'this exam'} from the pipeline? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={deleteExam}>Delete Exam</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Exam Cycle</DialogTitle>
              <DialogDescription>Set up a new exam and add it to the COE oversight pipeline.</DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <Label>Exam Name</Label>
                <Input value={createForm.examName} onChange={(e) => setCreateForm((p) => ({ ...p, examName: e.target.value }))} placeholder="End Semester Examination" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Semester</Label>
                  <Input value={createForm.semester} onChange={(e) => setCreateForm((p) => ({ ...p, semester: e.target.value }))} placeholder="Semester 5" />
                </div>
                <div>
                  <Label>Program</Label>
                  <Input value={createForm.program} onChange={(e) => setCreateForm((p) => ({ ...p, program: e.target.value }))} placeholder="B.Tech CSE" />
                </div>
              </div>
              <div>
                <Label>Total Students</Label>
                <Input type="number" value={createForm.totalStudents} onChange={(e) => setCreateForm((p) => ({ ...p, totalStudents: e.target.value }))} placeholder="120" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start Date</Label>
                  <Input type="date" value={createForm.startDate} onChange={(e) => setCreateForm((p) => ({ ...p, startDate: e.target.value }))} />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input type="date" value={createForm.endDate} onChange={(e) => setCreateForm((p) => ({ ...p, endDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Coordinator (optional)</Label>
                <Input value={createForm.coordinator} onChange={(e) => setCreateForm((p) => ({ ...p, coordinator: e.target.value }))} placeholder="Rahul COE" />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={createExam}>Create Exam</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

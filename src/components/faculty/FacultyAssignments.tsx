import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UploadField } from '@/components/ui/upload-field';
import {
  Plus, FileText, Upload, Download, CheckCircle2, Clock,
  AlertTriangle, Eye, MessageSquare
} from 'lucide-react';
import { fetchApi, postApi, putApi, uploadApi, downloadUpload } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, Fragment } from 'react';

export default function FacultyAssignments() {
  const [facultyAssignments, setFacultyAssignments] = useState<any>([]);
  const [facultyClasses, setFacultyClasses] = useState<any>([]);
  const [submissions, setSubmissions] = useState<any>([]);
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [_apiLoading, _setApiLoading] = useState(true);
  const { toast } = useToast();

  const loadAssignmentData = async (semester?: string) => {
    const semesterQuery = semester ? `?semester=${semester}` : '';
    const [assignmentsData, submissionsData] = await Promise.all([
      fetchApi(`/faculty/assignments${semesterQuery}`),
      fetchApi(`/faculty/assignments/submissions${semesterQuery}`)
    ]);
    setFacultyAssignments(assignmentsData);
    setSubmissions(submissionsData);
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        const classesData = await fetchApi('/faculty/classes');
        setFacultyClasses(classesData);
        const semesterOptions = Array.from(new Set((classesData || []).map((item: any) => Number(item?.semester)).filter((value) => Number.isFinite(value)))).sort((a: any, b: any) => a - b);
        const currentSemesterData = await fetchApi('/faculty/current-semester');
        const apiCurrentSemester = Number(currentSemesterData?.currentSemester);
        const defaultSemester = Number.isFinite(apiCurrentSemester) && semesterOptions.includes(apiCurrentSemester)
          ? String(apiCurrentSemester)
          : (semesterOptions.length > 0 ? String(semesterOptions[semesterOptions.length - 1]) : '');
        setSelectedSemester(defaultSemester);
        await loadAssignmentData(defaultSemester);
      } catch (error) {
        console.error('API request failed', error);
      } finally {
        _setApiLoading(false);
      }
    };

    initialize();
  }, []);

  useEffect(() => {
    if (_apiLoading) return;
    loadAssignmentData(selectedSemester).catch((error) => { console.error('API request failed', error); });
  }, [selectedSemester]);

  const [gradingId, setGradingId] = useState<string | null>(null);
  // Feedback typed per submission; saved with the marks.
  const [feedbackEdits, setFeedbackEdits] = useState<Record<string, string>>({});
  const [feedbackFor, setFeedbackFor] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingGrades, setSavingGrades] = useState(false);
  const [gradeEdits, setGradeEdits] = useState<Record<string, string>>({});
  // Every student in the class, submitted or not (GET /assignments/:id/roster).
  const [roster, setRoster] = useState<any[] | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const loadRoster = async (assignmentId: string) => {
    const rows = await fetchApi<any[]>(`/faculty/assignments/${assignmentId}/roster`);
    setRoster(Array.isArray(rows) ? rows : []);
  };
  useEffect(() => {
    setRoster(null);
    if (gradingId) loadRoster(gradingId).catch((error) => toast({ title: 'Could not load the class', description: error?.message, variant: 'destructive' }));
  }, [gradingId]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Submitted ↔ not submitted, e.g. for a paper handed in by hand. */
  const setSubmitted = async (row: any, submitted: boolean) => {
    if (!gradingId) return;
    if (!submitted && row.marks != null && !window.confirm(`${row.rollNumber} has been graded (${row.marks}). Marking them not submitted removes the marks and any uploaded file. Continue?`)) return;
    setTogglingId(row.studentId);
    try {
      await putApi(`/faculty/assignments/${gradingId}/students/${row.studentId}/submission`, { submitted });
      await Promise.all([loadRoster(gradingId), loadAssignmentData(selectedSemester)]);
    } catch (error: any) {
      toast({ title: 'Update failed', description: error?.message || 'Unable to change the status.', variant: 'destructive' });
    } finally {
      setTogglingId(null);
    }
  };
  const [createForm, setCreateForm] = useState({
    classId: '',
    title: '',
    description: '',
    dueDate: '',
    maxMarks: '100'
  });
  const [createAttachment, setCreateAttachment] = useState<File | null>(null);

  const statusIcon = {
    draft: <FileText className="h-4 w-4 text-muted-foreground" />,
    published: <Clock className="h-4 w-4 text-amber-500" />,
    closed: <AlertTriangle className="h-4 w-4 text-orange-500" />,
    graded: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  };

  const createAssessment = async (status: 'draft' | 'published') => {
    if (!createForm.classId || !createForm.title.trim() || !createForm.dueDate) {
      toast({ title: 'Missing details', description: 'Class, title, and due date are required.', variant: 'destructive' });
      return;
    }
    try {
      setCreating(true);
      let attachmentUrl: string | undefined;
      if (createAttachment) {
        // Uploaded private by default, so the students it was for got a 403.
        const uploaded: any = await uploadApi(createAttachment, 'faculty-assignments', {
          visibility: 'role_restricted',
          allowedRoles: ['student', 'faculty', 'hod']
        });
        attachmentUrl = uploaded?.url;
      }

      const created = await postApi('/faculty/assignments', {
        classId: createForm.classId,
        title: createForm.title.trim(),
        description: createForm.description.trim(),
        dueDate: createForm.dueDate,
        maxMarks: Number(createForm.maxMarks || 100),
        status,
        ...(attachmentUrl ? { attachmentUrl, attachmentName: createAttachment?.name } : {})
      });
      const classRecord = facultyClasses.find((item: any) => item.id === createForm.classId) || {};
      setFacultyAssignments((prev: any[]) => [{
        ...created,
        className: classRecord.className || '',
        section: classRecord.section || '',
        batch: classRecord.batch || '',
        courseCode: classRecord.code || '',
        courseName: classRecord.name || '',
        type: 'assignment',
        totalSubmissions: 0,
        pendingEvaluation: 0
      }, ...prev]);
      setShowCreateDialog(false);
      setCreateForm({ classId: '', title: '', description: '', dueDate: '', maxMarks: '100' });
      setCreateAttachment(null);
      toast({ title: status === 'draft' ? 'Draft saved' : 'Assessment published' });
    } catch (error: any) {
      toast({ title: 'Create failed', description: error?.message || 'Unable to create assessment.', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const publishDraft = async (id: string) => {
    try {
      const updated = await putApi(`/faculty/assignments/${id}`, { status: 'published' });
      setFacultyAssignments((prev: any[]) => prev.map((assignment) => assignment.id === id ? { ...assignment, ...updated, status: 'published' } : assignment));
      toast({ title: 'Draft published' });
    } catch (error: any) {
      toast({ title: 'Publish failed', description: error?.message || 'Unable to publish draft.', variant: 'destructive' });
    }
  };

  const saveGrades = async () => {
    const targetSubmissions = (roster ?? [])
      .filter((row: any) => row.submitted)
      .map((row: any) => ({ ...row, id: row.submissionId, assignmentId: gradingId }));
    const gradingMax = Number(facultyAssignments.find((a: any) => a.id === gradingId)?.maxMarks ?? 100);
    const toUpdate = targetSubmissions.filter((submission: any) => gradeEdits[submission.id] !== undefined || feedbackEdits[submission.id] !== undefined);
    const outOfRange = toUpdate.find((submission: any) => {
      const value = Number(gradeEdits[submission.id] ?? submission.marks);
      return gradeEdits[submission.id] !== undefined && (!Number.isFinite(value) || value < 0 || value > gradingMax);
    });
    if (outOfRange) {
      toast({ title: 'Check the marks', description: `Marks for ${outOfRange.studentName} must be between 0 and ${gradingMax}.`, variant: 'destructive' });
      return;
    }
    if (toUpdate.length === 0) {
      toast({ title: 'No changes', description: 'No grade edits to save.' });
      return;
    }
    try {
      setSavingGrades(true);
      for (const submission of toUpdate) {
        await putApi(`/faculty/assignments/${submission.assignmentId}/submissions/${submission.id}/grade`, {
          marks: Number(gradeEdits[submission.id] ?? submission.marks ?? 0),
          feedback: feedbackEdits[submission.id] ?? submission.feedback ?? ''
        });
      }
      setSubmissions((prev: any[]) => prev.map((submission) => (
        gradeEdits[submission.id] !== undefined || feedbackEdits[submission.id] !== undefined
          ? { ...submission, marks: Number(gradeEdits[submission.id] ?? submission.marks ?? 0), feedback: feedbackEdits[submission.id] ?? submission.feedback, status: 'evaluated' }
          : submission
      )));
      setGradeEdits({});
      setFeedbackEdits({});
      setGradingId(null);
      loadAssignmentData(selectedSemester).catch(() => undefined);
      toast({ title: 'Grades saved' });
    } catch (error: any) {
      toast({ title: 'Save failed', description: error?.message || 'Unable to save grades.', variant: 'destructive' });
    } finally {
      setSavingGrades(false);
    }
  };

  const exportAssignments = () => {
    const payload = facultyAssignments.map((assignment: any) => ({
      courseCode: assignment.courseCode,
      courseName: assignment.courseName,
      title: assignment.title,
      dueDate: assignment.dueDate,
      maxMarks: assignment.maxMarks,
      status: assignment.status,
      totalSubmissions: assignment.totalSubmissions,
      pendingEvaluation: assignment.pendingEvaluation
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `faculty-assignments-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadSubmission = (submission: any) => {
    if (submission.fileUrl) {
      // Opening the URL in a tab sends no login token, so the file was refused.
      downloadUpload(submission.fileUrl, `${submission.rollNumber}-submission`).catch((error) =>
        toast({ title: 'Download failed', description: error?.message || 'The file could not be downloaded.', variant: 'destructive' }));
      return;
    }
    const blob = new Blob([JSON.stringify(submission, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `submission-${submission.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Assignments & Assessments</h1>
          <div className="w-56">
            <Select value={selectedSemester || 'all'} onValueChange={(value) => setSelectedSemester(value === 'all' ? '' : value)}>
              <SelectTrigger><SelectValue placeholder="Select semester" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Semesters</SelectItem>
                {Array.from(new Set(facultyClasses.map((item: any) => Number(item?.semester)).filter((value) => Number.isFinite(value)))).sort((a: any, b: any) => a - b).map((semester: any) => (
                  <SelectItem key={semester} value={String(semester)}>Semester {semester}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-1 h-4 w-4" />Create Assessment</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create New Assessment</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Class</Label>
                  <Select value={createForm.classId} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, classId: value }))}><SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                    <SelectContent>
                      {facultyClasses.map((item: any) => (
                        <SelectItem key={item.id} value={item.id}>{item.code} - {item.name} / {item.section}{item.batch ? ` (${item.batch})` : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Title</Label><Input placeholder="Assessment title" value={createForm.title} onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))} /></div>
                <div><Label>Description</Label><Textarea placeholder="Instructions..." value={createForm.description} onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Due Date</Label><Input type="date" value={createForm.dueDate} onChange={(event) => setCreateForm((prev) => ({ ...prev, dueDate: event.target.value }))} /></div>
                  <div><Label>Max Marks</Label><Input type="number" placeholder="100" value={createForm.maxMarks} onChange={(event) => setCreateForm((prev) => ({ ...prev, maxMarks: event.target.value }))} /></div>
                </div>
                <UploadField
                  label="Attachments"
                  file={createAttachment}
                  accept=".pdf,.doc,.docx,.zip"
                  helperText="Optional. Upload reference files for students."
                  onFileSelect={setCreateAttachment}
                />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => createAssessment('draft')} disabled={creating}>Save as Draft</Button>
                  <Button className="flex-1" onClick={() => createAssessment('published')} disabled={creating}>{creating ? 'Saving...' : 'Publish'}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="graded">Graded</TabsTrigger>
            <TabsTrigger value="drafts">Drafts</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4 space-y-3">
            {facultyAssignments.filter(a => a.status === 'published').map((asn) => (
              <Card key={asn.id} className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{asn.courseCode}</Badge>
                        {asn.section && <Badge variant="secondary">Sec {asn.section}</Badge>}
                        <Badge variant="secondary" className="capitalize text-[10px]">{asn.type.replace('_', ' ')}</Badge>
                      </div>
                      <h3 className="text-lg font-medium text-foreground">{asn.title}</h3>
                      <p className="text-sm text-muted-foreground">{asn.description}</p>
                      {asn.attachmentUrl && (
                        <button
                          type="button"
                          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          onClick={() => downloadUpload(asn.attachmentUrl, asn.attachmentName || 'assignment').catch((error) =>
                            toast({ title: 'Download failed', description: error?.message, variant: 'destructive' }))}
                        >
                          <FileText className="h-3.5 w-3.5" />{asn.attachmentName || 'Attachment'}
                        </button>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Due: {asn.dueDate ? new Date(asn.dueDate).toLocaleDateString('en-IN') : '—'}</span>
                        <span>Max Marks: {asn.maxMarks}</span>
                        <span className="font-medium text-foreground">{asn.totalSubmissions}/{asn.classSize ?? '—'} submitted</span>
                        {asn.notSubmitted > 0 && <span className="text-amber-600">{asn.notSubmitted} not submitted</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {asn.pendingEvaluation > 0 && (
                        <Badge variant="destructive">{asn.pendingEvaluation} to grade</Badge>
                      )}
                      <Button size="sm" onClick={() => setGradingId(asn.id)}>
                        <Eye className="mr-1 h-4 w-4" />View Submissions
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="graded" className="mt-4 space-y-3">
            {facultyAssignments.filter(a => a.status === 'graded').map((asn) => (
              <Card key={asn.id} className="border-border">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{asn.courseCode}</Badge>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </div>
                    <h3 className="mt-1 font-medium text-foreground">{asn.title}</h3>
                    <p className="text-xs text-muted-foreground">{asn.totalSubmissions} submissions graded • Max: {asn.maxMarks}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={exportAssignments}><Download className="mr-1 h-4 w-4" />Export</Button>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="drafts" className="mt-4 space-y-3">
            {facultyAssignments.filter(a => a.status === 'draft').map((asn) => (
              <Card key={asn.id} className="border-border">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{asn.courseCode}</Badge>
                      <Badge variant="secondary">Draft</Badge>
                    </div>
                    <h3 className="mt-1 font-medium text-foreground">{asn.title}</h3>
                    <p className="text-xs text-muted-foreground">Due: {asn.dueDate ? new Date(asn.dueDate).toLocaleDateString('en-IN') : '—'} • Max: {asn.maxMarks}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setGradingId(asn.id)}>View</Button>
                    <Button size="sm" onClick={() => publishDraft(asn.id)}>Publish</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>

        {/* Submissions Dialog — the whole class, so non-submitters are visible too. */}
        <Dialog open={!!gradingId} onOpenChange={() => setGradingId(null)}>
          <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{facultyAssignments.find((x: any) => x.id === gradingId)?.title ?? 'Student Submissions'}</DialogTitle>
              {roster && (
                <p className="text-sm text-muted-foreground">
                  {roster.filter((r) => r.submitted).length}/{roster.length} submitted ·{' '}
                  {roster.filter((r) => r.status === 'submitted').length} to grade ·{' '}
                  {roster.filter((r) => !r.submitted).length} not submitted
                </p>
              )}
            </DialogHeader>
            {roster === null ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Loading class…</p>
            ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Roll No</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Submission</TableHead>
                  <TableHead>Submitted on</TableHead>
                  <TableHead>Marks</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roster.map((row) => {
                  const subKey = row.submissionId as string;
                  return (
                  <Fragment key={row.studentId}>
                  <TableRow className={row.submitted ? '' : 'bg-muted/40'}>
                    <TableCell className="font-mono">{row.rollNumber}</TableCell>
                    <TableCell>{row.studentName}</TableCell>
                    <TableCell>
                      {/* Faculty can flip either way: a paper handed in by hand,
                          or a submission that should not count. */}
                      <div className="flex w-fit whitespace-nowrap rounded-md border p-0.5 text-xs">
                        <button type="button" disabled={togglingId === row.studentId}
                          onClick={() => !row.submitted && setSubmitted(row, true)}
                          className={`rounded px-2 py-1 ${row.submitted ? 'bg-green-600 text-white' : 'hover:bg-muted'}`}>Submitted</button>
                        <button type="button" disabled={togglingId === row.studentId}
                          onClick={() => row.submitted && setSubmitted(row, false)}
                          className={`rounded px-2 py-1 ${!row.submitted ? 'bg-amber-500 text-white' : 'hover:bg-muted'}`}>Not submitted</button>
                      </div>
                      {row.status === 'evaluated' && <Badge className="mt-1 text-[10px]">Graded</Badge>}
                      {row.late && <Badge variant="destructive" className="ml-1 mt-1 text-[10px]">Late</Badge>}
                    </TableCell>
                    <TableCell className="text-xs">{row.submittedAt ? new Date(row.submittedAt).toLocaleString('en-IN') : '—'}</TableCell>
                    <TableCell>
                      {row.submitted ? (
                        <div className="flex items-center gap-1">
                          <Input type="number" min={0} className="w-20" placeholder="—"
                            value={gradeEdits[subKey] ?? (row.marks ?? '')}
                            onChange={(event) => setGradeEdits((prev) => ({ ...prev, [subKey]: event.target.value }))} />
                          <span className="text-xs text-muted-foreground">/{facultyAssignments.find((a: any) => a.id === gradingId)?.maxMarks ?? 100}</span>
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {row.submitted && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" title={row.fileUrl ? 'Download file' : 'No file (submitted on paper)'} disabled={!row.fileUrl} onClick={() => downloadSubmission(row)}><Download className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" title="Feedback" onClick={() => setFeedbackFor(feedbackFor === subKey ? null : subKey)}><MessageSquare className="h-4 w-4" /></Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                  {row.submitted && feedbackFor === subKey && (
                    <TableRow key={`${subKey}-feedback`}>
                      <TableCell colSpan={6}>
                        <Textarea rows={2} placeholder="Feedback for the student (saved with the marks)" value={feedbackEdits[subKey] ?? (row.feedback ?? '')}
                          onChange={(event) => setFeedbackEdits((prev) => ({ ...prev, [subKey]: event.target.value }))} />
                      </TableCell>
                    </TableRow>
                  )}
                  </Fragment>
                  );
                })}
              </TableBody>
            </Table>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setGradingId(null)}>Close</Button>
              <Button onClick={saveGrades} disabled={savingGrades}>{savingGrades ? 'Saving...' : 'Save Grades'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

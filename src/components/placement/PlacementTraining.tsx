import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  GraduationCap, Calendar, Users, Clock, MapPin, Plus, Download,
  BookOpen, ClipboardList, Star, FileText, CheckCircle2, Play, Eye, Edit, Trash2
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { deleteApi, fetchApi, postApi, putApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';

interface SessionFormState {
  title: string;
  type: string;
  instructor: string;
  date: string;
  duration: string;
  venue: string;
  maxCapacity: string;
  registeredCount: string;
  status: string;
  materials: string;
}

const formatDate = (value: unknown) => {
  if (!value) return '-';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString('en-IN');
};

const formatType = (value: unknown) => String(value || 'session').replace('_', ' ');

export default function PlacementTraining() {
  const { toast } = useToast();
  const [trainingSessions, setTrainingSessions] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [internshipOpen, setInternshipOpen] = useState(false);
  const [performanceOpen, setPerformanceOpen] = useState(false);
  const [internshipMode, setInternshipMode] = useState<'Post' | 'Manage' | 'View'>('Post');
  const [attendanceCount, setAttendanceCount] = useState('0');
  const [attendanceStatus, setAttendanceStatus] = useState('ongoing');
  const [internshipTitle, setInternshipTitle] = useState('Internship Opportunity');
  const [internshipCompany, setInternshipCompany] = useState('');
  const [internshipRole, setInternshipRole] = useState('Intern');
  const [internshipAudience, setInternshipAudience] = useState('eligible');
  const [internshipStudentId, setInternshipStudentId] = useState('');
  const [internshipNotes, setInternshipNotes] = useState('');
  const [performanceType, setPerformanceType] = useState('training_performance');
  const [performancePeriod, setPerformancePeriod] = useState('current_semester');
  const [form, setForm] = useState<SessionFormState>({
    title: '',
    type: 'interview_prep',
    instructor: 'Placement Cell',
    date: new Date().toISOString().slice(0, 10),
    duration: '120',
    venue: 'Seminar Hall A',
    maxCapacity: '200',
    registeredCount: '0',
    status: 'scheduled',
    materials: 'Slide Deck',
  });

  const setFormField = (field: keyof SessionFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm({
      title: '',
      type: 'interview_prep',
      instructor: 'Placement Cell',
      date: new Date().toISOString().slice(0, 10),
      duration: '120',
      venue: 'Seminar Hall A',
      maxCapacity: '200',
      registeredCount: '0',
      status: 'scheduled',
      materials: 'Slide Deck',
    });
  };

  const loadTraining = async () => {
    setLoading(true);
    const data = await fetchApi('/placements/training');
    setTrainingSessions(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    loadTraining().catch((error) => {
      console.error('API request failed', error);
      toast({ title: 'Unable to load training sessions', description: error?.message || 'Please retry', variant: 'destructive' });
    });
  }, []);

  const openCreate = () => {
    setSelectedSession(null);
    resetForm();
    setCreateOpen(true);
  };

  const openEdit = (session: any) => {
    setSelectedSession(session);
    setForm({
      title: String(session.title || ''),
      type: String(session.type || 'interview_prep'),
      instructor: String(session.instructor || ''),
      date: String(session.date || '').slice(0, 10),
      duration: String(session.duration || 60),
      venue: String(session.venue || ''),
      maxCapacity: String(session.maxCapacity || 100),
      registeredCount: String(session.registeredCount || 0),
      status: String(session.status || 'scheduled'),
      materials: Array.isArray(session.materials) ? session.materials.join(', ') : '',
    });
    setEditOpen(true);
  };

  const openView = (session: any) => {
    setSelectedSession(session);
    setViewOpen(true);
  };

  const handleCreateSession = async () => {
    if (!form.title.trim()) {
      toast({ title: 'Missing title', description: 'Session title is required.', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      await postApi('/placements/training', {
        title: form.title.trim(),
        type: form.type,
        instructor: form.instructor.trim(),
        date: new Date(form.date).toISOString(),
        duration: Number(form.duration || 60),
        venue: form.venue.trim(),
        maxCapacity: Number(form.maxCapacity || 100),
        registeredCount: Number(form.registeredCount || 0),
        status: form.status,
        materials: form.materials.split(',').map((m) => m.trim()).filter(Boolean)
      });
      await loadTraining();
      setCreateOpen(false);
      toast({ title: 'Session created', description: 'Training session created successfully.' });
    } catch (error: any) {
      toast({ title: 'Create failed', description: error?.message || 'Unable to create session.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSession = async () => {
    if (!selectedSession) return;

    try {
      setSaving(true);
      await putApi(`/placements/training/${selectedSession.id}`, {
        title: form.title.trim(),
        type: form.type,
        instructor: form.instructor.trim(),
        date: new Date(form.date).toISOString(),
        duration: Number(form.duration || 60),
        venue: form.venue.trim(),
        maxCapacity: Number(form.maxCapacity || 100),
        registeredCount: Number(form.registeredCount || 0),
        status: form.status,
        materials: form.materials.split(',').map((m) => m.trim()).filter(Boolean)
      });
      await loadTraining();
      setEditOpen(false);
      setSelectedSession(null);
      toast({ title: 'Session updated', description: 'Training session updated successfully.' });
    } catch (error: any) {
      toast({ title: 'Update failed', description: error?.message || 'Unable to update session.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSession = async () => {
    if (!selectedSession) return;

    try {
      setSaving(true);
      await deleteApi(`/placements/training/${selectedSession.id}`);
      await loadTraining();
      setDeleteOpen(false);
      setSelectedSession(null);
      toast({ title: 'Session deleted', description: 'Training session removed successfully.' });
    } catch (error: any) {
      toast({ title: 'Delete failed', description: error?.message || 'Unable to delete session.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleStartSession = async (session: any) => {
    try {
      await putApi(`/placements/training/${session.id}`, { status: 'ongoing' });
      await loadTraining();
      toast({ title: 'Session started', description: `${session.title} is now ongoing.` });
    } catch (error: any) {
      toast({ title: 'Unable to start', description: error?.message || 'Try again.', variant: 'destructive' });
    }
  };

  const openAttendance = (session: any) => {
    setSelectedSession(session);
    setAttendanceCount(String(session.registeredCount || 0));
    setAttendanceStatus(String(session.status || 'ongoing'));
    setAttendanceOpen(true);
  };

  const handleAttendance = async () => {
    if (!selectedSession) return;

    const max = Number(selectedSession.maxCapacity || 0);
    const entered = Number(attendanceCount || 0);
    const nextCount = max > 0 ? Math.max(0, Math.min(entered, max)) : Math.max(0, entered);

    try {
      await putApi(`/placements/training/${selectedSession.id}`, {
        registeredCount: nextCount,
        status: attendanceStatus.trim() || selectedSession.status
      });
      await loadTraining();
      setAttendanceOpen(false);
      toast({ title: 'Attendance updated', description: `${selectedSession.title} attendance updated to ${nextCount}/${max || 'N/A'}.` });
    } catch (error: any) {
      toast({ title: 'Unable to update attendance', description: error?.message || 'Try again.', variant: 'destructive' });
    }
  };

  const handleGenerateAttendanceReport = async () => {
    try {
      await postApi('/placements/reports/generate', { type: 'training_attendance' });
      toast({ title: 'Report generated', description: 'Training attendance report generated successfully.' });
    } catch (error: any) {
      toast({ title: 'Generation failed', description: error?.message || 'Unable to generate report.', variant: 'destructive' });
    }
  };

  const openInternshipAction = async (action: 'Post' | 'Manage' | 'View') => {
    setInternshipMode(action);
    setInternshipNotes('');
    setInternshipCompany('');
    setInternshipRole('Intern');
    setInternshipAudience('eligible');

    if (action === 'Manage') {
      try {
        const data = await fetchApi<any[]>('/placements/students');
        const list = Array.isArray(data) ? data : [];
        setStudents(list);
        setInternshipStudentId(list[0]?.id ? String(list[0].id) : '');
      } catch (error: any) {
        toast({ title: 'Unable to load students', description: error?.message || 'Try again.', variant: 'destructive' });
        return;
      }
    }

    setInternshipOpen(true);
  };

  const handleInternshipAction = async () => {
    try {
      if (internshipMode === 'Post') {
        await postApi('/placements/messages', {
          subject: internshipTitle.trim() || 'Internship opportunities announced',
          message: `Company: ${internshipCompany || 'TBD'}\nRole: ${internshipRole || 'Intern'}\nDetails: ${internshipNotes || 'Internship opportunities are available.'}`,
          channel: 'email',
          targetAudience: internshipAudience || 'eligible'
        });
        setInternshipOpen(false);
        toast({ title: 'Opportunity posted', description: 'Internship notification sent to students.' });
        return;
      }

      if (internshipMode === 'Manage') {
        const selectedStudent = students.find((s) => String(s.id) === String(internshipStudentId));
        if (!selectedStudent) {
          toast({ title: 'Select a student', description: 'Please choose a student for assignment.', variant: 'destructive' });
          return;
        }

        await postApi('/placements/messages', {
          subject: `Internship Assignment: ${internshipRole || 'Internship'}`,
          message: `Assigned Student: ${selectedStudent.name} (${selectedStudent.rollNumber || selectedStudent.rollNo || 'N/A'})\nCompany: ${internshipCompany || 'TBD'}\nNotes: ${internshipNotes || 'Assignment created by placement office.'}`,
          channel: 'email',
          targetAudience: String(selectedStudent.rollNumber || selectedStudent.rollNo || selectedStudent.name)
        });
        setInternshipOpen(false);
        toast({ title: 'Assignment recorded', description: `${selectedStudent.name} assigned successfully.` });
        return;
      }

      await postApi('/placements/reports/generate', {
        type: 'internship_completion',
        period: performancePeriod,
        notes: internshipNotes
      });
      setInternshipOpen(false);
      toast({ title: 'Completion records ready', description: 'Internship completion report generated.' });
    } catch (error: any) {
      toast({ title: 'Action failed', description: error?.message || 'Unable to complete action.', variant: 'destructive' });
    }
  };

  const handlePerformanceReport = async () => {
    try {
      await postApi('/placements/reports/generate', {
        type: performanceType,
        period: performancePeriod
      });
      setPerformanceOpen(false);
      toast({ title: 'Performance report generated', description: 'Training performance report is ready.' });
    } catch (error: any) {
      toast({ title: 'Generation failed', description: error?.message || 'Unable to generate performance report.', variant: 'destructive' });
    }
  };

  const avgAttendance = trainingSessions.length > 0
    ? Math.round(trainingSessions.reduce((sum: number, ts: any) => {
        const cap = Number(ts.maxCapacity || 0);
        const reg = Number(ts.registeredCount || 0);
        return sum + (cap > 0 ? (reg / cap) * 100 : 0);
      }, 0) / trainingSessions.length)
    : 0;
  const activeInternships = 0;
  const companiesOffering = new Set(trainingSessions.map((ts: any) => String(ts.instructor || '').trim()).filter(Boolean)).size;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Training & Internships</h1>
            <p className="text-muted-foreground">Schedule training sessions, manage internships, and track student readiness</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleGenerateAttendanceReport}><Download className="mr-2 h-4 w-4" />Attendance Report</Button>
            <Button size="sm" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Schedule Session</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Sessions This Month</p><p className="text-2xl font-bold text-foreground">{trainingSessions.length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Avg Attendance</p><p className="text-2xl font-bold text-green-600">{avgAttendance}%</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Active Internships</p><p className="text-2xl font-bold text-foreground">{activeInternships}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Companies Offering</p><p className="text-2xl font-bold text-foreground">{companiesOffering}</p></CardContent></Card>
        </div>

        <Tabs defaultValue="training">
          <TabsList>
            <TabsTrigger value="training">Training Sessions</TabsTrigger>
            <TabsTrigger value="internships">Internship Management</TabsTrigger>
            <TabsTrigger value="performance">Student Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="training" className="space-y-4">
            {loading && <p className="text-sm text-muted-foreground">Loading sessions...</p>}
            {trainingSessions.map((ts) => (
              <Card key={ts.id} className="hover:bg-muted/20 transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                        {ts.type === 'aptitude' ? <Star className="h-6 w-6 text-primary" /> :
                         ts.type === 'technical' ? <BookOpen className="h-6 w-6 text-primary" /> :
                         ts.type === 'resume_building' ? <FileText className="h-6 w-6 text-primary" /> :
                         <GraduationCap className="h-6 w-6 text-primary" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">{ts.title}</h3>
                          <Badge variant={ts.status === 'scheduled' ? 'default' : ts.status === 'completed' ? 'secondary' : 'default'} className="capitalize">{ts.status}</Badge>
                          <Badge variant="outline" className="capitalize">{formatType(ts.type)}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{ts.instructor}</p>
                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                          <span><Calendar className="mr-1 inline h-3 w-3" />{formatDate(ts.date)}</span>
                          <span><Clock className="mr-1 inline h-3 w-3" />{ts.duration} min</span>
                          <span><MapPin className="mr-1 inline h-3 w-3" />{ts.venue}</span>
                          <span><Users className="mr-1 inline h-3 w-3" />{ts.registeredCount}/{ts.maxCapacity} registered</span>
                        </div>
                        {Array.isArray(ts.materials) && ts.materials.length > 0 && (
                          <div className="mt-2 flex gap-2">
                            {ts.materials.map((m: string) => (
                              <Badge key={m} variant="secondary" className="text-xs"><FileText className="mr-1 h-3 w-3" />{m}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openView(ts)}><Eye className="mr-1 h-3 w-3" />View</Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(ts)}><Edit className="mr-1 h-3 w-3" />Edit</Button>
                      <Button variant="outline" size="sm" onClick={() => openAttendance(ts)}><ClipboardList className="mr-1 h-3 w-3" />Attendance</Button>
                      {ts.status === 'scheduled' && <Button size="sm" onClick={() => handleStartSession(ts)}><Play className="mr-1 h-3 w-3" />Start</Button>}
                      <Button variant="outline" size="sm" onClick={() => { setSelectedSession(ts); setDeleteOpen(true); }}><Trash2 className="mr-1 h-3 w-3" />Delete</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="internships">
            <Card>
              <CardHeader><CardTitle className="text-lg">Internship Management</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Advertise internship opportunities, collect student preferences, track who went where, and record completion certificates.</p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {[
                    { title: 'Post Opportunity', desc: 'Advertise new internship openings from partner companies', icon: Plus, action: 'Post' },
                    { title: 'Student Assignments', desc: 'View/assign students to internship positions', icon: Users, action: 'Manage' },
                    { title: 'Completion Records', desc: 'Track internship completion, certificates, and feedback', icon: CheckCircle2, action: 'View' },
                  ].map((item) => (
                    <Card key={item.title} className="cursor-pointer hover:bg-muted/30">
                      <CardContent className="flex flex-col items-center p-6 text-center">
                        <item.icon className="h-10 w-10 text-primary/60" />
                        <h3 className="mt-3 font-semibold text-foreground">{item.title}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
                        <Button size="sm" variant="outline" className="mt-3" onClick={() => openInternshipAction(item.action as 'Post' | 'Manage' | 'View')}>{item.action}</Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Star className="h-16 w-16 text-muted-foreground/30" />
                <h3 className="mt-4 text-lg font-semibold text-foreground">Training Performance Tracker</h3>
                <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
                  View student-wise attendance and performance across all training sessions. Identify students needing additional preparation.
                </p>
                <Button className="mt-4" onClick={() => setPerformanceOpen(true)}>View Performance Dashboard</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Training Session</DialogTitle>
              <DialogDescription>Add a new training plan for student readiness.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div><Label>Title</Label><Input value={form.title} onChange={(e) => setFormField('title', e.target.value)} /></div>
              <div><Label>Type</Label><Input value={form.type} onChange={(e) => setFormField('type', e.target.value)} /></div>
              <div><Label>Instructor</Label><Input value={form.instructor} onChange={(e) => setFormField('instructor', e.target.value)} /></div>
              <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setFormField('date', e.target.value)} /></div>
              <div><Label>Duration (minutes)</Label><Input type="number" value={form.duration} onChange={(e) => setFormField('duration', e.target.value)} /></div>
              <div><Label>Venue</Label><Input value={form.venue} onChange={(e) => setFormField('venue', e.target.value)} /></div>
              <div><Label>Max Capacity</Label><Input type="number" value={form.maxCapacity} onChange={(e) => setFormField('maxCapacity', e.target.value)} /></div>
              <div><Label>Registered Count</Label><Input type="number" value={form.registeredCount} onChange={(e) => setFormField('registeredCount', e.target.value)} /></div>
              <div><Label>Status</Label><Input value={form.status} onChange={(e) => setFormField('status', e.target.value)} /></div>
              <div><Label>Materials (comma separated)</Label><Input value={form.materials} onChange={(e) => setFormField('materials', e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleCreateSession} disabled={saving}>{saving ? 'Saving...' : 'Create Session'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Training Session</DialogTitle>
              <DialogDescription>Update session schedule and details.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div><Label>Title</Label><Input value={form.title} onChange={(e) => setFormField('title', e.target.value)} /></div>
              <div><Label>Type</Label><Input value={form.type} onChange={(e) => setFormField('type', e.target.value)} /></div>
              <div><Label>Instructor</Label><Input value={form.instructor} onChange={(e) => setFormField('instructor', e.target.value)} /></div>
              <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setFormField('date', e.target.value)} /></div>
              <div><Label>Duration (minutes)</Label><Input type="number" value={form.duration} onChange={(e) => setFormField('duration', e.target.value)} /></div>
              <div><Label>Venue</Label><Input value={form.venue} onChange={(e) => setFormField('venue', e.target.value)} /></div>
              <div><Label>Max Capacity</Label><Input type="number" value={form.maxCapacity} onChange={(e) => setFormField('maxCapacity', e.target.value)} /></div>
              <div><Label>Registered Count</Label><Input type="number" value={form.registeredCount} onChange={(e) => setFormField('registeredCount', e.target.value)} /></div>
              <div><Label>Status</Label><Input value={form.status} onChange={(e) => setFormField('status', e.target.value)} /></div>
              <div><Label>Materials (comma separated)</Label><Input value={form.materials} onChange={(e) => setFormField('materials', e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleUpdateSession} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedSession?.title || 'Session'}</DialogTitle>
              <DialogDescription>Detailed session information.</DialogDescription>
            </DialogHeader>
            {selectedSession && (
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">Type:</span> {formatType(selectedSession.type)}</p>
                <p><span className="font-medium">Instructor:</span> {selectedSession.instructor}</p>
                <p><span className="font-medium">Date:</span> {formatDate(selectedSession.date)}</p>
                <p><span className="font-medium">Duration:</span> {selectedSession.duration} minutes</p>
                <p><span className="font-medium">Venue:</span> {selectedSession.venue}</p>
                <p><span className="font-medium">Capacity:</span> {selectedSession.registeredCount}/{selectedSession.maxCapacity}</p>
                <p><span className="font-medium">Status:</span> {selectedSession.status}</p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Session</DialogTitle>
              <DialogDescription>This will remove {selectedSession?.title || 'this session'} from training plans.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={saving}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteSession} disabled={saving}>{saving ? 'Deleting...' : 'Delete'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={attendanceOpen} onOpenChange={setAttendanceOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Attendance</DialogTitle>
              <DialogDescription>Enter attendance and status for {selectedSession?.title || 'this session'}.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div><Label>Registered / Attended Count</Label><Input type="number" value={attendanceCount} onChange={(e) => setAttendanceCount(e.target.value)} /></div>
              <div><Label>Status</Label><Input value={attendanceStatus} onChange={(e) => setAttendanceStatus(e.target.value)} placeholder="scheduled | ongoing | completed" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAttendanceOpen(false)}>Cancel</Button>
              <Button onClick={handleAttendance}>Save Attendance</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={internshipOpen} onOpenChange={setInternshipOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {internshipMode === 'Post' ? 'Post Internship Opportunity' : internshipMode === 'Manage' ? 'Create Student Assignment' : 'Generate Completion Record'}
              </DialogTitle>
              <DialogDescription>Provide details and submit this internship action.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {internshipMode === 'Post' && (
                <>
                  <div><Label>Subject</Label><Input value={internshipTitle} onChange={(e) => setInternshipTitle(e.target.value)} /></div>
                  <div><Label>Company</Label><Input value={internshipCompany} onChange={(e) => setInternshipCompany(e.target.value)} /></div>
                  <div><Label>Role</Label><Input value={internshipRole} onChange={(e) => setInternshipRole(e.target.value)} /></div>
                  <div><Label>Audience</Label><Input value={internshipAudience} onChange={(e) => setInternshipAudience(e.target.value)} /></div>
                </>
              )}
              {internshipMode === 'Manage' && (
                <>
                  <div>
                    <Label>Student ID</Label>
                    <Input value={internshipStudentId} onChange={(e) => setInternshipStudentId(e.target.value)} placeholder="Paste student id from list" />
                    <p className="mt-1 text-xs text-muted-foreground">Loaded students: {students.length}</p>
                  </div>
                  <div><Label>Company</Label><Input value={internshipCompany} onChange={(e) => setInternshipCompany(e.target.value)} /></div>
                  <div><Label>Role</Label><Input value={internshipRole} onChange={(e) => setInternshipRole(e.target.value)} /></div>
                </>
              )}
              {internshipMode === 'View' && (
                <>
                  <div><Label>Reporting Period</Label><Input value={performancePeriod} onChange={(e) => setPerformancePeriod(e.target.value)} placeholder="current_semester" /></div>
                </>
              )}
              <div><Label>Notes</Label><Input value={internshipNotes} onChange={(e) => setInternshipNotes(e.target.value)} placeholder="Optional details" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInternshipOpen(false)}>Cancel</Button>
              <Button onClick={handleInternshipAction}>Submit</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={performanceOpen} onOpenChange={setPerformanceOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Performance Report</DialogTitle>
              <DialogDescription>Choose report inputs before generating.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div><Label>Report Type</Label><Input value={performanceType} onChange={(e) => setPerformanceType(e.target.value)} placeholder="training_performance" /></div>
              <div><Label>Period</Label><Input value={performancePeriod} onChange={(e) => setPerformancePeriod(e.target.value)} placeholder="current_semester" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPerformanceOpen(false)}>Cancel</Button>
              <Button onClick={handlePerformanceReport}>Generate</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

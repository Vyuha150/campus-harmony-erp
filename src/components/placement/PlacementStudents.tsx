import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Search, Download, CheckCircle2, Clock,
  Briefcase, MapPin, Eye, Edit, Upload, Trash2, Plus
} from 'lucide-react';
import { deleteApi, fetchApi, postApi, putApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';

interface StudentProfile {
  id: string;
  name: string;
  rollNo: string;
  program: string;
  branch: string;
  cgpa: number;
  backlogs: number;
  email: string;
  phone: string;
  semester: number;
  section: string;
  batch: string;
  admissionYear: number;
  resumeVerified: boolean;
  status: 'eligible' | 'placed' | 'higher_studies' | 'entrepreneur' | 'not_interested';
  skills: string[];
  placedAt?: string;
  package?: number;
  preferredRoles: string[];
  preferredLocations: string[];
}

interface StudentDetail extends StudentProfile {
  applications: Array<{
    id: string;
    status: string;
    appliedAt: string;
    company: string | null;
    role: string | null;
  }>;
}

interface StudentFormState {
  name: string;
  email: string;
  rollNumber: string;
  program: string;
  branch: string;
  semester: string;
  section: string;
  batch: string;
  admissionYear: string;
  cgpa: string;
}

const formatPackage = (amount: number) => {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)} LPA`;
  return `₹${amount.toLocaleString('en-IN')}`;
};

const statusBadge = (status: string) => {
  switch (status) {
    case 'placed': return <Badge className="bg-green-600">Placed</Badge>;
    case 'eligible': return <Badge variant="default">Eligible</Badge>;
    case 'higher_studies': return <Badge variant="secondary">Higher Studies</Badge>;
    case 'not_interested': return <Badge variant="outline">Not Interested</Badge>;
    case 'entrepreneur': return <Badge variant="outline">Entrepreneur</Badge>;
    default: return <Badge variant="secondary">{status}</Badge>;
  }
};

export default function PlacementStudents() {
  const { toast } = useToast();
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<StudentDetail | null>(null);
  const [form, setForm] = useState<StudentFormState>({
    name: '',
    email: '',
    rollNumber: '',
    program: 'B.Tech',
    branch: '',
    semester: '1',
    section: 'A',
    batch: `${new Date().getFullYear()}`,
    admissionYear: `${new Date().getFullYear()}`,
    cgpa: '0',
  });

  const setFormField = (field: keyof StudentFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm({
      name: '',
      email: '',
      rollNumber: '',
      program: 'B.Tech',
      branch: '',
      semester: '1',
      section: 'A',
      batch: `${new Date().getFullYear()}`,
      admissionYear: `${new Date().getFullYear()}`,
      cgpa: '0',
    });
  };

  const loadStudents = async () => {
    setLoading(true);
    const data = await fetchApi<any[]>('/placements/students');
    const normalized = (Array.isArray(data) ? data : []).map((student) => {
      const rawStatus = String(student.status || '').toLowerCase();
      const status = (
        rawStatus === 'placed' ||
        rawStatus === 'higher_studies' ||
        rawStatus === 'entrepreneur' ||
        rawStatus === 'not_interested' ||
        rawStatus === 'eligible'
      )
        ? rawStatus
        : (student.placed ? 'placed' : 'eligible');

      return {
        id: String(student.id ?? student.studentId ?? student.rollNumber ?? Math.random()),
        name: String(student.name ?? 'Student'),
        rollNo: String(student.rollNo ?? student.rollNumber ?? 'N/A'),
        program: String(student.program ?? 'N/A'),
        branch: String(student.branch ?? student.department ?? student.program ?? 'Unknown'),
        cgpa: Number(student.cgpa ?? 0),
        backlogs: Number(student.backlogs ?? 0),
        email: String(student.email ?? ''),
        phone: String(student.phone ?? ''),
        semester: Number(student.semester ?? 0),
        section: String(student.section ?? ''),
        batch: String(student.batch ?? ''),
        admissionYear: Number(student.admissionYear ?? 0),
        resumeVerified: Boolean(student.resumeVerified ?? true),
        status: status as StudentProfile['status'],
        skills: Array.isArray(student.skills) ? student.skills.map((skill: any) => String(skill)) : [],
        placedAt: student.placedAt ? String(student.placedAt) : undefined,
        package: typeof student.package === 'number' ? student.package : undefined,
        preferredRoles: Array.isArray(student.preferredRoles) ? student.preferredRoles.map((role: any) => String(role)) : [],
        preferredLocations: Array.isArray(student.preferredLocations) ? student.preferredLocations.map((location: any) => String(location)) : [],
      };
    });

    setStudents(normalized);
    setLoading(false);
  };

  useEffect(() => {
    loadStudents().catch((error) => {
      console.error('API request failed', error);
      toast({ title: 'Unable to load students', description: error?.message || 'Please retry', variant: 'destructive' });
    });
  }, []);

  const handleEditStudent = async (student: StudentProfile) => {
    setSelectedStudent(student);
    setForm({
      name: student.name,
      email: student.email,
      rollNumber: student.rollNo,
      program: student.program,
      branch: student.branch,
      semester: String(student.semester || 1),
      section: student.section || 'A',
      batch: student.batch || `${new Date().getFullYear()}`,
      admissionYear: String(student.admissionYear || new Date().getFullYear()),
      cgpa: String(student.cgpa || 0),
    });
    setEditOpen(true);
  };

  const handleVerifyResume = async (student: StudentProfile) => {
    try {
      await putApi(`/placements/students/${student.id}`, { cgpa: student.cgpa });
      setStudents((prev) => prev.map((s) => (s.id === student.id ? { ...s, resumeVerified: true } : s)));
      toast({ title: 'Resume verified', description: `${student.name} marked as resume verified.` });
    } catch (error: any) {
      toast({ title: 'Verification failed', description: error?.message || 'Unable to verify resume.', variant: 'destructive' });
    }
  };

  const handleViewStudent = async (student: StudentProfile) => {
    try {
      const detail = await fetchApi<any>(`/placements/students/${student.id}`);
      setSelectedDetail({
        id: String(detail?.id ?? student.id),
        name: String(detail?.name ?? student.name),
        rollNo: String(detail?.rollNumber ?? student.rollNo),
        program: String(detail?.program ?? student.program),
        branch: String(detail?.branch ?? student.branch),
        cgpa: Number(detail?.cgpa ?? student.cgpa),
        backlogs: student.backlogs,
        email: String(detail?.email ?? student.email),
        phone: student.phone,
        semester: Number(detail?.semester ?? student.semester ?? 0),
        section: String(detail?.section ?? student.section ?? ''),
        batch: String(detail?.batch ?? student.batch ?? ''),
        admissionYear: Number(detail?.admissionYear ?? student.admissionYear ?? 0),
        resumeVerified: student.resumeVerified,
        status: String(detail?.status ?? student.status) as StudentProfile['status'],
        skills: student.skills,
        placedAt: student.placedAt,
        package: student.package,
        preferredRoles: student.preferredRoles,
        preferredLocations: student.preferredLocations,
        applications: Array.isArray(detail?.applications)
          ? detail.applications.map((app: any) => ({
              id: String(app.id),
              status: String(app.status || 'applied'),
              appliedAt: String(app.appliedAt || ''),
              company: app.company ? String(app.company) : null,
              role: app.role ? String(app.role) : null,
            }))
          : [],
      });
      setViewOpen(true);
    } catch (error: any) {
      toast({ title: 'Unable to load profile', description: error?.message || 'Try again.', variant: 'destructive' });
    }
  };

  const handleOpenCreate = () => {
    setSelectedStudent(null);
    resetForm();
    setCreateOpen(true);
  };

  const handleCreateStudent = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.rollNumber.trim() || !form.branch.trim()) {
      toast({ title: 'Missing fields', description: 'Name, email, roll number, and branch are required.', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      await postApi('/placements/students', {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        rollNumber: form.rollNumber.trim(),
        program: form.program.trim(),
        branch: form.branch.trim(),
        semester: Number(form.semester || 1),
        section: form.section.trim() || 'A',
        batch: form.batch.trim(),
        admissionYear: Number(form.admissionYear || new Date().getFullYear()),
        cgpa: Number(form.cgpa || 0),
      });
      await loadStudents();
      setCreateOpen(false);
      resetForm();
      toast({ title: 'Student created', description: `${form.name.trim()} has been added.` });
    } catch (error: any) {
      toast({ title: 'Create failed', description: error?.message || 'Unable to create student.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedStudent) return;
    if (!form.name.trim() || !form.email.trim() || !form.branch.trim()) {
      toast({ title: 'Missing fields', description: 'Name, email, and branch are required.', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      await putApi(`/placements/students/${selectedStudent.id}`, {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        program: form.program.trim(),
        branch: form.branch.trim(),
        semester: Number(form.semester || 1),
        section: form.section.trim() || 'A',
        batch: form.batch.trim(),
        admissionYear: Number(form.admissionYear || new Date().getFullYear()),
        cgpa: Number(form.cgpa || 0),
      });
      await loadStudents();
      setEditOpen(false);
      setSelectedStudent(null);
      toast({ title: 'Student updated', description: `${form.name.trim()} profile updated.` });
    } catch (error: any) {
      toast({ title: 'Update failed', description: error?.message || 'Unable to update student.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStudent = async () => {
    if (!selectedStudent) return;

    try {
      setSaving(true);
      await deleteApi(`/placements/students/${selectedStudent.id}`);
      await loadStudents();
      setDeleteOpen(false);
      const deletedName = selectedStudent.name;
      setSelectedStudent(null);
      toast({ title: 'Student deleted', description: `${deletedName} has been removed.` });
    } catch (error: any) {
      toast({ title: 'Delete failed', description: error?.message || 'Unable to delete student.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const rows = filtered.map((s) => [s.name, s.rollNo, s.program, s.branch, s.cgpa, s.status]);
    const csv = ['name,rollNo,program,branch,cgpa,status', ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'placement-students.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const branches = Array.from(new Set(students.map(s => s.branch).filter(Boolean))).sort();

  const filtered = students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.rollNo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchBranch = branchFilter === 'all' || s.branch === branchFilter;
    return matchSearch && matchStatus && matchBranch;
  });

  const placed = students.filter(s => s.status === 'placed').length;
  const eligible = students.filter(s => s.status === 'eligible').length;
  const higherStudies = students.filter(s => s.status === 'higher_studies').length;
  const resumePending = students.filter(s => !s.resumeVerified).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Student Profiles</h1>
            <p className="text-muted-foreground">Browse, search, and manage final-year student placement profiles</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => loadStudents()}><Upload className="mr-2 h-4 w-4" />Refresh</Button>
            <Button variant="outline" size="sm" onClick={handleExport}><Download className="mr-2 h-4 w-4" />Export List</Button>
            <Button size="sm" onClick={handleOpenCreate}><Plus className="mr-2 h-4 w-4" />Add Student</Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Students</p><p className="text-2xl font-bold text-foreground">{students.length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Placed</p><p className="text-2xl font-bold text-green-600">{placed}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Eligible (Unplaced)</p><p className="text-2xl font-bold text-foreground">{eligible}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Higher Studies</p><p className="text-2xl font-bold text-foreground">{higherStudies}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Resume Pending</p><p className="text-2xl font-bold text-amber-600">{resumePending}</p></CardContent></Card>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name or roll number..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="eligible">Eligible</SelectItem>
              <SelectItem value="placed">Placed</SelectItem>
              <SelectItem value="higher_studies">Higher Studies</SelectItem>
            </SelectContent>
          </Select>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Branch" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches.map((branch) => (
                <SelectItem key={branch} value={branch}>{branch}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Student Cards */}
        <div className="space-y-3">
          {loading && <p className="text-sm text-muted-foreground">Loading students...</p>}
          {filtered.map((s) => (
            <Card key={s.id} className="hover:bg-muted/20 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg">
                      {(s.name || 'S').charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{s.name}</h3>
                        {statusBadge(s.status)}
                        {s.resumeVerified ? (
                          <Badge variant="outline" className="text-green-600 border-green-300"><CheckCircle2 className="mr-1 h-3 w-3" />Resume Verified</Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-300"><Clock className="mr-1 h-3 w-3" />Resume Pending</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {s.rollNo} • {s.program} {s.branch} • CGPA: <span className="font-semibold text-foreground">{s.cgpa}</span>
                        {s.backlogs > 0 && <span className="text-destructive"> • {s.backlogs} backlog(s)</span>}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">Sem {s.semester} • Sec {s.section || '-'} • Batch {s.batch || '-'} • Admit {s.admissionYear || '-'}</p>
                      {s.skills.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {s.skills.map(sk => <Badge key={sk} variant="secondary" className="text-xs">{sk}</Badge>)}
                        </div>
                      )}
                      {s.placedAt && (
                        <p className="mt-2 text-sm">
                          <Briefcase className="mr-1 inline h-3 w-3 text-green-600" />
                          <span className="font-medium text-green-600">{s.placedAt}</span>
                          {s.package && <span className="text-muted-foreground"> – {formatPackage(s.package)}</span>}
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        {s.preferredLocations.length > 0 && <span><MapPin className="mr-0.5 inline h-3 w-3" />{s.preferredLocations.join(', ')}</span>}
                        <span>{s.email}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleViewStudent(s)}><Eye className="mr-1 h-3 w-3" />View</Button>
                    <Button variant="outline" size="sm" onClick={() => handleEditStudent(s)}><Edit className="mr-1 h-3 w-3" />Edit</Button>
                    <Button variant="outline" size="sm" onClick={() => { setSelectedStudent(s); setDeleteOpen(true); }}><Trash2 className="mr-1 h-3 w-3" />Delete</Button>
                    {!s.resumeVerified && <Button size="sm" onClick={() => handleVerifyResume(s)}><CheckCircle2 className="mr-1 h-3 w-3" />Verify Resume</Button>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {!loading && filtered.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No students found for current filters.
              </CardContent>
            </Card>
          )}
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Student Profile</DialogTitle>
              <DialogDescription>Create a new student user and placement profile in one step.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setFormField('name', e.target.value)} placeholder="Student name" /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={(e) => setFormField('email', e.target.value)} placeholder="student@college.edu" /></div>
              <div><Label>Roll Number</Label><Input value={form.rollNumber} onChange={(e) => setFormField('rollNumber', e.target.value)} placeholder="22CSE001" /></div>
              <div><Label>Program</Label><Input value={form.program} onChange={(e) => setFormField('program', e.target.value)} placeholder="B.Tech" /></div>
              <div><Label>Branch</Label><Input value={form.branch} onChange={(e) => setFormField('branch', e.target.value)} placeholder="CSE" /></div>
              <div><Label>Semester</Label><Input type="number" value={form.semester} onChange={(e) => setFormField('semester', e.target.value)} /></div>
              <div><Label>Section</Label><Input value={form.section} onChange={(e) => setFormField('section', e.target.value)} placeholder="A" /></div>
              <div><Label>Batch</Label><Input value={form.batch} onChange={(e) => setFormField('batch', e.target.value)} placeholder="2026" /></div>
              <div><Label>Admission Year</Label><Input type="number" value={form.admissionYear} onChange={(e) => setFormField('admissionYear', e.target.value)} /></div>
              <div><Label>CGPA</Label><Input type="number" step="0.01" value={form.cgpa} onChange={(e) => setFormField('cgpa', e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleCreateStudent} disabled={saving}>{saving ? 'Saving...' : 'Create Student'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Student Profile</DialogTitle>
              <DialogDescription>Update student account and placement details.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setFormField('name', e.target.value)} /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={(e) => setFormField('email', e.target.value)} /></div>
              <div><Label>Roll Number</Label><Input value={form.rollNumber} disabled /></div>
              <div><Label>Program</Label><Input value={form.program} onChange={(e) => setFormField('program', e.target.value)} /></div>
              <div><Label>Branch</Label><Input value={form.branch} onChange={(e) => setFormField('branch', e.target.value)} /></div>
              <div><Label>Semester</Label><Input type="number" value={form.semester} onChange={(e) => setFormField('semester', e.target.value)} /></div>
              <div><Label>Section</Label><Input value={form.section} onChange={(e) => setFormField('section', e.target.value)} /></div>
              <div><Label>Batch</Label><Input value={form.batch} onChange={(e) => setFormField('batch', e.target.value)} /></div>
              <div><Label>Admission Year</Label><Input type="number" value={form.admissionYear} onChange={(e) => setFormField('admissionYear', e.target.value)} /></div>
              <div><Label>CGPA</Label><Input type="number" step="0.01" value={form.cgpa} onChange={(e) => setFormField('cgpa', e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleSaveEdit} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{selectedDetail?.name || 'Student Profile'}</DialogTitle>
              <DialogDescription>Full student details and placement application history.</DialogDescription>
            </DialogHeader>
            {selectedDetail && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Roll Number</p><p className="font-medium">{selectedDetail.rollNo}</p></CardContent></Card>
                  <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Program / Branch</p><p className="font-medium">{selectedDetail.program} {selectedDetail.branch}</p></CardContent></Card>
                  <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">CGPA</p><p className="font-medium">{selectedDetail.cgpa}</p></CardContent></Card>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>{selectedDetail.email}</p>
                  <p>Semester {selectedDetail.semester} • Section {selectedDetail.section || '-'} • Batch {selectedDetail.batch || '-'} • Admission Year {selectedDetail.admissionYear || '-'}</p>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">Applications ({selectedDetail.applications.length})</h3>
                  <div className="max-h-56 overflow-auto rounded-md border">
                    {selectedDetail.applications.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">No applications found.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50 text-left">
                            <th className="px-3 py-2">Company</th>
                            <th className="px-3 py-2">Role</th>
                            <th className="px-3 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedDetail.applications.map((app) => (
                            <tr key={app.id} className="border-b last:border-0">
                              <td className="px-3 py-2">{app.company || '-'}</td>
                              <td className="px-3 py-2">{app.role || '-'}</td>
                              <td className="px-3 py-2"><Badge variant="outline" className="capitalize">{app.status}</Badge></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
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
              <DialogTitle>Delete Student</DialogTitle>
              <DialogDescription>
                This will remove {selectedStudent?.name || 'this student'} and their placement profile.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={saving}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteStudent} disabled={saving}>{saving ? 'Deleting...' : 'Delete'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

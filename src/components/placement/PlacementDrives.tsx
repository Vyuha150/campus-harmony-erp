import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar, Building2, Users, CheckCircle2, Play,
  Upload, ClipboardList, Target, Plus, Edit, Trash2, Eye
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { deleteApi, fetchApi, postApi, putApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';

interface DriveFormState {
  companyId: string;
  role: string;
  packageValue: string;
  date: string;
  registrationDeadline: string;
  status: string;
  location: string;
  jobDescription: string;
}

const formatPackage = (amount: number) => {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)} LPA`;
  return `₹${amount.toLocaleString('en-IN')}`;
};

const formatDate = (value: unknown) => {
  if (!value) return '-';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString('en-IN');
};

export default function PlacementDrives() {
  const { toast } = useToast();
  const [placementDrives, setPlacementDrives] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedDrive, setSelectedDrive] = useState<any | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [applicationsOpen, setApplicationsOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [startStatus, setStartStatus] = useState('ongoing');
  const [startLocation, setStartLocation] = useState('');
  const [importDriveId, setImportDriveId] = useState('');
  const [importStatus, setImportStatus] = useState('completed');
  const [manualDriveId, setManualDriveId] = useState('');
  const [form, setForm] = useState<DriveFormState>({
    companyId: '',
    role: '',
    packageValue: '700000',
    date: new Date().toISOString().slice(0, 10),
    registrationDeadline: new Date().toISOString().slice(0, 10),
    status: 'upcoming',
    location: 'Main Auditorium',
    jobDescription: 'Campus recruitment drive',
  });

  const setFormField = (field: keyof DriveFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm({
      companyId: companies[0]?.id ? String(companies[0].id) : '',
      role: '',
      packageValue: '700000',
      date: new Date().toISOString().slice(0, 10),
      registrationDeadline: new Date().toISOString().slice(0, 10),
      status: 'upcoming',
      location: 'Main Auditorium',
      jobDescription: 'Campus recruitment drive',
    });
  };

  const loadDrives = async () => {
    setLoading(true);
    const [drives, companyList] = await Promise.all([
      fetchApi('/placements/drives'),
      fetchApi('/placements/companies')
    ]);
    setPlacementDrives(Array.isArray(drives) ? drives : []);
    const normalizedCompanies = Array.isArray(companyList) ? companyList : [];
    setCompanies(normalizedCompanies);
    setLoading(false);
  };

  useEffect(() => {
    loadDrives().catch((error) => {
      console.error('API request failed', error);
      toast({ title: 'Unable to load drives', description: error?.message || 'Please retry', variant: 'destructive' });
    });
  }, []);

  const openCreate = () => {
    setSelectedDrive(null);
    resetForm();
    setCreateOpen(true);
  };

  const openEdit = (drive: any) => {
    setSelectedDrive(drive);
    setForm({
      companyId: String(drive.companyId || drive.company?.id || ''),
      role: String(drive.role || drive.jobRole || ''),
      packageValue: String(drive.package?.ctc || 0),
      date: String(drive.driveDate || '').slice(0, 10),
      registrationDeadline: String(drive.registrationDeadline || drive.driveDate || '').slice(0, 10),
      status: String(drive.status || 'upcoming'),
      location: String(drive.location || drive.venue || ''),
      jobDescription: String(drive.jobDescription || ''),
    });
    setEditOpen(true);
  };

  const handleCreateDrive = async () => {
    if (!form.companyId || !form.role.trim()) {
      toast({ title: 'Missing fields', description: 'Company and role are required.', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      await postApi('/placements/drives', {
        companyId: form.companyId,
        role: form.role.trim(),
        package: form.packageValue,
        date: new Date(form.date).toISOString(),
        registrationDeadline: new Date(form.registrationDeadline || form.date).toISOString(),
        status: form.status,
        location: form.location.trim(),
        jobDescription: form.jobDescription.trim(),
      });
      await loadDrives();
      setCreateOpen(false);
      toast({ title: 'Drive created', description: 'Placement drive has been created.' });
    } catch (error: any) {
      toast({ title: 'Create failed', description: error?.message || 'Unable to create drive.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateDrive = async () => {
    if (!selectedDrive) return;

    try {
      setSaving(true);
      await putApi(`/placements/drives/${selectedDrive.id}`, {
        companyId: form.companyId,
        role: form.role.trim(),
        package: form.packageValue,
        date: new Date(form.date).toISOString(),
        registrationDeadline: new Date(form.registrationDeadline || form.date).toISOString(),
        status: form.status,
        location: form.location.trim(),
        jobDescription: form.jobDescription.trim(),
      });
      await loadDrives();
      setEditOpen(false);
      setSelectedDrive(null);
      toast({ title: 'Drive updated', description: 'Drive details updated successfully.' });
    } catch (error: any) {
      toast({ title: 'Update failed', description: error?.message || 'Unable to update drive.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDrive = async () => {
    if (!selectedDrive) return;

    try {
      setSaving(true);
      await deleteApi(`/placements/drives/${selectedDrive.id}`);
      await loadDrives();
      setDeleteOpen(false);
      setSelectedDrive(null);
      toast({ title: 'Drive deleted', description: 'Drive removed successfully.' });
    } catch (error: any) {
      toast({ title: 'Delete failed', description: error?.message || 'Unable to delete drive.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleViewApplications = async (drive: any) => {
    try {
      const apps = await fetchApi<any[]>(`/placements/drives/${drive.id}/applications`);
      setApplications(Array.isArray(apps) ? apps : []);
      setSelectedDrive(drive);
      setApplicationsOpen(true);
    } catch (error: any) {
      toast({ title: 'Unable to load applications', description: error?.message || 'Try again.', variant: 'destructive' });
    }
  };

  const handleUpdateApplicationStatus = async (applicationId: string, status: string) => {
    if (!selectedDrive) return;

    try {
      await putApi(`/placements/drives/${selectedDrive.id}/applications/${applicationId}`, { status });
      setApplications((prev) => prev.map((app) => (app.id === applicationId ? { ...app, status } : app)));
      toast({ title: 'Application updated', description: `Status changed to ${status}.` });
      await loadDrives();
    } catch (error: any) {
      toast({ title: 'Update failed', description: error?.message || 'Unable to update status.', variant: 'destructive' });
    }
  };

  const handleImportResults = async () => {
    if (!importDriveId) {
      toast({ title: 'Select drive', description: 'Choose a drive to import results.', variant: 'destructive' });
      return;
    }

    const targetDrive = placementDrives.find((d) => String(d.id) === String(importDriveId));
    if (!targetDrive) {
      toast({ title: 'Drive not found', description: 'Please reselect the drive.', variant: 'destructive' });
      return;
    }

    try {
      await putApi(`/placements/drives/${targetDrive.id}`, { status: importStatus || 'completed' });
      await loadDrives();
      setImportOpen(false);
      toast({ title: 'Results imported', description: `${targetDrive.companyName || 'Drive'} marked as ${importStatus || 'completed'}.` });
    } catch (error: any) {
      toast({ title: 'Import failed', description: error?.message || 'Unable to import results.', variant: 'destructive' });
    }
  };

  const openStartRound = (drive: any) => {
    setSelectedDrive(drive);
    setStartStatus('ongoing');
    setStartLocation(String(drive.location || drive.venue || ''));
    setStartOpen(true);
  };

  const handleStartRound = async () => {
    if (!selectedDrive) return;

    try {
      await putApi(`/placements/drives/${selectedDrive.id}`, {
        status: startStatus || 'ongoing',
        location: startLocation.trim() || selectedDrive.location || selectedDrive.venue,
      });
      await loadDrives();
      setStartOpen(false);
      toast({ title: 'Drive updated', description: `${selectedDrive.companyName || 'Drive'} moved to ${startStatus || 'ongoing'}.` });
    } catch (error: any) {
      toast({ title: 'Unable to start', description: error?.message || 'Try again.', variant: 'destructive' });
    }
  };

  const openImportResults = () => {
    setImportDriveId(placementDrives[0]?.id ? String(placementDrives[0].id) : '');
    setImportStatus('completed');
    setImportOpen(true);
  };

  const openManualEntry = () => {
    setManualDriveId(placementDrives[0]?.id ? String(placementDrives[0].id) : '');
    setManualEntryOpen(true);
  };

  const handleManualEntry = async () => {
    if (!manualDriveId) {
      toast({ title: 'Select drive', description: 'Choose a drive for manual entry.', variant: 'destructive' });
      return;
    }
    const drive = placementDrives.find((d) => String(d.id) === String(manualDriveId));
    if (!drive) {
      toast({ title: 'Drive not found', description: 'Please reselect the drive.', variant: 'destructive' });
      return;
    }
    setManualEntryOpen(false);
    await handleViewApplications(drive);
  };

  const recentOffers = placementDrives.flatMap((drive: any) => drive?.recentOffers || []);
  const activeDrives = placementDrives.filter((drive: any) => ['active', 'ongoing', 'upcoming'].includes(String(drive.status || '').toLowerCase())).length;
  const oneWeekAhead = new Date();
  oneWeekAhead.setDate(oneWeekAhead.getDate() + 7);
  const drivesThisWeek = placementDrives.filter((drive: any) => {
    const d = new Date(drive.driveDate);
    return !Number.isNaN(d.getTime()) && d <= oneWeekAhead;
  }).length;
  const pendingResults = placementDrives.filter((drive: any) => {
    const status = String(drive.status || '').toLowerCase();
    return ['completed', 'closed'].includes(status) && Number(drive.selected || 0) === 0;
  }).length;
  const activeDriveList = placementDrives.filter((drive: any) => ['active', 'ongoing', 'upcoming'].includes(String(drive.status || '').toLowerCase()));
  const completedDriveList = placementDrives.filter((drive: any) => ['completed', 'closed'].includes(String(drive.status || '').toLowerCase()));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Placement Drives</h1>
            <p className="text-muted-foreground">Track drives, manage rounds, mark attendance, and record selections</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={openImportResults}><Upload className="mr-2 h-4 w-4" />Import Results</Button>
            <Button size="sm" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />New Drive</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Active Drives</p><p className="text-2xl font-bold text-foreground">{activeDrives}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Offers (Season)</p><p className="text-2xl font-bold text-green-600">{recentOffers.length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Drives This Week</p><p className="text-2xl font-bold text-foreground">{drivesThisWeek}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Pending Results</p><p className="text-2xl font-bold text-amber-600">{pendingResults}</p></CardContent></Card>
        </div>

        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">Active & Upcoming</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="results">Results Entry</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {loading && <p className="text-sm text-muted-foreground">Loading drives...</p>}
            {activeDriveList.map((drive) => (
              <Card key={drive.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10">
                        <Building2 className="h-7 w-7 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-foreground">{drive.company?.name || drive.companyName}</h3>
                          <Badge variant={drive.status === 'upcoming' ? 'default' : drive.status === 'ongoing' ? 'default' : 'secondary'} className="capitalize">{drive.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{drive.jobRole || drive.role}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="outline">CTC: {formatPackage(Number(drive.package?.ctc || 0))}</Badge>
                          <Badge variant="outline">Min CGPA: {drive.eligibilityCriteria?.minCGPA ?? 'N/A'}</Badge>
                        </div>
                        <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                          <span><Calendar className="mr-1 inline h-3 w-3" />{formatDate(drive.driveDate)}</span>
                          <span><Users className="mr-1 inline h-3 w-3" />{Number(drive.registeredStudents || drive.registrations || 0)} registered</span>
                          <span>Venue: {drive.venue || drive.location}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button size="sm" onClick={() => handleViewApplications(drive)}><ClipboardList className="mr-1 h-3 w-3" />Student List</Button>
                      <Button size="sm" variant="outline" onClick={() => openStartRound(drive)}><Play className="mr-1 h-3 w-3" />Start</Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(drive)}><Edit className="mr-1 h-3 w-3" />Edit</Button>
                      <Button size="sm" variant="outline" onClick={() => { setSelectedDrive(drive); setDeleteOpen(true); }}><Trash2 className="mr-1 h-3 w-3" />Delete</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!loading && activeDriveList.length === 0 && (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  No active or upcoming drives.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="completed">
            <div className="space-y-4">
              {completedDriveList.map((drive) => (
                <Card key={drive.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-foreground">{drive.company?.name || drive.companyName}</h3>
                          <Badge variant="secondary" className="capitalize">{drive.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{drive.jobRole || drive.role}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span><Calendar className="mr-1 inline h-3 w-3" />{formatDate(drive.driveDate)}</span>
                          <span><Users className="mr-1 inline h-3 w-3" />{Number(drive.registeredStudents || drive.registrations || 0)} registered</span>
                          <span>Selected: {Number(drive.selected || drive.selectedStudents || 0)}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleViewApplications(drive)}><ClipboardList className="mr-1 h-3 w-3" />Student List</Button>
                        <Button size="sm" variant="outline" onClick={() => openEdit(drive)}><Edit className="mr-1 h-3 w-3" />Edit</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {!loading && completedDriveList.length === 0 && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <CheckCircle2 className="h-16 w-16 text-muted-foreground/30" />
                    <h3 className="mt-4 text-lg font-semibold text-foreground">No Completed Drives</h3>
                    <p className="text-sm text-muted-foreground">Completed or closed drives will appear here.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="results" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-lg">Quick Results Entry</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Import company selection lists or manually mark selected students.</p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Card className="cursor-pointer hover:bg-muted/30">
                    <CardContent className="flex flex-col items-center p-6 text-center">
                      <Upload className="h-10 w-10 text-primary/60" />
                      <h3 className="mt-3 font-semibold text-foreground">Import from Spreadsheet</h3>
                      <p className="mt-1 text-xs text-muted-foreground">Upload company's selection list (CSV/Excel) to bulk-mark selections</p>
                      <Button size="sm" className="mt-3" onClick={openImportResults}>Upload File</Button>
                    </CardContent>
                  </Card>
                  <Card className="cursor-pointer hover:bg-muted/30">
                    <CardContent className="flex flex-col items-center p-6 text-center">
                      <Target className="h-10 w-10 text-primary/60" />
                      <h3 className="mt-3 font-semibold text-foreground">Manual Entry</h3>
                      <p className="mt-1 text-xs text-muted-foreground">Open student list for a drive and update each application status.</p>
                      <Button size="sm" variant="outline" className="mt-3" onClick={openManualEntry}>Start Entry</Button>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Placement Drive</DialogTitle>
              <DialogDescription>Add a new company drive and configure schedule details.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Company</Label>
                <Select value={form.companyId} onValueChange={(value) => setFormField('companyId', value)}>
                  <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={String(company.id)}>{company.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Role</Label><Input value={form.role} onChange={(e) => setFormField('role', e.target.value)} /></div>
              <div><Label>Package (annual)</Label><Input type="number" value={form.packageValue} onChange={(e) => setFormField('packageValue', e.target.value)} /></div>
              <div><Label>Drive Date</Label><Input type="date" value={form.date} onChange={(e) => setFormField('date', e.target.value)} /></div>
              <div><Label>Registration Deadline</Label><Input type="date" value={form.registrationDeadline} onChange={(e) => setFormField('registrationDeadline', e.target.value)} /></div>
              <div><Label>Status</Label><Input value={form.status} onChange={(e) => setFormField('status', e.target.value)} /></div>
              <div><Label>Location</Label><Input value={form.location} onChange={(e) => setFormField('location', e.target.value)} /></div>
              <div><Label>Job Description</Label><Input value={form.jobDescription} onChange={(e) => setFormField('jobDescription', e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleCreateDrive} disabled={saving}>{saving ? 'Saving...' : 'Create Drive'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Drive</DialogTitle>
              <DialogDescription>Update drive schedule and requirements.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Company</Label>
                <Select value={form.companyId} onValueChange={(value) => setFormField('companyId', value)}>
                  <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={String(company.id)}>{company.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Role</Label><Input value={form.role} onChange={(e) => setFormField('role', e.target.value)} /></div>
              <div><Label>Package (annual)</Label><Input type="number" value={form.packageValue} onChange={(e) => setFormField('packageValue', e.target.value)} /></div>
              <div><Label>Drive Date</Label><Input type="date" value={form.date} onChange={(e) => setFormField('date', e.target.value)} /></div>
              <div><Label>Registration Deadline</Label><Input type="date" value={form.registrationDeadline} onChange={(e) => setFormField('registrationDeadline', e.target.value)} /></div>
              <div><Label>Status</Label><Input value={form.status} onChange={(e) => setFormField('status', e.target.value)} /></div>
              <div><Label>Location</Label><Input value={form.location} onChange={(e) => setFormField('location', e.target.value)} /></div>
              <div><Label>Job Description</Label><Input value={form.jobDescription} onChange={(e) => setFormField('jobDescription', e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleUpdateDrive} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Drive</DialogTitle>
              <DialogDescription>
                This will remove {selectedDrive?.companyName || selectedDrive?.company?.name || 'this drive'} from placement schedules.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={saving}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteDrive} disabled={saving}>{saving ? 'Deleting...' : 'Delete'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={applicationsOpen} onOpenChange={setApplicationsOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Students List - {selectedDrive?.companyName || selectedDrive?.company?.name || 'Drive'}</DialogTitle>
              <DialogDescription>View applicants and update each student selection status.</DialogDescription>
            </DialogHeader>
            <div className="max-h-[420px] overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="px-3 py-2">Student</th>
                    <th className="px-3 py-2">Roll No</th>
                    <th className="px-3 py-2">CGPA</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">No applications found.</td>
                    </tr>
                  )}
                  {applications.map((app) => (
                    <tr key={app.id} className="border-b last:border-0">
                      <td className="px-3 py-2">{app.studentName}</td>
                      <td className="px-3 py-2">{app.rollNumber}</td>
                      <td className="px-3 py-2">{app.cgpa}</td>
                      <td className="px-3 py-2"><Badge variant="outline" className="capitalize">{app.status}</Badge></td>
                      <td className="px-3 py-2">
                        <Select
                          value={String(app.status || 'applied')}
                          onValueChange={(value) => handleUpdateApplicationStatus(String(app.id), value)}
                        >
                          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="applied">Applied</SelectItem>
                            <SelectItem value="shortlisted">Shortlisted</SelectItem>
                            <SelectItem value="selected">Selected</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setApplicationsOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={startOpen} onOpenChange={setStartOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Drive Status</DialogTitle>
              <DialogDescription>Provide status and venue details before starting/updating this drive.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Status</Label>
                <Select value={startStatus} onValueChange={setStartStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="ongoing">Ongoing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Venue / Location</Label><Input value={startLocation} onChange={(e) => setStartLocation(e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStartOpen(false)}>Cancel</Button>
              <Button onClick={handleStartRound}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import Results</DialogTitle>
              <DialogDescription>Select the drive and target status for imported results.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Drive</Label>
                <Select value={importDriveId} onValueChange={setImportDriveId}>
                  <SelectTrigger><SelectValue placeholder="Select drive" /></SelectTrigger>
                  <SelectContent>
                    {placementDrives.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>{d.companyName || d.company?.name} - {d.role || d.jobRole}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Update Status To</Label>
                <Select value={importStatus} onValueChange={setImportStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="ongoing">Ongoing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
              <Button onClick={handleImportResults}>Apply</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={manualEntryOpen} onOpenChange={setManualEntryOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Manual Results Entry</DialogTitle>
              <DialogDescription>Select a drive to open student list and update statuses.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Drive</Label>
                <Select value={manualDriveId} onValueChange={setManualDriveId}>
                  <SelectTrigger><SelectValue placeholder="Select drive" /></SelectTrigger>
                  <SelectContent>
                    {placementDrives.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>{d.companyName || d.company?.name} - {d.role || d.jobRole}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setManualEntryOpen(false)}>Cancel</Button>
              <Button onClick={handleManualEntry}>Open Student List</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

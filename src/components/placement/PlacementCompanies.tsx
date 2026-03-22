import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Building2, Search, Plus, Users, Calendar, Mail,
  MapPin, Download, Edit, ExternalLink, Award, Eye, Trash2, ChevronLeft, ChevronRight, RefreshCw
} from 'lucide-react';
import { deleteApi, fetchApi, postApi, putApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';

interface CompanyFormState {
  name: string;
  email: string;
  industry: string;
  website: string;
  totalHires: string;
}

export default function PlacementCompanies() {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<any[]>([]);
  const [drives, setDrives] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [selectedCompany, setSelectedCompany] = useState<any | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState<CompanyFormState>({
    name: '',
    email: '',
    industry: 'General',
    website: '',
    totalHires: '0'
  });

  const setFormField = (field: keyof CompanyFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm({
      name: '',
      email: '',
      industry: 'General',
      website: '',
      totalHires: '0'
    });
  };

  const loadCompanies = async () => {
    setLoading(true);
    const data = await fetchApi('/placements/companies');
    setCompanies(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  const loadDrives = async () => {
    setCalendarLoading(true);
    const data = await fetchApi('/placements/drives');
    setDrives(Array.isArray(data) ? data : []);
    setCalendarLoading(false);
  };

  useEffect(() => {
    Promise.all([loadCompanies(), loadDrives()]).catch((error) => {
      console.error('API request failed', error);
      toast({ title: 'Unable to load company schedule data', description: error?.message || 'Please retry', variant: 'destructive' });
    });
  }, []);

  const openCreate = () => {
    setSelectedCompany(null);
    resetForm();
    setCreateOpen(true);
  };

  const openEdit = (company: any) => {
    setSelectedCompany(company);
    setForm({
      name: String(company.name || ''),
      email: String(company.email || ''),
      industry: String(company.industry || 'General'),
      website: String(company.website || ''),
      totalHires: String(company.totalHires ?? 0),
    });
    setEditOpen(true);
  };

  const openView = (company: any) => {
    setSelectedCompany(company);
    setViewOpen(true);
  };

  const handleCreateCompany = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.industry.trim()) {
      toast({ title: 'Missing fields', description: 'Name, email and industry are required.', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      await postApi('/placements/companies', {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        industry: form.industry.trim(),
        website: form.website.trim() || null,
        totalHires: Number(form.totalHires || 0)
      });
      await loadCompanies();
      setCreateOpen(false);
      resetForm();
      toast({ title: 'Company added', description: `${form.name.trim()} has been added.` });
    } catch (error: any) {
      toast({ title: 'Add failed', description: error?.message || 'Unable to add company.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCompany = async () => {
    if (!selectedCompany) return;

    try {
      setSaving(true);
      await putApi(`/placements/companies/${selectedCompany.id}`, {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        industry: form.industry.trim(),
        website: form.website.trim() || null,
        totalHires: Number(form.totalHires || 0),
      });
      await loadCompanies();
      setEditOpen(false);
      setSelectedCompany(null);
      toast({ title: 'Company updated', description: `${form.name.trim()} details updated.` });
    } catch (error: any) {
      toast({ title: 'Update failed', description: error?.message || 'Unable to update company.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCompany = async () => {
    if (!selectedCompany) return;

    try {
      setSaving(true);
      await deleteApi(`/placements/companies/${selectedCompany.id}`);
      await loadCompanies();
      await loadDrives();
      const deletedName = selectedCompany.name;
      setDeleteOpen(false);
      setSelectedCompany(null);
      toast({ title: 'Company deleted', description: `${deletedName} has been removed.` });
    } catch (error: any) {
      toast({ title: 'Delete failed', description: error?.message || 'Unable to delete company.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSchedule = async (company: any) => {
    try {
      await postApi('/placements/drives', {
        companyId: company.id,
        role: 'Associate Engineer',
        package: '600000',
        date: new Date().toISOString(),
        status: 'upcoming',
        location: 'Main Campus',
        jobDescription: 'Campus recruitment drive'
      });
      await loadDrives();
      toast({ title: 'Drive scheduled', description: `New drive created for ${company.name}.` });
    } catch (error: any) {
      toast({ title: 'Schedule failed', description: error?.message || 'Unable to schedule drive.', variant: 'destructive' });
    }
  };

  const handleExport = () => {
    const rows = companies.map((c: any) => [c.name, c.industry, c.email, c.totalDrives || 0, c.totalHires || 0]);
    const csv = ['name,industry,email,totalDrives,totalHires', ...rows.map((r: any[]) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'placement-companies.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredCompanies = companies.filter((c: any) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    return String(c.name || '').toLowerCase().includes(query) || String(c.industry || '').toLowerCase().includes(query);
  });

  const formatDate = (value: unknown) => {
    if (!value) return '-';
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString('en-IN');
  };

  const active = companies.filter((c) => c.status === 'active').length;
  const invitationsSent = companies.length;
  const confirmedVisits = companies.filter((c: any) => Number(c.totalDrives || 0) > 0).length;

  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const monthLabel = currentMonth.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  const firstDayIndex = monthStart.getDay();
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();

  const drivesByDate = new Map<string, any[]>();
  for (const drive of drives) {
    const parsed = new Date(String(drive.driveDate));
    if (Number.isNaN(parsed.getTime())) continue;
    const key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
    const existing = drivesByDate.get(key) ?? [];
    existing.push(drive);
    drivesByDate.set(key, existing);
  }

  const selectedDayDrives = drivesByDate.get(selectedDateKey) ?? [];

  const goPrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Company Management</h1>
            <p className="text-muted-foreground">Manage recruiting companies, send invitations, and schedule drives</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}><Download className="mr-2 h-4 w-4" />Export</Button>
            <Button size="sm" onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add Company</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Companies</p><p className="text-2xl font-bold text-foreground">{companies.length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Active Partners</p><p className="text-2xl font-bold text-green-600">{active}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Invitations Sent</p><p className="text-2xl font-bold text-foreground">{invitationsSent}</p><p className="text-xs text-muted-foreground">Based on listed companies</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Confirmed Visits</p><p className="text-2xl font-bold text-foreground">{confirmedVisits}</p></CardContent></Card>
        </div>

        <Tabs defaultValue="directory">
          <TabsList>
            <TabsTrigger value="directory">Company Directory</TabsTrigger>
            <TabsTrigger value="schedule">Drive Schedule</TabsTrigger>
          </TabsList>

          <TabsContent value="directory" className="space-y-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search companies..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>

            {loading && <p className="text-sm text-muted-foreground">Loading companies...</p>}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filteredCompanies.map((c) => (
                <Card key={c.id} className="hover:bg-muted/20 transition-colors">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                          <Building2 className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground">{c.name}</h3>
                            <Badge variant={c.status === 'active' ? 'default' : 'destructive'} className="capitalize">{c.status}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{c.industry} • {c.companySize || 0} employees</p>
                          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                            <p><Users className="mr-1 inline h-3 w-3" />{c.contactPerson || c.name}</p>
                            <p><Mail className="mr-1 inline h-3 w-3" />{c.email}</p>
                            <p><MapPin className="mr-1 inline h-3 w-3" />{c.address || '-'}</p>
                          </div>
                          <div className="mt-2 flex items-center gap-3 text-sm">
                            <span className="font-medium text-foreground"><Award className="mr-1 inline h-3 w-3 text-primary" />{c.totalHires} total hires</span>
                            {c.lastVisit && <span className="text-muted-foreground">Last: {formatDate(c.lastVisit)}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                      <Button variant="ghost" size="sm" onClick={() => openView(c)}><Eye className="mr-1 h-3 w-3" />View</Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Edit className="mr-1 h-3 w-3" />Edit</Button>
                      <Button variant="outline" size="sm" onClick={() => handleSchedule(c)}><Calendar className="mr-1 h-3 w-3" />Schedule</Button>
                      <Button variant="outline" size="sm" onClick={() => { setSelectedCompany(c); setDeleteOpen(true); }}><Trash2 className="mr-1 h-3 w-3" />Delete</Button>
                      {c.website && <Button variant="ghost" size="sm" onClick={() => window.open(String(c.website), '_blank')}><ExternalLink className="mr-1 h-3 w-3" />Website</Button>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="schedule">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Drive Schedule Calendar</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" onClick={goPrevMonth}><ChevronLeft className="h-4 w-4" /></Button>
                      <span className="min-w-36 text-center text-sm font-medium text-foreground">{monthLabel}</span>
                      <Button variant="outline" size="icon" onClick={goNextMonth}><ChevronRight className="h-4 w-4" /></Button>
                      <Button variant="outline" size="sm" onClick={() => loadDrives()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {calendarLoading && <p className="pb-3 text-sm text-muted-foreground">Loading calendar...</p>}
                  <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium text-muted-foreground">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div key={day}>{day}</div>)}
                  </div>
                  <div className="mt-2 grid grid-cols-7 gap-2">
                    {Array.from({ length: firstDayIndex }).map((_, i) => (
                      <div key={`blank-${i}`} className="h-24 rounded-md border border-transparent" />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, idx) => {
                      const day = idx + 1;
                      const key = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const dayDrives = drivesByDate.get(key) ?? [];
                      const isSelected = selectedDateKey === key;

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelectedDateKey(key)}
                          className={`h-24 rounded-md border p-2 text-left transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/30'}`}
                        >
                          <p className="text-sm font-semibold text-foreground">{day}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{dayDrives.length} drive(s)</p>
                          {dayDrives.slice(0, 2).map((d) => (
                            <p key={d.id} className="truncate text-xs text-foreground">{d.companyName || d.company?.name}</p>
                          ))}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Drives On {selectedDateKey}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedDayDrives.length === 0 && <p className="text-sm text-muted-foreground">No drives scheduled for this date.</p>}
                  {selectedDayDrives.map((drive) => (
                    <div key={drive.id} className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <p className="font-medium text-foreground">{drive.companyName || drive.company?.name}</p>
                        <p className="text-sm text-muted-foreground">{drive.role || drive.jobRole} • {drive.location || drive.venue || '-'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="capitalize" variant={String(drive.status).toLowerCase() === 'completed' ? 'secondary' : 'default'}>{drive.status}</Badge>
                        <Button size="sm" variant="outline" onClick={() => handleSchedule({ id: drive.company?.id || drive.companyId, name: drive.companyName || drive.company?.name })}>Duplicate</Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Company</DialogTitle>
              <DialogDescription>Create a recruiting company profile.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setFormField('name', e.target.value)} /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={(e) => setFormField('email', e.target.value)} /></div>
              <div><Label>Industry</Label><Input value={form.industry} onChange={(e) => setFormField('industry', e.target.value)} /></div>
              <div><Label>Website</Label><Input value={form.website} onChange={(e) => setFormField('website', e.target.value)} /></div>
              <div><Label>Total Hires</Label><Input type="number" value={form.totalHires} onChange={(e) => setFormField('totalHires', e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleCreateCompany} disabled={saving}>{saving ? 'Saving...' : 'Create'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Company</DialogTitle>
              <DialogDescription>Update company details.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setFormField('name', e.target.value)} /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={(e) => setFormField('email', e.target.value)} /></div>
              <div><Label>Industry</Label><Input value={form.industry} onChange={(e) => setFormField('industry', e.target.value)} /></div>
              <div><Label>Website</Label><Input value={form.website} onChange={(e) => setFormField('website', e.target.value)} /></div>
              <div><Label>Total Hires</Label><Input type="number" value={form.totalHires} onChange={(e) => setFormField('totalHires', e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleSaveCompany} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedCompany?.name || 'Company'}</DialogTitle>
              <DialogDescription>Company details and placement engagement metrics.</DialogDescription>
            </DialogHeader>
            {selectedCompany && (
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">Industry:</span> {selectedCompany.industry}</p>
                <p><span className="font-medium">Email:</span> {selectedCompany.email}</p>
                <p><span className="font-medium">Website:</span> {selectedCompany.website || '-'}</p>
                <p><span className="font-medium">Total Hires:</span> {selectedCompany.totalHires}</p>
                <p><span className="font-medium">Total Drives:</span> {selectedCompany.totalDrives}</p>
                <p><span className="font-medium">Last Visit:</span> {formatDate(selectedCompany.lastVisit)}</p>
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
              <DialogTitle>Delete Company</DialogTitle>
              <DialogDescription>This removes {selectedCompany?.name || 'this company'} and associated drives.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={saving}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteCompany} disabled={saving}>{saving ? 'Deleting...' : 'Delete'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

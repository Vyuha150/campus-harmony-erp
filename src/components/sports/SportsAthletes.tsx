import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Plus, Dumbbell, Medal, Trophy, Edit, Eye, FileText, Download, Filter, UserCheck } from 'lucide-react';
import { deleteApi, fetchApi, postApi, putApi } from '@/lib/apiService';
import { toast } from '@/hooks/use-toast';

export default function SportsAthletes() {
  const [sportsAthletes, setSportsAthletes] = useState<any>([]);
  const [_apiLoading, _setApiLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    program: '',
    year: '1',
    phone: '',
    status: 'active'
  });

  const [registerForm, setRegisterForm] = useState({
    studentId: '',
    rollNumber: '',
    studentName: '',
    program: '',
    year: '1',
    sport: '',
    email: '',
    phone: '',
    emergencyContact: ''
  });

  const loadAthletes = async () => {
    try {
      const data = await fetchApi('/sports/athletes');
      setSportsAthletes(data);
    } catch (error) {
      console.error('API request failed', error);
      toast({ title: 'Failed to load athletes', description: String((error as any)?.message || 'Please retry.'), variant: 'destructive' });
    } finally {
      _setApiLoading(false);
    }
  };

  useEffect(() => {
    loadAthletes();
  }, []);

  const [search, setSearch] = useState('');
  const [sportFilter, setSportFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedAthlete, setSelectedAthlete] = useState<string | null>(null);

  const filtered = sportsAthletes.filter(a => {
    const matchSearch = a.studentName.toLowerCase().includes(search.toLowerCase()) || a.rollNumber.toLowerCase().includes(search.toLowerCase());
    const matchSport = sportFilter === 'all' || (Array.isArray(a.sports) ? a.sports : []).some(s => s.sport.toLowerCase() === sportFilter.toLowerCase());
    const matchStatus = statusFilter === 'all' || a.status === statusFilter;
    return matchSearch && matchSport && matchStatus;
  });

  const athlete = selectedAthlete ? sportsAthletes.find(a => a.id === selectedAthlete) : null;
  const totalAthletes = sportsAthletes.length;
  const activeCount = sportsAthletes.filter((a: any) => String(a.status || '').toLowerCase() === 'active').length;
  const injuredCount = sportsAthletes.filter((a: any) => String(a.status || '').toLowerCase() === 'injured').length;
  const medalCount = sportsAthletes.reduce((sum: number, a: any) => sum + (Array.isArray(a.achievements) ? a.achievements.length : 0), 0);

  const registerAthlete = async () => {
    if (!registerForm.studentId.trim() || !registerForm.studentName.trim() || !registerForm.rollNumber.trim()) {
      toast({ title: 'Missing required fields', description: 'Student ID, full name, and roll number are required.', variant: 'destructive' });
      return;
    }

    try {
      await postApi('/sports/athletes', {
        studentId: registerForm.studentId.trim(),
        studentName: registerForm.studentName.trim(),
        rollNumber: registerForm.rollNumber.trim(),
        program: registerForm.program.trim() || 'NA',
        year: Number(registerForm.year),
        email: registerForm.email.trim() || 'na@campusharmony.edu',
        phone: registerForm.phone.trim() || '0000000000',
        sports: registerForm.sport.trim() ? [{ sport: registerForm.sport.trim(), category: 'general', level: 'university', status: 'active' }] : [],
        achievements: [],
        medicalClearance: false,
        emergencyContact: {
          name: registerForm.emergencyContact.trim() || 'NA',
          relationship: 'guardian',
          phone: registerForm.phone.trim() || '0000000000'
        },
        status: 'active'
      });

      setRegisterForm({
        studentId: '',
        rollNumber: '',
        studentName: '',
        program: '',
        year: '1',
        sport: '',
        email: '',
        phone: '',
        emergencyContact: ''
      });
      await loadAthletes();
      toast({ title: 'Athlete registered', description: 'New athlete has been added successfully.' });
    } catch (error: any) {
      toast({ title: 'Registration failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    }
  };

  const toAthletePayload = (item: any) => ({
    studentId: item.studentId,
    studentName: item.studentName,
    rollNumber: item.rollNumber,
    program: item.program,
    year: Number(item.year),
    email: item.email,
    phone: item.phone,
    sports: Array.isArray(item.sports) ? item.sports : [],
    achievements: Array.isArray(item.achievements) ? item.achievements : [],
    medicalClearance: Boolean(item.medicalClearance),
    emergencyContact: item.emergencyContact ?? null,
    status: item.status || 'active'
  });

  const toggleMedicalClearance = async () => {
    if (!athlete) return;
    try {
      const updated = await putApi(`/sports/athletes/${athlete.id}`, {
        ...toAthletePayload(athlete),
        medicalClearance: !athlete.medicalClearance
      });
      setSportsAthletes((prev: any[]) => prev.map((item) => item.id === athlete.id ? updated : item));
      toast({ title: 'Athlete updated', description: `Medical clearance marked as ${updated.medicalClearance ? 'cleared' : 'pending'}.` });
    } catch (error: any) {
      toast({ title: 'Update failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    }
  };

  const saveAthleteProfile = async () => {
    if (!athlete) return;
    try {
      const updated = await putApi(`/sports/athletes/${athlete.id}`, toAthletePayload(athlete));
      setSportsAthletes((prev: any[]) => prev.map((item) => item.id === athlete.id ? updated : item));
      toast({ title: 'Profile saved', description: 'Athlete profile synchronized with API.' });
    } catch (error: any) {
      toast({ title: 'Save failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    }
  };

  const openEditAthlete = () => {
    if (!athlete) return;
    setEditForm({
      program: athlete.program || '',
      year: String(athlete.year || '1'),
      phone: athlete.phone || '',
      status: athlete.status || 'active'
    });
    setIsEditOpen(true);
  };

  const submitEditAthlete = async () => {
    if (!athlete) return;
    try {
      const updated = await putApi(`/sports/athletes/${athlete.id}`, {
        ...toAthletePayload(athlete),
        program: editForm.program.trim() || athlete.program,
        year: Number(editForm.year),
        phone: editForm.phone.trim() || athlete.phone,
        status: editForm.status
      });
      setSportsAthletes((prev: any[]) => prev.map((item) => item.id === athlete.id ? updated : item));
      setIsEditOpen(false);
      toast({ title: 'Athlete updated', description: 'Athlete profile changes saved.' });
    } catch (error: any) {
      toast({ title: 'Update failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    }
  };

  const deleteAthlete = async () => {
    if (!athlete) return;
    if (!window.confirm(`Delete athlete ${athlete.studentName}?`)) return;
    try {
      await deleteApi(`/sports/athletes/${athlete.id}`);
      setSportsAthletes((prev: any[]) => prev.filter((item) => item.id !== athlete.id));
      setSelectedAthlete(null);
      toast({ title: 'Athlete deleted', description: 'Athlete removed successfully.' });
    } catch (error: any) {
      toast({ title: 'Delete failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    }
  };

  const exportAthletes = () => {
    const rows = filtered.map((item: any) => ({
      studentId: item.studentId,
      studentName: item.studentName,
      rollNumber: item.rollNumber,
      program: item.program,
      year: item.year,
      status: item.status,
      medicalClearance: item.medicalClearance ? 'Yes' : 'No'
    }));
    const header = ['studentId', 'studentName', 'rollNumber', 'program', 'year', 'status', 'medicalClearance'];
    const csv = [
      header.join(','),
      ...rows.map((row) => header.map((key) => JSON.stringify((row as any)[key] ?? '')).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sports-athletes-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast({ title: 'Export complete', description: 'Athlete data exported as CSV.' });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Student Athletes Database</h1>
            <p className="text-muted-foreground">Manage athlete profiles, achievements, and co-curricular records</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportAthletes}><Download className="mr-2 h-4 w-4" />Export</Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-2 h-4 w-4" />Register Athlete</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Register New Athlete</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Student ID</Label><Input placeholder="e.g. STU2024001" value={registerForm.studentId} onChange={(e) => setRegisterForm((prev) => ({ ...prev, studentId: e.target.value }))} /></div>
                    <div><Label>Roll Number</Label><Input placeholder="e.g. BT24CS001" value={registerForm.rollNumber} onChange={(e) => setRegisterForm((prev) => ({ ...prev, rollNumber: e.target.value }))} /></div>
                  </div>
                  <div><Label>Full Name</Label><Input placeholder="Student name" value={registerForm.studentName} onChange={(e) => setRegisterForm((prev) => ({ ...prev, studentName: e.target.value }))} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Program</Label><Input placeholder="e.g. B.Tech CSE" value={registerForm.program} onChange={(e) => setRegisterForm((prev) => ({ ...prev, program: e.target.value }))} /></div>
                    <div><Label>Year</Label><Select value={registerForm.year} onValueChange={(value) => setRegisterForm((prev) => ({ ...prev, year: value }))}><SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger><SelectContent><SelectItem value="1">1</SelectItem><SelectItem value="2">2</SelectItem><SelectItem value="3">3</SelectItem><SelectItem value="4">4</SelectItem></SelectContent></Select></div>
                  </div>
                  <div><Label>Primary Sport</Label><Input placeholder="e.g. Cricket, Badminton" value={registerForm.sport} onChange={(e) => setRegisterForm((prev) => ({ ...prev, sport: e.target.value }))} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Email</Label><Input type="email" value={registerForm.email} onChange={(e) => setRegisterForm((prev) => ({ ...prev, email: e.target.value }))} /></div>
                    <div><Label>Phone</Label><Input placeholder="Phone number" value={registerForm.phone} onChange={(e) => setRegisterForm((prev) => ({ ...prev, phone: e.target.value }))} /></div>
                  </div>
                  <div><Label>Emergency Contact</Label><Input placeholder="Name – Relationship – Phone" value={registerForm.emergencyContact} onChange={(e) => setRegisterForm((prev) => ({ ...prev, emergencyContact: e.target.value }))} /></div>
                  <Button className="w-full" onClick={registerAthlete}>Register Athlete</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name or roll number..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={sportFilter} onValueChange={setSportFilter}>
            <SelectTrigger className="w-[160px]"><Filter className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sports</SelectItem>
              <SelectItem value="cricket">Cricket</SelectItem>
              <SelectItem value="badminton">Badminton</SelectItem>
              <SelectItem value="football">Football</SelectItem>
              <SelectItem value="athletics">Athletics</SelectItem>
              <SelectItem value="swimming">Swimming</SelectItem>
              <SelectItem value="basketball">Basketball</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="injured">Injured</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{totalAthletes}</p><p className="text-xs text-muted-foreground">Total Athletes</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">{activeCount}</p><p className="text-xs text-muted-foreground">Active</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-destructive">{injuredCount}</p><p className="text-xs text-muted-foreground">Injured</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-amber-500">{medalCount}</p><p className="text-xs text-muted-foreground">Medals This Year</p></CardContent></Card>
        </div>

        {/* Athletes list / detail view */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            {filtered.map(a => (
              <Card key={a.id} className={`cursor-pointer transition-colors ${selectedAthlete === a.id ? 'ring-2 ring-primary' : 'hover:bg-muted/30'}`} onClick={() => setSelectedAthlete(a.id)}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <Dumbbell className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{a.studentName}</p>
                      <p className="text-sm text-muted-foreground">{a.rollNumber} • {a.program} – Year {a.year}</p>
                      <div className="mt-1 flex gap-2 flex-wrap">{(Array.isArray(a.sports) ? a.sports : []).map((s, i) => <Badge key={i} variant="outline">{s.sport} ({s.level})</Badge>)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(Array.isArray(a.achievements) ? a.achievements : []).length > 0 && <Badge variant="default"><Medal className="mr-1 h-3 w-3" />{(Array.isArray(a.achievements) ? a.achievements : []).length}</Badge>}
                    <Badge variant={a.status === 'active' ? 'default' : a.status === 'injured' ? 'destructive' : 'secondary'} className="capitalize">{a.status}</Badge>
                    {a.medicalClearance && <UserCheck className="h-4 w-4 text-green-600" />}
                  </div>
                </CardContent>
              </Card>
            ))}
            {filtered.length === 0 && <Card><CardContent className="p-8 text-center text-muted-foreground">No athletes found matching criteria.</CardContent></Card>}
          </div>

          {/* Detail panel */}
          <div>
            {athlete ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{athlete.studentName}</span>
                    <Button variant="outline" size="sm" onClick={openEditAthlete}><Edit className="mr-1 h-3 w-3" />Edit</Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Roll No:</span> <span className="text-foreground font-medium">{athlete.rollNumber}</span></div>
                    <div><span className="text-muted-foreground">Program:</span> <span className="text-foreground font-medium">{athlete.program}</span></div>
                    <div><span className="text-muted-foreground">Year:</span> <span className="text-foreground font-medium">{athlete.year}</span></div>
                    <div><span className="text-muted-foreground">Medical:</span> <Badge variant={athlete.medicalClearance ? 'default' : 'destructive'}>{athlete.medicalClearance ? 'Cleared' : 'Pending'}</Badge></div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2">Sports Participation</h4>
                    {(Array.isArray(athlete.sports) ? athlete.sports : []).map((s, i) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                        <span className="text-foreground">{s.sport} – {s.category}</span>
                        <Badge variant="outline" className="capitalize">{s.level}</Badge>
                      </div>
                    ))}
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2">Achievements</h4>
                    {(Array.isArray(athlete.achievements) ? athlete.achievements : []).map(ach => (
                      <div key={ach.id} className="py-2 border-b last:border-0">
                        <div className="flex items-center gap-2">
                          {ach.medal && <Trophy className={`h-4 w-4 ${ach.medal === 'gold' ? 'text-amber-500' : ach.medal === 'silver' ? 'text-gray-400' : 'text-orange-700'}`} />}
                          <span className="text-sm font-medium text-foreground">{ach.eventName}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{ach.venue} • Position #{ach.position} • {ach.verified ? '✅ Verified' : '⏳ Pending verification'}</p>
                      </div>
                    ))}
                    {(Array.isArray(athlete.achievements) ? athlete.achievements : []).length === 0 && <p className="text-sm text-muted-foreground">No achievements recorded yet.</p>}
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-1">Emergency Contact</h4>
                    <p className="text-sm text-muted-foreground">{athlete.emergencyContact.name} ({athlete.emergencyContact.relationship}) – {athlete.emergencyContact.phone}</p>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={toggleMedicalClearance}><FileText className="mr-1 h-3 w-3" />Toggle Clearance</Button>
                    <Button variant="outline" size="sm" className="flex-1" onClick={saveAthleteProfile}><Eye className="mr-1 h-3 w-3" />Save Profile</Button>
                    <Button variant="destructive" size="sm" className="flex-1" onClick={deleteAthlete}>Delete</Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card><CardContent className="p-8 text-center text-muted-foreground">Select an athlete to view details</CardContent></Card>
            )}
          </div>
        </div>

        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Edit Athlete</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div>
                <Label>Program</Label>
                <Input value={editForm.program} onChange={(e) => setEditForm((prev) => ({ ...prev, program: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Year</Label>
                  <Select value={editForm.year} onValueChange={(value) => setEditForm((prev) => ({ ...prev, year: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={editForm.status} onValueChange={(value) => setEditForm((prev) => ({ ...prev, status: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="injured">Injured</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={editForm.phone} onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))} />
              </div>
              <Button onClick={submitEditAthlete}>Save Changes</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

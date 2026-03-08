import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Users, Briefcase, TrendingUp, Clock, Building2, Plus,
  CheckCircle, AlertTriangle, Calendar, Eye, Download
} from 'lucide-react';
import { vacancies as initialVacancies, establishmentSummary } from '@/data/registrarMockData';
import { Vacancy } from '@/types/registrar';

const statusColors: Record<string, string> = {
  advertised: 'bg-blue-50 text-blue-700',
  applications_received: 'bg-cyan-50 text-cyan-700',
  shortlisted: 'bg-amber-50 text-amber-700',
  interview_scheduled: 'bg-purple-50 text-purple-700',
  selected: 'bg-emerald-50 text-emerald-700',
  joined: 'bg-emerald-50 text-emerald-700',
  closed: 'bg-muted text-muted-foreground',
};

export default function RegistrarHR() {
  const { toast } = useToast();
  const [vacancyList, setVacancyList] = useState(initialVacancies);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newPosition, setNewPosition] = useState('');
  const [newDept, setNewDept] = useState('');
  const [newType, setNewType] = useState('teaching');

  const handleAdvance = (id: string) => {
    const steps = ['advertised', 'applications_received', 'shortlisted', 'interview_scheduled', 'selected', 'joined', 'closed'];
    setVacancyList(prev => prev.map(v => {
      if (v.id !== id) return v;
      const idx = steps.indexOf(v.status);
      if (idx < steps.length - 1) return { ...v, status: steps[idx + 1] as Vacancy['status'] };
      return v;
    }));
    toast({ title: 'Status Updated', description: 'Recruitment advanced to next stage.' });
  };

  const handleCreate = () => {
    if (!newPosition || !newDept) return;
    const newVacancy: Vacancy = {
      id: `v${vacancyList.length + 1}`,
      position: newPosition,
      department: newDept,
      type: newType as any,
      sanctioned: 1,
      filled: 0,
      status: 'advertised',
      postedAt: new Date(),
      lastDate: new Date(Date.now() + 30 * 86400000),
      applicants: 0,
    };
    setVacancyList(prev => [...prev, newVacancy]);
    setShowCreateDialog(false);
    setNewPosition('');
    setNewDept('');
    toast({ title: 'Vacancy Posted', description: `"${newPosition}" in ${newDept} has been advertised.` });
  };

  const teachingFillRate = Math.round((establishmentSummary.teaching.filled / establishmentSummary.teaching.sanctioned) * 100);
  const nonTeachingFillRate = Math.round((establishmentSummary.nonTeaching.filled / establishmentSummary.nonTeaching.sanctioned) * 100);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">HR & Establishment</h1>
            <p className="text-muted-foreground">Staff positions, recruitment tracking, promotions, and retirements</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Post Vacancy
          </Button>
        </div>

        {/* Establishment Overview */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Teaching Staff</p>
              <p className="text-xl font-bold">{establishmentSummary.teaching.filled}/{establishmentSummary.teaching.sanctioned}</p>
              <Progress value={teachingFillRate} className="h-2 mt-2" />
              <p className="text-[10px] text-muted-foreground mt-1">{teachingFillRate}% filled • {establishmentSummary.teaching.sanctioned - establishmentSummary.teaching.filled} vacancies</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Non-Teaching Staff</p>
              <p className="text-xl font-bold">{establishmentSummary.nonTeaching.filled}/{establishmentSummary.nonTeaching.sanctioned}</p>
              <Progress value={nonTeachingFillRate} className="h-2 mt-2" />
              <p className="text-[10px] text-muted-foreground mt-1">{nonTeachingFillRate}% filled • {establishmentSummary.nonTeaching.sanctioned - establishmentSummary.nonTeaching.filled} vacancies</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <TrendingUp className="h-8 w-8 text-amber-600" />
              <div>
                <p className="text-2xl font-bold">{establishmentSummary.pendingPromotions}</p>
                <p className="text-xs text-muted-foreground">Pending Promotions</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Clock className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-2xl font-bold">{establishmentSummary.pendingRetirements}</p>
                <p className="text-xs text-muted-foreground">Upcoming Retirements</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recruitment Tracker */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary" /> Active Recruitment Tracker</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {vacancyList.map(v => (
                <div key={v.id} className="flex items-center gap-4 rounded-lg border p-3 hover:bg-muted/20 transition-colors">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    {v.type === 'teaching' ? <Users className="h-5 w-5 text-primary" /> : <Building2 className="h-5 w-5 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium">{v.position}</p>
                      <Badge variant="outline" className="text-[10px]">{v.type.replace('_', '-')}</Badge>
                      <Badge className={`text-[10px] ${statusColors[v.status]}`}>{v.status.replace(/_/g, ' ')}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{v.department}</span>
                      <span>•</span>
                      <span>{v.applicants} applicants</span>
                      <span>•</span>
                      <span>Vacancies: {v.sanctioned - v.filled}</span>
                      {v.lastDate && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Last date: {v.lastDate.toLocaleDateString('en-IN')}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {!['joined', 'closed'].includes(v.status) && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleAdvance(v.id)}>
                      <CheckCircle className="h-3 w-3" /> Advance
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Promotions & Retirements */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Pending Promotions</CardTitle>
            </CardHeader>
            <CardContent>
              {[
                { name: 'Dr. Sita Raman', from: 'Associate Professor', to: 'Professor', dept: 'Physics', years: 12 },
                { name: 'Mr. Rajesh Khanna', from: 'Clerk', to: 'Senior Clerk', dept: 'Admin', years: 15 },
                { name: 'Dr. Kavita Desai', from: 'Assistant Professor', to: 'Associate Professor', dept: 'Chemistry', years: 8 },
              ].map((p, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border p-3 mb-2">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.from} → {p.to} • {p.dept} • {p.years} yrs service</p>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => toast({ title: 'Forwarded', description: `Promotion case for ${p.name} forwarded to VC.` })}>
                    Forward to VC
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4 text-destructive" /> Upcoming Retirements</CardTitle>
            </CardHeader>
            <CardContent>
              {[
                { name: 'Prof. Mohan Lal', dept: 'Mechanical', date: 'April 30, 2026', position: 'Professor' },
                { name: 'Mr. Dinesh Chand', dept: 'Library', date: 'May 31, 2026', position: 'Senior Librarian' },
              ].map((r, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border p-3 mb-2">
                  <div>
                    <p className="text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.position} • {r.dept} • Retires: {r.date}</p>
                  </div>
                  <Badge variant="destructive" className="text-[10px]">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Retiring Soon
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Create Vacancy Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Post New Vacancy</DialogTitle>
              <DialogDescription>Advertise a new position</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div><Label>Position Title</Label><Input value={newPosition} onChange={e => setNewPosition(e.target.value)} placeholder="e.g., Assistant Professor" /></div>
              <div><Label>Department</Label><Input value={newDept} onChange={e => setNewDept(e.target.value)} placeholder="e.g., Computer Science" /></div>
              <div>
                <Label>Type</Label>
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="teaching">Teaching</SelectItem>
                    <SelectItem value="non_teaching">Non-Teaching</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={handleCreate}>Post Vacancy</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

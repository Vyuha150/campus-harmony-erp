import { useState, useEffect } from 'react';
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
import { fetchApi, putApi, postApi } from '@/lib/apiService';
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
  const [vacancies, setVacancies] = useState<any>([]);
  const [establishmentSummary, setEstablishmentSummary] = useState<any>({
    teaching: { filled: 0, sanctioned: 0 },
    nonTeaching: { filled: 0, sanctioned: 0 },
    pendingPromotions: 0,
    pendingRetirements: 0,
    activeRecruitments: 0,
  });
  const [apiLoading, setApiLoading] = useState(true);
  // Real promotion cases (HOD → Dean → Registrar → VC) and retirement records.
  // These two panels were hard-coded names — people and departments that do
  // not exist here — and "Forward to VC" filed those names into the VC's queue.
  const [promotions, setPromotions] = useState<any[]>([]);
  const [retirements, setRetirements] = useState<any[]>([]);
  useEffect(() => {
    fetchApi('/registrar/hr/vacancies').then(d => setVacancies(d)).catch((error) => { console.error('API request failed', error); });
    fetchApi('/registrar/hr/summary').then(d => setEstablishmentSummary(d)).catch((error) => { console.error('API request failed', error); });
    fetchApi<any[]>('/registrar/promotions').then((d) => setPromotions(Array.isArray(d) ? d : [])).catch(() => setPromotions([]));
    fetchApi<any[]>('/registrar/retirements').then((d) => setRetirements(Array.isArray(d) ? d : [])).catch(() => setRetirements([]));
    setApiLoading(false);
  }, []);

  const { toast } = useToast();
  const [vacancyList, setVacancyList] = useState<any[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newPosition, setNewPosition] = useState('');
  const [newDept, setNewDept] = useState('');
  const [newType, setNewType] = useState('teaching');
  const [isCreating, setIsCreating] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);

  useEffect(() => {
    setVacancyList(vacancies || []);
  }, [vacancies]);

  const handleAdvance = async (id: string) => {
    const steps = ['advertised', 'applications_received', 'shortlisted', 'interview_scheduled', 'selected', 'joined', 'closed'];
    try {
      setIsAdvancing(true);
      const vacancy = vacancyList.find(v => v.id === id);
      const idx = steps.indexOf(vacancy?.status);
      if (idx < steps.length - 1) {
        const newStatus = steps[idx + 1];
        await putApi(`/registrar/hr/vacancies/${id}`, { status: newStatus });
        setVacancyList(prev => prev.map(v => {
          if (v.id !== id) return v;
          return { ...v, status: newStatus as Vacancy['status'] };
        }));
        toast({ title: 'Status Updated', description: 'Recruitment advanced to next stage.' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleCreate = async () => {
    if (!newPosition || !newDept) {
      toast({ title: 'Missing fields', description: 'Position and department are required.', variant: 'destructive' });
      return;
    }
    try {
      setIsCreating(true);
      const createdVacancy = await postApi('/registrar/hr/vacancies', {
        position: newPosition,
        department: newDept,
        type: newType,
        sanctioned: 1,
        filled: 0,
        status: 'advertised',
        postedAt: new Date(),
        lastDate: new Date(Date.now() + 30 * 86400000),
        applicants: 0,
      });
      setVacancyList(prev => [...prev, createdVacancy]);
      setShowCreateDialog(false);
      setNewPosition('');
      setNewDept('');
      toast({ title: 'Vacancy Posted', description: `"${newPosition}" in ${newDept} has been advertised.` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const teachingFillRate = establishmentSummary.teaching.sanctioned > 0
    ? Math.round((establishmentSummary.teaching.filled / establishmentSummary.teaching.sanctioned) * 100) : 0;
  const nonTeachingFillRate = establishmentSummary.nonTeaching.sanctioned > 0
    ? Math.round((establishmentSummary.nonTeaching.filled / establishmentSummary.nonTeaching.sanctioned) * 100) : 0;

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
              <p className="text-[10px] text-muted-foreground mt-1">{establishmentSummary.nonTeaching.sanctioned > 0 ? `${nonTeachingFillRate}% filled • ${establishmentSummary.nonTeaching.sanctioned - establishmentSummary.nonTeaching.filled} vacancies` : 'No non-teaching posts recorded'}</p>
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
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Last date: {new Date(v.lastDate).toLocaleDateString('en-IN')}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {!['joined', 'closed'].includes(v.status) && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleAdvance(v.id)} disabled={isAdvancing}>
                      <CheckCircle className="h-3 w-3" /> {isAdvancing ? 'Updating...' : 'Advance'}
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
              {promotions.length === 0 && <p className="text-sm text-muted-foreground">No promotion cases. A HOD recommends one from Faculty Management.</p>}
              {promotions.map((p) => (
                <div key={p.id} className="mb-2 flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.currentDesignation} → {p.newDesignation}{p.department ? ` • ${p.department}` : ''} • {new Date(p.appliedAt).toLocaleDateString('en-IN')}</p>
                  </div>
                  <Badge variant={p.status === 'approved' ? 'default' : p.status === 'rejected' ? 'destructive' : 'secondary'} className="text-[10px] capitalize">
                    {p.status === 'pending' && p.waitingOn ? `With ${String(p.waitingOn).replace(/_/g, ' ')}` : p.status}
                  </Badge>
                </div>
              ))}
              {promotions.some((p) => p.waitingOn === 'registrar') && <p className="text-xs text-amber-700">Cases at your step are in Approvals & Workflows (screening committee).</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4 text-destructive" /> Upcoming Retirements</CardTitle>
            </CardHeader>
            <CardContent>
              {retirements.length === 0 && <p className="text-sm text-muted-foreground">No retirements recorded.</p>}
              {retirements.map((r) => (
                <div key={r.id} className="mb-2 flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.currentDesignation}{r.department ? ` • ${r.department}` : ''} • {r.yearsOfService} yrs • Retires {new Date(r.lastDate).toLocaleDateString('en-IN')}</p>
                  </div>
                  <Badge variant={new Date(r.lastDate).getTime() - Date.now() < 180 * 86_400_000 ? 'destructive' : 'secondary'} className="text-[10px] capitalize">{r.status}</Badge>
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
              <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={isCreating}>Cancel</Button>
              <Button onClick={handleCreate} disabled={isCreating}>{isCreating ? 'Posting...' : 'Post Vacancy'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

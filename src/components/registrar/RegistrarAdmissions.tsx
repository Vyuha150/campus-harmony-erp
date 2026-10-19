import { useEffect, useState } from 'react';
import { CheckCircle, ListOrdered, Plus, Send, UserPlus, XCircle } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchApi, postApi } from '@/lib/apiService';
import { api, getErrorMessage } from '@/lib/api';
import { downloadCsv } from '@/lib/download';
import { toast } from '@/hooks/use-toast';

/**
 * Admissions: open a cycle with its seat matrix → record applications →
 * verify eligibility → generate the merit list → offer seats → confirm
 * admission, which creates the student's account and records the admission fee.
 */
const CATEGORIES = ['GENERAL', 'EWS', 'OBC_NCL', 'SC', 'ST', 'PWD', 'MINORITY'];
const STATUS_TONE: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = { submitted: 'outline', verified: 'secondary', ineligible: 'destructive', offered: 'secondary', admitted: 'default', declined: 'outline', rejected: 'destructive' };
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function RegistrarAdmissions() {
  const [cycles, setCycles] = useState<any[]>([]);
  const [programmes, setProgrammes] = useState<any[]>([]);
  const [cycleId, setCycleId] = useState('');
  const [board, setBoard] = useState<any | null>(null);
  const [busy, setBusy] = useState('');
  const [newCycle, setNewCycle] = useState(false);
  const [newApp, setNewApp] = useState(false);
  const [credentials, setCredentials] = useState<any | null>(null);
  const year = new Date().getFullYear();
  const [cf, setCf] = useState({ programmeId: '', academicYear: `${year}-${String(year + 1).slice(-2)}`, name: '', code: '', applicationStartsAt: iso(new Date()), applicationEndsAt: iso(new Date(Date.now() + 30 * 864e5)), totalSeats: '60', applicationFee: '1000', minimumQualifyingPercentage: '60', entranceExamName: 'AP EAPCET', seats: { GENERAL: '30', EWS: '6', OBC_NCL: '16', SC: '5', ST: '3' } as Record<string, string> });
  const [af, setAf] = useState({ fullName: '', email: '', phone: '', dateOfBirth: '', category: 'GENERAL', gender: 'MALE', domicileState: 'Andhra Pradesh', guardianName: '', guardianPhone: '', previousQualification: 'Intermediate (MPC)', previousBoard: 'BIEAP', previousPercentage: '', previousYearOfPassing: String(year), entranceExamRollNumber: '', entranceExamRank: '' });

  const loadCycles = () => fetchApi<any[]>('/admissions/cycles?pageSize=100').then((d) => { const l = Array.isArray(d) ? d : []; setCycles(l); setCycleId((c) => c || l[0]?.id || ''); }).catch(() => setCycles([]));
  const loadBoard = (id = cycleId) => { if (id) fetchApi<any>(`/admissions/cycles/${id}/board`).then(setBoard).catch(() => setBoard(null)); };
  useEffect(() => { loadCycles(); fetchApi<any[]>('/admissions/programmes').then((d) => setProgrammes(Array.isArray(d) ? d : [])).catch(() => setProgrammes([])); }, []);
  useEffect(() => { loadBoard(); }, [cycleId]);

  const run = async (label: string, fn: () => Promise<any>, ok: (r: any) => string) => {
    setBusy(label);
    try { const r = await fn(); toast({ title: ok(r) }); await loadCycles(); loadBoard(); return r; }
    catch (e: any) { toast({ title: 'Could not complete', description: e?.message, variant: 'destructive' }); return null; }
    finally { setBusy(''); }
  };

  const createCycle = () => run('cycle', () => postApi<any>('/admissions/cycles', {
    programmeId: cf.programmeId, academicYear: cf.academicYear, name: cf.name.trim(), code: cf.code.trim().toUpperCase(),
    applicationStartsAt: cf.applicationStartsAt, applicationEndsAt: cf.applicationEndsAt, totalSeats: Number(cf.totalSeats),
    applicationFee: Number(cf.applicationFee), minimumQualifyingPercentage: Number(cf.minimumQualifyingPercentage), entranceExamName: cf.entranceExamName.trim() || undefined,
    seatMatrix: Object.entries(cf.seats).filter(([, v]) => Number(v) > 0).map(([category, v]) => ({ category, totalSeats: Number(v) }))
  }).then((r) => { setNewCycle(false); setCycleId(r.id); return r; }), (r) => `Cycle ${r.code} created`);

  const addApplication = () => run('app', () => postApi<any>('/admissions/applications', {
    cycleId, fullName: af.fullName.trim(), email: af.email.trim().toLowerCase(), phone: af.phone.trim(), dateOfBirth: af.dateOfBirth, category: af.category, gender: af.gender,
    domicileState: af.domicileState || undefined, guardianName: af.guardianName.trim() || undefined, guardianPhone: af.guardianPhone.trim() || undefined,
    previousQualification: af.previousQualification || undefined, previousBoard: af.previousBoard || undefined,
    previousPercentage: af.previousPercentage ? Number(af.previousPercentage) : undefined, previousYearOfPassing: af.previousYearOfPassing ? Number(af.previousYearOfPassing) : undefined,
    entranceExamRollNumber: af.entranceExamRollNumber || undefined, entranceExamRank: af.entranceExamRank ? Number(af.entranceExamRank) : undefined
  }).then((r) => { setNewApp(false); return r; }), (r) => `Application ${r.applicationNumber} recorded`);

  const confirm = async (offerId: string) => {
    setBusy(offerId);
    try {
      // The one-time password is outside `data`, so this uses the raw client.
      const { data: j } = await api.post(`/admissions/offers/${offerId}/confirm`, {});
      setCredentials({ ...j.data, temporaryPassword: j.temporaryPassword });
      loadBoard();
    } catch (e: any) {
      toast({ title: 'Could not confirm admission', description: getErrorMessage(e), variant: 'destructive' });
    } finally {
      setBusy('');
    }
  };

  const c = board?.cycle;
  const apps: any[] = board?.applications ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admissions</h1>
            <p className="text-muted-foreground">Cycles, applications, merit list, seat offers and admission into the student register</p>
          </div>
          <Button onClick={() => setNewCycle(true)}><Plus className="mr-1 h-4 w-4" />New admission cycle</Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {cycles.map((x) => <Button key={x.id} size="sm" variant={x.id === cycleId ? 'default' : 'outline'} onClick={() => setCycleId(x.id)}>{x.code}<span className="ml-2 text-[10px] font-normal opacity-80">· {String(x.status).replace(/_/g, ' ')}</span></Button>)}
          {!cycles.length && <p className="text-sm text-muted-foreground">No admission cycles yet.</p>}
        </div>

        {c && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle>{c.name} <Badge variant="secondary" className="ml-2 capitalize">{String(c.status).replace(/_/g, ' ')}</Badge></CardTitle>
                    <CardDescription>{c.programme?.name} · {c.academicYear} · {c.totalSeats} seats · applications {new Date(c.applicationStartsAt).toLocaleDateString('en-IN')} – {new Date(c.applicationEndsAt).toLocaleDateString('en-IN')}{c.minimumQualifyingPercentage ? ` · min ${c.minimumQualifyingPercentage}%` : ''}</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {c.status === 'draft' && <Button size="sm" disabled={!!busy} onClick={() => run('open', () => postApi(`/admissions/cycles/${c.id}/open`, {}), () => 'Applications opened')}><Send className="mr-1 h-4 w-4" />Open applications</Button>}
                    {c.status !== 'draft' && <Button size="sm" variant="outline" onClick={() => setNewApp(true)}><UserPlus className="mr-1 h-4 w-4" />Record application</Button>}
                    {c.status !== 'draft' && <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => run('merit', () => postApi<any>(`/admissions/cycles/${c.id}/merit-list`, {}), (r) => `Merit list generated (${r?.ranked ?? r?.count ?? 'all'} ranked)`)}><ListOrdered className="mr-1 h-4 w-4" />Generate merit list</Button>}
                    {apps.length > 0 && <Button size="sm" variant="outline" onClick={() => downloadCsv(`merit-list-${c.code}.csv`, ['Rank', 'Application', 'Name', 'Category', 'Qualifying %', 'Entrance rank', 'Merit score', 'Status'], apps.map((a) => [a.meritRank ?? '', a.applicationNumber, a.fullName, a.category, a.previousPercentage ?? '', a.entranceExamRank ?? '', a.meritScore ?? '', a.status]))}>Export CSV</Button>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {(c.seatMatrix ?? []).map((m: any) => <Badge key={m.category} variant="outline">{m.category.replace('_', ' ')}: {m.filledSeats}/{m.totalSeats}</Badge>)}
              </CardContent>
            </Card>

            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Rank</TableHead><TableHead>Applicant</TableHead><TableHead>Category</TableHead><TableHead>Qualifying</TableHead><TableHead>Entrance</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {apps.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.meritRank ?? '—'}</TableCell>
                      <TableCell><p className="font-medium">{a.fullName}</p><p className="text-xs text-muted-foreground">{a.applicationNumber} · {a.email}</p></TableCell>
                      <TableCell className="text-xs">{a.category.replace('_', ' ')}</TableCell>
                      <TableCell>{a.previousPercentage != null ? `${a.previousPercentage}%` : '—'}</TableCell>
                      <TableCell>{a.entranceExamRank ? `Rank ${a.entranceExamRank}` : '—'}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_TONE[a.status] ?? 'outline'} className="capitalize">{a.status}</Badge>
                        {a.eligibilityRemark && <p className="mt-1 max-w-[12rem] text-[10px] text-muted-foreground">{a.eligibilityRemark}</p>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {a.status === 'submitted' && <>
                            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run(a.id, () => postApi(`/admissions/applications/${a.id}/verify`, { eligible: true, remark: 'Documents verified' }), () => `${a.fullName}: eligible`)}><CheckCircle className="mr-1 h-3 w-3" />Eligible</Button>
                            <Button size="sm" variant="ghost" className="text-destructive" disabled={!!busy} onClick={() => { const remark = window.prompt('Why is the applicant ineligible?'); if (remark && remark.trim().length >= 5) run(a.id, () => postApi(`/admissions/applications/${a.id}/verify`, { eligible: false, remark: remark.trim() }), () => `${a.fullName}: not eligible`); }}><XCircle className="mr-1 h-3 w-3" />Ineligible</Button>
                          </>}
                          {a.status === 'verified' && a.meritRank && <Button size="sm" disabled={!!busy} onClick={() => run(a.id, () => postApi(`/admissions/applications/${a.id}/offer`, { validForDays: 7 }), () => `Seat offered to ${a.fullName}`)}>Offer seat</Button>}
                          {a.offer?.status === 'offered' && a.status !== 'admitted' && <>
                            <Button size="sm" disabled={!!busy} onClick={() => confirm(a.offer.id)}>Confirm admission</Button>
                            <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => run(a.id, () => postApi(`/admissions/offers/${a.offer.id}/decline`, { reason: 'Declined by candidate' }), () => 'Offer declined; seat released')}>Declined</Button>
                          </>}
                          {a.status === 'admitted' && <span className="text-xs text-muted-foreground">In student register</span>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!apps.length && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">{c.status === 'draft' ? 'Open applications to start recording applicants.' : 'No applications yet.'}</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent></Card>
          </>
        )}

        <Dialog open={newCycle} onOpenChange={setNewCycle}>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>New admission cycle</DialogTitle><DialogDescription>Seats per reservation category must add up to the total.</DialogDescription></DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2"><Label>Programme</Label>
                <Select value={cf.programmeId} onValueChange={(v) => setCf({ ...cf, programmeId: v })}><SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                  <SelectContent>{programmes.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1"><Label>Code</Label><Input value={cf.code} onChange={(e) => setCf({ ...cf, code: e.target.value })} placeholder="ADM-CSE-2027" /></div>
              <div className="space-y-1"><Label>Academic year</Label><Input value={cf.academicYear} onChange={(e) => setCf({ ...cf, academicYear: e.target.value })} /></div>
              <div className="space-y-1 sm:col-span-2"><Label>Name</Label><Input value={cf.name} onChange={(e) => setCf({ ...cf, name: e.target.value })} placeholder="B.Tech CSE admissions 2027-28" /></div>
              <div className="space-y-1"><Label>Applications open</Label><Input type="date" value={cf.applicationStartsAt} onChange={(e) => setCf({ ...cf, applicationStartsAt: e.target.value })} /></div>
              <div className="space-y-1"><Label>Applications close</Label><Input type="date" value={cf.applicationEndsAt} onChange={(e) => setCf({ ...cf, applicationEndsAt: e.target.value })} /></div>
              <div className="space-y-1"><Label>Total seats</Label><Input type="number" value={cf.totalSeats} onChange={(e) => setCf({ ...cf, totalSeats: e.target.value })} /></div>
              <div className="space-y-1"><Label>Application fee (₹)</Label><Input type="number" value={cf.applicationFee} onChange={(e) => setCf({ ...cf, applicationFee: e.target.value })} /></div>
              <div className="space-y-1"><Label>Minimum qualifying %</Label><Input type="number" value={cf.minimumQualifyingPercentage} onChange={(e) => setCf({ ...cf, minimumQualifyingPercentage: e.target.value })} /></div>
              <div className="space-y-1"><Label>Entrance exam</Label><Input value={cf.entranceExamName} onChange={(e) => setCf({ ...cf, entranceExamName: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Seats by category</Label>
                <div className="mt-1 grid grid-cols-4 gap-2">{CATEGORIES.map((k) => <div key={k}><p className="text-[10px] text-muted-foreground">{k.replace('_', ' ')}</p><Input type="number" value={cf.seats[k] ?? ''} onChange={(e) => setCf({ ...cf, seats: { ...cf.seats, [k]: e.target.value } })} /></div>)}</div>
                <p className="mt-1 text-xs text-muted-foreground">Total {Object.values(cf.seats).reduce((a, v) => a + (Number(v) || 0), 0)} of {cf.totalSeats}</p>
              </div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setNewCycle(false)}>Cancel</Button><Button disabled={!!busy || !cf.programmeId || !cf.code || !cf.name} onClick={createCycle}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={newApp} onOpenChange={setNewApp}>
          <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
            <DialogHeader><DialogTitle>Record an application</DialogTitle><DialogDescription>{c?.name}</DialogDescription></DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2"><Label>Full name</Label><Input value={af.fullName} onChange={(e) => setAf({ ...af, fullName: e.target.value })} /></div>
              <div className="space-y-1"><Label>Email</Label><Input type="email" value={af.email} onChange={(e) => setAf({ ...af, email: e.target.value })} /></div>
              <div className="space-y-1"><Label>Phone</Label><Input value={af.phone} onChange={(e) => setAf({ ...af, phone: e.target.value })} placeholder="9876543210" /></div>
              <div className="space-y-1"><Label>Date of birth</Label><Input type="date" value={af.dateOfBirth} onChange={(e) => setAf({ ...af, dateOfBirth: e.target.value })} /></div>
              <div className="space-y-1"><Label>Gender</Label>
                <Select value={af.gender} onValueChange={(v) => setAf({ ...af, gender: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['MALE', 'FEMALE', 'TRANSGENDER', 'PREFER_NOT_TO_SAY'].map((g) => <SelectItem key={g} value={g}>{g.replace(/_/g, ' ').toLowerCase()}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1"><Label>Category</Label>
                <Select value={af.category} onValueChange={(v) => setAf({ ...af, category: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((k) => <SelectItem key={k} value={k}>{k.replace('_', ' ')}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1"><Label>Home state</Label><Input value={af.domicileState} onChange={(e) => setAf({ ...af, domicileState: e.target.value })} /></div>
              <div className="space-y-1"><Label>Guardian name</Label><Input value={af.guardianName} onChange={(e) => setAf({ ...af, guardianName: e.target.value })} /></div>
              <div className="space-y-1"><Label>Guardian phone</Label><Input value={af.guardianPhone} onChange={(e) => setAf({ ...af, guardianPhone: e.target.value })} /></div>
              <div className="space-y-1"><Label>Qualifying exam</Label><Input value={af.previousQualification} onChange={(e) => setAf({ ...af, previousQualification: e.target.value })} /></div>
              <div className="space-y-1"><Label>Board</Label><Input value={af.previousBoard} onChange={(e) => setAf({ ...af, previousBoard: e.target.value })} /></div>
              <div className="space-y-1"><Label>Percentage</Label><Input type="number" value={af.previousPercentage} onChange={(e) => setAf({ ...af, previousPercentage: e.target.value })} /></div>
              <div className="space-y-1"><Label>Year of passing</Label><Input type="number" value={af.previousYearOfPassing} onChange={(e) => setAf({ ...af, previousYearOfPassing: e.target.value })} /></div>
              <div className="space-y-1"><Label>Entrance roll no.</Label><Input value={af.entranceExamRollNumber} onChange={(e) => setAf({ ...af, entranceExamRollNumber: e.target.value })} /></div>
              <div className="space-y-1"><Label>Entrance rank</Label><Input type="number" value={af.entranceExamRank} onChange={(e) => setAf({ ...af, entranceExamRank: e.target.value })} /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setNewApp(false)}>Cancel</Button><Button disabled={!!busy || !af.fullName || !af.email || !af.phone || !af.dateOfBirth} onClick={addApplication}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!credentials} onOpenChange={(o) => { if (!o) setCredentials(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Admission confirmed</DialogTitle><DialogDescription>The student is in the register and the admission fee is on their account. Give them these sign-in details now — the password cannot be shown again.</DialogDescription></DialogHeader>
            <div className="space-y-1 rounded-lg bg-muted p-4 font-mono text-sm">
              <p>Roll number: {credentials?.rollNumber}</p>
              <p>Temporary password: {credentials?.temporaryPassword}</p>
            </div>
            <DialogFooter><Button onClick={() => setCredentials(null)}>Done</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

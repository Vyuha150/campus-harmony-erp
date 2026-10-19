import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Shield, GraduationCap, Download, CheckCircle, XCircle } from 'lucide-react';
import { fetchApi, putApi } from '@/lib/apiService';
import { downloadCsv } from '@/lib/download';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Cert {
  id: string; type: string; purpose: string; copies: number; status: string; requestedAt: string;
  certificateNumber: string | null; issuedAt: string | null; collectedAt: string | null;
  studentName: string; rollNumber: string; program: string; department: string | null; semester: number;
  waitingOn: string | null; steps: Array<{ role: string; state: string }>;
}

const ROLE: Record<string, string> = { finance_officer: 'Finance', hod: 'HOD', registrar: 'Registrar' };
const STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: 'Being approved', tone: 'bg-amber-50 text-amber-700' },
  approved: { label: 'Approved — to issue', tone: 'bg-blue-50 text-blue-700' },
  issued: { label: 'Issued', tone: 'bg-emerald-50 text-emerald-700' },
  collected: { label: 'Collected', tone: 'bg-slate-100 text-slate-700' },
  rejected: { label: 'Rejected', tone: 'bg-red-50 text-red-700' },
  cancelled: { label: 'Withdrawn', tone: 'bg-slate-100 text-slate-500' }
};
const date = (v: string | null) => (v ? new Date(v).toLocaleDateString('en-IN') : '—');

/**
 * Certificates students asked for (bonafide, transcript, TC, migration …).
 *
 * Finance (no dues) → HOD (verified) → Registrar approve each request in
 * Approvals & Workflows; then the Registrar issues it here with a verifiable
 * number and records its collection. The old page expected fields the server
 * never sent and offered statuses it refused, and its convocation was a fixed,
 * past date.
 */
export default function RegistrarCertificates() {
  const { toast } = useToast();
  const [certs, setCerts] = useState<Cert[]>([]);
  const [graduands, setGraduands] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [verifyNo, setVerifyNo] = useState('');
  const [verifyResult, setVerifyResult] = useState<any | null>(null);

  const load = () => fetchApi<Cert[]>('/registrar/certificates').then((d) => setCerts(Array.isArray(d) ? d : [])).catch(() => setCerts([]));
  useEffect(() => {
    load();
    fetchApi<any[]>('/registrar/graduands').then((d) => setGraduands(Array.isArray(d) ? d : [])).catch(() => setGraduands([]));
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return certs.filter((c) => (filter === 'all' || c.status === filter) && (!q || `${c.studentName} ${c.rollNumber} ${c.certificateNumber ?? ''}`.toLowerCase().includes(q)));
  }, [certs, search, filter]);
  const count = (status: string) => certs.filter((c) => c.status === status).length;

  const act = async (c: Cert, action: 'issue' | 'collected') => {
    setBusy(c.id);
    try {
      const updated = await putApi<any>(`/registrar/certificates/${c.id}`, { action });
      toast({
        title: action === 'issue' ? `Issued ${updated.certificateNumber}` : 'Marked collected',
        description: action === 'issue' ? `${c.studentName} has been notified to collect it.` : c.studentName
      });
      load();
    } catch (e: any) {
      toast({ title: 'Could not update', description: e?.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const verify = async () => {
    if (!verifyNo.trim()) return;
    try {
      setVerifyResult(await fetchApi<any>(`/registrar/certificates/verify?number=${encodeURIComponent(verifyNo.trim())}`));
    } catch (e: any) {
      toast({ title: 'Verification failed', description: e?.message, variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Certificates</h1>
          <p className="text-muted-foreground">Issue approved certificates, record collection, and verify certificate numbers</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          {[
            ['Being approved', count('pending'), 'pending'], ['To issue', count('approved'), 'approved'],
            ['Issued, not collected', count('issued'), 'issued'], ['Collected', count('collected'), 'collected']
          ].map(([label, value, key]) => (
            <Card key={label as string} className={cn('cursor-pointer', filter === key && 'ring-2 ring-primary')} onClick={() => setFilter(filter === key ? 'all' : (key as string))}>
              <CardContent className="p-4"><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="register">
          <TabsList>
            <TabsTrigger value="register">Certificate Register</TabsTrigger>
            <TabsTrigger value="verify">Verify Certificate</TabsTrigger>
            <TabsTrigger value="graduands">Graduands</TabsTrigger>
          </TabsList>

          <TabsContent value="register" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-lg">Requests {filter !== 'all' && <Badge variant="secondary" className="ml-2">{STATUS[filter]?.label}</Badge>}</CardTitle>
                <div className="relative w-[260px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-8" placeholder="Student, roll no or certificate no" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30 text-left text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Student</th>
                      <th className="px-4 py-3 font-medium">Certificate</th>
                      <th className="px-4 py-3 font-medium">Requested</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Number</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {visible.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No certificate requests.</td></tr>}
                    {visible.map((c) => (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="px-4 py-3"><p className="font-medium">{c.studentName}</p><p className="text-xs text-muted-foreground">{c.rollNumber} · {c.department ?? c.program}</p></td>
                        <td className="px-4 py-3"><p className="capitalize">{c.type}{c.copies > 1 ? ` × ${c.copies}` : ''}</p><p className="max-w-[220px] truncate text-xs text-muted-foreground">{c.purpose}</p></td>
                        <td className="px-4 py-3 text-xs">{date(c.requestedAt)}</td>
                        <td className="px-4 py-3">
                          <Badge className={cn('text-[10px] hover:bg-inherit', STATUS[c.status]?.tone)}>{STATUS[c.status]?.label ?? c.status}</Badge>
                          {c.status === 'pending' && c.steps.length > 0 && (
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {c.steps.map((s) => `${s.state === 'approved' ? '✓' : s.state === 'current' ? '●' : '○'} ${ROLE[s.role] ?? s.role}`).join(' → ')}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{c.certificateNumber ?? '—'}{c.issuedAt && <p className="font-sans text-[10px] text-muted-foreground">issued {date(c.issuedAt)}</p>}</td>
                        <td className="px-4 py-3 text-right">
                          {c.status === 'approved' && <Button size="sm" disabled={busy === c.id} onClick={() => act(c, 'issue')}>Issue</Button>}
                          {c.status === 'issued' && <Button size="sm" variant="outline" disabled={busy === c.id} onClick={() => act(c, 'collected')}>Mark collected</Button>}
                          {c.status === 'pending' && c.waitingOn === 'registrar' && <span className="text-xs text-amber-700">Approve it in Approvals</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="verify" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" />Verify a certificate</CardTitle>
                <CardDescription>For employers and other universities — enter the certificate number printed on it.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input placeholder="e.g. CH/BON/2026/0001" value={verifyNo} onChange={(e) => { setVerifyNo(e.target.value); setVerifyResult(null); }} onKeyDown={(e) => e.key === 'Enter' && verify()} />
                  <Button onClick={verify} className="gap-2"><Search className="h-4 w-4" />Verify</Button>
                </div>
                {verifyResult?.valid === true && (
                  <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-sm dark:bg-green-950/30">
                    <p className="flex items-center gap-2 font-semibold text-green-700"><CheckCircle className="h-4 w-4" />Genuine certificate</p>
                    <p className="mt-1">{verifyResult.certificateNumber} · <span className="capitalize">{verifyResult.type}</span> · issued {date(verifyResult.issuedAt)}</p>
                    <p>{verifyResult.studentName} ({verifyResult.rollNumber}) · {verifyResult.program}</p>
                  </div>
                )}
                {verifyResult?.valid === false && (
                  <p className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:bg-red-950/30"><XCircle className="h-4 w-4" />No issued certificate has this number.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="graduands" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5 text-primary" />Graduands — final-year students</CardTitle>
                  <CardDescription>{graduands.length} students in semesters 7–8, for the convocation list and degree certificates.</CardDescription>
                </div>
                <Button variant="outline" className="gap-2" disabled={graduands.length === 0} onClick={() => downloadCsv('graduands.csv', ['Roll no', 'Name', 'Programme', 'Department', 'Semester', 'CGPA', 'Batch'], graduands.map((g) => [g.rollNumber, g.name, g.program, g.department, g.semester, g.cgpa, g.batch]))}>
                  <Download className="h-4 w-4" />Export list
                </Button>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/30 text-left text-muted-foreground"><th className="px-4 py-2 font-medium">Roll no</th><th className="px-4 py-2 font-medium">Name</th><th className="px-4 py-2 font-medium">Department</th><th className="px-4 py-2 text-center font-medium">Sem</th><th className="px-4 py-2 text-center font-medium">CGPA</th></tr></thead>
                  <tbody>
                    {graduands.map((g) => (
                      <tr key={g.id} className="border-b last:border-0"><td className="px-4 py-2 font-mono text-xs">{g.rollNumber}</td><td className="px-4 py-2">{g.name}</td><td className="px-4 py-2 text-xs">{g.department}</td><td className="px-4 py-2 text-center">{g.semester}</td><td className="px-4 py-2 text-center">{g.cgpa}</td></tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

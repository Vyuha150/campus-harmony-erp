import { useEffect, useState } from 'react';
import { Award, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { fetchApi } from '@/lib/apiService';
import { fetchNaacReadiness, requestCriterionSignoff } from '@/lib/iqacApi';
import { toast } from '@/hooks/use-toast';

/**
 * Readiness for each of the seven NAAC criteria, from the Registrar's checklist
 * (signed off by the Principal), the departments' verified data and IQAC's
 * approved evidence — with what is still missing — and the ERP's live figures.
 */
export function NaacReadiness() {
  const [rows, setRows] = useState<any[]>([]);
  const [live, setLive] = useState<any[]>([]);
  const [year, setYear] = useState('');
  const load = () => {
    fetchNaacReadiness().then((d) => setRows(Array.isArray(d) ? d : [])).catch(() => setRows([]));
    fetchApi<any>('/iqac/criteria').then((d) => { setLive(Array.isArray(d?.live) ? d.live : []); setYear(d?.academicYear ?? ''); }).catch(() => undefined);
  };
  useEffect(() => { load(); }, []);
  const overall = rows.length ? Math.round(rows.reduce((a, r) => a + r.score, 0) / rows.length) : 0;

  const signoff = async (id: string) => {
    try {
      await requestCriterionSignoff(id);
      toast({ title: 'Sent to the Principal for sign-off' });
      load();
    } catch (e: any) {
      toast({ title: 'Could not send', description: e?.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2"><Award className="h-5 w-5" />NAAC readiness — {overall}%</CardTitle>
              <CardDescription>Per criterion: Registrar checklist signed off by the Principal (40%), departments' verified data (40%), approved evidence documents (20%).</CardDescription>
            </div>
          </div>
          <Progress value={overall} className="h-2" />
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => (
            <div key={r.criterion} className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Criterion {r.criterion} — {r.name}</p>
                <Badge variant={r.score >= 80 ? 'default' : r.score >= 50 ? 'secondary' : 'destructive'}>{r.score}%</Badge>
              </div>
              <Progress value={r.score} className="mt-2 h-1.5" />
              <p className="mt-2 text-xs text-muted-foreground">
                {r.departmentMetrics.total ? `${r.departmentMetrics.verified}/${r.departmentMetrics.total} department metrics verified · ` : ''}{r.documents.approved}/{r.documents.total} documents approved
              </p>
              {r.missing.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs text-amber-700">{r.missing.map((m: string) => <li key={m}>{m}</li>)}</ul>}
              <div className="mt-2 flex flex-wrap gap-1">
                {r.checklist.map((c: any) => c.status === 'completed'
                  ? <Badge key={c.id} variant="default">Signed off</Badge>
                  : c.awaitingSignoff
                    ? <Badge key={c.id} variant="secondary">With the Principal</Badge>
                    : <Button key={c.id} size="sm" variant="outline" onClick={() => signoff(c.id)}><Send className="mr-1 h-3 w-3" />Send for sign-off</Button>)}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      {live.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Live figures {year && `(${year})`}</CardTitle><CardDescription>Computed from the ERP's records — the same figures HODs verify for their departments.</CardDescription></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {live.map((m) => (
              <div key={m.key} className="rounded border p-2">
                <p className="text-xs text-muted-foreground">{m.metric}</p>
                <p className="text-base font-semibold">{m.value}</p>
                <p className="text-[10px] text-muted-foreground">{m.basis}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

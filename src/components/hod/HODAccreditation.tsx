import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UploadField } from '@/components/ui/upload-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, Paperclip, CheckCircle, Clock, AlertTriangle, Award, Edit, Plus, Database, RotateCcw } from 'lucide-react';
import { downloadUpload, fetchApi, postApi, putApi, uploadApi } from '@/lib/apiService';
import { downloadCsv } from '@/lib/download';
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface Item {
  id: string; criterion: string; metric: string; value: string; year: string; status: 'pending' | 'complete' | 'needs_review';
  source: 'computed' | 'manual'; basis: string | null; documentUrl: string | null; documentName: string | null;
  verifiedAt: string | null; lastUpdated: string; updatedBy: string;
}

const CRITERIA = [
  'Criterion 1 – Curricular Aspects',
  'Criterion 2 – Teaching-Learning and Evaluation',
  'Criterion 3 – Research, Innovations and Extension',
  'Criterion 4 – Infrastructure and Learning Resources',
  'Criterion 5 – Student Support and Progression',
  'Criterion 6 – Governance, Leadership and Management',
  'Criterion 7 – Institutional Values and Best Practices'
];

/**
 * The department's NAAC data for the current academic year.
 *
 * Most figures are gathered from the ERP (courses, results, attendance,
 * research, waivers, placements, mentoring) and refresh whenever this page
 * opens; the HOD verifies each one and attaches evidence. Anything the ERP does
 * not hold is added by hand. Readiness = verified ÷ all.
 */
export default function HODAccreditation() {
  const { toast } = useToast();
  const [data, setData] = useState<Item[]>([]);
  const [year, setYear] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Item | null>(null);
  const [editValue, setEditValue] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [newMetric, setNewMetric] = useState({ criterion: CRITERIA[0]!, metric: '', value: '' });
  const [attachFor, setAttachFor] = useState<Item | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchApi<Item[]>('/hod/accreditationdata');
      setData(Array.isArray(res) ? res : []);
      // The academic year the computed rows belong to.
      setYear((Array.isArray(res) && res.find((r) => r.source === 'computed')?.year) || '');
    } catch (error: any) {
      toast({ title: 'Could not load accreditation data', description: error?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const complete = data.filter((d) => d.status === 'complete').length;
  const pending = data.filter((d) => d.status === 'pending').length;
  const needsReview = data.filter((d) => d.status === 'needs_review').length;
  const withEvidence = data.filter((d) => d.documentUrl).length;
  const readiness = data.length > 0 ? Math.round((complete / data.length) * 100) : 0;
  const criteria = [...new Set(data.map((d) => d.criterion))].sort();

  const fail = (title: string, e: any) => toast({ title, description: e?.message || 'Please try again.', variant: 'destructive' });
  const patch = async (item: Item, body: Record<string, unknown>) => {
    const updated = await putApi<any>(`/hod/accreditationdata/${item.id}`, body);
    setData((prev) => prev.map((d) => (d.id === item.id ? { ...d, ...updated, lastUpdated: new Date().toLocaleDateString('en-IN') } : d)));
  };

  const verify = async (item: Item) => {
    try {
      await patch(item, { status: 'complete' });
      toast({ title: 'Verified', description: item.metric });
    } catch (e) { fail('Verification failed', e); }
  };
  const reopen = async (item: Item) => {
    try {
      await patch(item, { status: 'needs_review' });
      toast({ title: 'Marked for review', description: item.metric });
    } catch (e) { fail('Update failed', e); }
  };
  const saveEdit = async () => {
    if (!editing || !editValue.trim()) return;
    try {
      await patch(editing, { value: editValue.trim(), status: 'pending' });
      toast({ title: 'Value updated', description: 'Verify it again once checked.' });
      setEditing(null);
    } catch (e) { fail('Update failed', e); }
  };
  const addMetric = async () => {
    if (!newMetric.metric.trim() || !newMetric.value.trim()) {
      toast({ title: 'Missing fields', description: 'Enter the metric and its value.', variant: 'destructive' });
      return;
    }
    try {
      await postApi('/hod/accreditationdata', { criterion: newMetric.criterion, metric: newMetric.metric.trim(), value: newMetric.value.trim(), year: year || String(new Date().getFullYear()) });
      setAddOpen(false);
      setNewMetric({ criterion: CRITERIA[0]!, metric: '', value: '' });
      toast({ title: 'Metric added', description: 'Verify it once the evidence is in place.' });
      load();
    } catch (e) { fail('Could not add the metric', e); }
  };
  const attach = async () => {
    if (!attachFor || !file) return;
    setBusy(true);
    try {
      // Was a JSON post with only a name — no file ever reached the server.
      const up: any = await uploadApi(file, 'accreditation', {
        visibility: 'role_restricted', allowedRoles: ['hod', 'dean', 'principal', 'iqac_coordinator', 'registrar'],
        relatedEntityType: 'AccreditationData', relatedEntityId: attachFor.id
      });
      await patch(attachFor, { documentUrl: up.url, documentName: file.name });
      toast({ title: 'Evidence attached', description: `${file.name} → ${attachFor.metric}` });
      setAttachFor(null);
      setFile(null);
    } catch (e) { fail('Upload failed', e); } finally { setBusy(false); }
  };
  // Was "Export SSR", which the server always refused. This is the data itself.
  const exportCsv = () => downloadCsv(
    `naac-department-data-${year || 'current'}.csv`,
    ['Criterion', 'Metric', 'Value', 'Source', 'How derived', 'Status', 'Evidence', 'Year'],
    data.map((d) => [d.criterion, d.metric, d.value, d.source === 'computed' ? 'ERP' : 'Entered by HOD', d.basis ?? '', d.status.replace('_', ' '), d.documentName ?? '', d.year])
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Accreditation Data</h1>
            <p className="text-muted-foreground">Department NAAC data{year ? ` for ${year}` : ''} — gathered from the ERP, verified by you</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}><Plus className="mr-1 h-4 w-4" />Add metric</Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={data.length === 0}><Download className="mr-1 h-4 w-4" />Export (CSV)</Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Readiness (verified)', value: `${readiness}%`, icon: Award, color: 'text-green-600 bg-green-100' },
            { label: 'Verified', value: complete, icon: CheckCircle, color: 'text-blue-600 bg-blue-100' },
            { label: 'To verify', value: pending, icon: Clock, color: 'text-amber-600 bg-amber-100' },
            { label: 'Changed since verified', value: needsReview, icon: AlertTriangle, color: 'text-destructive bg-destructive/10' },
          ].map((s) => (
            <Card key={s.label} className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.color}`}><s.icon className="h-5 w-5" /></div>
                <div><p className="text-2xl font-bold text-foreground">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Department NAAC readiness</CardTitle>
              <span className="text-sm text-muted-foreground">{complete} of {data.length} verified · {withEvidence} with evidence</span>
            </div>
            <Progress value={readiness} className="mt-2 h-2" />
            <CardDescription className="pt-2">
              Figures marked <Badge variant="outline" className="mx-1 gap-1 text-[10px]"><Database className="h-3 w-3" />ERP</Badge> are calculated from the department's records and update by themselves.
              Check each one and press <b>Verify</b>; attach evidence where NAAC asks for it. Readiness rises as you verify.
            </CardDescription>
          </CardHeader>
        </Card>

        {loading && <p className="text-sm text-muted-foreground">Gathering department data…</p>}

        <div className="space-y-4">
          {criteria.map((criterion) => {
            const items = data.filter((d) => d.criterion === criterion);
            return (
              <Card key={criterion} className="border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-primary" />{criterion}
                    <Badge variant="outline" className="ml-auto text-[10px]">{items.filter((i) => i.status === 'complete').length}/{items.length} verified</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Metric</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Evidence</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <p className="font-medium text-foreground">{item.metric}</p>
                            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              {item.source === 'computed' ? <><Database className="h-3 w-3" />ERP · {item.basis}</> : <>Entered by HOD · {item.lastUpdated}</>}
                            </p>
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-bold">{item.value}</TableCell>
                          <TableCell>
                            <Badge variant={item.status === 'complete' ? 'default' : item.status === 'needs_review' ? 'destructive' : 'secondary'} className="text-[10px]">
                              {item.status === 'complete' ? 'Verified' : item.status === 'needs_review' ? 'Changed — review' : 'To verify'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {item.documentUrl ? (
                              <button type="button" className="flex items-center gap-1 text-xs text-primary hover:underline" onClick={() => downloadUpload(item.documentUrl!, item.documentName || 'evidence').catch(() => undefined)}>
                                <Paperclip className="h-3 w-3" />{item.documentName ?? 'Evidence'}
                              </button>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" className="h-7 text-xs" title="Attach evidence" onClick={() => { setAttachFor(item); setFile(null); }}><Paperclip className="h-3 w-3" /></Button>
                              {item.source === 'manual' && (
                                <Button size="sm" variant="ghost" className="h-7 text-xs" title="Edit value" onClick={() => { setEditing(item); setEditValue(item.value); }}><Edit className="h-3 w-3" /></Button>
                              )}
                              {item.status !== 'complete' ? (
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-green-600" onClick={() => verify(item)}><CheckCircle className="mr-1 h-3 w-3" />Verify</Button>
                              ) : (
                                <Button size="sm" variant="ghost" className="h-7 text-xs" title="Mark for review again" onClick={() => reopen(item)}><RotateCcw className="h-3 w-3" /></Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit – {editing?.metric}</DialogTitle><DialogDescription>Editing sets it back to “To verify”.</DialogDescription></DialogHeader>
          <div><Label>Value</Label><Input value={editValue} onChange={(e) => setEditValue(e.target.value)} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={saveEdit}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add a metric</DialogTitle><DialogDescription>For data the ERP does not hold — e.g. awards, MoUs, best practices, extension activities.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>NAAC criterion</Label>
              <Select value={newMetric.criterion} onValueChange={(v) => setNewMetric((p) => ({ ...p, criterion: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CRITERIA.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Metric</Label><Input placeholder="e.g. 3.4 Extension activities conducted" value={newMetric.metric} onChange={(e) => setNewMetric((p) => ({ ...p, metric: e.target.value }))} /></div>
            <div><Label>Value</Label><Input placeholder="e.g. 4 (NSS camp, blood donation …)" value={newMetric.value} onChange={(e) => setNewMetric((p) => ({ ...p, value: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button><Button onClick={addMetric}>Add metric</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={attachFor !== null} onOpenChange={(open) => { if (!open) { setAttachFor(null); setFile(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Attach evidence</DialogTitle><DialogDescription>{attachFor?.metric}. Readable by the HOD, Dean, Principal, IQAC and Registrar.</DialogDescription></DialogHeader>
          <UploadField label="Document" file={file} accept=".pdf,.jpg,.jpeg,.png,.xlsx,.docx,.csv" helperText="Sanction letter, mark sheet summary, MoU, photographs …" onFileSelect={setFile} />
          <DialogFooter><Button variant="outline" onClick={() => setAttachFor(null)}>Cancel</Button><Button onClick={attach} disabled={!file || busy}>{busy ? 'Uploading…' : 'Attach'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

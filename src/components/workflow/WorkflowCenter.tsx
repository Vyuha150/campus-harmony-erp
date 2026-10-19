import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { fetchApi, postApi } from '@/lib/apiService';

/**
 * Approvals & Workflows.
 *
 * The workflow engine had an API and no screen: 59 approval processes were
 * defined, and none could be started, approved or followed without calling the
 * API by hand. This is the screen for all three, for every role:
 *
 *   Awaiting me   approvals whose current step is this user's role
 *   My requests   approvals this user raised, with where each one stands
 *   Catalogue     every defined workflow and who approves each step
 */

interface InboxItem { instanceId: string; workflow: string; entityType: string; entityId: string; step: string; waitingSince: string; overdue: boolean }
interface MineItem { instanceId: string; workflow: string; workflowName: string; entityType: string; entityId: string; status: string; currentStep: string | null; waitingOn: string | null; startedAt: string; endedAt: string | null }
interface Step { sequence: number; name: string; assigneeRole: string; slaHours: number | null; escalationRole: string | null }
interface Definition { code: string; name: string; description: string | null; entityType: string; version: number; steps: Step[] }

const ROLE_LABEL: Record<string, string> = {
  student: 'Student', faculty: 'Faculty', hod: 'HOD', dean: 'Dean', principal: 'Principal', registrar: 'Registrar',
  coe: 'Controller of Examinations', vice_chancellor: 'Vice-Chancellor', pro_vc: 'Pro Vice-Chancellor',
  finance_officer: 'Finance Officer', iqac_coordinator: 'IQAC Coordinator', placement_officer: 'Placement Officer',
  librarian: 'Librarian', grievance_officer: 'Grievance Officer', security_officer: 'Security Officer',
  sports_director: 'Sports Director', alumni_officer: 'Alumni Officer', auditor: 'Auditor', super_admin: 'IT Administrator'
};
const roleLabel = (role: string | null) => (role ? ROLE_LABEL[role] ?? role : '—');
const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const allowance = (hours: number | null) => (hours == null ? '—' : hours % 24 === 0 ? `${hours / 24} day${hours === 24 ? '' : 's'}` : `${hours} h`);
/** "LeaveRequest" → "Leave Request". */
const readable = (entityType: string) => entityType.replace(/([a-z])([A-Z])/g, '$1 $2');

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
  cancelled: 'bg-slate-100 text-slate-600'
};

/** A field value from the approved record, readable. */
const showValue = (value: unknown) => {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDate(value);
  return String(value);
};
const STEP_STYLE: Record<string, string> = {
  approved: 'border-emerald-500 bg-emerald-50 text-emerald-700',
  rejected: 'border-red-500 bg-red-50 text-red-700',
  cancelled: 'border-slate-400 bg-slate-100 text-slate-600',
  current: 'border-amber-500 bg-amber-50 text-amber-700',
  upcoming: 'border-border text-muted-foreground'
};

/**
 * What the request is and where it stands. Approvers had only Approve and
 * Reject — no dates, no reason, no sign of who had already signed.
 */
export function DetailsDialog({ instanceId, onClose, actions }: { instanceId: string | null; onClose: () => void; actions?: React.ReactNode }) {
  const [details, setDetails] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setDetails(null);
    setError(null);
    if (!instanceId) return;
    fetchApi<any>(`/workflow/instances/${instanceId}`).then(setDetails).catch((e) => setError(e?.message || 'Could not load the details.'));
  }, [instanceId]);

  return (
    <Dialog open={instanceId !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{details?.workflow?.name ?? 'Approval details'}</DialogTitle>
          {details && (
            <DialogDescription>
              {details.requester ? `${details.requester.name} · ${roleLabel(details.requester.role)}${details.requester.department ? ` · ${details.requester.department}` : ''}` : ''}
              {' · raised '}{formatDate(details.startedAt)}
            </DialogDescription>
          )}
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!details && !error && <p className="text-sm text-muted-foreground">Loading…</p>}
        {details && (
          <div className="space-y-5">
            <section>
              <h4 className="mb-2 text-sm font-semibold">Request</h4>
              {details.record?.length ? (
                <dl className="divide-y rounded-lg border text-sm">
                  {details.record.map((f: any) => (
                    <div key={f.label} className="grid grid-cols-[38%_62%] gap-2 px-3 py-2">
                      <dt className="text-muted-foreground">{f.label}</dt>
                      <dd className="break-words font-medium">{showValue(f.value)}</dd>
                    </div>
                  ))}
                </dl>
              ) : <p className="text-sm text-muted-foreground">The record has no details to show.</p>}
            </section>

            <section>
              <h4 className="mb-2 text-sm font-semibold">Approval chain</h4>
              <ol className="space-y-2">
                {details.steps?.map((step: any) => (
                  <li key={step.sequence} className={`rounded-lg border-l-4 border p-3 text-sm ${STEP_STYLE[step.state] ?? ''}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{step.sequence}. {step.name} <span className="font-normal">({roleLabel(step.assigneeRole)})</span></span>
                      <span className="text-xs font-semibold capitalize">{step.state === 'current' ? 'Waiting' : step.state}</span>
                    </div>
                    {step.actorName && <p className="text-xs">{step.actorName} · {formatDate(step.at)}</p>}
                    {step.note && <p className="mt-1 text-xs italic">“{step.note}”</p>}
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}
        {actions && details?.status === 'pending' && <DialogFooter>{actions}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}

export default function WorkflowCenter() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [mine, setMine] = useState<MineItem[]>([]);
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<{ instanceId: string; title: string; canDecide: boolean } | null>(null);

  // Decision dialog (approve / reject / withdraw) and start dialog.
  const [decision, setDecision] = useState<{ instanceId: string; title: string; action: 'approved' | 'rejected' | 'cancelled' } | null>(null);
  const [note, setNote] = useState('');
  const [starting, setStarting] = useState<Definition | null>(null);
  const [recordId, setRecordId] = useState('');

  const load = useCallback(async () => {
    const [inboxData, mineData, definitionData] = await Promise.allSettled([
      fetchApi<InboxItem[]>('/workflow/inbox?pageSize=100'),
      fetchApi<MineItem[]>('/workflow/mine?pageSize=100'),
      fetchApi<Definition[]>('/workflow/definitions')
    ]);
    setInbox(inboxData.status === 'fulfilled' && Array.isArray(inboxData.value) ? inboxData.value : []);
    setMine(mineData.status === 'fulfilled' && Array.isArray(mineData.value) ? mineData.value : []);
    setDefinitions(definitionData.status === 'fulfilled' && Array.isArray(definitionData.value) ? definitionData.value : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // `?open=<record id>` (from a notification) opens that request: to decide it
  // if it is waiting on this user, otherwise read-only under "My requests".
  const location = useLocation();
  const [tab, setTab] = useState('inbox');
  const opened = useRef<string | null>(null);
  useEffect(() => {
    const target = new URLSearchParams(location.search).get('open');
    if (!target || loading || opened.current === location.search) return;
    opened.current = location.search;
    const waiting = inbox.find((i) => i.entityId === target);
    const own = mine.find((m) => m.entityId === target);
    if (waiting) {
      setTab('inbox');
      setViewing({ instanceId: waiting.instanceId, title: workflowTitle(waiting.workflow), canDecide: true });
    } else if (own) {
      setTab('mine');
      setViewing({ instanceId: own.instanceId, title: own.workflowName, canDecide: false });
    } else {
      toast({ title: 'Already handled', description: 'This request is no longer waiting for you.' });
    }
  }, [location.search, loading, inbox, mine]);

  const nameByCode = useMemo(() => new Map(definitions.map((d) => [d.code, d.name])), [definitions]);
  const visibleDefinitions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return definitions;
    return definitions.filter((d) => `${d.name} ${d.code} ${d.description ?? ''}`.toLowerCase().includes(q));
  }, [definitions, search]);

  const submitDecision = async () => {
    if (!decision) return;
    if (decision.action === 'rejected' && note.trim().length < 10) {
      toast({ title: 'A reason is required', description: 'Give at least 10 characters so the requester knows what to change.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      await postApi(`/workflow/instances/${decision.instanceId}/act`, { action: decision.action, ...(note.trim() ? { note: note.trim() } : {}) });
      toast({ title: decision.action === 'approved' ? 'Approved' : decision.action === 'rejected' ? 'Rejected' : 'Withdrawn', description: decision.title });
      setDecision(null);
      setNote('');
      await load();
    } catch (error) {
      toast({ title: 'Could not record the decision', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const submitStart = async () => {
    if (!starting || !recordId.trim()) return;
    setBusy(true);
    try {
      await postApi('/workflow/instances', { code: starting.code, entityType: starting.entityType, entityId: recordId.trim() });
      toast({ title: 'Approval started', description: `${starting.name} is now with ${roleLabel(starting.steps[0]?.assigneeRole ?? null)}.` });
      setStarting(null);
      setRecordId('');
      await load();
    } catch (error) {
      toast({ title: 'Could not start the approval', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const workflowTitle = (codeWithVersion: string) => nameByCode.get(codeWithVersion.split(' ')[0]!) ?? codeWithVersion;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Approvals & Workflows</h1>
          <p className="text-muted-foreground">Act on approvals waiting for {roleLabel(user?.role ?? null)}, follow your own requests, and see every defined process.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Awaiting me</p><p className="text-2xl font-bold">{inbox.length}</p><p className="text-xs text-muted-foreground">{inbox.filter((i) => i.overdue).length} overdue</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">My requests in progress</p><p className="text-2xl font-bold">{mine.filter((m) => m.status === 'pending').length}</p><p className="text-xs text-muted-foreground">{mine.length} raised in total</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Defined workflows</p><p className="text-2xl font-bold">{definitions.length}</p><p className="text-xs text-muted-foreground">mapped to NAAC and NIRF</p></CardContent></Card>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="inbox">Awaiting me ({inbox.length})</TabsTrigger>
            <TabsTrigger value="mine">My requests ({mine.length})</TabsTrigger>
            <TabsTrigger value="catalogue">Catalogue ({definitions.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="inbox" className="mt-4 space-y-3">
            {!loading && inbox.length === 0 && (
              <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nothing is waiting for your approval.</p>
            )}
            {inbox.map((item) => (
              <Card key={item.instanceId}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{workflowTitle(item.workflow)}</p>
                    <p className="text-sm text-muted-foreground">Step: {item.step}</p>
                    <p className="text-xs text-muted-foreground">{readable(item.entityType)} • record {item.entityId} • waiting since {formatDate(item.waitingSince)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.overdue && <Badge variant="destructive">Overdue</Badge>}
                    <Button size="sm" variant="ghost" onClick={() => setViewing({ instanceId: item.instanceId, title: workflowTitle(item.workflow), canDecide: true })}>View details</Button>
                    <Button size="sm" variant="outline" onClick={() => { setNote(''); setDecision({ instanceId: item.instanceId, title: workflowTitle(item.workflow), action: 'rejected' }); }}>Reject</Button>
                    <Button size="sm" onClick={() => { setNote(''); setDecision({ instanceId: item.instanceId, title: workflowTitle(item.workflow), action: 'approved' }); }}>Approve</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="mine" className="mt-4 space-y-3">
            {!loading && mine.length === 0 && (
              <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">You have not raised any approval. Start one from the Catalogue.</p>
            )}
            {mine.map((item) => (
              <Card key={item.instanceId}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{item.workflowName}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.status === 'pending' ? `With ${roleLabel(item.waitingOn)} — ${item.currentStep}` : `Closed ${formatDate(item.endedAt)}`}
                    </p>
                    <p className="text-xs text-muted-foreground">{readable(item.entityType)} • record {item.entityId} • raised {formatDate(item.startedAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={STATUS_STYLE[item.status] ?? ''}>{item.status}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => setViewing({ instanceId: item.instanceId, title: item.workflowName, canDecide: false })}>View details</Button>
                    {item.status === 'pending' && (
                      <Button size="sm" variant="outline" onClick={() => { setNote(''); setDecision({ instanceId: item.instanceId, title: item.workflowName, action: 'cancelled' }); }}>Withdraw</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="catalogue" className="mt-4 space-y-3">
            <Input placeholder="Search workflows — e.g. leave, NIRF, 2.5, scholarship" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
            {!loading && visibleDefinitions.length === 0 && (
              <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No workflow matches that search.</p>
            )}
            {visibleDefinitions.map((definition) => (
              <Card key={definition.code}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-base">{definition.name}</CardTitle>
                      {definition.description && <CardDescription className="mt-1">{definition.description}</CardDescription>}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => { setRecordId(''); setStarting(definition); }}>Start</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-1">
                    {definition.steps.map((step) => (
                      <li key={step.sequence} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                        <span className="w-5 shrink-0 text-muted-foreground">{step.sequence}.</span>
                        <span className="text-foreground">{step.name}</span>
                        <Badge variant="secondary" className="text-[10px]">{roleLabel(step.assigneeRole)}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {allowance(step.slaHours)}{step.escalationRole ? ` • escalates to ${roleLabel(step.escalationRole)}` : ''}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-2 text-xs text-muted-foreground">Approves: {readable(definition.entityType)} • code {definition.code}</p>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      <DetailsDialog
        instanceId={viewing?.instanceId ?? null}
        onClose={() => setViewing(null)}
        actions={viewing?.canDecide ? (
          <>
            <Button variant="outline" onClick={() => { const v = viewing; setViewing(null); setNote(''); setDecision({ instanceId: v.instanceId, title: v.title, action: 'rejected' }); }}>Reject</Button>
            <Button onClick={() => { const v = viewing; setViewing(null); setNote(''); setDecision({ instanceId: v.instanceId, title: v.title, action: 'approved' }); }}>Approve</Button>
          </>
        ) : undefined}
      />

      <Dialog open={decision !== null} onOpenChange={(open) => { if (!open) setDecision(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{decision?.action === 'approved' ? 'Approve' : decision?.action === 'rejected' ? 'Reject' : 'Withdraw'} — {decision?.title}</DialogTitle>
            <DialogDescription>
              {decision?.action === 'rejected'
                ? 'A reason of at least 10 characters is required.'
                : decision?.action === 'cancelled'
                  ? 'This closes your request. It cannot be reopened; raise a new one if needed.'
                  : 'An optional note is recorded with your decision.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="workflow-note">Note</Label>
            <Textarea id="workflow-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecision(null)}>Cancel</Button>
            <Button onClick={submitDecision} disabled={busy} variant={decision?.action === 'approved' ? 'default' : 'destructive'}>
              {decision?.action === 'approved' ? 'Approve' : decision?.action === 'rejected' ? 'Reject' : 'Withdraw request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={starting !== null} onOpenChange={(open) => { if (!open) setStarting(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start — {starting?.name}</DialogTitle>
            <DialogDescription>
              This sends an existing {starting ? readable(starting.entityType).toLowerCase() : 'record'} for approval, beginning with {roleLabel(starting?.steps[0]?.assigneeRole ?? null)}. The record must already exist.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="workflow-record">{starting ? readable(starting.entityType) : 'Record'} ID</Label>
            <Input id="workflow-record" value={recordId} onChange={(e) => setRecordId(e.target.value)} placeholder="ID of the record to be approved" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStarting(null)}>Cancel</Button>
            <Button onClick={submitStart} disabled={busy || !recordId.trim()}>Start approval</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

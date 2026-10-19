import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fetchApi, putApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface LeaveRow {
  id: string; type: string; fromDate: string; toDate: string; days: number; reason: string; status: string; appliedAt: string;
  instanceId: string | null; waitingOn: string | null; awaitingMe: boolean;
  steps: Array<{ role: string; name: string; state: string; note: string | null }>;
}

const ROLE: Record<string, string> = { hod: 'HOD', dean: 'Dean', registrar: 'Registrar', principal: 'Principal', vice_chancellor: 'VC' };
const role = (r: string | null) => (r ? ROLE[r] ?? r.replace(/_/g, ' ') : '—');
const d = (v: string) => new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * A faculty member's leave applications and the HOD's decision on each.
 *
 * Replaces "Manage Leave", which offered Approve / Reject for the faculty
 * member as a whole — with no application in sight, and a click that marked
 * their latest leave approved outright, skipping the Dean and Registrar.
 * Approving here is the HOD step of the leave approval: it forwards the leave
 * to the Dean.
 */
export function FacultyLeaveDialog({ faculty, open, onOpenChange, onDecided }: {
  faculty: { id: string; name: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDecided?: () => void;
}) {
  const { toast } = useToast();
  const [leaves, setLeaves] = useState<LeaveRow[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    if (!faculty) return;
    setLeaves(null);
    fetchApi<LeaveRow[]>(`/hod/planning/faculty/${faculty.id}/leaves`)
      .then((rows) => setLeaves(Array.isArray(rows) ? rows : []))
      .catch((e) => { setLeaves([]); toast({ title: 'Could not load leave requests', description: e?.message, variant: 'destructive' }); });
  };
  useEffect(() => { if (open) load(); }, [open, faculty?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const decide = async (leave: LeaveRow, action: 'approve' | 'reject') => {
    if (!faculty) return;
    if (action === 'reject' && (notes[leave.id]?.trim().length ?? 0) < 10) {
      toast({ title: 'Add a reason', description: 'A rejection needs a reason of at least 10 characters, so the faculty member knows why.', variant: 'destructive' });
      return;
    }
    setBusy(leave.id);
    try {
      const result = await putApi<{ complete: boolean; assigneeRole: string | null }>(`/hod/faculty/${faculty.id}/leave`, {
        leaveId: leave.id, action, ...(notes[leave.id]?.trim() ? { note: notes[leave.id]!.trim() } : {})
      });
      toast({
        title: action === 'reject' ? 'Leave rejected' : result?.complete ? 'Leave approved' : `Forwarded to the ${role(result?.assigneeRole ?? null)}`,
        description: `${faculty.name} has been notified.`
      });
      load();
      onDecided?.();
    } catch (e: any) {
      toast({ title: 'Decision failed', description: e?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const waiting = leaves?.filter((l) => l.awaitingMe) ?? [];
  const others = leaves?.filter((l) => !l.awaitingMe) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Leave – {faculty?.name}</DialogTitle>
          <DialogDescription>Faculty leave goes HOD → Dean → Registrar. Approving here forwards it to the Dean.</DialogDescription>
        </DialogHeader>

        {leaves === null && <p className="text-sm text-muted-foreground">Loading…</p>}
        {leaves?.length === 0 && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{faculty?.name} has not applied for any leave.</p>}

        {waiting.length > 0 && <h4 className="text-sm font-semibold">Waiting for your decision</h4>}
        {waiting.map((l) => (
          <div key={l.id} className="space-y-3 rounded-lg border border-amber-400 p-4">
            <LeaveSummary leave={l} />
            <Textarea rows={2} placeholder="Note to the faculty member (required to reject, at least 10 characters)" value={notes[l.id] ?? ''} onChange={(e) => setNotes((p) => ({ ...p, [l.id]: e.target.value }))} />
            <div className="flex gap-2">
              <Button className="flex-1" disabled={busy === l.id} onClick={() => decide(l, 'approve')}>{busy === l.id ? 'Saving…' : 'Approve & forward to Dean'}</Button>
              <Button variant="destructive" className="flex-1" disabled={busy === l.id} onClick={() => decide(l, 'reject')}>Reject</Button>
            </div>
          </div>
        ))}

        {others.length > 0 && <h4 className="text-sm font-semibold">{waiting.length ? 'Other applications' : 'Applications'}</h4>}
        {others.map((l) => (
          <div key={l.id} className="rounded-lg border p-4"><LeaveSummary leave={l} /></div>
        ))}
      </DialogContent>
    </Dialog>
  );
}

function LeaveSummary({ leave }: { leave: LeaveRow }) {
  return (
    <div className="space-y-1.5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium capitalize">{leave.type} leave · {d(leave.fromDate)}{leave.days > 1 ? ` – ${d(leave.toDate)}` : ''} ({leave.days} day{leave.days > 1 ? 's' : ''})</span>
        <Badge variant={leave.status === 'approved' ? 'default' : leave.status === 'pending' ? 'secondary' : 'destructive'} className="capitalize">
          {leave.status === 'pending' && leave.waitingOn ? `Waiting on ${role(leave.waitingOn)}` : leave.status}
        </Badge>
      </div>
      <p className="text-muted-foreground">“{leave.reason}” · applied {d(leave.appliedAt)}</p>
      {leave.steps.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-xs">
          {leave.steps.map((s, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span className="text-muted-foreground">→</span>}
              <span className={cn(s.state === 'approved' && 'text-green-600', s.state === 'rejected' && 'text-destructive', s.state === 'current' && 'font-semibold text-amber-600', s.state === 'upcoming' && 'text-muted-foreground')}>
                {s.state === 'approved' ? '✓' : s.state === 'rejected' ? '✗' : s.state === 'current' ? '●' : '○'} {role(s.role)}
              </span>
            </span>
          ))}
        </div>
      )}
      {leave.steps.filter((s) => s.note).map((s, i) => <p key={i} className="text-xs italic text-muted-foreground">{role(s.role)}: “{s.note}”</p>)}
    </div>
  );
}

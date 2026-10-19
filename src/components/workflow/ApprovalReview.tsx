import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { postApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';
import { DetailsDialog } from './WorkflowCenter';

/**
 * Review one approval in place: the request and its chain (DetailsDialog),
 * a note, and Approve / Reject. A rejection needs a reason of 10+ characters —
 * the engine refuses one without, and the requester has to know what to change.
 */
export function ApprovalReview({ instanceId, onClose, onDecided }: { instanceId: string | null; onClose: () => void; onDecided: () => void }) {
  const { toast } = useToast();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setNote(''); }, [instanceId]);

  const decide = async (action: 'approved' | 'rejected') => {
    if (!instanceId) return;
    if (action === 'rejected' && note.trim().length < 10) {
      toast({ title: 'Add a reason', description: 'A rejection needs a reason of at least 10 characters.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const r = await postApi<{ complete: boolean; assigneeRole: string | null; status: string }>(`/workflow/instances/${instanceId}/act`, {
        action, ...(note.trim() ? { note: note.trim() } : {})
      });
      toast({
        title: action === 'rejected' ? 'Rejected' : r?.complete ? 'Approved' : 'Approved and forwarded',
        description: r?.complete ? 'The requester has been notified.' : `Now with ${r?.assigneeRole?.replace(/_/g, ' ') ?? 'the next approver'}.`
      });
      onDecided();
      onClose();
    } catch (e: any) {
      toast({ title: 'Decision failed', description: e?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DetailsDialog
      instanceId={instanceId}
      onClose={onClose}
      actions={
        <div className="flex w-full flex-col gap-2">
          <Textarea rows={2} placeholder="Note (required to reject, at least 10 characters)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="text-destructive" disabled={busy} onClick={() => decide('rejected')}>Reject</Button>
            <Button disabled={busy} onClick={() => decide('approved')}>{busy ? 'Saving…' : 'Approve'}</Button>
          </div>
        </div>
      }
    />
  );
}

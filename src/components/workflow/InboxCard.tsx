import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle, ChevronRight, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchApi } from '@/lib/apiService';
import { ApprovalReview } from '@/components/workflow/ApprovalReview';

/**
 * Requests waiting at this user's step of an approval workflow, each opened in
 * the Review window (full details, approval chain, approve / reject with a note).
 *
 * Replaces the per-role "pending approvals" lists that read the legacy approval
 * table: those held seeded rows linked to nothing, and approving one there
 * skipped the rest of the chain.
 */
export function InboxCard({ title = 'Awaiting your approval', description, limit, onCount }: { title?: string; description?: string; limit?: number; onCount?: (n: number) => void }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<string | null>(null);

  const load = () => fetchApi<any[]>('/workflow/inbox?pageSize=100')
    .then((d) => { const list = Array.isArray(d) ? d : []; setItems(list); onCount?.(list.length); })
    .catch(() => setItems([]))
    .finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const shown = limit ? items.slice(0, limit) : items;
  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg"><Bell className="h-5 w-5 text-amber-500" />{title} ({items.length})</CardTitle>
          <Button variant="outline" size="sm" onClick={() => navigate('/workflows')}>All approvals <ChevronRight className="ml-1 h-4 w-4" /></Button>
        </div>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-3">
        {!loading && items.length === 0 && (
          <div className="py-8 text-center text-muted-foreground">
            <CheckCircle className="mx-auto mb-2 h-10 w-10 text-green-500" />
            <p className="font-medium">All caught up</p>
            <p className="text-sm">Nothing is waiting for your decision.</p>
          </div>
        )}
        {shown.map((item) => (
          <div key={item.instanceId} className="flex items-start gap-3 rounded-lg border p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted"><FileText className="h-4 w-4 text-muted-foreground" /></div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.workflowName}</p>
              <p className="text-xs text-muted-foreground">{item.requestedBy ? `From ${item.requestedBy} · ` : ''}{item.step}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">Waiting since {new Date(item.waitingSince).toLocaleDateString('en-IN')}</p>
            </div>
            {item.overdue && <Badge variant="destructive" className="text-[10px]">Overdue</Badge>}
            <Button size="sm" onClick={() => setReviewing(item.instanceId)}>Review</Button>
          </div>
        ))}
        {limit && items.length > limit && <p className="text-center text-xs text-muted-foreground">+{items.length - limit} more in All approvals</p>}
      </CardContent>
      <ApprovalReview instanceId={reviewing} onClose={() => setReviewing(null)} onDecided={load} />
    </Card>
  );
}

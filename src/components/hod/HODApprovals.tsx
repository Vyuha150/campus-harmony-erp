import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { InboxCard } from '@/components/workflow/InboxCard';

/**
 * The HOD's approvals: the requests waiting at their step of each workflow.
 * This page listed the legacy approval table — seeded rows linked to no real
 * request, where approving skipped the rest of the chain.
 */
export default function HODApprovals() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Approvals</h1>
          <p className="text-muted-foreground">Requests from your department waiting for your decision</p>
        </div>
        <InboxCard description="Open a request to see its details and the full approval chain, then approve or reject with a note." />
      </div>
    </DashboardLayout>
  );
}

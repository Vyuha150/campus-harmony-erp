import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { InboxCard } from '@/components/workflow/InboxCard';

/**
 * The Vice-Chancellor's approvals: the requests waiting at their step of each workflow.
 * This page listed the legacy approval table — seeded rows linked to no real
 * request, where approving skipped the rest of the chain.
 */
export default function VCApprovals() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Approvals</h1>
          <p className="text-muted-foreground">Final sanctions waiting for the Vice-Chancellor — promotions, research projects, budgets, recruitment, policies</p>
        </div>
        <InboxCard description="Open a request to see its details and every earlier decision, then sanction or reject with a note." />
      </div>
    </DashboardLayout>
  );
}

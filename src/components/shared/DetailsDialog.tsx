import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface Details {
  title: string;
  description?: string;
  /** Label / value pairs; empty values render as "—". */
  rows: Array<[string, ReactNode]>;
  /** Anything below the table, e.g. a list or action buttons. */
  footer?: ReactNode;
}

/**
 * Read-only record viewer. Several "View" buttons only flashed a toast (or did
 * nothing); they now open this with the record's fields.
 *
 *   const [details, setDetails] = useState<Details | null>(null);
 *   <DetailsDialog details={details} onClose={() => setDetails(null)} />
 */
export function DetailsDialog({ details, onClose }: { details: Details | null; onClose: () => void }) {
  return (
    <Dialog open={details !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{details?.title}</DialogTitle>
          {details?.description && <DialogDescription>{details.description}</DialogDescription>}
        </DialogHeader>
        <dl className="divide-y rounded-lg border text-sm">
          {details?.rows.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[40%_60%] gap-2 px-3 py-2">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="break-words font-medium text-foreground">
                {value === null || value === undefined || value === '' ? '—' : value}
              </dd>
            </div>
          ))}
        </dl>
        {details?.footer}
      </DialogContent>
    </Dialog>
  );
}

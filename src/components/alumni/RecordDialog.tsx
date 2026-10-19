import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/**
 * A read-only "View" dialog: a title and a list of labelled values.
 *
 * Every alumni screen had "View" (and Attendees, Manage, Track, Report)
 * buttons whose handler only re-fetched the list — clicking them appeared to
 * do nothing. They now open this, with any actions passed as `children`.
 */
export function RecordDialog({
  open, onOpenChange, title, description, rows, children
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  rows: Array<[string, ReactNode]>;
  children?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div>
          {rows.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5 border-b border-border py-2 last:border-0 sm:flex-row sm:gap-4">
              <span className="w-36 shrink-0 text-sm text-muted-foreground">{label}</span>
              <span className="whitespace-pre-wrap text-sm text-foreground">{value === null || value === undefined || value === '' ? '—' : value}</span>
            </div>
          ))}
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** Display a date as day/month/year, or a dash. */
export const showDate = (value: unknown) => {
  if (!value) return '—';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

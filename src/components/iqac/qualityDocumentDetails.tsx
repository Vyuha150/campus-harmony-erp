import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { downloadUpload } from '@/lib/apiService';
import type { Details } from '@/components/shared/DetailsDialog';

const formatDate = (value: unknown) => {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('en-IN');
};

/** The fields of a quality (NAAC evidence) document, for DetailsDialog. */
export function documentDetails(doc: any): Details {
  return {
    title: doc.title,
    description: `Criterion ${doc.criteriaNumber} • ${doc.documentType}`,
    rows: [
      ['Version', doc.version],
      ['Uploaded by', doc.uploadedBy],
      ['Uploaded on', formatDate(doc.uploadDate)],
      ['Status', String(doc.status || '').replace('_', ' ')],
      ['Review comments', doc.reviewComments],
      ['Reviewed on', formatDate(doc.reviewDate)]
    ],
    footer: doc.filePath ? (
      <Button variant="outline" className="w-full" onClick={() => downloadUpload(doc.filePath, doc.title).catch(() => undefined)}>
        <Download className="mr-2 h-4 w-4" />Download file
      </Button>
    ) : (
      <p className="text-sm text-muted-foreground">No file is attached to this record.</p>
    )
  };
}

/** Approve / send back, with a comment that is required when sending back. */
export function ReviewActions({ onDecide }: { onDecide: (status: 'approved' | 'needs_revision', comment: string) => Promise<void> }) {
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const decide = async (status: 'approved' | 'needs_revision') => {
    setBusy(true);
    try {
      await onDecide(status, comment.trim());
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <Textarea rows={3} placeholder="Review comment (required when sending back)" value={comment} onChange={(e) => setComment(e.target.value)} />
      <div className="flex gap-2">
        <Button className="flex-1" disabled={busy} onClick={() => decide('approved')}>Approve</Button>
        <Button className="flex-1" variant="destructive" disabled={busy || !comment.trim()} onClick={() => decide('needs_revision')}>Needs revision</Button>
      </div>
    </div>
  );
}

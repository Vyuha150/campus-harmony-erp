import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Search, Filter, CheckCircle2, XCircle, MessageSquare, Eye, Upload, Download } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { UploadField } from '@/components/ui/upload-field';
import { postApi, uploadApi } from '@/lib/apiService';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { fetchIQACDocuments, updateIQACDocument } from '@/lib/iqacApi';

export default function IQACDocuments() {
  const { toast } = useToast();
  const [qualityDocuments, setQualityDocuments] = useState<any>([]);
  const [apiLoading, setApiLoading] = useState(true);

  const loadDocuments = async () => {
    try {
      setApiLoading(true);
      const docs = await fetchIQACDocuments();
      setQualityDocuments(docs);
    } catch (error: any) {
      toast({ title: 'Unable to load documents', description: error?.message || 'Please refresh and try again.', variant: 'destructive' });
    } finally {
      setApiLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newCriteriaNumber, setNewCriteriaNumber] = useState('1');
  const [newDocumentType, setNewDocumentType] = useState('evidence');
  const [newTags, setNewTags] = useState('');

  const [statusFilter, setStatusFilter] = useState('all');
  const [criteriaFilter, setCriteriaFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = qualityDocuments.filter(d => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (criteriaFilter !== 'all' && d.criteriaNumber !== parseInt(criteriaFilter)) return false;
    if (searchTerm && !d.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: qualityDocuments.length,
    approved: qualityDocuments.filter(d => d.status === 'approved').length,
    pendingReview: qualityDocuments.filter(d => d.status === 'pending_review').length,
    needsRevision: qualityDocuments.filter(d => d.status === 'needs_revision').length,
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'approved': return 'default' as const;
      case 'needs_revision': return 'destructive' as const;
      case 'rejected': return 'destructive' as const;
      default: return 'secondary' as const;
    }
  };

  const handleUpload = async () => {
    if (!newTitle.trim() || !newFile) {
      toast({ title: 'Missing details', description: 'Title and file are required.', variant: 'destructive' });
      return;
    }

    try {
      setUploading(true);
      const uploadResult: any = await uploadApi(newFile, 'iqac-documents');
      const created = await postApi('/iqac/documents', {
        title: newTitle.trim(),
        criteriaNumber: Number(newCriteriaNumber),
        documentType: newDocumentType,
        filePath: uploadResult?.url,
        tags: newTags.split(',').map((item) => item.trim()).filter(Boolean)
      });

      setQualityDocuments((prev: any[]) => [{
        ...created,
        uploadDate: new Date(created?.uploadDate ?? Date.now()),
        tags: Array.isArray(created?.tags) ? created.tags : []
      }, ...prev]);
      setShowUploadDialog(false);
      setNewFile(null);
      setNewTitle('');
      setNewTags('');
      setNewCriteriaNumber('1');
      setNewDocumentType('evidence');
      toast({ title: 'Document uploaded', description: 'IQAC document uploaded successfully.' });
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error?.message || 'Unable to upload document.', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleReviewStatus = async (documentId: string, status: 'approved' | 'needs_revision') => {
    try {
      const reviewComments = status === 'needs_revision'
        ? window.prompt('Enter revision comments for the uploader:', 'Please address review feedback and re-upload updated evidence.')
        : '';

      if (status === 'needs_revision' && reviewComments === null) {
        return;
      }

      const updated = await updateIQACDocument(documentId, {
        status,
        reviewComments: status === 'needs_revision' ? reviewComments : ''
      });

      setQualityDocuments((prev: any[]) => prev.map((doc) => (
        doc.id === documentId
          ? {
              ...doc,
              ...updated,
              uploadDate: updated?.uploadDate ? new Date(updated.uploadDate) : doc.uploadDate,
              reviewDate: updated?.reviewDate ? new Date(updated.reviewDate) : doc.reviewDate,
              tags: Array.isArray(updated?.tags) ? updated.tags : doc.tags
            }
          : doc
      )));

      toast({
        title: status === 'approved' ? 'Document approved' : 'Revision requested',
        description: status === 'approved' ? 'The document has been marked as approved.' : 'Revision feedback has been saved.'
      });
    } catch (error: any) {
      toast({ title: 'Review update failed', description: error?.message || 'Unable to update document status.', variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Document Review</h1>
            <p className="text-muted-foreground">Review and verify evidence documents for NAAC accreditation</p>
          </div>
          <Button size="sm" onClick={() => setShowUploadDialog(true)}><Upload className="mr-2 h-4 w-4" />Upload Document</Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card><CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-foreground">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Documents</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-green-600">{stats.approved}</p>
            <p className="text-xs text-muted-foreground">Approved</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-amber-500">{stats.pendingReview}</p>
            <p className="text-xs text-muted-foreground">Pending Review</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-destructive">{stats.needsRevision}</p>
            <p className="text-xs text-muted-foreground">Needs Revision</p>
          </CardContent></Card>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search documents..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <Select value={criteriaFilter} onValueChange={setCriteriaFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Criteria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Criteria</SelectItem>
              {[1,2,3,4,5,6,7].map(n => <SelectItem key={n} value={String(n)}>Criterion {n}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><Filter className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending_review">Pending Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="needs_revision">Needs Revision</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Document Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead className="text-center">Criteria</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Uploaded By</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{d.title}</p>
                        <p className="text-xs text-muted-foreground">{d.uploadDate.toLocaleDateString('en-IN')}</p>
                        {d.reviewComments && (
                          <p className="text-xs text-amber-600 mt-1">
                            <MessageSquare className="inline h-3 w-3 mr-1" />{d.reviewComments}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {d.criteriaNumber}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{d.documentType}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.uploadedBy}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">v{d.version}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(d.status)} className="capitalize">{d.status.replace('_', ' ')}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="View"
                          onClick={() => d.filePath ? window.open(d.filePath, '_blank', 'noopener,noreferrer') : toast({ title: 'No file available', variant: 'destructive' })}
                        ><Eye className="h-4 w-4" /></Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Approve"
                          className="text-green-600 hover:text-green-700"
                          onClick={() => handleReviewStatus(d.id, 'approved')}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Request Revision"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleReviewStatus(d.id, 'needs_revision')}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Download"
                          onClick={() => d.filePath ? window.open(d.filePath, '_blank', 'noopener,noreferrer') : toast({ title: 'No file available', variant: 'destructive' })}
                        ><Download className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!apiLoading && filtered.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">No documents match your filters.</div>
            )}
          </CardContent>
        </Card>

        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Upload IQAC Document</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Title</Label>
                <Input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Document title" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Criteria</Label>
                  <Select value={newCriteriaNumber} onValueChange={setNewCriteriaNumber}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7].map((number) => (
                        <SelectItem key={number} value={String(number)}>Criterion {number}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={newDocumentType} onValueChange={setNewDocumentType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="policy">Policy</SelectItem>
                      <SelectItem value="procedure">Procedure</SelectItem>
                      <SelectItem value="certificate">Certificate</SelectItem>
                      <SelectItem value="report">Report</SelectItem>
                      <SelectItem value="data">Data</SelectItem>
                      <SelectItem value="evidence">Evidence</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Tags</Label>
                <Input value={newTags} onChange={(event) => setNewTags(event.target.value)} placeholder="NAAC, AQAR, KPI" />
              </div>
              <div>
                <Label>File</Label>
                <UploadField
                  file={newFile}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
                  onFileSelect={setNewFile}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowUploadDialog(false)}>Cancel</Button>
                <Button onClick={handleUpload} disabled={uploading}>{uploading ? 'Uploading...' : 'Upload'}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UploadField } from '@/components/ui/upload-field';
import { useToast } from '@/hooks/use-toast';
import {
  Search, FileText, Upload, Download, Eye, Lock, Unlock,
  Tag, Folder, Calendar, Plus, Filter
} from 'lucide-react';
import { fetchApi, postApi, uploadApi } from '@/lib/apiService';
import { AdminDocument } from '@/types/registrar';

const categoryLabels: Record<string, string> = {
  government_order: 'Government Order',
  ugc_communication: 'UGC Communication',
  circular: 'Circular',
  minutes: 'Minutes',
  policy: 'Policy',
  notification: 'Notification',
  audit_report: 'Audit Report',
};

const categoryColors: Record<string, string> = {
  government_order: 'bg-red-50 text-red-700',
  ugc_communication: 'bg-blue-50 text-blue-700',
  circular: 'bg-amber-50 text-amber-700',
  minutes: 'bg-purple-50 text-purple-700',
  policy: 'bg-emerald-50 text-emerald-700',
  notification: 'bg-cyan-50 text-cyan-700',
  audit_report: 'bg-orange-50 text-orange-700',
};

export default function RegistrarDocuments() {
  const [adminDocuments, setAdminDocuments] = useState<any>([]);
  const [_apiLoading, _setApiLoading] = useState(true);
  useEffect(() => {
    fetchApi('/registrar/documents').then(d => setAdminDocuments(d)).catch((error) => { console.error('API request failed', error); });
    _setApiLoading(false);
  }, []);

  const { toast } = useToast();
  const [documents, setDocuments] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('circular');
  const [newTags, setNewTags] = useState('');
  const [isConfidential, setIsConfidential] = useState(false);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const normalizeDocument = (raw: any) => ({
    ...raw,
    uploadedAt: new Date(raw?.uploadedAt ?? Date.now()),
    tags: Array.isArray(raw?.tags) ? raw.tags : [],
    accessRoles: Array.isArray(raw?.accessRoles) ? raw.accessRoles : [],
  });

  const formatBytes = (size: number): string => {
    if (!Number.isFinite(size) || size <= 0) return '0 KB';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = size;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  useEffect(() => {
    setDocuments((adminDocuments || []).map(normalizeDocument));
  }, [adminDocuments]);

  const filtered = documents.filter(d => {
    const matchSearch = d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchCategory = categoryFilter === 'all' || d.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  const handleUpload = async () => {
    if (!newTitle.trim() || !newFile) {
      toast({ title: 'Missing details', description: 'Title and file are required.', variant: 'destructive' });
      return;
    }

    try {
      setUploading(true);
      const uploadResult: any = await uploadApi(newFile, 'registrar-documents');
      const created = await postApi('/registrar/documents', {
        title: newTitle.trim(),
        category: newCategory,
        tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
        isConfidential,
        accessRoles: isConfidential ? ['registrar', 'vice_chancellor'] : ['all'],
        fileSize: formatBytes(newFile.size),
        filePath: uploadResult?.storagePath,
        fileUrl: uploadResult?.url,
        fileName: uploadResult?.fileName,
        mimeType: uploadResult?.mimeType,
      });
      setDocuments(prev => [normalizeDocument(created), ...prev]);
      setShowUploadDialog(false);
      setNewTitle('');
      setNewTags('');
      setNewFile(null);
      setIsConfidential(false);
      toast({ title: 'Document uploaded', description: `"${newTitle}" added to repository.` });
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error?.message || 'Unable to upload document.', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Document Management</h1>
            <p className="text-muted-foreground">Repository of government orders, circulars, minutes, and administrative documents</p>
          </div>
          <Button onClick={() => setShowUploadDialog(true)} className="gap-2">
            <Upload className="h-4 w-4" /> Upload Document
          </Button>
        </div>

        {/* Category Stats */}
        <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {Object.entries(categoryLabels).map(([key, label]) => (
            <Card key={key} className={`cursor-pointer hover:shadow-md transition-shadow ${categoryFilter === key ? 'ring-2 ring-primary' : ''}`} onClick={() => setCategoryFilter(categoryFilter === key ? 'all' : key)}>
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold">{documents.filter(d => d.category === key).length}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search documents by title or tags..." className="pl-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          {categoryFilter !== 'all' && (
            <Button variant="ghost" size="sm" onClick={() => setCategoryFilter('all')}>Clear Filter</Button>
          )}
        </div>

        {/* Documents List */}
        <div className="space-y-3">
          {filtered.map(doc => (
            <Card key={doc.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="flex items-center gap-4 p-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${categoryColors[doc.category]}`}>
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm truncate">{doc.title}</p>
                    {doc.isConfidential && <Lock className="h-3 w-3 text-destructive" />}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Badge variant="outline" className={`text-[10px] ${categoryColors[doc.category]}`}>{categoryLabels[doc.category]}</Badge>
                    <span>•</span>
                    <span>{doc.uploadedBy}</span>
                    <span>•</span>
                    <span>{doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('en-IN') : 'N/A'}</span>
                    <span>•</span>
                    <span>{doc.fileSize}</span>
                  </div>
                  <div className="flex gap-1 mt-1">
                    {doc.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-[10px] gap-0.5"><Tag className="h-2.5 w-2.5" /> {tag}</Badge>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => doc.fileUrl ? window.open(doc.fileUrl, '_blank', 'noopener,noreferrer') : toast({ title: 'No file available', variant: 'destructive' })}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => doc.fileUrl ? window.open(doc.fileUrl, '_blank', 'noopener,noreferrer') : toast({ title: 'No file available', variant: 'destructive' })}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Upload Dialog */}
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
              <DialogDescription>Add a new document to the administrative repository</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div><Label>Document Title</Label><Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g., UGC Circular on Fee Regulation" /></div>
              <div>
                <Label>Category</Label>
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Tags (comma separated)</Label><Input value={newTags} onChange={e => setNewTags(e.target.value)} placeholder="e.g., UGC, Fee, Regulation" /></div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={isConfidential} onChange={e => setIsConfidential(e.target.checked)} className="rounded" />
                <Label>Mark as Confidential</Label>
              </div>
              <div className="rounded-lg border-2 border-dashed p-6 text-center text-muted-foreground">
                <Upload className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">Select file to upload</p>
                <p className="text-xs">PDF, DOCX, XLSX up to 50MB</p>
                <UploadField
                  className="mt-3 text-left"
                  file={newFile}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
                  onFileSelect={setNewFile}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUploadDialog(false)}>Cancel</Button>
              <Button onClick={handleUpload} className="gap-2" disabled={uploading}><Upload className="h-4 w-4" /> {uploading ? 'Uploading...' : 'Upload'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

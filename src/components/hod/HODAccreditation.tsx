import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  FileText, Download, Upload, CheckCircle, Clock, AlertTriangle, Award, Edit, Plus
} from 'lucide-react';
import { accreditationData as initialData } from '@/data/hodMockData';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { AccreditationDataItem } from '@/types/hod';

export default function HODAccreditation() {
  const { toast } = useToast();
  const [data, setData] = useState<AccreditationDataItem[]>(initialData);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<AccreditationDataItem | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newMetric, setNewMetric] = useState({ criterion: '', metric: '', value: '', year: '2025-26' });

  const complete = data.filter(d => d.status === 'complete').length;
  const pending = data.filter(d => d.status === 'pending').length;
  const needsReview = data.filter(d => d.status === 'needs_review').length;
  const readiness = Math.round((complete / data.length) * 100);

  const criteria = [...new Set(data.map(d => d.criterion))];

  const handleVerify = (id: string) => {
    setData(prev => prev.map(d => d.id === id ? { ...d, status: 'complete', lastUpdated: '2026-03-08', updatedBy: 'Dr. Vikram Singh (HOD)' } : d));
    toast({ title: '✅ Data Verified', description: 'Metric verified and marked complete by HOD' });
  };

  const handleEditSave = () => {
    if (selectedItem && editValue) {
      setData(prev => prev.map(d => d.id === selectedItem.id ? { ...d, value: editValue, lastUpdated: '2026-03-08', updatedBy: 'Dr. Vikram Singh (HOD)' } : d));
      toast({ title: 'Value Updated', description: `${selectedItem.metric} updated to "${editValue}"` });
      setShowEditDialog(false);
      setEditValue('');
    }
  };

  const handleAddMetric = () => {
    if (newMetric.criterion && newMetric.metric && newMetric.value) {
      const item: AccreditationDataItem = {
        id: `ad-${Date.now()}`,
        criterion: newMetric.criterion,
        metric: newMetric.metric,
        value: newMetric.value,
        year: newMetric.year,
        status: 'pending',
        lastUpdated: '2026-03-08',
        updatedBy: 'Dr. Vikram Singh (HOD)',
      };
      setData(prev => [...prev, item]);
      toast({ title: 'Metric Added', description: `"${newMetric.metric}" added to ${newMetric.criterion}` });
      setShowAddDialog(false);
      setNewMetric({ criterion: '', metric: '', value: '', year: '2025-26' });
    }
  };

  const handleExportSSR = () => {
    toast({ title: '📥 SSR Exported', description: `Departmental SSR data exported with ${complete} complete metrics` });
  };

  const handleUpload = () => {
    toast({ title: '📎 Document Uploaded', description: 'Supporting document uploaded successfully' });
    setShowUploadDialog(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Accreditation Data</h1>
            <p className="text-muted-foreground">NAAC/NIRF departmental data management</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-1 h-4 w-4" />Add Metric
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowUploadDialog(true)}>
              <Upload className="mr-1 h-4 w-4" />Upload Document
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportSSR}>
              <Download className="mr-1 h-4 w-4" />Export SSR
            </Button>
          </div>
        </div>

        {/* Readiness */}
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: 'NAAC Readiness', value: `${readiness}%`, icon: Award, color: 'text-green-600 bg-green-100' },
            { label: 'Data Complete', value: complete, icon: CheckCircle, color: 'text-blue-600 bg-blue-100' },
            { label: 'Pending', value: pending, icon: Clock, color: 'text-amber-600 bg-amber-100' },
            { label: 'Needs Review', value: needsReview, icon: AlertTriangle, color: 'text-destructive bg-destructive/10' },
          ].map(s => (
            <Card key={s.label} className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Department NAAC Readiness</CardTitle>
              <span className="text-sm text-muted-foreground">{readiness}% complete</span>
            </div>
            <Progress value={readiness} className="h-2 mt-2" />
          </CardHeader>
        </Card>

        {/* By Criterion */}
        <div className="space-y-4">
          {criteria.map(criterion => {
            const items = data.filter(d => d.criterion === criterion);
            return (
              <Card key={criterion} className="border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    {criterion}
                    <Badge variant="outline" className="text-[10px] ml-auto">{items.filter(i => i.status === 'complete').length}/{items.length} complete</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Metric</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Year</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Updated</TableHead>
                        <TableHead>Updated By</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map(item => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium text-foreground">{item.metric}</TableCell>
                          <TableCell className="font-bold">{item.value}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{item.year}</TableCell>
                          <TableCell>
                            <Badge variant={
                              item.status === 'complete' ? 'default' :
                              item.status === 'needs_review' ? 'destructive' : 'secondary'
                            } className="capitalize text-[10px]">
                              {item.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.lastUpdated}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.updatedBy}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="h-7 text-xs"
                                onClick={() => { setSelectedItem(item); setEditValue(item.value); setShowEditDialog(true); }}>
                                <Edit className="h-3 w-3" />
                              </Button>
                              {item.status !== 'complete' && (
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-green-600"
                                  onClick={() => handleVerify(item.id)}>
                                  <CheckCircle className="h-3 w-3 mr-1" />Verify
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit: {selectedItem?.metric}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Current Value</Label>
              <p className="text-sm text-muted-foreground">{selectedItem?.value}</p>
            </div>
            <div>
              <Label>New Value</Label>
              <Input value={editValue} onChange={e => setEditValue(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
              <Button onClick={handleEditSave}>Save Changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload Supporting Document</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Drag & drop or click to upload</p>
              <p className="text-xs text-muted-foreground">PDF, DOC, XLS up to 10MB</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowUploadDialog(false)}>Cancel</Button>
              <Button onClick={handleUpload}>Upload</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Metric Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Metric</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Criterion</Label>
              <Input placeholder="e.g., Criterion 3 – Research" value={newMetric.criterion} onChange={e => setNewMetric(p => ({ ...p, criterion: e.target.value }))} />
            </div>
            <div>
              <Label>Metric Name</Label>
              <Input placeholder="e.g., Patents Filed" value={newMetric.metric} onChange={e => setNewMetric(p => ({ ...p, metric: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Value</Label>
                <Input placeholder="e.g., 5" value={newMetric.value} onChange={e => setNewMetric(p => ({ ...p, value: e.target.value }))} />
              </div>
              <div>
                <Label>Year</Label>
                <Input value={newMetric.year} onChange={e => setNewMetric(p => ({ ...p, year: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button onClick={handleAddMetric}>Add Metric</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

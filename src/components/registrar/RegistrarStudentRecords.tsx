import { useTabParam } from '@/hooks/useTabParam';
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
import { useToast } from '@/hooks/use-toast';
import {
  Search, Eye, Edit, CheckCircle, XCircle, FileText,
  GraduationCap, Calendar, Mail, AlertTriangle, Download
} from 'lucide-react';
import { downloadUpload, fetchApi, putApi } from '@/lib/apiService';
import { downloadCsv } from '@/lib/download';
import { StudentRecord, RecordChangeRequest } from '@/types/registrar';

const statusColors: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  graduated: 'bg-blue-50 text-blue-700',
  transferred: 'bg-amber-50 text-amber-700',
  discontinued: 'bg-red-50 text-red-700',
  suspended: 'bg-red-50 text-red-700',
};

export default function RegistrarStudentRecords() {
  const tabParam = useTabParam('records');
  const [studentRecords, setStudentRecords] = useState<any>([]);
  const [recordChangeRequests, setRecordChangeRequests] = useState<any>([]);
  const [apiLoading, setApiLoading] = useState(true);
  useEffect(() => {
    fetchApi('/registrar/students').then(d => setStudentRecords(d)).catch((error) => { console.error('API request failed', error); });
    fetchApi('/registrar/record-changes').then(d => setRecordChangeRequests(d)).catch((error) => { console.error('API request failed', error); });
    setApiLoading(false);
  }, []);

  const { toast } = useToast();
  const [records, setRecords] = useState<any[]>([]);
  const [changes, setChanges] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);
  const [selectedChange, setSelectedChange] = useState<RecordChangeRequest | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    setRecords(studentRecords || []);
  }, [studentRecords]);

  useEffect(() => {
    setChanges(recordChangeRequests || []);
  }, [recordChangeRequests]);

  const filtered = records.filter(r => {
    const q = searchTerm.toLowerCase();
    const matchSearch = [r.name, r.rollNo, r.department].some((v) => String(v ?? '').toLowerCase().includes(q));
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleApproveChange = async (id: string) => {
    try {
      setIsUpdating(true);
      // Approving applies the correction to the student's record and tells the student.
      await putApi(`/registrar/record-changes/${id}`, { status: 'approved' });
      setChanges(prev => prev.map(c => c.id === id ? { ...c, status: 'approved' as const } : c));
      fetchApi('/registrar/students').then(d => setStudentRecords(d)).catch(() => undefined);
      toast({ title: 'Change Approved', description: 'The student record is updated and the student has been notified.' });
      setSelectedChange(null);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsUpdating(false);
    }
  };

  // Rejecting needs a reason; the student is told why.
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const handleRejectChange = async (id: string) => {
    if (rejectNote.trim().length < 10) {
      toast({ title: 'Give a reason', description: 'At least 10 characters. The student sees it.', variant: 'destructive' });
      return;
    }
    try {
      setIsUpdating(true);
      await putApi(`/registrar/record-changes/${id}`, { status: 'rejected', note: rejectNote.trim() });
      setRejecting(null);
      setRejectNote('');
      setChanges(prev => prev.map(c => c.id === id ? { ...c, status: 'rejected' as const } : c));
      toast({ title: 'Change Rejected', description: 'Record change request has been denied.' });
      setSelectedChange(null);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Student Records Management</h1>
          <p className="text-muted-foreground">Official student register — corrections, updates, and change approvals</p>
        </div>

        <Tabs key={tabParam.key} defaultValue={tabParam.defaultValue}>
          <TabsList>
            <TabsTrigger value="records">Student Register</TabsTrigger>
            <TabsTrigger value="changes">Change Requests ({changes.filter(c => c.status === 'pending').length})</TabsTrigger>
          </TabsList>

          <TabsContent value="records" className="space-y-4 mt-4">
            {/* Search & Filter */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by name, roll no, department..." className="pl-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="graduated">Graduated</SelectItem>
                  <SelectItem value="transferred">Transferred</SelectItem>
                  <SelectItem value="discontinued">Discontinued</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Records Table */}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Roll No</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Name</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Program</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Batch</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">CGPA</th>
                        <th className="text-center py-3 px-4 font-medium text-muted-foreground">Status</th>
                        <th className="text-center py-3 px-4 font-medium text-muted-foreground">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(r => (
                        <tr key={r.id} className="border-b hover:bg-muted/20 cursor-pointer" onClick={() => setSelectedStudent(r)}>
                          <td className="py-3 px-4 font-mono text-xs">{r.rollNo}</td>
                          <td className="py-3 px-4 font-medium">{r.name}</td>
                          <td className="py-3 px-4 text-muted-foreground">{r.program}</td>
                          <td className="py-3 px-4 text-muted-foreground">{r.batch}</td>
                          <td className="py-3 px-4 text-right font-medium">{r.cgpa}</td>
                          <td className="py-3 px-4 text-center">
                            <Badge className={`text-[10px] ${statusColors[r.status]}`}>{r.status}</Badge>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"><Eye className="h-3 w-3" /> View</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="changes" className="space-y-4 mt-4">
            <div className="space-y-3">
              {changes.map(change => (
                <Card key={change.id} className={`${change.status === 'pending' ? 'border-amber-200' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium">{change.studentName} ({change.studentId})</p>
                          <Badge variant={change.status === 'approved' ? 'default' : change.status === 'rejected' ? 'destructive' : 'outline'} className="text-[10px]">{change.status}</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">Field:</span>
                          <span className="font-medium capitalize">{String(change.field).replace(/_/g, ' ')}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs mt-1">
                          <Badge variant="outline" className="text-[10px] line-through">{change.oldValue}</Badge>
                          <span>→</span>
                          <Badge className="text-[10px] bg-primary/10 text-primary">{change.newValue}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Reason: {change.reason}</p>
                        <div className="flex gap-1 mt-2">
                          {(Array.isArray(change.documents) ? change.documents : []).map((d: string) => (
                            String(d).startsWith('/api/uploads/')
                              ? <Button key={d} size="sm" variant="outline" className="h-6 gap-1 text-[10px]" onClick={() => downloadUpload(d, `proof-${change.field}`).catch((e) => toast({ title: 'Could not open', description: e?.message, variant: 'destructive' }))}><FileText className="h-3 w-3" /> View proof</Button>
                              : <Badge key={d} variant="outline" className="text-[10px] gap-1"><FileText className="h-3 w-3" /> {d}</Badge>
                          ))}
                        </div>
                      </div>
                      {change.status === 'pending' && (
                        <div className="flex gap-1">
                          <Button size="sm" className="h-7 text-xs gap-1" onClick={() => handleApproveChange(change.id)} disabled={isUpdating}>
                            <CheckCircle className="h-3 w-3" /> {isUpdating ? 'Approving...' : 'Approve'}
                          </Button>
                          <Button size="sm" variant="destructive" className="h-7 text-xs gap-1" onClick={() => { setRejectNote(''); setRejecting(change.id); }} disabled={isUpdating}>
                            <XCircle className="h-3 w-3" /> Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={!!rejecting} onOpenChange={(o) => { if (!o) setRejecting(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject correction</DialogTitle>
              <DialogDescription>The student is notified with this reason.</DialogDescription>
            </DialogHeader>
            <Textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="e.g. The proof does not match; attach your 10th certificate" />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
              <Button variant="destructive" disabled={isUpdating} onClick={() => rejecting && handleRejectChange(rejecting)}>{isUpdating ? 'Rejecting...' : 'Reject'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Student Detail Dialog */}
        <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                {selectedStudent?.name}
              </DialogTitle>
              <DialogDescription>{selectedStudent?.rollNo} • {selectedStudent?.program}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Department', value: selectedStudent?.department },
                  { label: 'Batch', value: selectedStudent?.batch },
                  { label: 'CGPA', value: selectedStudent?.cgpa },
                  { label: 'Status', value: selectedStudent?.status },
                  { label: 'Semester', value: (selectedStudent as any)?.semester },
                  { label: 'Category', value: selectedStudent?.category },
                  { label: 'Gender', value: (selectedStudent as any)?.gender },
                  { label: 'Nationality', value: (selectedStudent as any)?.nationality },
                  { label: 'Home state', value: (selectedStudent as any)?.homeState },
                ].map(item => (
                  <div key={item.label} className="rounded-lg border p-2">
                    <p className="text-[10px] text-muted-foreground">{item.label}</p>
                    <p className="text-sm font-medium capitalize">{item.value === null || item.value === undefined || item.value === '' ? '-' : String(item.value)}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground" /> {selectedStudent?.email}</div>
                <div className="flex items-center gap-2 text-sm"><Calendar className="h-4 w-4 text-muted-foreground" /> DOB: {selectedStudent?.dob ? new Date(selectedStudent.dob).toLocaleDateString('en-IN') : 'N/A'}</div>
              </div>
              {/* "Audit Trail" was removed: it reported "12 changes logged for
                  this student record" — a hard-coded number, identical for
                  every student, with no request behind it. Amendments here ARE
                  audited server-side (registrarService.updateStudentRecord
                  writes a warning-severity entry with before and after), but
                  no endpoint exposes that history per student, so there was
                  nothing to show. "Export Record" now writes a real file
                  rather than claiming a PDF that was never produced. */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1" onClick={() => selectedStudent && downloadCsv(
                  `student-${String(selectedStudent.rollNo || selectedStudent.id).replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}.csv`,
                  ['field', 'value'],
                  Object.entries(selectedStudent).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)])
                )}>
                  <Download className="h-3 w-3" /> Export Record
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

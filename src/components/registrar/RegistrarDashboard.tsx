import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  FileText, Users, GraduationCap, ClipboardList, CheckCircle,
  XCircle, AlertTriangle, Clock, ChevronRight, Forward,
  BarChart3, Briefcase, Building2, Eye, Scale, Wallet,
  TrendingUp, Award
} from 'lucide-react';
import { adminFiles as initialFiles, examProgress, establishmentSummary, vacancies } from '@/data/registrarMockData';
import { AdminFile } from '@/types/registrar';

const typeIcons: Record<string, React.ElementType> = {
  affiliation: Building2, record_change: FileText, transfer: Forward,
  certificate: Award, policy: Scale, recruitment: Users,
  budget: Wallet, general: ClipboardList,
};

const priorityColors: Record<string, string> = {
  low: 'text-muted-foreground', medium: 'text-blue-600', high: 'text-amber-600', urgent: 'text-destructive',
};

export default function RegistrarDashboard() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [files, setFiles] = useState(initialFiles);
  const [selectedFile, setSelectedFile] = useState<AdminFile | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'forward' | null>(null);
  const [remarks, setRemarks] = useState('');

  const pendingFiles = files.filter(f => f.status === 'pending');

  const handleAction = () => {
    if (!selectedFile || !actionType) return;
    const newStatus = actionType === 'approve' ? 'approved' as const
      : actionType === 'reject' ? 'rejected' as const
      : 'forwarded' as const;
    setFiles(prev => prev.map(f => f.id === selectedFile.id ? { ...f, status: newStatus, remarks } : f));
    toast({
      title: actionType === 'approve' ? 'Approved' : actionType === 'reject' ? 'Rejected' : 'Forwarded',
      description: `"${selectedFile.title}" has been ${newStatus}.`
    });
    setSelectedFile(null);
    setActionType(null);
    setRemarks('');
  };

  const estUtil = Math.round((establishmentSummary.totalFilled / establishmentSummary.totalSanctioned) * 100);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Registrar Dashboard</h1>
          <p className="text-muted-foreground">Administrative backbone — requests, examinations, and establishment overview</p>
        </div>

        {/* Summary Stats */}
        <div className="grid gap-4 sm:grid-cols-5">
          {[
            { label: 'Pending Files', value: pendingFiles.length, icon: FileText, color: 'text-amber-600', onClick: () => {} },
            { label: 'Active Students', value: '13,900', icon: GraduationCap, color: 'text-blue-600', onClick: () => navigate('/registrar/records') },
            { label: 'Exam Progress', value: `${examProgress.filter(e => e.status === 'published').length}/${examProgress.length}`, icon: ClipboardList, color: 'text-emerald-600', onClick: () => navigate('/registrar/exams') },
            { label: 'Staff Positions', value: `${establishmentSummary.totalFilled}/${establishmentSummary.totalSanctioned}`, icon: Users, color: 'text-purple-600', onClick: () => navigate('/registrar/hr') },
            { label: 'Verifications', value: '4', icon: CheckCircle, color: 'text-primary', onClick: () => navigate('/registrar/queries') },
          ].map(s => (
            <Card key={s.label} className="cursor-pointer hover:shadow-md transition-shadow" onClick={s.onClick}>
              <CardContent className="flex items-center gap-3 p-4">
                <s.icon className={`h-8 w-8 ${s.color}`} />
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Pending Files Queue */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Requests & Files Queue</CardTitle>
                <Badge variant="destructive">{pendingFiles.length}</Badge>
              </div>
              <CardDescription>Administrative items requiring your action</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[420px] overflow-y-auto">
                {files.map(file => {
                  const TypeIcon = typeIcons[file.type] || FileText;
                  return (
                    <div key={file.id} className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <TypeIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-medium truncate">{file.title}</p>
                          <Badge variant={file.status === 'approved' ? 'default' : file.status === 'rejected' ? 'destructive' : file.status === 'forwarded' ? 'secondary' : 'outline'} className="text-[10px] shrink-0">{file.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">{file.description}</p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                          <span>{file.submittedBy}</span>
                          <span>•</span>
                          <span className={priorityColors[file.priority]}>{file.priority}</span>
                          <span>•</span>
                          <span>{file.submittedAt.toLocaleDateString('en-IN')}</span>
                        </div>
                      </div>
                      {file.status === 'pending' && (
                        <div className="flex flex-col gap-1">
                          <Button size="sm" className="h-6 text-[10px] gap-0.5" onClick={() => { setSelectedFile(file); setActionType('approve'); }}>
                            <CheckCircle className="h-3 w-3" /> Approve
                          </Button>
                          <Button size="sm" variant="destructive" className="h-6 text-[10px] gap-0.5" onClick={() => { setSelectedFile(file); setActionType('reject'); }}>
                            <XCircle className="h-3 w-3" /> Reject
                          </Button>
                          <Button size="sm" variant="outline" className="h-6 text-[10px] gap-0.5" onClick={() => { setSelectedFile(file); setActionType('forward'); }}>
                            <Forward className="h-3 w-3" /> Forward
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Examination Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" /> Examination Progress</CardTitle>
              <CardDescription>Current semester examination status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {examProgress.map(ep => (
                  <div key={ep.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium">{ep.semester} — {ep.program}</p>
                        <p className="text-xs text-muted-foreground">{ep.examName} • {ep.coordinator}</p>
                      </div>
                      <Badge variant={ep.status === 'published' ? 'default' : ep.status === 'moderation' ? 'secondary' : 'outline'} className="text-[10px]">
                        {ep.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={(ep.marksEntered / ep.totalStudents) * 100} className="h-2 flex-1" />
                      <span className="text-xs font-medium">{Math.round((ep.marksEntered / ep.totalStudents) * 100)}%</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{ep.marksEntered}/{ep.totalStudents} marks entered</p>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full mt-3 text-xs" onClick={() => navigate('/registrar/exams')}>
                View Exam Details <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Establishment Overview */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> Establishment & HR</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Teaching</p>
                  <p className="text-xl font-bold">{establishmentSummary.teaching.filled}/{establishmentSummary.teaching.sanctioned}</p>
                  <Progress value={(establishmentSummary.teaching.filled / establishmentSummary.teaching.sanctioned) * 100} className="h-1.5 mt-1" />
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Non-Teaching</p>
                  <p className="text-xl font-bold">{establishmentSummary.nonTeaching.filled}/{establishmentSummary.nonTeaching.sanctioned}</p>
                  <Progress value={(establishmentSummary.nonTeaching.filled / establishmentSummary.nonTeaching.sanctioned) * 100} className="h-1.5 mt-1" />
                </div>
              </div>
              <div className="space-y-2 text-sm">
                {[
                  { label: 'Pending Promotions', value: establishmentSummary.pendingPromotions, icon: TrendingUp },
                  { label: 'Upcoming Retirements', value: establishmentSummary.pendingRetirements, icon: Clock },
                  { label: 'Active Recruitments', value: establishmentSummary.activeRecruitments, icon: Briefcase },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between rounded-lg border p-2">
                    <span className="flex items-center gap-2 text-muted-foreground"><item.icon className="h-4 w-4" /> {item.label}</span>
                    <Badge variant="outline">{item.value}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Active Recruitments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary" /> Active Recruitments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {vacancies.filter(v => !['joined', 'closed'].includes(v.status)).slice(0, 4).map(v => (
                  <div key={v.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{v.position}</p>
                      <p className="text-xs text-muted-foreground">{v.department} • {v.applicants} applicants</p>
                    </div>
                    <Badge variant={v.status === 'interview_scheduled' ? 'default' : 'outline'} className="text-[10px]">
                      {v.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full mt-3 text-xs" onClick={() => navigate('/registrar/hr')}>
                View All HR <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Action Dialog */}
        <Dialog open={!!selectedFile && !!actionType} onOpenChange={() => { setSelectedFile(null); setActionType(null); setRemarks(''); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionType === 'approve' ? 'Approve File' : actionType === 'reject' ? 'Reject File' : 'Forward to Vice Chancellor'}
              </DialogTitle>
              <DialogDescription>{selectedFile?.title}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{selectedFile?.description}</p>
              {selectedFile?.documents && (
                <div className="flex gap-1 flex-wrap">
                  {selectedFile.documents.map(d => (
                    <Badge key={d} variant="outline" className="text-[10px] gap-1"><FileText className="h-3 w-3" /> {d}</Badge>
                  ))}
                </div>
              )}
              <Textarea placeholder={actionType === 'reject' ? 'Reason for rejection (required)...' : 'Remarks (optional)...'} value={remarks} onChange={e => setRemarks(e.target.value)} rows={3} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setSelectedFile(null); setActionType(null); setRemarks(''); }}>Cancel</Button>
              <Button variant={actionType === 'reject' ? 'destructive' : 'default'} onClick={handleAction} disabled={actionType === 'reject' && !remarks}>
                {actionType === 'approve' ? 'Confirm Approval' : actionType === 'reject' ? 'Confirm Rejection' : 'Forward to VC'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

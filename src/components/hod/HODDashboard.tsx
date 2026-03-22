import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Users, GraduationCap, BookOpen, AlertTriangle, Calendar,
  CheckCircle, XCircle, Clock, ArrowRight, Bell, TrendingUp,
  FileText, ShoppingCart, UserX, Megaphone, BarChart3, Forward
} from 'lucide-react';
import { fetchApi, putApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { HODApprovalItem } from '@/types/hod';

export default function HODDashboard() {
  const [departmentFaculty, setDepartmentFaculty] = useState<any>([]);
  const [departmentStudents, setDepartmentStudents] = useState<any>([]);
  const [hodApprovals, setHodApprovals] = useState<any>([]);
  const [departmentCalendar, setDepartmentCalendar] = useState<any>([]);
  const [_apiLoading, _setApiLoading] = useState(true);
  useEffect(() => {
    Promise.allSettled([
      fetchApi('/hod/departmentfaculty').then(d => setDepartmentFaculty(d)),
      fetchApi('/hod/departmentstudents').then(d => setDepartmentStudents(d)),
      fetchApi('/hod/hodapprovals').then(d => setHodApprovals(d)),
      fetchApi('/hod/departmentcalendar').then(d => setDepartmentCalendar(d)),
    ]).finally(() => _setApiLoading(false));
  }, []);

  const { toast } = useToast();
  const navigate = useNavigate();
  const [approvals, setApprovals] = useState<HODApprovalItem[]>([]);
  const [selectedApproval, setSelectedApproval] = useState<HODApprovalItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  useEffect(() => {
    setApprovals(Array.isArray(hodApprovals) ? hodApprovals : []);
  }, [hodApprovals]);

  const permanentFaculty = departmentFaculty.filter(f => f.type === 'permanent').length;
  const adjunctFaculty = departmentFaculty.filter(f => f.type !== 'permanent').length;
  const totalStudents = departmentStudents.length;
  const onLeaveFaculty = departmentFaculty.filter(f => f.isOnLeave).length;
  const atRiskStudents = departmentStudents.filter(s => s.cgpa < 6 || s.attendance < 65).length;
  const pendingApprovals = approvals.filter(a => a.status === 'pending').length;

  const studentsByYear = [1, 2, 3, 4].map(y => ({
    year: y,
    count: departmentStudents.filter(s => s.year === y).length,
  }));

  const approvalIcons: Record<string, React.ElementType> = {
    leave: Clock, od: Calendar, purchase: ShoppingCart,
    section_change: Users, grievance: AlertTriangle,
    grade_change: FileText, elective: BookOpen,
  };

  const upcomingEvents = departmentCalendar
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const handleApprove = async (item: HODApprovalItem) => {
    try {
      await putApi(`/hod/hodapprovals/${item.id}/status`, { status: 'approved' });
      setApprovals(prev => prev.map(a => a.id === item.id ? { ...a, status: 'approved' } : a));
      toast({ title: '✅ Approved', description: item.title });
    } catch (error: any) {
      toast({ title: 'Action failed', description: error?.message || 'Unable to approve item', variant: 'destructive' });
    }
  };

  const handleReject = async () => {
    if (selectedApproval) {
      try {
        await putApi(`/hod/hodapprovals/${selectedApproval.id}/status`, { status: 'rejected', reason: rejectReason });
        setApprovals(prev => prev.map(a => a.id === selectedApproval.id ? { ...a, status: 'rejected' } : a));
        toast({ title: '❌ Rejected', description: `${selectedApproval.title}${rejectReason ? ` — Reason: ${rejectReason}` : ''}` });
        setShowRejectDialog(false);
        setRejectReason('');
        setSelectedApproval(null);
      } catch (error: any) {
        toast({ title: 'Action failed', description: error?.message || 'Unable to reject item', variant: 'destructive' });
      }
    }
  };

  const handleForward = async (item: HODApprovalItem) => {
    try {
      await putApi(`/hod/hodapprovals/${item.id}/status`, { status: 'forwarded' });
      setApprovals(prev => prev.map(a => a.id === item.id ? { ...a, status: 'forwarded' } : a));
      toast({ title: '📤 Forwarded to Dean', description: item.title });
    } catch (error: any) {
      toast({ title: 'Action failed', description: error?.message || 'Unable to forward item', variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">HOD Dashboard</h1>
          <p className="text-muted-foreground">
            Department of Computer Science & Engineering • Academic Year 2025-26
          </p>
        </div>

        {/* Department Overview Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Faculty (Permanent)', value: permanentFaculty, sub: `+${adjunctFaculty} adjunct/visiting`, icon: Users, color: 'text-blue-600 bg-blue-100', path: '/hod/faculty' },
            { label: 'Total Students', value: totalStudents, sub: studentsByYear.map(s => `Y${s.year}: ${s.count}`).join(' | '), icon: GraduationCap, color: 'text-green-600 bg-green-100', path: '/hod/students' },
            { label: 'Pending Approvals', value: pendingApprovals, sub: 'Requires your action', icon: Bell, color: 'text-amber-600 bg-amber-100', path: '' },
            { label: 'At-Risk Students', value: atRiskStudents, sub: 'Low CGPA or attendance', icon: AlertTriangle, color: 'text-destructive bg-destructive/10', path: '/hod/students' },
          ].map((stat) => (
            <Card key={stat.label} className="border-border cursor-pointer hover:shadow-md transition-shadow" onClick={() => stat.path && navigate(stat.path)}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs font-medium text-foreground/80">{stat.label}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{stat.sub}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Alerts/Approvals – left 3 cols */}
          <div className="lg:col-span-3 space-y-4">
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bell className="h-5 w-5 text-amber-500" />
                  Pending Approvals ({pendingApprovals})
                </CardTitle>
                {approvals.filter(a => a.status !== 'pending').length > 0 && (
                  <Badge variant="outline" className="text-[10px]">
                    {approvals.filter(a => a.status === 'approved').length} approved, {approvals.filter(a => a.status === 'rejected').length} rejected
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {approvals.filter(a => a.status === 'pending').length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-500" />
                    <p className="font-medium">All caught up!</p>
                    <p className="text-sm">No pending approvals</p>
                  </div>
                ) : (
                  approvals.filter(a => a.status === 'pending').slice(0, 6).map((item) => {
                    const Icon = approvalIcons[item.type] || FileText;
                    return (
                      <div key={item.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted cursor-pointer"
                          onClick={() => { setSelectedApproval(item); setShowDetailDialog(true); }}>
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setSelectedApproval(item); setShowDetailDialog(true); }}>
                          <p className="text-sm font-medium text-foreground">{item.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{item.details}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">By {item.requestedBy} • {item.requestedAt}</p>
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          <Badge variant={item.priority === 'high' ? 'destructive' : item.priority === 'medium' ? 'secondary' : 'outline'} className="text-[10px] capitalize">
                            {item.priority}
                          </Badge>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 hover:bg-green-100"
                            onClick={() => handleApprove(item)}>
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => { setSelectedApproval(item); setShowRejectDialog(true); }}>
                            <XCircle className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600 hover:bg-blue-100"
                            onClick={() => handleForward(item)}>
                            <Forward className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
                {/* Show recently processed */}
                {approvals.filter(a => a.status !== 'pending').length > 0 && (
                  <div className="pt-2 border-t border-border space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Recently Processed</p>
                    {approvals.filter(a => a.status !== 'pending').map(item => (
                      <div key={item.id} className="flex items-center gap-2 text-sm">
                        {item.status === 'approved' && <CheckCircle className="h-3.5 w-3.5 text-green-600" />}
                        {item.status === 'rejected' && <XCircle className="h-3.5 w-3.5 text-destructive" />}
                        {item.status === 'forwarded' && <Forward className="h-3.5 w-3.5 text-blue-600" />}
                        <span className="text-muted-foreground line-through">{item.title}</span>
                        <Badge variant={item.status === 'approved' ? 'default' : item.status === 'forwarded' ? 'secondary' : 'destructive'} className="text-[10px] capitalize ml-auto">{item.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Faculty On Leave Alert */}
            {onLeaveFaculty > 0 && (
              <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
                <CardContent className="flex items-center gap-3 p-4">
                  <UserX className="h-5 w-5 text-amber-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {onLeaveFaculty} faculty member(s) on leave today
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {departmentFaculty.filter(f => f.isOnLeave).map(f => `${f.name} (${f.leaveType})`).join(', ')}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate('/hod/workload')}>Manage Substitution</Button>
                </CardContent>
              </Card>
            )}

            {/* Announcements from higher-ups */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Megaphone className="h-5 w-5 text-primary" />
                  Announcements
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { from: 'Dean – Faculty of Engineering', msg: 'Submit departmental NIRF data by 31 March 2026', date: '2026-03-05', priority: 'high' as const },
                  { from: 'Registrar Office', msg: 'End-semester exam timetable finalized. Please ensure question papers are submitted by 15 March.', date: '2026-03-04', priority: 'medium' as const },
                  { from: 'IQAC', msg: 'NAAC Peer Team visit scheduled for May 2026. Prepare departmental SSR sections.', date: '2026-03-01', priority: 'high' as const },
                ].map((ann, i) => (
                  <div key={i} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-primary">{ann.from}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">{ann.date}</span>
                        {ann.priority === 'high' && <Badge variant="destructive" className="text-[10px]">Important</Badge>}
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-foreground">{ann.msg}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Department Calendar – right 2 cols */}
          <div className="lg:col-span-2">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Department Calendar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {upcomingEvents.map((event) => {
                  const typeColors: Record<string, string> = {
                    deadline: 'bg-destructive/10 text-destructive',
                    meeting: 'bg-blue-100 text-blue-700',
                    seminar: 'bg-purple-100 text-purple-700',
                    exam: 'bg-amber-100 text-amber-700',
                    appraisal: 'bg-green-100 text-green-700',
                  };
                  return (
                    <div key={event.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                      <div className="text-center">
                        <p className="text-xs font-bold text-primary">{new Date(event.date).toLocaleDateString('en-US', { month: 'short' })}</p>
                        <p className="text-lg font-bold text-foreground">{new Date(event.date).getDate()}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{event.title}</p>
                        {event.time && <p className="text-xs text-muted-foreground">{event.time}</p>}
                        {event.description && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{event.description}</p>}
                      </div>
                      <Badge className={`shrink-0 text-[10px] capitalize ${typeColors[event.type] || ''}`} variant="outline">
                        {event.type}
                      </Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="border-border mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Faculty Management', icon: Users, path: '/hod/faculty' },
                  { label: 'Workload & Timetable', icon: Calendar, path: '/hod/workload' },
                  { label: 'Student Academics', icon: GraduationCap, path: '/hod/students' },
                  { label: 'Results Analysis', icon: BarChart3, path: '/hod/results' },
                  { label: 'Accreditation Data', icon: FileText, path: '/hod/accreditation' },
                  { label: 'Lab & Inventory', icon: ShoppingCart, path: '/hod/inventory' },
                ].map((action) => (
                  <Button key={action.label} variant="outline" className="h-auto flex-col gap-1.5 py-3 text-xs" onClick={() => navigate(action.path)}>
                    <action.icon className="h-5 w-5 text-primary" />
                    {action.label}
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Reject Reason Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject: {selectedApproval?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{selectedApproval?.details}</p>
            <div>
              <label className="text-sm font-medium">Reason for Rejection (optional)</label>
              <Textarea placeholder="Enter reason..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleReject}>
                <XCircle className="mr-1 h-4 w-4" />Confirm Rejection
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Approval Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedApproval?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Badge variant={selectedApproval?.priority === 'high' ? 'destructive' : 'secondary'} className="capitalize">{selectedApproval?.priority}</Badge>
              <Badge variant="outline" className="capitalize">{selectedApproval?.type?.replace('_', ' ')}</Badge>
            </div>
            <div className="text-sm space-y-2">
              <p><span className="text-muted-foreground">Requested by:</span> {selectedApproval?.requestedBy}</p>
              <p><span className="text-muted-foreground">Date:</span> {selectedApproval?.requestedAt}</p>
              <p><span className="text-muted-foreground">Details:</span> {selectedApproval?.details}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { handleForward(selectedApproval!); setShowDetailDialog(false); }}>
                <Forward className="mr-1 h-4 w-4" />Forward to Dean
              </Button>
              <Button variant="destructive" onClick={() => { setShowDetailDialog(false); setShowRejectDialog(true); }}>
                <XCircle className="mr-1 h-4 w-4" />Reject
              </Button>
              <Button onClick={() => { handleApprove(selectedApproval!); setShowDetailDialog(false); }}>
                <CheckCircle className="mr-1 h-4 w-4" />Approve
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

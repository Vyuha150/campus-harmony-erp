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
  Users, GraduationCap, TrendingUp, TrendingDown, Minus, AlertTriangle,
  CheckCircle, Info, XCircle, MapPin, Building2, BarChart3, Activity,
  Clock, ChevronRight, Briefcase, BookOpen, FlaskConical, Eye, EyeOff, X
} from 'lucide-react';
import {
  campusSummaries, institutionKPIs, liveUpdates as initialLiveUpdates, executiveApprovals, departmentPerformance
} from '@/data/vcMockData';
import { useAuth } from '@/context/AuthContext';
import { ExecutiveApproval } from '@/types/vc';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';

const statusIcons = {
  info: <Info className="h-4 w-4 text-blue-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  success: <CheckCircle className="h-4 w-4 text-emerald-500" />,
  critical: <XCircle className="h-4 w-4 text-destructive" />,
};

const trendIcons = {
  up: <TrendingUp className="h-3.5 w-3.5" />,
  down: <TrendingDown className="h-3.5 w-3.5" />,
  stable: <Minus className="h-3.5 w-3.5" />,
};

const statusColors = {
  good: 'text-emerald-600 bg-emerald-50',
  average: 'text-amber-600 bg-amber-50',
  poor: 'text-red-600 bg-red-50',
};

export default function VCDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [approvals, setApprovals] = useState(executiveApprovals);
  const [liveUpdates, setLiveUpdates] = useState(initialLiveUpdates);
  const [selectedApproval, setSelectedApproval] = useState<ExecutiveApproval | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [comment, setComment] = useState('');
  const pendingApprovals = approvals.filter(a => a.status === 'pending');

  const handleApprovalAction = () => {
    if (!selectedApproval || !actionType) return;
    setApprovals(prev => prev.map(a => a.id === selectedApproval.id ? { ...a, status: actionType === 'approve' ? 'approved' as const : 'rejected' as const } : a));
    toast({ title: actionType === 'approve' ? 'Approved' : 'Rejected', description: `"${selectedApproval.title}" has been ${actionType === 'approve' ? 'approved' : 'rejected'}.` });
    setSelectedApproval(null);
    setActionType(null);
    setComment('');
  };

  const handleDismissAlert = (id: string) => {
    setLiveUpdates(prev => prev.filter(u => u.id !== id));
    toast({ title: 'Alert Dismissed', description: 'Update removed from feed.' });
  };

  const handleMarkAlertRead = (id: string) => {
    toast({ title: 'Noted', description: 'Alert acknowledged and logged.' });
  };

  const radarData = departmentPerformance.slice(0, 6).map(d => ({
    department: d.department,
    'Pass Rate': d.passRate,
    'Placement': d.placementRate,
    'Research': d.researchOutput * 2,
    'Satisfaction': d.studentSatisfaction * 20,
  }));

  const barData = departmentPerformance.map(d => ({
    name: d.department.length > 10 ? d.department.slice(0, 10) + '…' : d.department,
    Students: d.studentCount,
    Faculty: d.facultyCount * 10,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {user?.role === 'pro_vc' ? 'Pro Vice Chancellor' : 'Vice Chancellor'} Dashboard
          </h1>
          <p className="text-muted-foreground">
            Institution-wide overview • {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Campus Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {campusSummaries.map(campus => (
            <Card key={campus.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">{campus.name}</CardTitle>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {campus.location}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <div>
                      <p className="font-semibold">{campus.students.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Students</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-primary" />
                    <div>
                      <p className="font-semibold">{campus.faculty}</p>
                      <p className="text-xs text-muted-foreground">Faculty</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <div>
                      <p className="font-semibold">{campus.programs}</p>
                      <p className="text-xs text-muted-foreground">Programs</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-primary" />
                    <div>
                      <p className="font-semibold">{campus.placementRate}%</p>
                      <p className="text-xs text-muted-foreground">Placed</p>
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Pass Rate</span>
                    <span className="font-medium">{campus.passRate}%</span>
                  </div>
                  <Progress value={campus.passRate} className="h-1.5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* KPIs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /> Key Performance Indicators</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="academic">Academic</TabsTrigger>
                <TabsTrigger value="research">Research</TabsTrigger>
                <TabsTrigger value="finance">Finance</TabsTrigger>
                <TabsTrigger value="quality">Quality</TabsTrigger>
              </TabsList>
              {['all', 'academic', 'research', 'finance', 'quality', 'placement'].map(tab => (
                <TabsContent key={tab} value={tab}>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {institutionKPIs
                      .filter(k => tab === 'all' || k.category === tab)
                      .map(kpi => (
                        <div key={kpi.id} className="rounded-lg border p-3 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => toast({ title: kpi.label, description: `Current: ${kpi.value} | Target: ${kpi.target} | Trend: ${kpi.trendValue}` })}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground">{kpi.label}</span>
                            <Badge variant="outline" className={`text-[10px] ${statusColors[kpi.status]}`}>
                              {kpi.status}
                            </Badge>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-xl font-bold">{kpi.value}</span>
                            <div className={`flex items-center gap-0.5 text-xs ${kpi.trend === 'up' ? 'text-emerald-600' : kpi.trend === 'down' ? 'text-red-600' : 'text-muted-foreground'}`}>
                              {trendIcons[kpi.trend]}
                              {kpi.trendValue}
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">Target: {kpi.target}</p>
                        </div>
                      ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Live Updates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> Live Updates & Alerts</CardTitle>
              <CardDescription>AI-detected anomalies and critical operations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {liveUpdates.length === 0 && <p className="text-center text-muted-foreground py-8">All alerts cleared.</p>}
                {liveUpdates.map(update => (
                  <div key={update.id} className={`flex items-start gap-3 rounded-lg border p-3 ${update.type === 'critical' ? 'border-destructive/40 bg-destructive/5' : ''}`}>
                    {statusIcons[update.type]}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{update.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px]">{update.module}</Badge>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {update.timestamp.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleMarkAlertRead(update.id)} title="Acknowledge">
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleDismissAlert(update.id)} title="Dismiss">
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pending Approvals Quick View */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /> Pending Approvals</CardTitle>
                <Badge variant="destructive">{pendingApprovals.length}</Badge>
              </div>
              <CardDescription>Items requiring your decision</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {pendingApprovals.length === 0 && <p className="text-center text-muted-foreground py-8">All approvals cleared! 🎉</p>}
                {pendingApprovals.slice(0, 5).map(item => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.requestedBy} • {item.requestedAt.toLocaleDateString('en-IN')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={item.priority === 'critical' ? 'destructive' : item.priority === 'high' ? 'default' : 'secondary'} className="text-[10px]">
                        {item.priority}
                      </Badge>
                      <Button size="sm" variant="outline" onClick={() => { setSelectedApproval(item); setActionType('approve'); }} className="h-7 text-xs gap-1">
                        <CheckCircle className="h-3 w-3" /> Approve
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setSelectedApproval(item); setActionType('reject'); }} className="h-7 text-xs gap-1 text-destructive">
                        <XCircle className="h-3 w-3" /> Reject
                      </Button>
                    </div>
                  </div>
                ))}
                {pendingApprovals.length > 5 && (
                  <Button variant="ghost" className="w-full text-xs" onClick={() => navigate('/vc/approvals')}>
                    View all {pendingApprovals.length} approvals <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
                {pendingApprovals.length > 0 && pendingApprovals.length <= 5 && (
                  <Button variant="outline" className="w-full text-xs" onClick={() => navigate('/vc/approvals')}>
                    Go to Approvals Page <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Department Comparison — Radar</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="department" className="text-xs" />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} />
                  <Radar name="Pass Rate" dataKey="Pass Rate" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                  <Radar name="Placement" dataKey="Placement" stroke="hsl(var(--accent))" fill="hsl(var(--accent))" fillOpacity={0.2} />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Department Size Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="Students" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Legend />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Approval Action Dialog */}
        <Dialog open={!!selectedApproval && !!actionType} onOpenChange={() => { setSelectedApproval(null); setActionType(null); setComment(''); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{actionType === 'approve' ? 'Approve Request' : 'Reject Request'}</DialogTitle>
              <DialogDescription>{selectedApproval?.title}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{selectedApproval?.description}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>From: {selectedApproval?.requestedBy}</span>
                {selectedApproval?.amount && <span>• Amount: ₹{(selectedApproval.amount / 10000000).toFixed(1)} Cr</span>}
              </div>
              <Textarea placeholder={actionType === 'reject' ? 'Reason for rejection (required)...' : 'Add remarks (optional)...'} value={comment} onChange={e => setComment(e.target.value)} rows={3} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setSelectedApproval(null); setActionType(null); setComment(''); }}>Cancel</Button>
              <Button variant={actionType === 'reject' ? 'destructive' : 'default'} onClick={handleApprovalAction} disabled={actionType === 'reject' && !comment}>
                {actionType === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

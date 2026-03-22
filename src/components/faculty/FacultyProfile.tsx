import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  User, Mail, Phone, Building2, GraduationCap, Calendar,
  Download, FileText, Briefcase, Clock, Award, BookOpen,
  Plus, TrendingUp
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { fetchApi, postApi } from '@/lib/apiService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

export default function FacultyProfile() {
  const [facultyProfile, setFacultyProfile] = useState<any>({
    name: '',
    designation: '',
    department: '',
    employeeId: '',
    email: '',
    phone: '',
    dateOfJoining: new Date().toISOString(),
    qualification: '',
    specialization: '',
    experience: 0,
    hIndex: 0,
    totalPublications: 0,
    totalProjects: 0,
    weeklyHours: 0,
  });
  const [leaveBalances, setLeaveBalances] = useState<any>([]);
  const [leaveHistory, setLeaveHistory] = useState<any>([]);
  const [_apiLoading, _setApiLoading] = useState(true);
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ type: '', fromDate: '', toDate: '', reason: '' });
  const { toast } = useToast();
  useEffect(() => {
    fetchApi('/faculty/profile').then(d => setFacultyProfile(d)).catch((error) => { console.error('API request failed', error); });
    fetchApi('/faculty/profile/leave-balances').then(d => setLeaveBalances(d)).catch((error) => { console.error('API request failed', error); });
    fetchApi('/faculty/profile/leave-history').then(d => setLeaveHistory(d)).catch((error) => { console.error('API request failed', error); });
    _setApiLoading(false);
  }, []);

  const applyLeave = async () => {
    if (!leaveForm.type || !leaveForm.fromDate || !leaveForm.toDate || !leaveForm.reason.trim()) {
      toast({ title: 'Missing details', description: 'Leave type, dates, and reason are required.', variant: 'destructive' });
      return;
    }

    try {
      setSubmittingLeave(true);
      await postApi('/faculty/profile/leave-request', {
        type: leaveForm.type,
        fromDate: leaveForm.fromDate,
        toDate: leaveForm.toDate,
        reason: leaveForm.reason.trim()
      });

      const refreshedHistory = await fetchApi('/faculty/profile/leave-history');
      const refreshedBalances = await fetchApi('/faculty/profile/leave-balances');
      setLeaveHistory(Array.isArray(refreshedHistory) ? refreshedHistory : []);
      setLeaveBalances(Array.isArray(refreshedBalances) ? refreshedBalances : []);

      setLeaveForm({ type: '', fromDate: '', toDate: '', reason: '' });
      toast({ title: 'Leave applied', description: 'Leave request submitted successfully.' });
    } catch (error: any) {
      toast({ title: 'Submit failed', description: error?.message || 'Unable to submit leave request.', variant: 'destructive' });
    } finally {
      setSubmittingLeave(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Profile & Service</h1>

        {/* Profile Card */}
        <Card className="border-border">
          <CardContent className="p-6">
            <div className="flex flex-col gap-6 md:flex-row">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-primary/10 text-3xl font-bold text-primary">
                {(facultyProfile.name || '')
                  .split(' ')
                  .filter(Boolean)
                  .map((n: string) => n[0])
                  .join('')
                  .slice(0, 2)}
              </div>
              <div className="flex-1 space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-foreground">{facultyProfile.name}</h2>
                  <p className="text-muted-foreground">{facultyProfile.designation} • {facultyProfile.department}</p>
                  <Badge className="mt-1">{facultyProfile.employeeId}</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    { icon: Mail, label: 'Email', value: facultyProfile.email },
                    { icon: Phone, label: 'Phone', value: facultyProfile.phone },
                    { icon: Calendar, label: 'Joined', value: new Date(facultyProfile.dateOfJoining).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
                    { icon: GraduationCap, label: 'Qualification', value: facultyProfile.qualification },
                    { icon: Award, label: 'Specialization', value: facultyProfile.specialization },
                    { icon: Briefcase, label: 'Experience', value: `${facultyProfile.experience} years` },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start gap-2">
                      <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p className="text-sm font-medium text-foreground">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Academic & Research Summary */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'h-Index', value: facultyProfile.hIndex, icon: TrendingUp, color: 'text-primary' },
            { label: 'Publications', value: facultyProfile.totalPublications, icon: FileText, color: 'text-blue-600' },
            { label: 'Projects', value: facultyProfile.totalProjects, icon: Briefcase, color: 'text-amber-600' },
            { label: 'Weekly Teaching', value: `${facultyProfile.weeklyHours}h`, icon: Clock, color: 'text-green-600' },
          ].map((s) => (
            <Card key={s.label} className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <s.icon className={`h-8 w-8 ${s.color}`} />
                <div>
                  <p className="text-xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs: Leave, Payslips, Documents */}
        <Tabs defaultValue="leave" className="space-y-4">
          <TabsList>
            <TabsTrigger value="leave">Leave Management</TabsTrigger>
            <TabsTrigger value="payslips">Payslips</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="leave" className="space-y-4">
            {/* Leave Balances */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {leaveBalances.map((lb) => (
                <Card key={lb.type} className="border-border">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-muted-foreground">{lb.type}</p>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-foreground">{lb.remaining}</span>
                      <span className="text-xs text-muted-foreground">/ {lb.total}</span>
                    </div>
                    <Progress value={(lb.remaining / lb.total) * 100} className="mt-2 h-1.5" />
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Apply Leave + History */}
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-lg">Leave History</CardTitle>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="mr-1 h-4 w-4" />Apply Leave</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Apply for Leave</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Leave Type</Label>
                        <Select value={leaveForm.type} onValueChange={(value) => setLeaveForm((prev) => ({ ...prev, type: value }))}><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="casual">Casual Leave</SelectItem>
                            <SelectItem value="earned">Earned Leave</SelectItem>
                            <SelectItem value="medical">Medical Leave</SelectItem>
                            <SelectItem value="duty">Duty Leave</SelectItem>
                            <SelectItem value="academic">Academic Leave</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label>From</Label><Input type="date" value={leaveForm.fromDate} onChange={(event) => setLeaveForm((prev) => ({ ...prev, fromDate: event.target.value }))} /></div>
                        <div><Label>To</Label><Input type="date" value={leaveForm.toDate} onChange={(event) => setLeaveForm((prev) => ({ ...prev, toDate: event.target.value }))} /></div>
                      </div>
                      <div><Label>Reason</Label><Textarea placeholder="Reason for leave..." value={leaveForm.reason} onChange={(event) => setLeaveForm((prev) => ({ ...prev, reason: event.target.value }))} /></div>
                      <Button className="w-full" onClick={applyLeave} disabled={submittingLeave}>{submittingLeave ? 'Submitting...' : 'Submit Application'}</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveHistory.map((lv) => (
                      <TableRow key={lv.id}>
                        <TableCell className="capitalize">{lv.type}</TableCell>
                        <TableCell>{lv.fromDate}</TableCell>
                        <TableCell>{lv.toDate}</TableCell>
                        <TableCell>{lv.days}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{lv.reason}</TableCell>
                        <TableCell>
                          <Badge variant={lv.status === 'approved' ? 'default' : lv.status === 'pending' ? 'secondary' : 'destructive'}>
                            {lv.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payslips">
            <Card className="border-border">
              <CardContent className="p-6">
                <div className="space-y-3">
                  {['February 2026', 'January 2026', 'December 2025', 'November 2025'].map((month) => (
                    <div key={month} className="flex items-center justify-between rounded-lg border border-border p-4">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">Salary Slip – {month}</p>
                          <p className="text-xs text-muted-foreground">Generated on 28th of month</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm"><Download className="mr-1 h-4 w-4" />Download</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents">
            <Card className="border-border">
              <CardContent className="p-6">
                <div className="space-y-3">
                  {[
                    { name: 'Appointment Letter', date: 'Aug 2015' },
                    { name: 'Promotion Order (Associate Prof.)', date: 'Jan 2022' },
                    { name: 'PhD Certificate', date: 'Jun 2014' },
                    { name: 'UGC-NET Certificate', date: 'Dec 2012' },
                    { name: 'Experience Certificate (Previous)', date: 'Jul 2015' },
                  ].map((doc) => (
                    <div key={doc.name} className="flex items-center justify-between rounded-lg border border-border p-4">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">{doc.date}</p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm"><Download className="mr-1 h-4 w-4" />View</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

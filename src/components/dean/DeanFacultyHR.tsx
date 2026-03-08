import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Users, UserPlus, ClipboardCheck, CheckCircle, XCircle, AlertTriangle,
  Calendar, Briefcase, TrendingUp
} from 'lucide-react';
import { departmentSummaries, facultyRecruitments, deanApprovals } from '@/data/deanMockData';
import { useToast } from '@/hooks/use-toast';

export default function DeanFacultyHR() {
  const { toast } = useToast();

  const totalVacancies = departmentSummaries.reduce((s, d) => s + d.vacancies, 0);
  const leaveApprovals = deanApprovals.filter(a => a.type === 'leave' && a.status === 'pending');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Faculty HR Actions</h1>
          <p className="text-muted-foreground">Recruitment, appraisal, and leave management across departments</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: 'Total Faculty', value: departmentSummaries.reduce((s, d) => s + d.totalFaculty, 0), icon: Users, color: 'text-blue-600 bg-blue-100' },
            { label: 'Open Vacancies', value: totalVacancies, icon: UserPlus, color: 'text-amber-600 bg-amber-100' },
            { label: 'Active Recruitments', value: facultyRecruitments.filter(r => r.status === 'in_progress').length, icon: Briefcase, color: 'text-green-600 bg-green-100' },
            { label: 'Pending Leave Approvals', value: leaveApprovals.length, icon: Calendar, color: 'text-primary bg-primary/10' },
          ].map(s => (
            <Card key={s.label} className="border-border">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.color}`}><s.icon className="h-5 w-5" /></div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="recruitment">
          <TabsList>
            <TabsTrigger value="recruitment">Recruitment</TabsTrigger>
            <TabsTrigger value="leave">Leave Approvals</TabsTrigger>
            <TabsTrigger value="appraisal">Appraisal Overview</TabsTrigger>
          </TabsList>

          <TabsContent value="recruitment" className="mt-4">
            <Card className="border-border">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Department</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Specialization</TableHead>
                      <TableHead>Vacant Since</TableHead>
                      <TableHead className="text-center">Applicants</TableHead>
                      <TableHead className="text-center">Shortlisted</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {facultyRecruitments.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.department}</TableCell>
                        <TableCell>{r.position}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.specialization}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.vacancySince}</TableCell>
                        <TableCell className="text-center">{r.applicants}</TableCell>
                        <TableCell className="text-center">{r.shortlisted}</TableCell>
                        <TableCell>
                          <Badge variant={r.status === 'completed' ? 'default' : r.status === 'in_progress' ? 'secondary' : 'outline'} className="capitalize text-[10px]">
                            {r.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {r.status === 'requested' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs"
                              onClick={() => toast({ title: 'Recruitment Approved', description: `${r.position} – ${r.department}` })}>
                              <CheckCircle className="mr-1 h-3 w-3" />Approve
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leave" className="mt-4 space-y-3">
            {leaveApprovals.length === 0 ? (
              <Card className="border-border"><CardContent className="p-8 text-center text-muted-foreground">No pending leave approvals</CardContent></Card>
            ) : leaveApprovals.map(la => (
              <Card key={la.id} className="border-border">
                <CardContent className="flex items-center gap-4 p-4">
                  <Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{la.title}</p>
                    <p className="text-sm text-muted-foreground">{la.details}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{la.department} • {la.requestedAt}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" className="text-green-600" onClick={() => toast({ title: 'Leave Approved' })}>
                      <CheckCircle className="mr-1 h-3 w-3" />Approve
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => toast({ title: 'Leave Rejected' })}>
                      <XCircle className="mr-1 h-3 w-3" />Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="appraisal" className="mt-4">
            <Card className="border-border">
              <CardHeader className="pb-3"><CardTitle className="text-lg">Faculty Appraisal Status by Department</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {departmentSummaries.map(d => {
                  const completed = Math.floor(d.totalFaculty * 0.6);
                  const pct = Math.round((completed / d.totalFaculty) * 100);
                  return (
                    <div key={d.id} className="flex items-center gap-4">
                      <span className="w-48 text-sm font-medium text-foreground truncate">{d.name}</span>
                      <Progress value={pct} className="flex-1 h-2" />
                      <span className="text-xs text-muted-foreground w-24 text-right">{completed}/{d.totalFaculty} completed</span>
                    </div>
                  );
                })}
                <p className="text-xs text-muted-foreground mt-2">Deadline: 25 March 2026</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  GraduationCap, BookOpen, CheckCircle, XCircle, Clock, ArrowRight, FileText, Send
} from 'lucide-react';
import { departmentSummaries, curriculumProposals } from '@/data/deanMockData';
import { useToast } from '@/hooks/use-toast';

export default function DeanAcademics() {
  const { toast } = useToast();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Academic Oversight</h1>
          <p className="text-muted-foreground">Review department academics and approve curriculum changes</p>
        </div>

        <Tabs defaultValue="departments">
          <TabsList>
            <TabsTrigger value="departments">Department Academics</TabsTrigger>
            <TabsTrigger value="curriculum">Curriculum Proposals</TabsTrigger>
          </TabsList>

          <TabsContent value="departments" className="mt-4">
            <Card className="border-border">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Department</TableHead>
                      <TableHead>HOD</TableHead>
                      <TableHead className="text-center">Students</TableHead>
                      <TableHead className="text-center">Faculty</TableHead>
                      <TableHead className="text-center">Pass %</TableHead>
                      <TableHead className="text-center">Attendance</TableHead>
                      <TableHead className="text-center">Research</TableHead>
                      <TableHead className="text-center">Placement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departmentSummaries.map(d => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium text-foreground">{d.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{d.hod}</TableCell>
                        <TableCell className="text-center">{d.totalStudents}</TableCell>
                        <TableCell className="text-center">
                          {d.totalFaculty}
                          {d.vacancies > 0 && <span className="text-destructive text-xs ml-1">(-{d.vacancies})</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={d.avgPassPercentage < 85 ? 'text-destructive font-bold' : 'text-green-600 font-medium'}>
                            {d.avgPassPercentage}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={d.avgAttendance < 75 ? 'text-destructive font-bold' : ''}>{d.avgAttendance}%</span>
                        </TableCell>
                        <TableCell className="text-center">{d.researchOutput}</TableCell>
                        <TableCell className="text-center">
                          <span className={d.placementRate < 80 ? 'text-amber-600' : 'text-green-600'}>{d.placementRate}%</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="curriculum" className="mt-4 space-y-4">
            {curriculumProposals.map(cp => (
              <Card key={cp.id} className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px]">{cp.department}</Badge>
                        <Badge variant="secondary" className="text-[10px] capitalize">{cp.type.replace('_', ' ')}</Badge>
                        {cp.bosApproved && <Badge className="text-[10px] bg-green-100 text-green-700">BoS Approved</Badge>}
                      </div>
                      <p className="font-medium text-foreground">{cp.title}</p>
                      <p className="text-sm text-muted-foreground mt-1">{cp.description}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Proposed by {cp.proposedBy} • {cp.submittedAt}</p>
                    </div>
                    {cp.status === 'pending_dean' && (
                      <div className="flex shrink-0 gap-1.5 ml-4">
                        <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50"
                          onClick={() => toast({ title: 'Approved & Sent to Academic Council', description: cp.title })}>
                          <CheckCircle className="mr-1 h-4 w-4" />Approve
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive"
                          onClick={() => toast({ title: 'Rejected', description: cp.title })}>
                          <XCircle className="mr-1 h-4 w-4" />Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

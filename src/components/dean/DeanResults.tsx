import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import {
  BarChart3, CheckCircle, Clock, Download, Award, TrendingUp, AlertTriangle
} from 'lucide-react';
import { resultSummaries } from '@/data/deanMockData';
import { useToast } from '@/hooks/use-toast';

export default function DeanResults() {
  const { toast } = useToast();

  const pending = resultSummaries.filter(r => r.status === 'pending_approval');
  const avgPass = Math.round(resultSummaries.reduce((s, r) => s + r.passPercentage, 0) / resultSummaries.length * 10) / 10;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Exams & Results</h1>
            <p className="text-muted-foreground">Review and approve semester results before publication</p>
          </div>
          <Button variant="outline" size="sm"><Download className="mr-1 h-4 w-4" />Export All Results</Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: 'Programs Reviewed', value: resultSummaries.length, icon: BarChart3, color: 'text-blue-600 bg-blue-100' },
            { label: 'Pending Approval', value: pending.length, icon: Clock, color: 'text-amber-600 bg-amber-100' },
            { label: 'Overall Pass %', value: `${avgPass}%`, icon: TrendingUp, color: 'text-green-600 bg-green-100' },
            { label: 'Published', value: resultSummaries.filter(r => r.status === 'published').length, icon: CheckCircle, color: 'text-primary bg-primary/10' },
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

        {/* Pending Results */}
        {pending.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />Results Pending Your Approval
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pending.map(r => (
                <div key={`${r.department}-${r.program}-${r.semester}`} className="flex items-center justify-between rounded-lg border border-amber-200 bg-white/60 dark:bg-background/60 p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{r.program} – Semester {r.semester}</p>
                    <p className="text-xs text-muted-foreground">{r.department} • {r.totalStudents} students • Pass: {r.passPercentage}%</p>
                  </div>
                  <Button size="sm" onClick={() => toast({ title: 'Results Approved', description: `${r.program} Sem ${r.semester} approved for publication` })}>
                    <CheckCircle className="mr-1 h-4 w-4" />Approve & Publish
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* All Results */}
        <Card className="border-border">
          <CardHeader className="pb-3"><CardTitle className="text-lg">Result Summary – All Programs</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead className="text-center">Sem</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Passed</TableHead>
                  <TableHead className="text-center">Failed</TableHead>
                  <TableHead className="text-center">Pass %</TableHead>
                  <TableHead className="text-center">Avg GPA</TableHead>
                  <TableHead>Topper</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultSummaries.map(r => (
                  <TableRow key={`${r.department}-${r.program}-${r.semester}`}>
                    <TableCell className="font-medium">{r.department}</TableCell>
                    <TableCell className="text-sm">{r.program}</TableCell>
                    <TableCell className="text-center">{r.semester}</TableCell>
                    <TableCell className="text-center">{r.totalStudents}</TableCell>
                    <TableCell className="text-center text-green-600">{r.passed}</TableCell>
                    <TableCell className="text-center text-destructive">{r.failed}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Progress value={r.passPercentage} className="w-12 h-1.5" />
                        <span className="text-xs font-medium">{r.passPercentage}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-medium">{r.avgGPA}</TableCell>
                    <TableCell className="text-xs">
                      {r.toppers[0] && <span>{r.toppers[0].name} ({r.toppers[0].gpa})</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.status === 'published' ? 'default' : r.status === 'approved' ? 'secondary' : 'outline'} className="capitalize text-[10px]">
                        {r.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

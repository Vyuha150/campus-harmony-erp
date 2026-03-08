import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import {
  BarChart3, Download, TrendingUp, TrendingDown, AlertTriangle, Award
} from 'lucide-react';
import { courseResults } from '@/data/hodMockData';

export default function HODResultsAnalysis() {
  const overallPass = Math.round(courseResults.reduce((s, c) => s + c.passPercentage, 0) / courseResults.length * 10) / 10;
  const overallAvg = Math.round(courseResults.reduce((s, c) => s + c.avgScore, 0) / courseResults.length * 10) / 10;
  const totalFailed = courseResults.reduce((s, c) => s + c.failed, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Department Results Analysis</h1>
            <p className="text-muted-foreground">Semester-wise performance analysis • Even Semester 2025-26</p>
          </div>
          <Button variant="outline" size="sm">
            <Download className="mr-1 h-4 w-4" />Download Report
          </Button>
        </div>

        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: 'Overall Pass %', value: `${overallPass}%`, icon: TrendingUp, color: 'text-green-600 bg-green-100' },
            { label: 'Average Score', value: overallAvg, icon: BarChart3, color: 'text-blue-600 bg-blue-100' },
            { label: 'Total Failures', value: totalFailed, icon: TrendingDown, color: 'text-destructive bg-destructive/10' },
            { label: 'Courses Analyzed', value: courseResults.length, icon: Award, color: 'text-primary bg-primary/10' },
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

        {/* Course-wise Results */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Course-wise Performance</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Faculty</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Passed</TableHead>
                  <TableHead className="text-center">Failed</TableHead>
                  <TableHead className="text-center">Pass %</TableHead>
                  <TableHead className="text-center">Avg Score</TableHead>
                  <TableHead className="text-center">Highest</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courseResults.map(c => (
                  <TableRow key={c.courseCode}>
                    <TableCell>
                      <p className="font-medium text-foreground">{c.courseCode}</p>
                      <p className="text-xs text-muted-foreground">{c.courseName}</p>
                    </TableCell>
                    <TableCell className="text-sm">{c.faculty}</TableCell>
                    <TableCell className="text-center">{c.totalStudents}</TableCell>
                    <TableCell className="text-center text-green-600 font-medium">{c.passed}</TableCell>
                    <TableCell className="text-center text-destructive font-medium">{c.failed}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Progress value={c.passPercentage} className="w-16 h-1.5" />
                        <span className={`text-xs font-medium ${c.passPercentage < 80 ? 'text-destructive' : 'text-green-600'}`}>
                          {c.passPercentage}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{c.avgScore}</TableCell>
                    <TableCell className="text-center font-bold text-green-600">{c.highestScore}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Grade Distribution Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courseResults.map(c => (
            <Card key={c.courseCode} className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{c.courseCode} – Grade Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {c.gradeDistribution.map(g => (
                    <div key={g.grade} className="flex items-center gap-2">
                      <span className="w-8 text-xs font-medium text-foreground">{g.grade}</span>
                      <Progress value={(g.count / c.totalStudents) * 100} className="flex-1 h-2" />
                      <span className="w-6 text-xs text-muted-foreground text-right">{g.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Courses needing remedial action */}
        {courseResults.filter(c => c.passPercentage < 90).length > 0 && (
          <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Courses Needing Attention
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {courseResults.filter(c => c.passPercentage < 90).map(c => (
                <div key={c.courseCode} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{c.courseCode} – {c.courseName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{c.failed} students failed</span>
                    <Button size="sm" variant="outline" className="h-7 text-xs">Arrange Remedial</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

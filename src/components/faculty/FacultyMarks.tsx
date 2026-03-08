import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, Download, Upload, BarChart3 } from 'lucide-react';
import { internalMarks, facultyCourses } from '@/data/facultyMockData';
import { useToast } from '@/hooks/use-toast';

export default function FacultyMarks() {
  const { toast } = useToast();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Gradebook & Marks Entry</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Upload className="mr-1 h-4 w-4" />Import CSV</Button>
            <Button variant="outline" size="sm"><Download className="mr-1 h-4 w-4" />Export</Button>
          </div>
        </div>

        <div className="flex gap-4">
          <Select defaultValue="fc-1">
            <SelectTrigger className="w-[280px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {facultyCourses.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.code} – {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="internal">
          <TabsList>
            <TabsTrigger value="internal">Internal Marks</TabsTrigger>
            <TabsTrigger value="exam">End-Semester Entry</TabsTrigger>
          </TabsList>

          <TabsContent value="internal" className="mt-4">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">CS301 – Internal Assessment Marks</CardTitle>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Quiz 1: /10</span>
                    <span>Quiz 2: /10</span>
                    <span>Midterm: /50</span>
                    <span>Assignment: /20</span>
                    <span>Attendance: /10</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Roll No</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-center">Quiz 1 (10)</TableHead>
                      <TableHead className="text-center">Quiz 2 (10)</TableHead>
                      <TableHead className="text-center">Midterm (50)</TableHead>
                      <TableHead className="text-center">Assignment (20)</TableHead>
                      <TableHead className="text-center">Attendance (10)</TableHead>
                      <TableHead className="text-center">Total (100)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {internalMarks.map((entry) => (
                      <TableRow key={entry.studentId}>
                        <TableCell className="font-mono">{entry.rollNumber}</TableCell>
                        <TableCell className="font-medium">{entry.studentName}</TableCell>
                        <TableCell className="text-center">
                          <Input type="number" className="mx-auto w-16 text-center" defaultValue={entry.quiz1} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input type="number" className="mx-auto w-16 text-center" defaultValue={entry.quiz2} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input type="number" className="mx-auto w-16 text-center" defaultValue={entry.midterm} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input type="number" className="mx-auto w-16 text-center" defaultValue={entry.assignment} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input type="number" className="mx-auto w-16 text-center" defaultValue={entry.attendance} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={entry.total >= 60 ? 'default' : entry.total >= 40 ? 'secondary' : 'destructive'}>
                            {entry.total}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="outline">Save Draft</Button>
                  <Button onClick={() => toast({ title: 'Marks Submitted', description: 'Internal marks saved and submitted for review.' })}>
                    <Save className="mr-1 h-4 w-4" />Submit Marks
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="exam" className="mt-4">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">End-Semester Marks Entry</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Roll No</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-center">Theory (70)</TableHead>
                      <TableHead className="text-center">Practical (30)</TableHead>
                      <TableHead className="text-center">Total (100)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {internalMarks.map((entry) => (
                      <TableRow key={entry.studentId}>
                        <TableCell className="font-mono">{entry.rollNumber}</TableCell>
                        <TableCell className="font-medium">{entry.studentName}</TableCell>
                        <TableCell className="text-center"><Input type="number" className="mx-auto w-16 text-center" /></TableCell>
                        <TableCell className="text-center"><Input type="number" className="mx-auto w-16 text-center" /></TableCell>
                        <TableCell className="text-center"><span className="text-muted-foreground">—</span></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-4 flex justify-end">
                  <Button onClick={() => toast({ title: 'Exam Marks Submitted' })}>
                    <Save className="mr-1 h-4 w-4" />Submit to Exam Cell
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

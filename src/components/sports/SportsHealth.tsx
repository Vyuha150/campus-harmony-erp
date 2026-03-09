import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Heart, Plus, Activity, AlertTriangle, UserCheck, Stethoscope, Calendar, Download } from 'lucide-react';

const fitnessTests = [
  { id: 'FT001', studentName: 'Rahul Sharma', rollNumber: 'BT23CS045', sport: 'Cricket', testDate: '15 Feb 2026', testType: 'Fitness Assessment', grade: 'A', status: 'completed' },
  { id: 'FT002', studentName: 'Priya Menon', rollNumber: 'BT24ECE022', sport: 'Badminton', testDate: '15 Feb 2026', testType: 'Beep Test', grade: 'A', status: 'completed' },
  { id: 'FT003', studentName: 'Vikas Patel', rollNumber: 'BT23ME067', sport: 'Cricket', testDate: '20 Mar 2026', testType: 'Medical Checkup', grade: '-', status: 'scheduled' },
];

const injuryLog = [
  { id: 'INJ001', studentName: 'Anil Kumar', rollNumber: 'BT23EE012', sport: 'Football', injury: 'Ankle Sprain', severity: 'moderate' as const, date: '5 Mar 2026', recoveryWeeks: 3, status: 'recovering' as const },
  { id: 'INJ002', studentName: 'Deepa Raj', rollNumber: 'BT24ME045', sport: 'Athletics', injury: 'Hamstring Pull', severity: 'mild' as const, date: '1 Mar 2026', recoveryWeeks: 2, status: 'cleared' as const },
  { id: 'INJ003', studentName: 'Ravi Teja', rollNumber: 'BT23CS078', sport: 'Basketball', injury: 'ACL Tear', severity: 'severe' as const, date: '20 Feb 2026', recoveryWeeks: 16, status: 'recovering' as const },
];

const medicalClearances = [
  { studentName: 'Rahul Sharma', rollNumber: 'BT23CS045', lastCheckup: '15 Feb 2026', nextDue: '15 Aug 2026', cleared: true },
  { studentName: 'Priya Menon', rollNumber: 'BT24ECE022', lastCheckup: '15 Feb 2026', nextDue: '15 Aug 2026', cleared: true },
  { studentName: 'Vikas Patel', rollNumber: 'BT23ME067', lastCheckup: '10 Sep 2025', nextDue: '10 Mar 2026', cleared: false },
];

export default function SportsHealth() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Health & Fitness Records</h1>
            <p className="text-muted-foreground">Fitness tests, injury tracking, medical clearances, and checkup scheduling</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export</Button>
            <Dialog>
              <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Log Record</Button></DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Log Health / Fitness Record</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                  <div><Label>Student</Label><Input placeholder="Search by name or roll number" /></div>
                  <div><Label>Record Type</Label>
                    <Select><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                      <SelectItem value="fitness">Fitness Assessment</SelectItem>
                      <SelectItem value="beep">Beep Test</SelectItem>
                      <SelectItem value="strength">Strength Test</SelectItem>
                      <SelectItem value="medical">Medical Checkup</SelectItem>
                      <SelectItem value="injury">Injury Report</SelectItem>
                    </SelectContent></Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Date</Label><Input type="date" /></div>
                    <div><Label>Conducted By</Label><Input placeholder="Doctor / Trainer name" /></div>
                  </div>
                  <div><Label>Notes / Results</Label><Textarea placeholder="Describe findings..." /></div>
                  <div><Label>Grade (if applicable)</Label>
                    <Select><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>
                      <SelectItem value="A">A – Excellent</SelectItem><SelectItem value="B">B – Good</SelectItem><SelectItem value="C">C – Average</SelectItem><SelectItem value="D">D – Below Average</SelectItem><SelectItem value="F">F – Poor</SelectItem>
                    </SelectContent></Select>
                  </div>
                  <Button className="w-full">Save Record</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4 flex items-center gap-3"><UserCheck className="h-8 w-8 text-green-600" /><div><p className="text-2xl font-bold text-foreground">72</p><p className="text-xs text-muted-foreground">Medically Cleared</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><AlertTriangle className="h-8 w-8 text-amber-500" /><div><p className="text-2xl font-bold text-foreground">8</p><p className="text-xs text-muted-foreground">Clearance Due</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><Activity className="h-8 w-8 text-destructive" /><div><p className="text-2xl font-bold text-foreground">4</p><p className="text-xs text-muted-foreground">Currently Injured</p></div></CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3"><Stethoscope className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold text-foreground">15</p><p className="text-xs text-muted-foreground">Tests Scheduled</p></div></CardContent></Card>
        </div>

        <Tabs defaultValue="injuries">
          <TabsList>
            <TabsTrigger value="injuries">Injury Log</TabsTrigger>
            <TabsTrigger value="fitness">Fitness Tests</TabsTrigger>
            <TabsTrigger value="clearance">Medical Clearances</TabsTrigger>
          </TabsList>

          <TabsContent value="injuries" className="mt-4">
            <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full">
              <thead><tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Athlete</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Sport</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Injury</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Severity</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Recovery (wks)</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Actions</th>
              </tr></thead>
              <tbody>
                {injuryLog.map(inj => (
                  <tr key={inj.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3"><p className="text-sm font-medium text-foreground">{inj.studentName}</p><p className="text-xs text-muted-foreground">{inj.rollNumber}</p></td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{inj.sport}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{inj.injury}</td>
                    <td className="px-4 py-3"><Badge variant={inj.severity === 'severe' ? 'destructive' : inj.severity === 'moderate' ? 'secondary' : 'default'} className="capitalize">{inj.severity}</Badge></td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{inj.date}</td>
                    <td className="px-4 py-3 text-center text-sm text-foreground">{inj.recoveryWeeks}</td>
                    <td className="px-4 py-3"><Badge variant={inj.status === 'cleared' ? 'default' : 'secondary'} className="capitalize">{inj.status}</Badge></td>
                    <td className="px-4 py-3"><Button variant="outline" size="sm">Update</Button></td>
                  </tr>
                ))}
              </tbody>
            </table></div></CardContent></Card>
          </TabsContent>

          <TabsContent value="fitness" className="mt-4">
            <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full">
              <thead><tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Athlete</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Sport</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Test Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Grade</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
              </tr></thead>
              <tbody>
                {fitnessTests.map(ft => (
                  <tr key={ft.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3"><p className="text-sm font-medium text-foreground">{ft.studentName}</p><p className="text-xs text-muted-foreground">{ft.rollNumber}</p></td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{ft.sport}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{ft.testType}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{ft.testDate}</td>
                    <td className="px-4 py-3 text-center"><Badge variant={ft.grade === 'A' ? 'default' : 'secondary'}>{ft.grade}</Badge></td>
                    <td className="px-4 py-3"><Badge variant={ft.status === 'completed' ? 'default' : 'secondary'} className="capitalize">{ft.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table></div></CardContent></Card>
          </TabsContent>

          <TabsContent value="clearance" className="mt-4">
            <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full">
              <thead><tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Athlete</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Last Checkup</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Next Due</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Cleared</th>
                <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Actions</th>
              </tr></thead>
              <tbody>
                {medicalClearances.map((mc, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3"><p className="text-sm font-medium text-foreground">{mc.studentName}</p><p className="text-xs text-muted-foreground">{mc.rollNumber}</p></td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{mc.lastCheckup}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{mc.nextDue}</td>
                    <td className="px-4 py-3"><Badge variant={mc.cleared ? 'default' : 'destructive'}>{mc.cleared ? 'Yes' : 'Overdue'}</Badge></td>
                    <td className="px-4 py-3"><Button variant="outline" size="sm">{mc.cleared ? 'View' : 'Schedule'}</Button></td>
                  </tr>
                ))}
              </tbody>
            </table></div></CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

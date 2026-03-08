import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  GraduationCap, Search, Users, AlertTriangle, Eye, Download, TrendingUp, TrendingDown,
  Mail, Phone, Edit, UserCheck, BookOpen
} from 'lucide-react';
import { departmentStudents as initialStudents, departmentFaculty } from '@/data/hodMockData';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { DepartmentStudent } from '@/types/hod';

export default function HODStudentAcademics() {
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [students, setStudents] = useState<DepartmentStudent[]>(initialStudents);
  const [selectedStudent, setSelectedStudent] = useState<DepartmentStudent | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showAdvisorDialog, setShowAdvisorDialog] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [newAdvisor, setNewAdvisor] = useState('');
  const [counselNote, setCounselNote] = useState('');
  const { toast } = useToast();

  const filtered = students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.rollNumber.toLowerCase().includes(search.toLowerCase());
    const matchYear = yearFilter === 'all' || s.year === parseInt(yearFilter);
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchSearch && matchYear && matchStatus;
  });

  const avgCGPA = (students.reduce((s, st) => s + st.cgpa, 0) / students.length).toFixed(2);
  const avgAttendance = Math.round(students.reduce((s, st) => s + st.attendance, 0) / students.length);
  const atRisk = students.filter(s => s.cgpa < 6 || s.attendance < 65);

  const handleChangeAdvisor = () => {
    if (selectedStudent && newAdvisor) {
      setStudents(prev => prev.map(s => s.id === selectedStudent.id ? { ...s, advisor: newAdvisor } : s));
      setSelectedStudent(prev => prev ? { ...prev, advisor: newAdvisor } : null);
      toast({ title: 'Advisor Updated', description: `${selectedStudent.name}'s advisor changed to ${newAdvisor}` });
      setShowAdvisorDialog(false);
      setNewAdvisor('');
    }
  };

  const handleExport = () => {
    toast({ title: '📥 Report Exported', description: `${filtered.length} student records exported as CSV` });
  };

  const handleMeritList = () => {
    const toppers = [...students].sort((a, b) => b.cgpa - a.cgpa).slice(0, 5);
    toast({ title: '🏆 Merit List Generated', description: `Top 5: ${toppers.map(s => `${s.name} (${s.cgpa})`).join(', ')}` });
  };

  const handleAddNote = () => {
    if (selectedStudent && counselNote) {
      toast({ title: 'Counseling Note Added', description: `Note for ${selectedStudent.name}: "${counselNote}"` });
      setCounselNote('');
      setShowNoteDialog(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Student Academics</h1>
            <p className="text-muted-foreground">Academic records of all students in the department</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleMeritList}>
              <TrendingUp className="mr-1 h-4 w-4" />Merit List
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-1 h-4 w-4" />Export Report
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: 'Total Students', value: students.length, icon: Users, color: 'text-blue-600 bg-blue-100' },
            { label: 'Avg CGPA', value: avgCGPA, icon: TrendingUp, color: 'text-green-600 bg-green-100' },
            { label: 'Avg Attendance', value: `${avgAttendance}%`, icon: GraduationCap, color: 'text-primary bg-primary/10' },
            { label: 'At-Risk Students', value: atRisk.length, icon: AlertTriangle, color: 'text-destructive bg-destructive/10' },
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

        {/* At-Risk Alert */}
        {atRisk.length > 0 && (
          <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium">At-Risk Students ({atRisk.length})</span>
              </div>
              <div className="space-y-1">
                {atRisk.map(s => (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <span className="cursor-pointer hover:underline" onClick={() => { setSelectedStudent(s); setShowDetailDialog(true); }}>
                      {s.rollNumber} – {s.name}
                    </span>
                    <div className="flex gap-2">
                      {s.cgpa < 6 && <Badge variant="destructive" className="text-[10px]">CGPA: {s.cgpa}</Badge>}
                      {s.attendance < 65 && <Badge variant="secondary" className="text-[10px]">Att: {s.attendance}%</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name or roll..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Year" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              <SelectItem value="1">1st Year</SelectItem>
              <SelectItem value="2">2nd Year</SelectItem>
              <SelectItem value="3">3rd Year</SelectItem>
              <SelectItem value="4">4th Year</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="detained">Detained</SelectItem>
              <SelectItem value="graduated">Graduated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Student Table */}
        <Card className="border-border">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Roll No</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead className="text-center">Year</TableHead>
                  <TableHead className="text-center">Section</TableHead>
                  <TableHead className="text-center">CGPA</TableHead>
                  <TableHead className="text-center">Attendance</TableHead>
                  <TableHead>Advisor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(s => (
                  <TableRow key={s.id} className="cursor-pointer" onClick={() => { setSelectedStudent(s); setShowDetailDialog(true); }}>
                    <TableCell className="font-mono">{s.rollNumber}</TableCell>
                    <TableCell className="font-medium text-foreground">{s.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.program}</TableCell>
                    <TableCell className="text-center">{s.year}</TableCell>
                    <TableCell className="text-center">{s.section}</TableCell>
                    <TableCell className="text-center">
                      <span className={s.cgpa < 6 ? 'text-destructive font-bold' : s.cgpa >= 8.5 ? 'text-green-600 font-bold' : ''}>
                        {s.cgpa}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Progress value={s.attendance} className="w-16 h-1.5" />
                        <span className={`text-xs ${s.attendance < 65 ? 'text-destructive font-bold' : ''}`}>{s.attendance}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.advisor}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === 'active' ? 'default' : s.status === 'detained' ? 'destructive' : 'secondary'} className="capitalize text-[10px]">
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" className="h-7" onClick={(e) => { e.stopPropagation(); setSelectedStudent(s); setShowDetailDialog(true); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Student Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Student Profile</DialogTitle></DialogHeader>
          {selectedStudent && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">{selectedStudent.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedStudent.rollNumber} • {selectedStudent.program}</p>
                </div>
                <Badge variant={selectedStudent.status === 'active' ? 'default' : 'destructive'} className="capitalize">{selectedStudent.status}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Year/Sem:</span> {selectedStudent.year}/{selectedStudent.semester}</div>
                <div><span className="text-muted-foreground">Section:</span> {selectedStudent.section}</div>
                <div><span className="text-muted-foreground">CGPA:</span> <span className={selectedStudent.cgpa < 6 ? 'text-destructive font-bold' : 'font-bold'}>{selectedStudent.cgpa}</span></div>
                <div><span className="text-muted-foreground">Attendance:</span> <span className={selectedStudent.attendance < 65 ? 'text-destructive font-bold' : 'font-bold'}>{selectedStudent.attendance}%</span></div>
                <div><span className="text-muted-foreground">Advisor:</span> {selectedStudent.advisor}</div>
                <div className="flex items-center gap-1"><Mail className="h-3 w-3 text-muted-foreground" />{selectedStudent.email}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => { setShowDetailDialog(false); setShowAdvisorDialog(true); }}>
                  <UserCheck className="mr-1 h-3 w-3" />Change Advisor
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setShowDetailDialog(false); setShowNoteDialog(true); }}>
                  <Edit className="mr-1 h-3 w-3" />Add Counseling Note
                </Button>
                <Button size="sm" variant="outline" onClick={() => toast({ title: 'Email Sent', description: `Message sent to ${selectedStudent.email}` })}>
                  <Mail className="mr-1 h-3 w-3" />Email Student
                </Button>
                <Button size="sm" variant="outline" onClick={() => toast({ title: 'Report Card Generated', description: `Report card for ${selectedStudent.name} downloaded` })}>
                  <Download className="mr-1 h-3 w-3" />Report Card
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Change Advisor Dialog */}
      <Dialog open={showAdvisorDialog} onOpenChange={setShowAdvisorDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change Advisor for {selectedStudent?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Current Advisor: {selectedStudent?.advisor}</p>
            <Select value={newAdvisor} onValueChange={setNewAdvisor}>
              <SelectTrigger><SelectValue placeholder="Select new advisor..." /></SelectTrigger>
              <SelectContent>
                {departmentFaculty.map(f => (
                  <SelectItem key={f.id} value={f.name}>{f.name} – {f.designation}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAdvisorDialog(false)}>Cancel</Button>
              <Button onClick={handleChangeAdvisor} disabled={!newAdvisor}>Update Advisor</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Counseling Note Dialog */}
      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Counseling Note – {selectedStudent?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Textarea placeholder="Enter counseling notes..." value={counselNote} onChange={e => setCounselNote(e.target.value)} rows={4} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNoteDialog(false)}>Cancel</Button>
              <Button onClick={handleAddNote} disabled={!counselNote}>Save Note</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

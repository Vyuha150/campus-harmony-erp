import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  GraduationCap, Search, Users, AlertTriangle, Eye, Download, TrendingUp, TrendingDown
} from 'lucide-react';
import { departmentStudents } from '@/data/hodMockData';
import { useState } from 'react';

export default function HODStudentAcademics() {
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = departmentStudents.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.rollNumber.toLowerCase().includes(search.toLowerCase());
    const matchYear = yearFilter === 'all' || s.year === parseInt(yearFilter);
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchSearch && matchYear && matchStatus;
  });

  const avgCGPA = (departmentStudents.reduce((s, st) => s + st.cgpa, 0) / departmentStudents.length).toFixed(2);
  const avgAttendance = Math.round(departmentStudents.reduce((s, st) => s + st.attendance, 0) / departmentStudents.length);
  const atRisk = departmentStudents.filter(s => s.cgpa < 6 || s.attendance < 65).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Student Academics</h1>
            <p className="text-muted-foreground">Academic records of all students in the department</p>
          </div>
          <Button variant="outline" size="sm">
            <Download className="mr-1 h-4 w-4" />Export Report
          </Button>
        </div>

        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: 'Total Students', value: departmentStudents.length, icon: Users, color: 'text-blue-600 bg-blue-100' },
            { label: 'Avg CGPA', value: avgCGPA, icon: TrendingUp, color: 'text-green-600 bg-green-100' },
            { label: 'Avg Attendance', value: `${avgAttendance}%`, icon: GraduationCap, color: 'text-primary bg-primary/10' },
            { label: 'At-Risk Students', value: atRisk, icon: AlertTriangle, color: 'text-destructive bg-destructive/10' },
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(s => (
                  <TableRow key={s.id}>
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

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Users, Search, Filter, Download, CheckCircle2, XCircle, Clock,
  FileText, Star, Briefcase, GraduationCap, MapPin, Eye, Edit, Upload
} from 'lucide-react';

interface StudentProfile {
  id: string;
  name: string;
  rollNo: string;
  program: string;
  branch: string;
  cgpa: number;
  backlogs: number;
  email: string;
  phone: string;
  resumeVerified: boolean;
  status: 'eligible' | 'placed' | 'higher_studies' | 'entrepreneur' | 'not_interested';
  skills: string[];
  placedAt?: string;
  package?: number;
  preferredRoles: string[];
  preferredLocations: string[];
}

const students: StudentProfile[] = [
  { id: 'S001', name: 'Ananya Krishnan', rollNo: '20CS101', program: 'B.Tech', branch: 'CSE', cgpa: 9.2, backlogs: 0, email: 'ananya@student.edu', phone: '9876543001', resumeVerified: true, status: 'placed', skills: ['Python', 'ML', 'React'], placedAt: 'Microsoft', package: 4200000, preferredRoles: ['SDE'], preferredLocations: ['Bangalore', 'Hyderabad'] },
  { id: 'S002', name: 'Karthik Iyer', rollNo: '20CS102', program: 'B.Tech', branch: 'CSE', cgpa: 8.1, backlogs: 0, email: 'karthik@student.edu', phone: '9876543002', resumeVerified: true, status: 'placed', skills: ['Java', 'Spring', 'SQL'], placedAt: 'Infosys', package: 650000, preferredRoles: ['Backend Dev'], preferredLocations: ['Bangalore'] },
  { id: 'S003', name: 'Sneha Reddy', rollNo: '20EC103', program: 'B.Tech', branch: 'ECE', cgpa: 8.5, backlogs: 0, email: 'sneha@student.edu', phone: '9876543003', resumeVerified: true, status: 'eligible', skills: ['VLSI', 'Embedded Systems', 'C++'], preferredRoles: ['Design Engineer'], preferredLocations: ['Hyderabad', 'Chennai'] },
  { id: 'S004', name: 'Arjun Mehta', rollNo: '20CS104', program: 'B.Tech', branch: 'CSE', cgpa: 9.5, backlogs: 0, email: 'arjun@student.edu', phone: '9876543004', resumeVerified: true, status: 'placed', skills: ['Quant', 'Python', 'C++'], placedAt: 'Goldman Sachs', package: 2400000, preferredRoles: ['Analyst'], preferredLocations: ['Bangalore'] },
  { id: 'S005', name: 'Priya Nair', rollNo: '20ME105', program: 'B.Tech', branch: 'Mechanical', cgpa: 7.8, backlogs: 1, email: 'priya@student.edu', phone: '9876543005', resumeVerified: false, status: 'eligible', skills: ['AutoCAD', 'SolidWorks', 'MATLAB'], preferredRoles: ['Design Engineer'], preferredLocations: ['Pune', 'Chennai'] },
  { id: 'S006', name: 'Rohit Sharma', rollNo: '20IT106', program: 'B.Tech', branch: 'IT', cgpa: 7.2, backlogs: 0, email: 'rohit@student.edu', phone: '9876543006', resumeVerified: true, status: 'eligible', skills: ['JavaScript', 'Node.js', 'React'], preferredRoles: ['Full Stack Dev'], preferredLocations: ['Bangalore', 'Remote'] },
  { id: 'S007', name: 'Divya Prakash', rollNo: '20CS107', program: 'B.Tech', branch: 'CSE', cgpa: 8.8, backlogs: 0, email: 'divya@student.edu', phone: '9876543007', resumeVerified: true, status: 'higher_studies', skills: ['AI', 'NLP', 'Research'], preferredRoles: ['Researcher'], preferredLocations: ['USA', 'UK'] },
  { id: 'S008', name: 'Vikram Patel', rollNo: '20EC108', program: 'B.Tech', branch: 'ECE', cgpa: 6.9, backlogs: 2, email: 'vikram@student.edu', phone: '9876543008', resumeVerified: false, status: 'eligible', skills: ['PCB Design', 'Arduino'], preferredRoles: ['Hardware Engineer'], preferredLocations: ['Bangalore'] },
];

const formatPackage = (amount: number) => {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)} LPA`;
  return `₹${amount.toLocaleString('en-IN')}`;
};

const statusBadge = (status: string) => {
  switch (status) {
    case 'placed': return <Badge className="bg-green-600">Placed</Badge>;
    case 'eligible': return <Badge variant="default">Eligible</Badge>;
    case 'higher_studies': return <Badge variant="secondary">Higher Studies</Badge>;
    case 'not_interested': return <Badge variant="outline">Not Interested</Badge>;
    case 'entrepreneur': return <Badge variant="outline">Entrepreneur</Badge>;
    default: return <Badge variant="secondary">{status}</Badge>;
  }
};

export default function PlacementStudents() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');

  const filtered = students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.rollNo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchBranch = branchFilter === 'all' || s.branch === branchFilter;
    return matchSearch && matchStatus && matchBranch;
  });

  const placed = students.filter(s => s.status === 'placed').length;
  const eligible = students.filter(s => s.status === 'eligible').length;
  const higherStudies = students.filter(s => s.status === 'higher_studies').length;
  const resumePending = students.filter(s => !s.resumeVerified).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Student Profiles</h1>
            <p className="text-muted-foreground">Browse, search, and manage final-year student placement profiles</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Upload className="mr-2 h-4 w-4" />Import Data</Button>
            <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export List</Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Students</p><p className="text-2xl font-bold text-foreground">{students.length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Placed</p><p className="text-2xl font-bold text-green-600">{placed}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Eligible (Unplaced)</p><p className="text-2xl font-bold text-foreground">{eligible}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Higher Studies</p><p className="text-2xl font-bold text-foreground">{higherStudies}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Resume Pending</p><p className="text-2xl font-bold text-amber-600">{resumePending}</p></CardContent></Card>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name or roll number..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="eligible">Eligible</SelectItem>
              <SelectItem value="placed">Placed</SelectItem>
              <SelectItem value="higher_studies">Higher Studies</SelectItem>
            </SelectContent>
          </Select>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Branch" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              <SelectItem value="CSE">CSE</SelectItem>
              <SelectItem value="ECE">ECE</SelectItem>
              <SelectItem value="Mechanical">Mechanical</SelectItem>
              <SelectItem value="IT">IT</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Student Cards */}
        <div className="space-y-3">
          {filtered.map((s) => (
            <Card key={s.id} className="hover:bg-muted/20 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg">
                      {s.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{s.name}</h3>
                        {statusBadge(s.status)}
                        {s.resumeVerified ? (
                          <Badge variant="outline" className="text-green-600 border-green-300"><CheckCircle2 className="mr-1 h-3 w-3" />Resume Verified</Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-300"><Clock className="mr-1 h-3 w-3" />Resume Pending</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {s.rollNo} • {s.program} {s.branch} • CGPA: <span className="font-semibold text-foreground">{s.cgpa}</span>
                        {s.backlogs > 0 && <span className="text-destructive"> • {s.backlogs} backlog(s)</span>}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {s.skills.map(sk => <Badge key={sk} variant="secondary" className="text-xs">{sk}</Badge>)}
                      </div>
                      {s.placedAt && (
                        <p className="mt-2 text-sm">
                          <Briefcase className="mr-1 inline h-3 w-3 text-green-600" />
                          <span className="font-medium text-green-600">{s.placedAt}</span>
                          {s.package && <span className="text-muted-foreground"> – {formatPackage(s.package)}</span>}
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span><MapPin className="mr-0.5 inline h-3 w-3" />{s.preferredLocations.join(', ')}</span>
                        <span>{s.email}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm"><Eye className="mr-1 h-3 w-3" />View</Button>
                    <Button variant="outline" size="sm"><Edit className="mr-1 h-3 w-3" />Edit</Button>
                    {!s.resumeVerified && <Button size="sm"><CheckCircle2 className="mr-1 h-3 w-3" />Verify Resume</Button>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

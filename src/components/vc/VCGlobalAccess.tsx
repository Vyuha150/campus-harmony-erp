import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Search, Eye, GraduationCap, Users, Award, Building2,
  BookOpen, FileText, Mail, Phone, Calendar, MapPin, Download
} from 'lucide-react';
import { departmentPerformance } from '@/data/vcMockData';

interface SearchResult {
  type: string;
  name: string;
  id: string;
  department: string;
  details: string;
  awards: string[];
  email?: string;
  phone?: string;
  joinDate?: string;
  address?: string;
  extraInfo?: Record<string, string>;
}

const mockSearchResults: SearchResult[] = [
  { type: 'student', name: 'Arjun Reddy', id: 'STD-2024-001', department: 'Computer Science', details: 'B.Tech CSE 3rd Year • CGPA: 8.7 • Attendance: 89%', awards: ['Dean\'s List 2025', 'Hackathon Winner'], email: 'arjun.reddy@student.edu', phone: '+91-9876543210', joinDate: '2023-08-01', extraInfo: { 'Semester': '5th', 'Section': 'A', 'Mentor': 'Dr. Vikram Singh', 'Hostel': 'Block C-204', 'Fee Status': 'Paid' } },
  { type: 'student', name: 'Priya Sharma', id: 'STD-2024-045', department: 'Electronics', details: 'B.Tech ECE 4th Year • CGPA: 9.1 • Attendance: 94%', awards: ['Gold Medal Candidate', 'Research Paper Published'], email: 'priya.sharma@student.edu', phone: '+91-9876543211', joinDate: '2022-08-01', extraInfo: { 'Semester': '7th', 'Section': 'B', 'Mentor': 'Dr. Neha Gupta', 'Fee Status': 'Paid' } },
  { type: 'student', name: 'Rahul Verma', id: 'STD-2024-102', department: 'Mechanical', details: 'B.Tech ME 2nd Year • CGPA: 7.9 • Attendance: 78%', awards: [], email: 'rahul.verma@student.edu', phone: '+91-9876543212', joinDate: '2024-08-01', extraInfo: { 'Semester': '3rd', 'Section': 'A', 'Fee Status': 'Pending - ₹45,000' } },
  { type: 'faculty', name: 'Dr. Vikram Singh', id: 'FAC-001', department: 'Computer Science', details: 'Professor & HOD • Exp: 18 years • Publications: 42', awards: ['Best Researcher 2024'], email: 'vikram.singh@university.edu', phone: '+91-9876543220', joinDate: '2008-07-01', extraInfo: { 'Designation': 'Professor', 'Specialization': 'AI/ML', 'PhD Students': '8', 'Courses': '3' } },
  { type: 'faculty', name: 'Dr. Neha Agarwal', id: 'FAC-012', department: 'Computer Science', details: 'Associate Professor • Exp: 12 years • Publications: 28', awards: [], email: 'neha.agarwal@university.edu', phone: '+91-9876543221', joinDate: '2014-01-15', extraInfo: { 'Designation': 'Associate Professor', 'Specialization': 'Cybersecurity', 'PhD Students': '3', 'Courses': '4' } },
  { type: 'faculty', name: 'Dr. Suresh Patel', id: 'FAC-008', department: 'Electronics', details: 'Professor • Exp: 20 years • Publications: 55', awards: ['UGC Award 2023'], email: 'suresh.patel@university.edu', phone: '+91-9876543222', joinDate: '2006-06-01', extraInfo: { 'Designation': 'Professor', 'Specialization': 'VLSI Design', 'PhD Students': '12' } },
  { type: 'department', name: 'Computer Science', id: 'DEPT-CSE', department: '', details: 'Students: 1200 • Faculty: 35 • Pass Rate: 94% • Placement: 95%', awards: [], extraInfo: { 'HOD': 'Dr. Vikram Singh', 'Programs': '5', 'Labs': '12', 'Research Centers': '2' } },
  { type: 'department', name: 'Electronics', id: 'DEPT-ECE', department: '', details: 'Students: 800 • Faculty: 28 • Pass Rate: 91% • Placement: 82%', awards: [], extraInfo: { 'HOD': 'Dr. Suresh Patel', 'Programs': '4', 'Labs': '10' } },
  { type: 'program', name: 'B.Tech Computer Science', id: 'PROG-BTCS', department: 'Computer Science', details: 'Seats: 180 • Duration: 4 years • Accredited till 2028', awards: [], extraInfo: { 'Total Enrolled': '720', 'Avg CGPA': '8.2', 'Placement Rate': '95%' } },
  { type: 'program', name: 'MBA', id: 'PROG-MBA', department: 'Business Admin', details: 'Seats: 120 • Duration: 2 years • AICTE Approved', awards: [], extraInfo: { 'Total Enrolled': '240', 'Avg CGPA': '7.8', 'Placement Rate': '88%' } },
];

export default function VCGlobalAccess() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState('all');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<SearchResult | null>(null);

  const handleSearch = (query?: string, category?: string) => {
    const q = query ?? searchQuery;
    const cat = category ?? searchCategory;
    setHasSearched(true);
    const results = q
      ? mockSearchResults.filter(r =>
          (r.name.toLowerCase().includes(q.toLowerCase()) ||
          r.id.toLowerCase().includes(q.toLowerCase()) ||
          r.department.toLowerCase().includes(q.toLowerCase()))
        ).filter(r => cat === 'all' || r.type === cat)
      : mockSearchResults.filter(r => cat === 'all' || r.type === cat);
    setSearchResults(results);
    if (results.length === 0) {
      toast({ title: 'No Results', description: `No matches found for "${q}"` });
    }
  };

  const handleQuickLink = (type: string) => {
    setSearchCategory(type);
    setSearchQuery('');
    handleSearch('', type);
  };

  const typeIcons: Record<string, React.ElementType> = {
    student: GraduationCap,
    faculty: Users,
    department: Building2,
    program: BookOpen,
  };

  const typeColors: Record<string, string> = {
    student: 'bg-blue-50 text-blue-700',
    faculty: 'bg-emerald-50 text-emerald-700',
    department: 'bg-purple-50 text-purple-700',
    program: 'bg-amber-50 text-amber-700',
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Global Access</h1>
          <p className="text-muted-foreground">Search and view any record across the institution (read-only)</p>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3">
              <Select value={searchCategory} onValueChange={v => { setSearchCategory(v); if (hasSearched) handleSearch(searchQuery, v); }}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="student">Students</SelectItem>
                  <SelectItem value="faculty">Faculty</SelectItem>
                  <SelectItem value="department">Departments</SelectItem>
                  <SelectItem value="program">Programs</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, ID, department..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <Button onClick={() => handleSearch()} className="gap-2">
                <Search className="h-4 w-4" /> Search
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        {!hasSearched && (
          <div className="grid gap-4 sm:grid-cols-4">
            {[
              { label: 'Student Records', count: '13,900', icon: GraduationCap, color: 'text-blue-600', type: 'student' },
              { label: 'Faculty Records', count: '715', icon: Users, color: 'text-emerald-600', type: 'faculty' },
              { label: 'Departments', count: '8', icon: Building2, color: 'text-purple-600', type: 'department' },
              { label: 'Programs', count: '79', icon: BookOpen, color: 'text-amber-600', type: 'program' },
            ].map(item => (
              <Card key={item.label} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleQuickLink(item.type)}>
                <CardContent className="flex items-center gap-3 p-4">
                  <item.icon className={`h-8 w-8 ${item.color}`} />
                  <div>
                    <p className="text-xl font-bold">{item.count}</p>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Search Results */}
        {hasSearched && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{searchResults.length} results found</p>
              <Button variant="ghost" size="sm" onClick={() => { setHasSearched(false); setSearchQuery(''); setSearchResults([]); setSearchCategory('all'); }}>Clear</Button>
            </div>
            {searchResults.map(result => {
              const TypeIcon = typeIcons[result.type] || FileText;
              return (
                <Card key={result.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="flex items-start gap-4 p-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${typeColors[result.type]}`}>
                      <TypeIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm">{result.name}</p>
                        <Badge variant="outline" className="text-[10px]">{result.type}</Badge>
                        <span className="text-[10px] text-muted-foreground font-mono">{result.id}</span>
                      </div>
                      {result.department && <p className="text-xs text-muted-foreground mb-1">{result.department}</p>}
                      <p className="text-xs text-muted-foreground">{result.details}</p>
                      {result.awards.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {result.awards.map((a: string) => (
                            <Badge key={a} variant="secondary" className="text-[10px] gap-1"><Award className="h-3 w-3" /> {a}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => setSelectedRecord(result)}>
                      <Eye className="h-3 w-3" /> View
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Department Overview Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Department Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Department</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Students</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Faculty</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Pass Rate</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Placement</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Research</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Satisfaction</th>
                  </tr>
                </thead>
                <tbody>
                  {departmentPerformance.map(d => (
                    <tr key={d.department} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedRecord({ type: 'department', name: d.department, id: `DEPT-${d.department.slice(0, 3).toUpperCase()}`, department: '', details: `Students: ${d.studentCount} • Faculty: ${d.facultyCount} • Pass Rate: ${d.passRate}%`, awards: [], extraInfo: { 'Pass Rate': `${d.passRate}%`, 'Placement Rate': `${d.placementRate}%`, 'Research Output': `${d.researchOutput} papers`, 'Satisfaction': `${d.studentSatisfaction}/5`, 'F:S Ratio': `1:${Math.round(d.studentCount / d.facultyCount)}` } })}>
                      <td className="py-2 px-3 font-medium">{d.department}</td>
                      <td className="py-2 px-3 text-right">{d.studentCount}</td>
                      <td className="py-2 px-3 text-right">{d.facultyCount}</td>
                      <td className="py-2 px-3 text-right">{d.passRate}%</td>
                      <td className="py-2 px-3 text-right">{d.placementRate}%</td>
                      <td className="py-2 px-3 text-right">{d.researchOutput}</td>
                      <td className="py-2 px-3 text-right">{d.studentSatisfaction}/5</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Record Detail Dialog */}
        <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedRecord && (() => { const Icon = typeIcons[selectedRecord.type] || FileText; return <Icon className="h-5 w-5 text-primary" />; })()}
                {selectedRecord?.name}
              </DialogTitle>
              <DialogDescription>
                <Badge variant="outline" className="mr-2">{selectedRecord?.type}</Badge>
                {selectedRecord?.id} {selectedRecord?.department && `• ${selectedRecord.department}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{selectedRecord?.details}</p>

              {(selectedRecord?.email || selectedRecord?.phone) && (
                <div className="rounded-lg border p-3 space-y-2">
                  {selectedRecord.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedRecord.email}</span>
                    </div>
                  )}
                  {selectedRecord.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedRecord.phone}</span>
                    </div>
                  )}
                  {selectedRecord.joinDate && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Joined: {new Date(selectedRecord.joinDate).toLocaleDateString('en-IN')}</span>
                    </div>
                  )}
                </div>
              )}

              {selectedRecord?.extraInfo && (
                <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                  <h4 className="font-medium text-sm mb-2">Additional Details</h4>
                  {Object.entries(selectedRecord.extraInfo).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between text-sm border-b border-border/50 pb-1 last:border-0">
                      <span className="text-muted-foreground">{key}</span>
                      <span className="font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              )}

              {selectedRecord?.awards && selectedRecord.awards.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {selectedRecord.awards.map(a => (
                    <Badge key={a} variant="secondary" className="text-xs gap-1"><Award className="h-3 w-3" /> {a}</Badge>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1" onClick={() => toast({ title: 'Exported', description: `Record for ${selectedRecord?.name} exported as PDF.` })}>
                  <Download className="h-3 w-3" /> Export PDF
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

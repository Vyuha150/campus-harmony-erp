import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Search, Eye, GraduationCap, Users, Award, Building2,
  Download, Filter, BookOpen, Briefcase, MapPin, Clock, FileText
} from 'lucide-react';
import { departmentPerformance } from '@/data/vcMockData';

export default function VCGlobalAccess() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState('all');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const mockSearchResults = [
    { type: 'student', name: 'Arjun Reddy', id: 'STD-2024-001', department: 'Computer Science', details: 'B.Tech CSE 3rd Year • CGPA: 8.7 • Attendance: 89%', awards: ['Dean\'s List 2025', 'Hackathon Winner'] },
    { type: 'student', name: 'Priya Sharma', id: 'STD-2024-045', department: 'Electronics', details: 'B.Tech ECE 4th Year • CGPA: 9.1 • Attendance: 94%', awards: ['Gold Medal Candidate', 'Research Paper Published'] },
    { type: 'faculty', name: 'Dr. Vikram Singh', id: 'FAC-001', department: 'Computer Science', details: 'Professor & HOD • Exp: 18 years • Publications: 42', awards: ['Best Researcher 2024'] },
    { type: 'faculty', name: 'Dr. Neha Agarwal', id: 'FAC-012', department: 'Computer Science', details: 'Associate Professor • Exp: 12 years • Publications: 28', awards: [] },
    { type: 'department', name: 'Computer Science', id: 'DEPT-CSE', department: '', details: 'Students: 1200 • Faculty: 35 • Pass Rate: 94% • Placement: 95%', awards: [] },
    { type: 'program', name: 'B.Tech Computer Science', id: 'PROG-BTCS', department: 'Computer Science', details: 'Seats: 180 • Duration: 4 years • Accredited till 2028', awards: [] },
  ];

  const handleSearch = () => {
    setHasSearched(true);
    const results = searchQuery
      ? mockSearchResults.filter(r =>
          r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.department.toLowerCase().includes(searchQuery.toLowerCase())
        ).filter(r => searchCategory === 'all' || r.type === searchCategory)
      : [];
    setSearchResults(results);
    if (results.length === 0 && searchQuery) {
      toast({ title: 'No Results', description: `No matches found for "${searchQuery}"` });
    }
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
              <Select value={searchCategory} onValueChange={setSearchCategory}>
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
              <Button onClick={handleSearch} className="gap-2">
                <Search className="h-4 w-4" /> Search
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        {!hasSearched && (
          <div className="grid gap-4 sm:grid-cols-4">
            {[
              { label: 'Student Records', count: '13,900', icon: GraduationCap, color: 'text-blue-600' },
              { label: 'Faculty Records', count: '715', icon: Users, color: 'text-emerald-600' },
              { label: 'Departments', count: '8', icon: Building2, color: 'text-purple-600' },
              { label: 'Programs', count: '79', icon: BookOpen, color: 'text-amber-600' },
            ].map(item => (
              <Card key={item.label} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setSearchCategory(item.label.split(' ')[0].toLowerCase()); setSearchQuery(''); handleSearch(); }}>
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
              <Button variant="ghost" size="sm" onClick={() => { setHasSearched(false); setSearchQuery(''); setSearchResults([]); }}>Clear</Button>
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
                    <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => toast({ title: 'View Record', description: `Opening full record for ${result.name}...` })}>
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
                    <tr key={d.department} className="border-b hover:bg-muted/30 cursor-pointer">
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
      </div>
    </DashboardLayout>
  );
}

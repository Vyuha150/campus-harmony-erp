import { useState, useEffect } from 'react';
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
import { fetchApi } from '@/lib/apiService';

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

export default function VCGlobalAccess() {
  const [departmentPerformance, setDepartmentPerformance] = useState<any>([]);
  const [globalRecords, setGlobalRecords] = useState<SearchResult[]>([]);
  const [_apiLoading, _setApiLoading] = useState(true);
  useEffect(() => {
    fetchApi('/vc/departmentperformance').then(d => setDepartmentPerformance(d)).catch((error) => { console.error('API request failed', error); });
    fetchApi('/vc/global-access-records').then(d => setGlobalRecords(d)).catch((error) => { console.error('API request failed', error); });
    _setApiLoading(false);
  }, []);

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
      ? globalRecords.filter(r =>
          (r.name.toLowerCase().includes(q.toLowerCase()) ||
          r.id.toLowerCase().includes(q.toLowerCase()) ||
          r.department.toLowerCase().includes(q.toLowerCase()))
        ).filter(r => cat === 'all' || r.type === cat)
      : globalRecords.filter(r => cat === 'all' || r.type === cat);
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
              { label: 'Student Records', count: globalRecords.filter(r => r.type === 'student').length.toLocaleString(), icon: GraduationCap, color: 'text-blue-600', type: 'student' },
              { label: 'Faculty Records', count: globalRecords.filter(r => r.type === 'faculty').length.toLocaleString(), icon: Users, color: 'text-emerald-600', type: 'faculty' },
              { label: 'Departments', count: globalRecords.filter(r => r.type === 'department').length.toLocaleString(), icon: Building2, color: 'text-purple-600', type: 'department' },
              { label: 'Programs', count: globalRecords.filter(r => r.type === 'program').length.toLocaleString(), icon: BookOpen, color: 'text-amber-600', type: 'program' },
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

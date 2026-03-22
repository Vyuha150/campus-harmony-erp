import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Download, Eye, Users, MapPin, Briefcase, Globe, RefreshCw } from 'lucide-react';
import { fetchApi, postApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';

export default function AlumniDirectory() {
  const { toast } = useToast();
  const [alumniProfiles, setAlumniProfiles] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState('all');
  const [programFilter, setProgramFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<any | null>(null);
  const [isSyncingGraduates, setIsSyncingGraduates] = useState(false);

  const loadDirectory = async () => {
    const rows = await fetchApi<any[]>('/alumni/directory');
    setAlumniProfiles(Array.isArray(rows) ? rows : []);
  };

  useEffect(() => {
    loadDirectory().catch((error) => {
      console.error('API request failed', error);
      toast({ title: 'Unable to load directory', description: error?.message || 'Please retry', variant: 'destructive' });
    });
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSelectedDetails(null);
      return;
    }
    fetchApi(`/alumni/directory/${selectedId}`)
      .then((d) => setSelectedDetails(d))
      .catch((error) => {
        console.error('API request failed', error);
        toast({ title: 'Unable to load profile details', description: error?.message || 'Please retry', variant: 'destructive' });
      });
  }, [selectedId]);

  const batchOptions = Array.from(new Set<string>(alumniProfiles.map((a: any) => String(a.graduationYear || '')).filter(Boolean))).sort((a, b) => Number(b) - Number(a));
  const programOptions = Array.from(new Set<string>(alumniProfiles.map((a: any) => String(a.program || '')).filter(Boolean))).sort();

  const stats = useMemo(() => {
    const totalAlumni = alumniProfiles.length;
    const withCompany = alumniProfiles.filter((a) => String(a.currentCompany || '').trim().length > 0).length;
    const countries = new Set(
      alumniProfiles
        .map((a) => String(a.currentLocation || '').split(',').pop()?.trim())
        .filter(Boolean)
    ).size;
    const programs = new Set(alumniProfiles.map((a) => String(a.program || '')).filter(Boolean)).size;
    return { totalAlumni, withCompany, countries, programs };
  }, [alumniProfiles]);

  const filtered = useMemo(() => {
    return alumniProfiles.filter((a) => {
      const matchSearch = String(a.name || '').toLowerCase().includes(search.toLowerCase())
        || String(a.email || '').toLowerCase().includes(search.toLowerCase())
        || String(a.currentCompany || '').toLowerCase().includes(search.toLowerCase());
      const matchBatch = batchFilter === 'all' || String(a.graduationYear) === batchFilter;
      const matchProgram = programFilter === 'all' || String(a.program) === programFilter;
      return matchSearch && matchBatch && matchProgram;
    });
  }, [alumniProfiles, search, batchFilter, programFilter]);

  const exportCsv = () => {
    const rows = filtered.map((a: any) => [
      a.name,
      a.email,
      a.program,
      a.graduationYear,
      a.currentCompany || '',
      a.currentRole || '',
      a.currentLocation || '',
      a.linkedIn || '',
    ]);
    const csv = ['name,email,program,graduationYear,currentCompany,currentRole,currentLocation,linkedIn', ...rows.map((r: any[]) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'alumni-directory.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const syncGraduatedStudents = async () => {
    setIsSyncingGraduates(true);
    try {
      const result = await postApi<{ eligibleCount: number; createdCount: number; skippedCount: number }>(
        '/alumni/directory/sync-graduates',
        {}
      );
      toast({
        title: 'Alumni sync completed',
        description: `Created ${result.createdCount} profiles from ${result.eligibleCount} eligible students.`,
      });
      await loadDirectory();
    } catch (error: any) {
      console.error('API request failed', error);
      toast({
        title: 'Sync failed',
        description: error?.message || 'Please retry',
        variant: 'destructive',
      });
    } finally {
      setIsSyncingGraduates(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Alumni Directory</h1>
            <p className="text-muted-foreground">Search and manage alumni profiles from the live API directory</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={syncGraduatedStudents} disabled={isSyncingGraduates}>
              <Users className="mr-2 h-4 w-4" />
              {isSyncingGraduates ? 'Syncing...' : 'Sync Graduated Students'}
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Export</Button>
            <Button size="sm" onClick={loadDirectory}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{stats.totalAlumni.toLocaleString('en-IN')}</p><p className="text-xs text-muted-foreground">Total Alumni</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">{stats.withCompany.toLocaleString('en-IN')}</p><p className="text-xs text-muted-foreground">With Company Data</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{stats.countries.toLocaleString('en-IN')}</p><p className="text-xs text-muted-foreground">Countries</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{stats.programs.toLocaleString('en-IN')}</p><p className="text-xs text-muted-foreground">Programs</p></CardContent></Card>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name, email, company..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={batchFilter} onValueChange={setBatchFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Batch" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Batches</SelectItem>
              {batchOptions.map((batch) => (
                <SelectItem key={batch} value={batch}>{batch}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={programFilter} onValueChange={setProgramFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Program" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Programs</SelectItem>
              {programOptions.map((program) => (
                <SelectItem key={program} value={program}>{program}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            {filtered.map((a) => (
              <Card key={a.id} className={`cursor-pointer transition-colors ${selectedId === a.id ? 'ring-2 ring-primary' : 'hover:bg-muted/30'}`} onClick={() => setSelectedId(a.id)}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">{String(a.name || 'A').slice(0, 1)}</div>
                    <div>
                      <p className="font-semibold text-foreground">{a.name}</p>
                      <p className="text-sm text-muted-foreground">{a.currentRole || 'Role N/A'} at {a.currentCompany || 'Company N/A'}</p>
                      <p className="text-xs text-muted-foreground">{a.program || 'Program N/A'} • Batch {a.graduationYear || 'N/A'}</p>
                    </div>
                  </div>
                  <Badge variant={a.currentCompany ? 'default' : 'secondary'}>{a.currentCompany ? 'active' : 'basic'}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>

          <div>
            {selectedDetails ? (
              <Card>
                <CardHeader><CardTitle className="flex items-center justify-between"><span>{selectedDetails.user?.name || 'Alumni Profile'}</span><Button variant="outline" size="sm" onClick={() => setSelectedId(selectedDetails.id)}><Eye className="mr-1 h-3 w-3" />Reload</Button></CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Email:</span><p className="font-medium text-foreground">{selectedDetails.user?.email || 'N/A'}</p></div>
                    <div><span className="text-muted-foreground">Program:</span><p className="font-medium text-foreground">{selectedDetails.program || 'N/A'}</p></div>
                    <div><span className="text-muted-foreground">Batch:</span><p className="font-medium text-foreground">{selectedDetails.graduationYear || 'N/A'}</p></div>
                  </div>
                  <div className="border-t pt-3">
                    <h4 className="mb-2 text-sm font-semibold text-foreground">Current Position</h4>
                    <p className="text-sm text-foreground"><Briefcase className="mr-1 inline h-3 w-3" />{selectedDetails.currentRole || 'Role N/A'} at {selectedDetails.currentCompany || 'Company N/A'}</p>
                    <p className="text-sm text-muted-foreground"><MapPin className="mr-1 inline h-3 w-3" />{selectedDetails.currentLocation || 'Location N/A'}</p>
                  </div>
                  {selectedDetails.linkedIn && <a href={selectedDetails.linkedIn} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline"><Globe className="mr-1 inline h-3 w-3" />View LinkedIn Profile</a>}
                  <Button variant="outline" size="sm" className="w-full" onClick={loadDirectory}><Users className="mr-1 h-3 w-3" />Refresh Directory</Button>
                </CardContent>
              </Card>
            ) : (
              <Card><CardContent className="p-8 text-center text-muted-foreground">Select an alumni to view API-backed details</CardContent></Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

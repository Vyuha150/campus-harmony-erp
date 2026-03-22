import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, Plus, RefreshCw } from 'lucide-react';
import { deleteApi, fetchApi, postApi } from '@/lib/apiService';
import { toast } from '@/hooks/use-toast';

type Team = { id: string; sport: string; category: string };
type AttendanceRecord = {
  id: string;
  teamId: string;
  date: string;
  attendees?: unknown;
  notes?: string | null;
  sessionType?: string;
};

export default function SportsAttendance() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    teamId: '',
    sessionType: 'training',
    date: new Date().toISOString().slice(0, 10),
    attendeesCsv: '',
    notes: ''
  });

  const formatTeamLabel = (team: Team) => {
    const category = String(team.category || '').trim();
    return category ? `${team.sport} (${category})` : team.sport;
  };

  const loadData = async (teamId?: string) => {
    try {
      setIsLoading(true);
      const [attendanceData, teamData] = await Promise.all([
        fetchApi<AttendanceRecord[]>(teamId ? `/sports/attendance?teamId=${teamId}` : '/sports/attendance'),
        fetchApi<Team[]>('/sports/teams')
      ]);
      setRecords(attendanceData);
      setTeams(teamData);
    } catch (error: any) {
      toast({ title: 'Failed to load attendance', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedTeamId === 'all') {
      loadData();
      return;
    }
    loadData(selectedTeamId);
  }, [selectedTeamId]);

  const teamMap = useMemo(() => {
    return new Map(teams.map((team) => [team.id, formatTeamLabel(team)]));
  }, [teams]);

  const presentCount = records.reduce((sum, record) => {
    const attendees = Array.isArray(record.attendees) ? record.attendees : [];
    return sum + attendees.length;
  }, 0);

  const createAttendanceRecord = async () => {
    if (!form.teamId) {
      toast({ title: 'Team is required', description: 'Please select a team.', variant: 'destructive' });
      return;
    }

    try {
      setIsLoading(true);
      await postApi('/sports/attendance', {
        teamId: form.teamId,
        sessionType: form.sessionType,
        date: new Date(form.date),
        attendees: form.attendeesCsv
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        notes: form.notes.trim() || null
      });

      setIsCreateOpen(false);
      setForm({
        teamId: '',
        sessionType: 'training',
        date: new Date().toISOString().slice(0, 10),
        attendeesCsv: '',
        notes: ''
      });
      await loadData(selectedTeamId === 'all' ? undefined : selectedTeamId);
      toast({ title: 'Attendance saved', description: 'Attendance session recorded successfully.' });
    } catch (error: any) {
      toast({ title: 'Save failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteAttendanceRecord = async (record: AttendanceRecord) => {
    if (!window.confirm('Delete this attendance record?')) return;
    try {
      await deleteApi(`/sports/attendance/${record.id}`);
      setRecords((prev) => prev.filter((item) => item.id !== record.id));
      toast({ title: 'Record deleted', description: 'Attendance record removed successfully.' });
    } catch (error: any) {
      toast({ title: 'Delete failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Attendance Tracking</h1>
            <p className="text-muted-foreground">Team-wise attendance sessions aligned with sports API records</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => loadData(selectedTeamId === 'all' ? undefined : selectedTeamId)} disabled={isLoading}>
              <RefreshCw className="mr-2 h-4 w-4" />Refresh
            </Button>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-2 h-4 w-4" />New Session</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Create Attendance Session</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-2">
                  <div>
                    <Label>Team</Label>
                    <select
                      className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={form.teamId}
                      onChange={(event) => setForm((prev) => ({ ...prev, teamId: event.target.value }))}
                    >
                      <option value="">Select team</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>{formatTeamLabel(team)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Session Type</Label>
                    <Input value={form.sessionType} onChange={(event) => setForm((prev) => ({ ...prev, sessionType: event.target.value }))} />
                  </div>
                  <div>
                    <Label>Date</Label>
                    <Input type="date" value={form.date} onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))} />
                  </div>
                  <div>
                    <Label>Attendee IDs (comma separated)</Label>
                    <Input value={form.attendeesCsv} onChange={(event) => setForm((prev) => ({ ...prev, attendeesCsv: event.target.value }))} />
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
                  </div>
                  <Button onClick={createAttendanceRecord} disabled={isLoading}>Save Attendance</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{records.length}</p><p className="text-xs text-muted-foreground">Sessions Logged</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{teams.length}</p><p className="text-xs text-muted-foreground">Total Teams</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">{presentCount}</p><p className="text-xs text-muted-foreground">Total Attendee Entries</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Attendance Records</span>
              <select
                className="rounded-md border bg-background px-2 py-1 text-sm"
                value={selectedTeamId}
                onChange={(event) => setSelectedTeamId(event.target.value)}
              >
                <option value="all">All teams</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>{formatTeamLabel(team)}</option>
                ))}
              </select>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Team</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Attendees</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Notes</th>
                  <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Actions</th>
                </tr></thead>
                <tbody>
                  {records.map((record) => {
                    const attendees = Array.isArray(record.attendees) ? record.attendees : [];
                    return (
                      <tr key={record.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3 text-sm font-medium text-foreground">{teamMap.get(record.teamId) || record.teamId}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground"><Calendar className="mr-1 inline h-3 w-3" />{new Date(record.date).toLocaleDateString('en-IN')}</td>
                        <td className="px-4 py-3"><Badge variant="outline" className="capitalize">{record.sessionType || 'training'}</Badge></td>
                        <td className="px-4 py-3 text-center text-sm text-foreground">{attendees.length}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{record.notes || '-'}</td>
                        <td className="px-4 py-3"><Button variant="destructive" size="sm" onClick={() => deleteAttendanceRecord(record)}>Delete</Button></td>
                      </tr>
                    );
                  })}
                  {records.length === 0 && (
                    <tr>
                      <td className="px-4 py-8 text-center text-sm text-muted-foreground" colSpan={6}>No attendance records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, Users, Calendar, MapPin, Plus, Edit, Clock, Swords } from 'lucide-react';
import { deleteApi, fetchApi, postApi, putApi } from '@/lib/apiService';
import { toast } from '@/hooks/use-toast';

export default function SportsTeams() {
  const [sportsTeams, setSportsTeams] = useState<any>([]);
  const [_apiLoading, _setApiLoading] = useState(true);
  const [isAddPlayerOpen, setIsAddPlayerOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isFixtureOpen, setIsFixtureOpen] = useState(false);
  const [form, setForm] = useState({
    sport: '',
    category: 'men',
    level: 'university',
    coach: '',
    season: ''
  });
  const [playerForm, setPlayerForm] = useState({
    studentId: '',
    studentName: '',
    rollNumber: '',
    position: '',
    jerseyNumber: '',
    status: 'regular'
  });
  const [scheduleForm, setScheduleForm] = useState({
    type: 'training',
    date: new Date().toISOString().slice(0, 10),
    startTime: '06:00',
    endTime: '08:00',
    venue: '',
    coach: ''
  });
  const [fixtureForm, setFixtureForm] = useState({
    opponent: '',
    type: 'league',
    homeAway: 'home',
    date: new Date().toISOString().slice(0, 10),
    venue: ''
  });
  const [captainName, setCaptainName] = useState('');

  const loadTeams = async () => {
    try {
      const data = await fetchApi('/sports/teams');
      setSportsTeams(data);
    } catch (error) {
      console.error('API request failed', error);
      toast({ title: 'Failed to load teams', description: String((error as any)?.message || 'Please retry.'), variant: 'destructive' });
    } finally {
      _setApiLoading(false);
    }
  };

  useEffect(() => {
    loadTeams();
  }, []);

  const [selectedTeam, setSelectedTeam] = useState<string | null>(sportsTeams[0]?.id || null);
  const team = sportsTeams.find(t => t.id === selectedTeam);

  const categoryLabel = (category?: string) => {
    const value = String(category || '').trim().toLowerCase();
    if (value === 'men') return "Men's";
    if (value === 'women') return "Women's";
    if (value === 'mixed') return 'Mixed';
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Open';
  };

  useEffect(() => {
    setCaptainName((team?.captain || '').trim());
  }, [team?.id, team?.captain]);

  const toTeamPayload = (item: any) => ({
    sport: item.sport,
    category: item.category,
    level: item.level,
    coach: item.coach,
    captain: item.captain || null,
    members: Array.isArray(item.members) ? item.members : [],
    practiceSchedule: Array.isArray(item.practiceSchedule) ? item.practiceSchedule : [],
    upcomingMatches: Array.isArray(item.upcomingMatches) ? item.upcomingMatches : [],
    season: item.season,
    status: item.status || 'active'
  });

  const createTeam = async () => {
    if (!form.sport.trim() || !form.coach.trim() || !form.season.trim()) {
      toast({ title: 'Missing fields', description: 'Sport, coach, and season are required.', variant: 'destructive' });
      return;
    }
    try {
      const created = await postApi('/sports/teams', {
        sport: form.sport.trim(),
        category: form.category,
        level: form.level,
        coach: form.coach.trim(),
        season: form.season.trim(),
        members: [],
        practiceSchedule: [],
        upcomingMatches: [],
        status: 'active'
      });
      setSportsTeams((prev: any[]) => [created, ...prev]);
      setSelectedTeam(created.id);
      setForm({ sport: '', category: 'men', level: 'university', coach: '', season: '' });
      toast({ title: 'Team created', description: 'Sports team created successfully.' });
    } catch (error: any) {
      toast({ title: 'Create failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    }
  };

  const toggleTeamStatus = async () => {
    if (!team) return;
    try {
      const nextStatus = team.status === 'active' ? 'off_season' : 'active';
      const updated = await putApi(`/sports/teams/${team.id}`, { ...toTeamPayload(team), status: nextStatus });
      setSportsTeams((prev: any[]) => prev.map((item) => item.id === team.id ? updated : item));
      toast({ title: 'Team updated', description: `Team marked as ${nextStatus}.` });
    } catch (error: any) {
      toast({ title: 'Update failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    }
  };

  const updateCaptain = async () => {
    if (!team) return;
    const captain = captainName.trim();
    try {
      const updated = await putApi(`/sports/teams/${team.id}`, {
        ...toTeamPayload(team),
        captain: captain || null
      });
      setSportsTeams((prev: any[]) => prev.map((item) => item.id === team.id ? updated : item));
      setCaptainName(captain);
      toast({ title: 'Captain updated', description: captain ? 'Team captain saved successfully.' : 'Team captain cleared.' });
    } catch (error: any) {
      toast({ title: 'Update failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    }
  };

  const addPlayer = async () => {
    if (!team) return;
    if (!playerForm.studentName.trim() || !playerForm.rollNumber.trim()) {
      toast({ title: 'Missing fields', description: 'Player name and roll number are required.', variant: 'destructive' });
      return;
    }
    try {
      const members = Array.isArray(team.members) ? team.members : [];
      const updated = await putApi(`/sports/teams/${team.id}`, {
        ...toTeamPayload(team),
        members: [
          ...members,
          {
            id: crypto.randomUUID(),
            studentId: playerForm.studentId.trim() || playerForm.rollNumber.trim(),
            studentName: playerForm.studentName.trim(),
            rollNumber: playerForm.rollNumber.trim(),
            position: playerForm.position.trim() || 'player',
            jerseyNumber: playerForm.jerseyNumber ? Number(playerForm.jerseyNumber) : null,
            status: playerForm.status
          }
        ]
      });
      setSportsTeams((prev: any[]) => prev.map((item) => item.id === team.id ? updated : item));
      setPlayerForm({ studentId: '', studentName: '', rollNumber: '', position: '', jerseyNumber: '', status: 'regular' });
      setIsAddPlayerOpen(false);
      toast({ title: 'Player added', description: 'Team roster updated successfully.' });
    } catch (error: any) {
      toast({ title: 'Add failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    }
  };

  const scheduleSession = async () => {
    if (!team) return;
    if (!scheduleForm.venue.trim()) {
      toast({ title: 'Venue required', description: 'Please provide a practice venue.', variant: 'destructive' });
      return;
    }
    try {
      const schedule = Array.isArray(team.practiceSchedule) ? team.practiceSchedule : [];
      const updated = await putApi(`/sports/teams/${team.id}`, {
        ...toTeamPayload(team),
        practiceSchedule: [
          ...schedule,
          {
            id: crypto.randomUUID(),
            type: scheduleForm.type,
            date: scheduleForm.date,
            startTime: scheduleForm.startTime,
            endTime: scheduleForm.endTime,
            venue: scheduleForm.venue.trim(),
            coach: scheduleForm.coach.trim() || team.coach
          }
        ]
      });
      setSportsTeams((prev: any[]) => prev.map((item) => item.id === team.id ? updated : item));
      setScheduleForm({ type: 'training', date: new Date().toISOString().slice(0, 10), startTime: '06:00', endTime: '08:00', venue: '', coach: '' });
      setIsScheduleOpen(false);
      toast({ title: 'Session scheduled', description: 'Practice session added successfully.' });
    } catch (error: any) {
      toast({ title: 'Schedule failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    }
  };

  const addFixture = async () => {
    if (!team) return;
    if (!fixtureForm.opponent.trim() || !fixtureForm.venue.trim()) {
      toast({ title: 'Missing fields', description: 'Opponent and venue are required.', variant: 'destructive' });
      return;
    }
    try {
      const fixtures = Array.isArray(team.upcomingMatches) ? team.upcomingMatches : [];
      const updated = await putApi(`/sports/teams/${team.id}`, {
        ...toTeamPayload(team),
        upcomingMatches: [
          ...fixtures,
          {
            id: crypto.randomUUID(),
            opponent: fixtureForm.opponent.trim(),
            type: fixtureForm.type,
            homeAway: fixtureForm.homeAway,
            date: fixtureForm.date,
            venue: fixtureForm.venue.trim(),
            status: 'scheduled'
          }
        ]
      });
      setSportsTeams((prev: any[]) => prev.map((item) => item.id === team.id ? updated : item));
      setFixtureForm({ opponent: '', type: 'league', homeAway: 'home', date: new Date().toISOString().slice(0, 10), venue: '' });
      setIsFixtureOpen(false);
      toast({ title: 'Fixture added', description: 'New fixture saved successfully.' });
    } catch (error: any) {
      toast({ title: 'Add failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    }
  };

  const markSessionAttendance = async () => {
    if (!team) return;
    try {
      const attendees = (Array.isArray(team.members) ? team.members : []).map((member: any) => ({
        studentId: member.studentId || member.rollNumber,
        studentName: member.studentName || 'Player',
        rollNumber: member.rollNumber || '-',
        status: 'present'
      }));
      await postApi('/sports/attendance', {
        teamId: team.id,
        date: new Date(),
        sessionType: 'training',
        attendees,
        notes: 'Marked from Team Management module.'
      });
      toast({ title: 'Attendance marked', description: 'Team attendance entry created successfully.' });
    } catch (error: any) {
      toast({ title: 'Attendance failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    }
  };

  const updateFixtureStatus = async (fixtureId: string) => {
    if (!team) return;
    try {
      const fixtures = Array.isArray(team.upcomingMatches) ? team.upcomingMatches : [];
      const updatedFixtures = fixtures.map((match: any) => {
        if (match.id !== fixtureId) return match;
        const current = match.status || 'scheduled';
        if (current === 'scheduled') return { ...match, status: 'live' };
        if (current === 'live') {
          return {
            ...match,
            status: 'completed',
            result: match.result || { ourScore: 0, opponentScore: 0 }
          };
        }
        return { ...match, status: 'scheduled', result: null };
      });

      const updated = await putApi(`/sports/teams/${team.id}`, {
        ...toTeamPayload(team),
        upcomingMatches: updatedFixtures
      });
      setSportsTeams((prev: any[]) => prev.map((item) => item.id === team.id ? updated : item));
      toast({ title: 'Fixture updated', description: 'Fixture status cycled successfully.' });
    } catch (error: any) {
      toast({ title: 'Update failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    }
  };

  const deleteTeam = async () => {
    if (!team) return;
    if (!window.confirm(`Delete ${team.sport} ${team.category} team?`)) return;
    try {
      await deleteApi(`/sports/teams/${team.id}`);
      setSportsTeams((prev: any[]) => prev.filter((item) => item.id !== team.id));
      setSelectedTeam(null);
      toast({ title: 'Team deleted', description: 'Team removed successfully.' });
    } catch (error: any) {
      toast({ title: 'Delete failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Team Management</h1>
            <p className="text-muted-foreground">Rosters, practice schedules, and game fixtures</p>
          </div>
          <Dialog>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Create Team</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create New Team</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div><Label>Sport</Label><Input placeholder="e.g. Cricket" value={form.sport} onChange={(e) => setForm((prev) => ({ ...prev, sport: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Category</Label><Select value={form.category} onValueChange={(value) => setForm((prev) => ({ ...prev, category: value }))}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent><SelectItem value="men">Men</SelectItem><SelectItem value="women">Women</SelectItem><SelectItem value="mixed">Mixed</SelectItem></SelectContent></Select></div>
                  <div><Label>Level</Label><Select value={form.level} onValueChange={(value) => setForm((prev) => ({ ...prev, level: value }))}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent><SelectItem value="university">University</SelectItem><SelectItem value="varsity">Varsity</SelectItem><SelectItem value="junior">Junior</SelectItem></SelectContent></Select></div>
                </div>
                <div><Label>Coach</Label><Input placeholder="Coach name" value={form.coach} onChange={(e) => setForm((prev) => ({ ...prev, coach: e.target.value }))} /></div>
                <div><Label>Season</Label><Input placeholder="e.g. 2025-26" value={form.season} onChange={(e) => setForm((prev) => ({ ...prev, season: e.target.value }))} /></div>
                <Button className="w-full" onClick={createTeam}>Create Team</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Teams grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sportsTeams.map(t => (
            <Card key={t.id} className={`cursor-pointer transition-all ${selectedTeam === t.id ? 'ring-2 ring-primary' : 'hover:shadow-md'}`} onClick={() => setSelectedTeam(t.id)}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Trophy className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{t.sport}</h3>
                      <p className="text-xs text-muted-foreground">{categoryLabel(t.category)} • {t.level || 'general'}</p>
                    </div>
                  </div>
                  <Badge variant={t.status === 'active' ? 'default' : 'secondary'} className="capitalize">{t.status}</Badge>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>Coach: {t.coach}</p>
                  {t.captain && <p>©️ Captain: {t.captain}</p>}
                  <p><Users className="inline h-3 w-3 mr-1" />{(Array.isArray(t.members) ? t.members.length : 0)} members • Season: {t.season}</p>
                </div>
                <div className="mt-3 flex gap-2">
                  {(Array.isArray(t.upcomingMatches) ? t.upcomingMatches.length : 0) > 0 && <Badge variant="outline"><Swords className="mr-1 h-3 w-3" />{(Array.isArray(t.upcomingMatches) ? t.upcomingMatches.length : 0)} upcoming</Badge>}
                  {(Array.isArray(t.practiceSchedule) ? t.practiceSchedule.length : 0) > 0 && <Badge variant="outline"><Clock className="mr-1 h-3 w-3" />{(Array.isArray(t.practiceSchedule) ? t.practiceSchedule.length : 0)} sessions</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Selected team detail */}
        {team && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{team.sport} - {categoryLabel(team.category)} Team</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={toggleTeamStatus}><Edit className="mr-1 h-3 w-3" />Toggle Status</Button>
                  <Button variant="destructive" size="sm" onClick={deleteTeam}>Delete</Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="w-full sm:max-w-xs">
                  <Label htmlFor="team-captain">Captain</Label>
                  <Input
                    id="team-captain"
                    placeholder="Captain name"
                    value={captainName}
                    onChange={(e) => setCaptainName(e.target.value)}
                  />
                </div>
                <Button variant="outline" size="sm" onClick={updateCaptain}>Save Captain</Button>
              </div>
              <Tabs defaultValue="roster">
                <TabsList>
                  <TabsTrigger value="roster">Roster ({(Array.isArray(team.members) ? team.members.length : 0)})</TabsTrigger>
                  <TabsTrigger value="schedule">Practice Schedule</TabsTrigger>
                  <TabsTrigger value="fixtures">Fixtures & Results</TabsTrigger>
                </TabsList>

                <TabsContent value="roster" className="mt-4">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead><tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Player</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Roll No</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Position</th>
                        <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Jersey #</th>
                        <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
                      </tr></thead>
                      <tbody>
                        {(Array.isArray(team.members) ? team.members : []).map((m, i) => (
                          <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="px-4 py-3 text-sm font-medium text-foreground">{m.studentName}</td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">{m.rollNumber}</td>
                            <td className="px-4 py-3 text-sm text-foreground">{m.position}</td>
                            <td className="px-4 py-3 text-center text-sm text-foreground">{m.jerseyNumber ?? '–'}</td>
                            <td className="px-4 py-3"><Badge variant={m.status === 'regular' ? 'default' : m.status === 'injured' ? 'destructive' : 'secondary'} className="capitalize">{m.status}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => setIsAddPlayerOpen(true)}><Plus className="mr-1 h-3 w-3" />Add Player</Button>
                </TabsContent>

                <TabsContent value="schedule" className="mt-4 space-y-3">
                  {(Array.isArray(team.practiceSchedule) ? team.practiceSchedule.length : 0) > 0 ? (Array.isArray(team.practiceSchedule) ? team.practiceSchedule : []).map(ps => (
                    <Card key={ps.id}><CardContent className="flex items-center justify-between p-4">
                      <div>
                        <p className="text-sm font-medium text-foreground capitalize">{ps.type} Session</p>
                        <p className="text-xs text-muted-foreground"><Calendar className="inline h-3 w-3 mr-1" />{new Date(ps.date).toLocaleDateString('en-IN')} • {ps.startTime} – {ps.endTime}</p>
                        <p className="text-xs text-muted-foreground"><MapPin className="inline h-3 w-3 mr-1" />{ps.venue} • Coach: {ps.coach}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={markSessionAttendance}>Mark Attendance</Button>
                    </CardContent></Card>
                  )) : <p className="text-sm text-muted-foreground">No practice sessions scheduled.</p>}
                  <Button variant="outline" size="sm" onClick={() => setIsScheduleOpen(true)}><Plus className="mr-1 h-3 w-3" />Schedule Session</Button>
                </TabsContent>

                <TabsContent value="fixtures" className="mt-4 space-y-3">
                  {(Array.isArray(team.upcomingMatches) ? team.upcomingMatches.length : 0) > 0 ? (Array.isArray(team.upcomingMatches) ? team.upcomingMatches : []).map(m => (
                    <Card key={m.id}><CardContent className="flex items-center justify-between p-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">vs {m.opponent}</p>
                        <p className="text-xs text-muted-foreground capitalize"><Swords className="inline h-3 w-3 mr-1" />{m.type} • {m.homeAway}</p>
                        <p className="text-xs text-muted-foreground"><Calendar className="inline h-3 w-3 mr-1" />{new Date(m.date).toLocaleDateString('en-IN')} • <MapPin className="inline h-3 w-3 mr-1" />{m.venue}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={m.status === 'completed' ? 'default' : m.status === 'live' ? 'destructive' : 'secondary'} className="capitalize">{m.status}</Badge>
                        {m.status === 'completed' && m.result && <span className="text-sm font-semibold text-foreground">{m.result.ourScore}–{m.result.opponentScore}</span>}
                        <Button variant="outline" size="sm" onClick={() => updateFixtureStatus(m.id)}>Update</Button>
                      </div>
                    </CardContent></Card>
                  )) : <p className="text-sm text-muted-foreground">No upcoming fixtures.</p>}
                  <Button variant="outline" size="sm" onClick={() => setIsFixtureOpen(true)}><Plus className="mr-1 h-3 w-3" />Add Fixture</Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        <Dialog open={isAddPlayerOpen} onOpenChange={setIsAddPlayerOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add Team Player</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Student ID</Label><Input value={playerForm.studentId} onChange={(e) => setPlayerForm((prev) => ({ ...prev, studentId: e.target.value }))} /></div>
                <div><Label>Roll Number</Label><Input value={playerForm.rollNumber} onChange={(e) => setPlayerForm((prev) => ({ ...prev, rollNumber: e.target.value }))} /></div>
              </div>
              <div><Label>Player Name</Label><Input value={playerForm.studentName} onChange={(e) => setPlayerForm((prev) => ({ ...prev, studentName: e.target.value }))} /></div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>Position</Label><Input value={playerForm.position} onChange={(e) => setPlayerForm((prev) => ({ ...prev, position: e.target.value }))} /></div>
                <div><Label>Jersey #</Label><Input type="number" value={playerForm.jerseyNumber} onChange={(e) => setPlayerForm((prev) => ({ ...prev, jerseyNumber: e.target.value }))} /></div>
                <div><Label>Status</Label><Select value={playerForm.status} onValueChange={(value) => setPlayerForm((prev) => ({ ...prev, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="regular">Regular</SelectItem><SelectItem value="reserve">Reserve</SelectItem><SelectItem value="injured">Injured</SelectItem></SelectContent></Select></div>
              </div>
              <Button onClick={addPlayer}>Save Player</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Schedule Practice Session</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Type</Label><Select value={scheduleForm.type} onValueChange={(value) => setScheduleForm((prev) => ({ ...prev, type: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="training">Training</SelectItem><SelectItem value="fitness">Fitness</SelectItem><SelectItem value="strategy">Strategy</SelectItem></SelectContent></Select></div>
                <div><Label>Date</Label><Input type="date" value={scheduleForm.date} onChange={(e) => setScheduleForm((prev) => ({ ...prev, date: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Start</Label><Input type="time" value={scheduleForm.startTime} onChange={(e) => setScheduleForm((prev) => ({ ...prev, startTime: e.target.value }))} /></div>
                <div><Label>End</Label><Input type="time" value={scheduleForm.endTime} onChange={(e) => setScheduleForm((prev) => ({ ...prev, endTime: e.target.value }))} /></div>
              </div>
              <div><Label>Venue</Label><Input value={scheduleForm.venue} onChange={(e) => setScheduleForm((prev) => ({ ...prev, venue: e.target.value }))} /></div>
              <div><Label>Coach</Label><Input value={scheduleForm.coach} onChange={(e) => setScheduleForm((prev) => ({ ...prev, coach: e.target.value }))} /></div>
              <Button onClick={scheduleSession}>Save Session</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isFixtureOpen} onOpenChange={setIsFixtureOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add Fixture</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div><Label>Opponent</Label><Input value={fixtureForm.opponent} onChange={(e) => setFixtureForm((prev) => ({ ...prev, opponent: e.target.value }))} /></div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>Type</Label><Select value={fixtureForm.type} onValueChange={(value) => setFixtureForm((prev) => ({ ...prev, type: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="league">League</SelectItem><SelectItem value="friendly">Friendly</SelectItem><SelectItem value="knockout">Knockout</SelectItem></SelectContent></Select></div>
                <div><Label>Home/Away</Label><Select value={fixtureForm.homeAway} onValueChange={(value) => setFixtureForm((prev) => ({ ...prev, homeAway: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="home">Home</SelectItem><SelectItem value="away">Away</SelectItem></SelectContent></Select></div>
                <div><Label>Date</Label><Input type="date" value={fixtureForm.date} onChange={(e) => setFixtureForm((prev) => ({ ...prev, date: e.target.value }))} /></div>
              </div>
              <div><Label>Venue</Label><Input value={fixtureForm.venue} onChange={(e) => setFixtureForm((prev) => ({ ...prev, venue: e.target.value }))} /></div>
              <Button onClick={addFixture}>Save Fixture</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

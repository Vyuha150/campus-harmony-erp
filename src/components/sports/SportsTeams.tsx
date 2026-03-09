import { useState } from 'react';
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
import { sportsTeams } from '@/data/sportsMockData';

export default function SportsTeams() {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(sportsTeams[0]?.id || null);
  const team = sportsTeams.find(t => t.id === selectedTeam);

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
                <div><Label>Sport</Label><Input placeholder="e.g. Cricket" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Category</Label><Select><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent><SelectItem value="men">Men</SelectItem><SelectItem value="women">Women</SelectItem><SelectItem value="mixed">Mixed</SelectItem></SelectContent></Select></div>
                  <div><Label>Level</Label><Select><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent><SelectItem value="university">University</SelectItem><SelectItem value="varsity">Varsity</SelectItem><SelectItem value="junior">Junior</SelectItem></SelectContent></Select></div>
                </div>
                <div><Label>Coach</Label><Input placeholder="Coach name" /></div>
                <div><Label>Season</Label><Input placeholder="e.g. 2025-26" /></div>
                <Button className="w-full">Create Team</Button>
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
                      <p className="text-xs text-muted-foreground capitalize">{t.category === 'men' ? "Men's" : t.category === 'women' ? "Women's" : "Mixed"} • {t.level}</p>
                    </div>
                  </div>
                  <Badge variant={t.status === 'active' ? 'default' : 'secondary'} className="capitalize">{t.status}</Badge>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>🎓 Coach: {t.coach}</p>
                  {t.captain && <p>©️ Captain: {t.captain}</p>}
                  <p><Users className="inline h-3 w-3 mr-1" />{t.members.length} members • Season: {t.season}</p>
                </div>
                <div className="mt-3 flex gap-2">
                  {t.upcomingMatches.length > 0 && <Badge variant="outline"><Swords className="mr-1 h-3 w-3" />{t.upcomingMatches.length} upcoming</Badge>}
                  {t.practiceSchedule.length > 0 && <Badge variant="outline"><Clock className="mr-1 h-3 w-3" />{t.practiceSchedule.length} sessions</Badge>}
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
                <span>{team.sport} – {team.category === 'men' ? "Men's" : "Women's"} Team</span>
                <Button variant="outline" size="sm"><Edit className="mr-1 h-3 w-3" />Edit Roster</Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="roster">
                <TabsList>
                  <TabsTrigger value="roster">Roster ({team.members.length})</TabsTrigger>
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
                        {team.members.map((m, i) => (
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
                  <Button variant="outline" size="sm" className="mt-4"><Plus className="mr-1 h-3 w-3" />Add Player</Button>
                </TabsContent>

                <TabsContent value="schedule" className="mt-4 space-y-3">
                  {team.practiceSchedule.length > 0 ? team.practiceSchedule.map(ps => (
                    <Card key={ps.id}><CardContent className="flex items-center justify-between p-4">
                      <div>
                        <p className="text-sm font-medium text-foreground capitalize">{ps.type} Session</p>
                        <p className="text-xs text-muted-foreground"><Calendar className="inline h-3 w-3 mr-1" />{ps.date.toLocaleDateString('en-IN')} • {ps.startTime} – {ps.endTime}</p>
                        <p className="text-xs text-muted-foreground"><MapPin className="inline h-3 w-3 mr-1" />{ps.venue} • Coach: {ps.coach}</p>
                      </div>
                      <Button variant="outline" size="sm">Mark Attendance</Button>
                    </CardContent></Card>
                  )) : <p className="text-sm text-muted-foreground">No practice sessions scheduled.</p>}
                  <Button variant="outline" size="sm"><Plus className="mr-1 h-3 w-3" />Schedule Session</Button>
                </TabsContent>

                <TabsContent value="fixtures" className="mt-4 space-y-3">
                  {team.upcomingMatches.length > 0 ? team.upcomingMatches.map(m => (
                    <Card key={m.id}><CardContent className="flex items-center justify-between p-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">vs {m.opponent}</p>
                        <p className="text-xs text-muted-foreground capitalize"><Swords className="inline h-3 w-3 mr-1" />{m.type} • {m.homeAway}</p>
                        <p className="text-xs text-muted-foreground"><Calendar className="inline h-3 w-3 mr-1" />{m.date.toLocaleDateString('en-IN')} • <MapPin className="inline h-3 w-3 mr-1" />{m.venue}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={m.status === 'completed' ? 'default' : m.status === 'live' ? 'destructive' : 'secondary'} className="capitalize">{m.status}</Badge>
                        {m.status === 'completed' && m.result && <span className="text-sm font-semibold text-foreground">{m.result.ourScore}–{m.result.opponentScore}</span>}
                        <Button variant="outline" size="sm">Update</Button>
                      </div>
                    </CardContent></Card>
                  )) : <p className="text-sm text-muted-foreground">No upcoming fixtures.</p>}
                  <Button variant="outline" size="sm"><Plus className="mr-1 h-3 w-3" />Add Fixture</Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

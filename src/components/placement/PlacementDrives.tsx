import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Briefcase, Calendar, Building2, Users, CheckCircle2, Clock, Play,
  FileText, Upload, ClipboardList, Target, ArrowRight, Plus, Search
} from 'lucide-react';
import { placementDrives, recentOffers } from '@/data/placementMockData';

const formatPackage = (amount: number) => {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)} LPA`;
  return `₹${amount.toLocaleString('en-IN')}`;
};

export default function PlacementDrives() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Placement Drives</h1>
            <p className="text-muted-foreground">Track drives, manage rounds, mark attendance, and record selections</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Upload className="mr-2 h-4 w-4" />Import Results</Button>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" />New Drive</Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Active Drives</p><p className="text-2xl font-bold text-foreground">{placementDrives.length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Offers (Season)</p><p className="text-2xl font-bold text-green-600">{recentOffers.length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Drives This Week</p><p className="text-2xl font-bold text-foreground">3</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Pending Results</p><p className="text-2xl font-bold text-amber-600">2</p></CardContent></Card>
        </div>

        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">Active & Upcoming</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="results">Results Entry</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {placementDrives.map((drive) => (
              <Card key={drive.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10">
                        <Building2 className="h-7 w-7 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-foreground">{drive.company.name}</h3>
                          <Badge variant={drive.status === 'upcoming' ? 'default' : drive.status === 'ongoing' ? 'default' : 'secondary'} className="capitalize">{drive.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{drive.jobRole} • {drive.jobType.replace('_', ' ')}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="outline">CTC: {formatPackage(drive.package.ctc)}</Badge>
                          <Badge variant="outline">Min CGPA: {drive.eligibilityCriteria.minCGPA}</Badge>
                          <Badge variant="outline">{drive.eligibilityCriteria.programs.join(', ')}</Badge>
                        </div>
                        <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                          <span><Calendar className="mr-1 inline h-3 w-3" />{drive.driveDate.toLocaleDateString('en-IN')}</span>
                          <span><Users className="mr-1 inline h-3 w-3" />{drive.registeredStudents} registered</span>
                          <span>Venue: {drive.venue}</span>
                        </div>

                        {/* Rounds Progress */}
                        <div className="mt-4 space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">ROUNDS</p>
                          {drive.rounds.map((round, idx) => (
                            <div key={round.id} className="flex items-center gap-3 rounded-lg bg-muted/30 p-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                {idx + 1}
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-foreground">{round.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {round.date.toLocaleDateString('en-IN')} • {round.venue} • {round.duration} min
                                  {round.maxMarks && ` • Max: ${round.maxMarks}`}
                                </p>
                              </div>
                              <Badge variant={round.status === 'completed' ? 'default' : 'secondary'} className="capitalize">{round.status}</Badge>
                              {round.status === 'upcoming' && (
                                <Button size="sm" variant="outline"><Play className="mr-1 h-3 w-3" />Start</Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button size="sm"><ClipboardList className="mr-1 h-3 w-3" />Mark Attendance</Button>
                      <Button size="sm" variant="outline"><Target className="mr-1 h-3 w-3" />Enter Scores</Button>
                      <Button size="sm" variant="outline"><CheckCircle2 className="mr-1 h-3 w-3" />Record Selections</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="completed">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <CheckCircle2 className="h-16 w-16 text-muted-foreground/30" />
                <h3 className="mt-4 text-lg font-semibold text-foreground">Completed Drives</h3>
                <p className="text-sm text-muted-foreground">View results and analytics for all concluded placement drives this season</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-lg">Quick Results Entry</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Import company selection lists or manually mark selected students. Students marked as "Placed" will be automatically locked from future drives (as per policy).</p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Card className="cursor-pointer hover:bg-muted/30">
                    <CardContent className="flex flex-col items-center p-6 text-center">
                      <Upload className="h-10 w-10 text-primary/60" />
                      <h3 className="mt-3 font-semibold text-foreground">Import from Spreadsheet</h3>
                      <p className="mt-1 text-xs text-muted-foreground">Upload company's selection list (CSV/Excel) to bulk-mark selections</p>
                      <Button size="sm" className="mt-3">Upload File</Button>
                    </CardContent>
                  </Card>
                  <Card className="cursor-pointer hover:bg-muted/30">
                    <CardContent className="flex flex-col items-center p-6 text-center">
                      <ClipboardList className="h-10 w-10 text-primary/60" />
                      <h3 className="mt-3 font-semibold text-foreground">Manual Entry</h3>
                      <p className="mt-1 text-xs text-muted-foreground">Select company drive and manually mark students who got selected</p>
                      <Button size="sm" variant="outline" className="mt-3">Start Entry</Button>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

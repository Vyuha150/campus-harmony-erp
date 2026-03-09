import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  GraduationCap, Calendar, Users, Clock, MapPin, Plus, Download,
  BookOpen, ClipboardList, Star, FileText, CheckCircle2, Play
} from 'lucide-react';
import { trainingSessions } from '@/data/placementMockData';

export default function PlacementTraining() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Training & Internships</h1>
            <p className="text-muted-foreground">Schedule training sessions, manage internships, and track student readiness</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Attendance Report</Button>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" />Schedule Session</Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Sessions This Month</p><p className="text-2xl font-bold text-foreground">{trainingSessions.length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Avg Attendance</p><p className="text-2xl font-bold text-green-600">89%</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Active Internships</p><p className="text-2xl font-bold text-foreground">156</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Companies Offering</p><p className="text-2xl font-bold text-foreground">34</p></CardContent></Card>
        </div>

        <Tabs defaultValue="training">
          <TabsList>
            <TabsTrigger value="training">Training Sessions</TabsTrigger>
            <TabsTrigger value="internships">Internship Management</TabsTrigger>
            <TabsTrigger value="performance">Student Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="training" className="space-y-4">
            {trainingSessions.map((ts) => (
              <Card key={ts.id} className="hover:bg-muted/20 transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                        {ts.type === 'aptitude' ? <Star className="h-6 w-6 text-primary" /> :
                         ts.type === 'technical' ? <BookOpen className="h-6 w-6 text-primary" /> :
                         ts.type === 'resume_building' ? <FileText className="h-6 w-6 text-primary" /> :
                         <GraduationCap className="h-6 w-6 text-primary" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">{ts.title}</h3>
                          <Badge variant={ts.status === 'scheduled' ? 'default' : ts.status === 'completed' ? 'secondary' : 'default'} className="capitalize">{ts.status}</Badge>
                          <Badge variant="outline" className="capitalize">{ts.type.replace('_', ' ')}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{ts.instructor}</p>
                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                          <span><Calendar className="mr-1 inline h-3 w-3" />{ts.date.toLocaleDateString('en-IN')}</span>
                          <span><Clock className="mr-1 inline h-3 w-3" />{ts.duration} min</span>
                          <span><MapPin className="mr-1 inline h-3 w-3" />{ts.venue}</span>
                          <span><Users className="mr-1 inline h-3 w-3" />{ts.registeredCount}/{ts.maxCapacity} registered</span>
                        </div>
                        {ts.materials.length > 0 && (
                          <div className="mt-2 flex gap-2">
                            {ts.materials.map(m => (
                              <Badge key={m} variant="secondary" className="text-xs"><FileText className="mr-1 h-3 w-3" />{m}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm"><ClipboardList className="mr-1 h-3 w-3" />Attendance</Button>
                      {ts.status === 'scheduled' && <Button size="sm"><Play className="mr-1 h-3 w-3" />Start</Button>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="internships">
            <Card>
              <CardHeader><CardTitle className="text-lg">Internship Management</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Advertise internship opportunities, collect student preferences, track who went where, and record completion certificates.</p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {[
                    { title: 'Post Opportunity', desc: 'Advertise new internship openings from partner companies', icon: Plus, action: 'Post' },
                    { title: 'Student Assignments', desc: 'View/assign students to internship positions', icon: Users, action: 'Manage' },
                    { title: 'Completion Records', desc: 'Track internship completion, certificates, and feedback', icon: CheckCircle2, action: 'View' },
                  ].map((item) => (
                    <Card key={item.title} className="cursor-pointer hover:bg-muted/30">
                      <CardContent className="flex flex-col items-center p-6 text-center">
                        <item.icon className="h-10 w-10 text-primary/60" />
                        <h3 className="mt-3 font-semibold text-foreground">{item.title}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
                        <Button size="sm" variant="outline" className="mt-3">{item.action}</Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Star className="h-16 w-16 text-muted-foreground/30" />
                <h3 className="mt-4 text-lg font-semibold text-foreground">Training Performance Tracker</h3>
                <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
                  View student-wise attendance and performance across all training sessions. Identify students needing additional preparation.
                </p>
                <Button className="mt-4">View Performance Dashboard</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

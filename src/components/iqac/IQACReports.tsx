import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, FileText, Users, Download, Plus, Clock, MapPin, CheckCircle2, Send } from 'lucide-react';
import { useState } from 'react';

// Mock IQAC meetings data
const iqacMeetings = [
  {
    id: 'M001', title: 'IQAC Meeting – Q3 Review', date: new Date('2026-03-15'), venue: 'Conference Hall A',
    status: 'scheduled' as const, chairperson: 'Dr. S. Krishnamurthy (IQAC Director)',
    agenda: ['Review Criterion 3 & 5 data gaps', 'FDP completion status', 'Student feedback analysis', 'AQAR timeline discussion'],
    attendees: [
      { name: 'Dr. S. Krishnamurthy', designation: 'IQAC Director', attended: true, role: 'chairperson' as const },
      { name: 'Dr. Rajesh Kumar', designation: 'CS HOD', attended: true, role: 'member' as const },
      { name: 'Prof. Meena Sharma', designation: 'Dean Academics', attended: true, role: 'member' as const },
    ],
    decisions: [], actionItems: [],
  },
  {
    id: 'M002', title: 'IQAC Meeting – Q2 Review', date: new Date('2025-12-20'), venue: 'Board Room',
    status: 'completed' as const, chairperson: 'Dr. S. Krishnamurthy (IQAC Director)',
    agenda: ['Mid-year quality audit results', 'Alumni survey outcomes', 'Best practices documentation'],
    attendees: [
      { name: 'Dr. S. Krishnamurthy', designation: 'IQAC Director', attended: true, role: 'chairperson' as const },
      { name: 'Dr. Anand Gupta', designation: 'Registrar', attended: true, role: 'member' as const },
      { name: 'Prof. Priya Nair', designation: 'NAAC Coordinator', attended: true, role: 'member' as const },
    ],
    decisions: ['Approved new quality benchmarks for research output', 'Established mentorship tracking system'],
    actionItems: ['Departments to submit updated faculty CVs by Jan 15', 'Research cell to verify publication data'],
  },
];

const aqarSections = [
  { section: 'Part A – Institutional Data', status: 'completed', progress: 100 },
  { section: 'Criterion 1 – Curricular Aspects', status: 'completed', progress: 95 },
  { section: 'Criterion 2 – Teaching-Learning', status: 'in_progress', progress: 80 },
  { section: 'Criterion 3 – Research & Extension', status: 'in_progress', progress: 72 },
  { section: 'Criterion 4 – Infrastructure', status: 'completed', progress: 98 },
  { section: 'Criterion 5 – Student Support', status: 'needs_attention', progress: 60 },
  { section: 'Criterion 6 – Governance', status: 'in_progress', progress: 85 },
  { section: 'Criterion 7 – Best Practices', status: 'in_progress', progress: 88 },
  { section: 'Part B – Best Practices & Institutional Distinctiveness', status: 'not_started', progress: 20 },
];

export default function IQACReports() {
  const [qualitativeNotes, setQualitativeNotes] = useState('');

  const overallAQAR = Math.round(aqarSections.reduce((a, b) => a + b.progress, 0) / aqarSections.length);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">AQAR & Reports</h1>
            <p className="text-muted-foreground">Meeting management and Annual Quality Assurance Report generation</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Plus className="mr-2 h-4 w-4" />Schedule Meeting</Button>
            <Button size="sm"><Download className="mr-2 h-4 w-4" />Generate AQAR</Button>
          </div>
        </div>

        <Tabs defaultValue="aqar">
          <TabsList>
            <TabsTrigger value="aqar">AQAR Generation</TabsTrigger>
            <TabsTrigger value="meetings">IQAC Meetings</TabsTrigger>
          </TabsList>

          <TabsContent value="aqar" className="space-y-4">
            {/* AQAR Progress */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">AQAR 2025-26 – Section-wise Progress</CardTitle>
                  <Badge variant="outline" className="text-sm">Overall: {overallAQAR}%</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Section</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aqarSections.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-foreground">{s.section}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-32 bg-secondary rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${s.progress >= 90 ? 'bg-green-500' : s.progress >= 70 ? 'bg-amber-500' : 'bg-destructive'}`}
                                style={{ width: `${s.progress}%` }}
                              />
                            </div>
                            <span className="text-sm text-muted-foreground">{s.progress}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={s.status === 'completed' ? 'default' : s.status === 'needs_attention' ? 'destructive' : s.status === 'not_started' ? 'outline' : 'secondary'}
                            className="capitalize"
                          >
                            {s.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">Edit Section</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Qualitative Input */}
            <Card>
              <CardHeader><CardTitle className="text-base">Qualitative Commentary (IQAC Coordinator)</CardTitle></CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Add qualitative remarks for the AQAR report – institutional achievements, innovations, distinctive features..."
                  value={qualitativeNotes}
                  onChange={(e) => setQualitativeNotes(e.target.value)}
                  className="min-h-[120px] mb-3"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm">Save Draft</Button>
                  <Button size="sm"><Send className="mr-2 h-4 w-4" />Submit for Review</Button>
                </div>
              </CardContent>
            </Card>

            {/* System Computed Metrics */}
            <Card>
              <CardHeader><CardTitle className="text-base">Auto-Computed Metrics from ERP Data</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold text-primary">42</p>
                    <p className="text-xs text-muted-foreground">Seminars Conducted</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold text-primary">18</p>
                    <p className="text-xs text-muted-foreground">Value-Added Courses</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold text-primary">156</p>
                    <p className="text-xs text-muted-foreground">Research Publications</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold text-primary">₹2.4Cr</p>
                    <p className="text-xs text-muted-foreground">Research Funding</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold text-primary">89%</p>
                    <p className="text-xs text-muted-foreground">Placement Rate</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold text-primary">12</p>
                    <p className="text-xs text-muted-foreground">FDPs Conducted</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold text-primary">28</p>
                    <p className="text-xs text-muted-foreground">Active MOUs</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold text-primary">4.1/5</p>
                    <p className="text-xs text-muted-foreground">Student Satisfaction</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="meetings" className="space-y-4">
            {iqacMeetings.map((m) => (
              <Card key={m.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-foreground text-lg">{m.title}</h3>
                      <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{m.date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{m.venue}</span>
                        <span className="flex items-center gap-1"><Users className="h-4 w-4" />{m.attendees.length} members</span>
                      </div>
                    </div>
                    <Badge variant={m.status === 'completed' ? 'default' : 'secondary'} className="capitalize">{m.status}</Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mt-4">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-2">📋 Agenda</h4>
                      {m.agenda.map((a, i) => (
                        <p key={i} className="text-sm text-muted-foreground">{i + 1}. {a}</p>
                      ))}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-2">👥 Attendees</h4>
                      {m.attendees.map((a, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm mb-1">
                          <CheckCircle2 className={`h-3.5 w-3.5 ${a.attended ? 'text-green-600' : 'text-muted-foreground'}`} />
                          <span className="text-foreground">{a.name}</span>
                          <span className="text-muted-foreground">– {a.designation}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {m.decisions.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-foreground mb-2">✅ Decisions</h4>
                      {m.decisions.map((d, i) => <p key={i} className="text-sm text-muted-foreground">• {d}</p>)}
                    </div>
                  )}
                  {m.actionItems.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-sm font-semibold text-foreground mb-2">📌 Action Items</h4>
                      {m.actionItems.map((a, i) => <p key={i} className="text-sm text-muted-foreground">• {a}</p>)}
                    </div>
                  )}

                  <div className="mt-4 flex gap-2">
                    {m.status === 'completed' ? (
                      <>
                        <Button variant="outline" size="sm"><FileText className="mr-1 h-4 w-4" />View Minutes</Button>
                        <Button variant="outline" size="sm"><Download className="mr-1 h-4 w-4" />Download</Button>
                      </>
                    ) : (
                      <>
                        <Button variant="outline" size="sm">Edit Agenda</Button>
                        <Button size="sm"><Send className="mr-1 h-4 w-4" />Send Invites</Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

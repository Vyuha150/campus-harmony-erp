import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, CheckCircle, AlertTriangle, FileText, Plus, Download, Award } from 'lucide-react';

const concessionRequests = [
  { id: 'CR001', studentName: 'Rahul Sharma', rollNumber: 'BT23CS045', sport: 'Cricket', event: 'Inter-University Cricket Championship', dates: '10 Mar – 15 Mar 2026', type: 'attendance', status: 'pending' as const, classesAffected: 12 },
  { id: 'CR002', studentName: 'Priya Menon', rollNumber: 'BT24ECE022', sport: 'Badminton', event: 'All India Inter-University Badminton', dates: '18 Jan – 22 Jan 2026', type: 'attendance', status: 'approved' as const, classesAffected: 8 },
  { id: 'CR003', studentName: 'Vikas Patel', rollNumber: 'BT23ME067', sport: 'Cricket', event: 'State-Level T20 Tournament', dates: '5 Apr – 8 Apr 2026', type: 'grace_marks', status: 'pending' as const, classesAffected: 6 },
];

const eventParticipation = [
  { id: 'EP001', event: 'Inter-University Cricket Championship', startDate: '10 Mar 2026', endDate: '15 Mar 2026', participants: 15, concessionsIssued: 12, status: 'upcoming' },
  { id: 'EP002', event: 'State Badminton Open', startDate: '25 Feb 2026', endDate: '27 Feb 2026', participants: 4, concessionsIssued: 4, status: 'completed' },
  { id: 'EP003', event: 'Annual Sports Day 2026', startDate: '25 Mar 2026', endDate: '28 Mar 2026', participants: 120, concessionsIssued: 0, status: 'upcoming' },
];

export default function SportsAttendance() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Attendance & Concessions</h1>
            <p className="text-muted-foreground">Manage sports participation records, attendance concessions, and grace marks</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export Records</Button>
            <Dialog>
              <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />New Concession Request</Button></DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Issue Attendance/Grace Concession</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                  <div><Label>Student</Label><Input placeholder="Search student by name or roll number" /></div>
                  <div><Label>Sport / Event</Label><Input placeholder="Official event name" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>From Date</Label><Input type="date" /></div>
                    <div><Label>To Date</Label><Input type="date" /></div>
                  </div>
                  <div><Label>Concession Type</Label>
                    <Select><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger><SelectContent>
                      <SelectItem value="attendance">Attendance Concession</SelectItem>
                      <SelectItem value="grace_marks">Grace Marks</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent></Select>
                  </div>
                  <div><Label>Justification / Notes</Label><Textarea placeholder="Describe the official participation details..." /></div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="official" />
                    <Label htmlFor="official" className="text-sm">This is an officially sanctioned university representation</Label>
                  </div>
                  <Button className="w-full">Submit Concession Request</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">23</p><p className="text-xs text-muted-foreground">Concessions This Semester</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-amber-500">3</p><p className="text-xs text-muted-foreground">Pending Approval</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">18</p><p className="text-xs text-muted-foreground">Approved</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-foreground">5</p><p className="text-xs text-muted-foreground">Events This Month</p></CardContent></Card>
        </div>

        {/* Concession requests table */}
        <Card>
          <CardHeader><CardTitle>Concession Requests</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Student</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Event</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Dates</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Classes</th>
                  <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Actions</th>
                </tr></thead>
                <tbody>
                  {concessionRequests.map(cr => (
                    <tr key={cr.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3"><p className="text-sm font-medium text-foreground">{cr.studentName}</p><p className="text-xs text-muted-foreground">{cr.rollNumber}</p></td>
                      <td className="px-4 py-3 text-sm text-foreground">{cr.event}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{cr.dates}</td>
                      <td className="px-4 py-3 text-center text-sm text-foreground">{cr.classesAffected}</td>
                      <td className="px-4 py-3"><Badge variant="outline" className="capitalize">{cr.type.replace('_', ' ')}</Badge></td>
                      <td className="px-4 py-3"><Badge variant={cr.status === 'approved' ? 'default' : cr.status === 'pending' ? 'secondary' : 'destructive'} className="capitalize">{cr.status}</Badge></td>
                      <td className="px-4 py-3">
                        {cr.status === 'pending' ? (
                          <div className="flex gap-1">
                            <Button variant="default" size="sm">Approve</Button>
                            <Button variant="outline" size="sm">Reject</Button>
                          </div>
                        ) : <Button variant="outline" size="sm">View</Button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Event participation log */}
        <Card>
          <CardHeader><CardTitle>Event Participation Log</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {eventParticipation.map(ep => (
              <div key={ep.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="text-sm font-medium text-foreground">{ep.event}</p>
                  <p className="text-xs text-muted-foreground"><Calendar className="inline h-3 w-3 mr-1" />{ep.startDate} – {ep.endDate} • {ep.participants} participants</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={ep.status === 'completed' ? 'default' : 'secondary'} className="capitalize">{ep.status}</Badge>
                  <span className="text-sm text-muted-foreground">{ep.concessionsIssued} concessions</span>
                  <Button variant="outline" size="sm"><FileText className="mr-1 h-3 w-3" />Mark Participants</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, Calendar, Clock, Users, CheckCircle, XCircle, Wrench, Plus } from 'lucide-react';
import { sportsFacilities } from '@/data/sportsMockData';

const bookingRequests = [
  { id: 'BR001', facility: 'Main Cricket Ground', requestedBy: 'Cultural Club', purpose: 'Annual Cultural Fest Setup', date: '22 Mar 2026', time: '08:00 – 18:00', status: 'pending' as const },
  { id: 'BR002', facility: 'Indoor Sports Complex', requestedBy: 'CSE Department', purpose: 'Department Sports Day', date: '18 Mar 2026', time: '09:00 – 17:00', status: 'approved' as const },
  { id: 'BR003', facility: 'Athletic Track', requestedBy: 'NSS Unit', purpose: 'Marathon Event', date: '30 Mar 2026', time: '06:00 – 10:00', status: 'pending' as const },
];

export default function SportsFacilities() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Facility Booking & Management</h1>
            <p className="text-muted-foreground">Manage sports facilities, bookings, and maintenance schedules</p>
          </div>
          <Dialog>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Facility</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add New Facility</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div><Label>Facility Name</Label><Input placeholder="e.g. Basketball Court" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Type</Label><Select><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="indoor">Indoor</SelectItem><SelectItem value="outdoor">Outdoor</SelectItem></SelectContent></Select></div>
                  <div><Label>Capacity</Label><Input type="number" placeholder="e.g. 200" /></div>
                </div>
                <div><Label>Sports Supported</Label><Input placeholder="Comma separated" /></div>
                <div><Label>Amenities</Label><Textarea placeholder="List amenities" /></div>
                <Button className="w-full">Add Facility</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Facility cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sportsFacilities.map(f => (
            <Card key={f.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${f.status === 'available' ? 'bg-green-100 dark:bg-green-900/30' : f.status === 'maintenance' ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-muted'}`}>
                      {f.status === 'available' ? <CheckCircle className="h-5 w-5 text-green-600" /> : f.status === 'maintenance' ? <Wrench className="h-5 w-5 text-amber-600" /> : <XCircle className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{f.name}</h3>
                      <p className="text-xs text-muted-foreground capitalize">{f.type} • <Users className="inline h-3 w-3" /> {f.capacity}</p>
                    </div>
                  </div>
                  <Badge variant={f.status === 'available' ? 'default' : f.status === 'maintenance' ? 'destructive' : 'secondary'} className="capitalize">{f.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">Sports: {f.sports.join(', ')}</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {f.amenities.slice(0, 4).map((a, i) => <Badge key={i} variant="outline" className="text-xs">{a}</Badge>)}
                  {f.amenities.length > 4 && <Badge variant="secondary" className="text-xs">+{f.amenities.length - 4}</Badge>}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1">Schedule</Button>
                  <Button variant="outline" size="sm" className="flex-1">Maintenance</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Booking requests */}
        <Card>
          <CardHeader><CardTitle>Booking Requests</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Facility</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Requested By</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Purpose</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date & Time</th>
                  <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Actions</th>
                </tr></thead>
                <tbody>
                  {bookingRequests.map(br => (
                    <tr key={br.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{br.facility}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{br.requestedBy}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{br.purpose}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground"><Calendar className="inline h-3 w-3 mr-1" />{br.date} <Clock className="inline h-3 w-3 ml-2 mr-1" />{br.time}</td>
                      <td className="px-4 py-3"><Badge variant={br.status === 'approved' ? 'default' : 'secondary'} className="capitalize">{br.status}</Badge></td>
                      <td className="px-4 py-3">
                        {br.status === 'pending' ? (
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
      </div>
    </DashboardLayout>
  );
}

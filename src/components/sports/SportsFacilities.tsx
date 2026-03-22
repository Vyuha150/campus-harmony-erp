import { useState, useEffect } from 'react';
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
import { fetchApi, putApi } from '@/lib/apiService';
import { toast } from '@/hooks/use-toast';

export default function SportsFacilities() {
  const [sportsFacilities, setSportsFacilities] = useState<any>([]);
  const [_apiLoading, _setApiLoading] = useState(true);

  const loadFacilities = async () => {
    try {
      const data = await fetchApi('/sports/facilities');
      setSportsFacilities(data);
    } catch (error) {
      console.error('API request failed', error);
      toast({ title: 'Failed to load facilities', description: String((error as any)?.message || 'Please retry.'), variant: 'destructive' });
    } finally {
      _setApiLoading(false);
    }
  };

  useEffect(() => {
    loadFacilities();
  }, []);

  const toggleFacilityBooking = async (facility: any) => {
    try {
      const nextStatus = facility.status === 'booked' ? 'available' : 'booked';
      if (nextStatus === 'booked') {
        await putApi(`/sports/facilities/${facility.id}/book`, {});
      } else {
        await putApi(`/sports/facilities/${facility.id}`, { status: 'available' });
      }
      toast({ title: nextStatus === 'booked' ? 'Facility booked' : 'Facility unbooked', description: `Facility marked as ${nextStatus}.` });
      await loadFacilities();
    } catch (error: any) {
      toast({ title: 'Update failed', description: String(error?.message || 'Please retry.'), variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Facility Booking & Management</h1>
            <p className="text-muted-foreground">Manage sports facilities, bookings, and maintenance schedules</p>
          </div>
          <Dialog>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Booking Notes</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Facility Booking Guidance</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <p className="text-sm text-muted-foreground">
                  Facilities are managed centrally. From this screen you can directly book available facilities through the Book button.
                </p>
                <Button className="w-full" onClick={loadFacilities}>Refresh Facilities</Button>
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
                <p className="text-sm text-muted-foreground mb-2">Sports: {(Array.isArray(f.sports) ? f.sports : []).filter(Boolean).join(', ') || '-'}</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {(Array.isArray(f.amenities) ? f.amenities : []).slice(0, 4).map((a, i) => <Badge key={i} variant="outline" className="text-xs">{a}</Badge>)}
                  {(Array.isArray(f.amenities) ? f.amenities.length : 0) > 4 && <Badge variant="secondary" className="text-xs">+{(Array.isArray(f.amenities) ? f.amenities.length : 0) - 4}</Badge>}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => toggleFacilityBooking(f)}
                    disabled={f.status === 'maintenance'}
                  >
                    {f.status === 'booked' ? 'Unbook' : 'Book'}
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={loadFacilities}>Refresh</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

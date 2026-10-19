import { useEffect, useState } from 'react';
import { BedDouble, Bus } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { fetchApi, postApi } from '@/lib/apiService';
import { toast } from '@/hooks/use-toast';

/** Hostel room and bus pass: what the student has, and requests to the Registrar's office. */
export default function StudentServices() {
  const [data, setData] = useState<any>(null);
  const [roomType, setRoomType] = useState('double');
  const [hostelNote, setHostelNote] = useState('');
  const [routeId, setRouteId] = useState('');
  const [stop, setStop] = useState('');
  const [busy, setBusy] = useState('');
  const load = () => fetchApi<any>('/students/campus-services').then(setData).catch(() => setData({ requests: [], routes: [] }));
  useEffect(() => { load(); }, []);

  const ask = async (service: 'hostel' | 'transport') => {
    setBusy(service);
    try {
      await postApi('/students/campus-services', service === 'hostel'
        ? { service, preference: { roomType }, ...(hostelNote.trim() ? { note: hostelNote.trim() } : {}) }
        : { service, preference: { routeId, stop } });
      toast({ title: 'Request sent', description: 'The Registrar’s office allocates and the fee is added to your account.' });
      load();
    } catch (e: any) {
      toast({ title: 'Could not send', description: e?.message, variant: 'destructive' });
    } finally {
      setBusy('');
    }
  };

  if (!data) return <DashboardLayout><p className="py-10 text-center text-sm text-muted-foreground">Loading…</p></DashboardLayout>;
  const pending = (s: string) => data.requests.find((r: any) => r.service === s && r.status === 'requested');
  const route = data.routes.find((r: any) => r.id === routeId);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="page-title">Hostel & Transport</h1>
          <p className="page-description">Your room and bus pass, and requests for them</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><BedDouble className="h-5 w-5" />Hostel</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {data.hostel ? (
                <div className="space-y-1 text-sm">
                  <p className="text-lg font-semibold">{data.hostel.hostel} · Block {data.hostel.block} · Room {data.hostel.roomNumber}</p>
                  <p className="capitalize text-muted-foreground">{data.hostel.roomType} room · since {new Date(data.hostel.since).toLocaleDateString('en-IN')}</p>
                  <p>Warden: {data.hostel.warden} ({data.hostel.wardenPhone})</p>
                </div>
              ) : pending('hostel') ? (
                <Badge variant="secondary">Request with the Registrar’s office</Badge>
              ) : (
                <>
                  <div className="space-y-1"><Label>Room type</Label>
                    <Select value={roomType} onValueChange={setRoomType}><SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{['single', 'double', 'triple', 'dormitory'].map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent></Select>
                  </div>
                  <Textarea value={hostelNote} onChange={(e) => setHostelNote(e.target.value)} placeholder="Anything the office should know (e.g. medical needs, roommate preference)" />
                  <Button onClick={() => ask('hostel')} disabled={!!busy}>Request a hostel seat</Button>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Bus className="h-5 w-5" />Transport</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {data.transport ? (
                <div className="space-y-1 text-sm">
                  <p className="text-lg font-semibold">{data.transport.route}</p>
                  <p>Boarding at <b>{data.transport.stop}</b>{data.transport.time ? ` at ${data.transport.time}` : ''}</p>
                  <p className="text-muted-foreground">{[data.transport.vehicleNumber, data.transport.driverName && `Driver ${data.transport.driverName}`, data.transport.driverPhone].filter(Boolean).join(' · ')}</p>
                </div>
              ) : pending('transport') ? (
                <Badge variant="secondary">Request with the Registrar’s office</Badge>
              ) : !data.routes.length ? (
                <p className="text-sm text-muted-foreground">No bus routes have been set up yet.</p>
              ) : (
                <>
                  <div className="space-y-1"><Label>Route</Label>
                    <Select value={routeId} onValueChange={(v) => { setRouteId(v); setStop(''); }}><SelectTrigger><SelectValue placeholder="Choose a route" /></SelectTrigger>
                      <SelectContent>{data.routes.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.code} — {r.name}</SelectItem>)}</SelectContent></Select>
                  </div>
                  {route && (
                    <div className="space-y-1"><Label>Stop</Label>
                      <Select value={stop} onValueChange={setStop}><SelectTrigger><SelectValue placeholder="Where you board" /></SelectTrigger>
                        <SelectContent>{(route.stops ?? []).map((st: any) => <SelectItem key={st.name} value={st.name}>{st.name} · {st.time} · ₹{Number(st.fee).toLocaleString('en-IN')}/year</SelectItem>)}</SelectContent></Select>
                    </div>
                  )}
                  <Button onClick={() => ask('transport')} disabled={!!busy || !routeId || !stop}>Request a bus pass</Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
        {data.requests.length > 0 && (
          <Card>
            <CardHeader><CardTitle>My requests</CardTitle><CardDescription>Hostel and transport</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {data.requests.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <span className="capitalize">{r.service} · {new Date(r.createdAt).toLocaleDateString('en-IN')}{r.decisionNote ? ` · ${r.decisionNote}` : ''}</span>
                  <Badge variant={r.status === 'allocated' ? 'default' : r.status === 'declined' ? 'destructive' : 'secondary'} className="capitalize">{r.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

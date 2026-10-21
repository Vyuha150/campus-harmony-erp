import { useFormDialog } from '@/components/shared/FormDialog';
import { useEffect, useState } from 'react';
import { BedDouble, Bus, Inbox, Plus, Trash2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchApi, postApi, putApi } from '@/lib/apiService';
import { toast } from '@/hooks/use-toast';

/**
 * Hostel and transport, run from the Registrar's office. An allocation adds
 * the hostel / transport fee to the student's account; students request seats
 * and passes from their portal.
 */
type Stop = { name: string; time: string; fee: string };
const blankHostel = { id: '', name: '', block: '', wardenName: '', wardenPhone: '', capacity: '', hostelType: 'boys', feePerSemester: '' };
const blankRoute = { id: '', code: '', name: '', vehicleNumber: '', driverName: '', driverPhone: '', capacity: '50', stops: [{ name: '', time: '07:30', fee: '' }] as Stop[] };

export default function RegistrarCampusServices() {
  const [formDialog, ask] = useFormDialog();
  const [hostels, setHostels] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [hostelForm, setHostelForm] = useState<typeof blankHostel | null>(null);
  const [routeForm, setRouteForm] = useState<typeof blankRoute | null>(null);
  const [alloc, setAlloc] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    fetchApi<any[]>('/registrar/hostels').then((d) => setHostels(Array.isArray(d) ? d : [])).catch(() => undefined);
    fetchApi<any[]>('/registrar/transport-routes').then((d) => setRoutes(Array.isArray(d) ? d : [])).catch(() => undefined);
    fetchApi<any[]>('/registrar/service-requests').then((d) => setRequests(Array.isArray(d) ? d : [])).catch(() => undefined);
  };
  useEffect(() => { load(); fetchApi<any[]>('/registrar/students').then((d) => setStudents(Array.isArray(d) ? d : [])).catch(() => undefined); }, []);

  const go = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true);
    try { await fn(); toast({ title: ok }); load(); return true; }
    catch (e: any) { toast({ title: 'Could not complete', description: e?.message, variant: 'destructive' }); return false; }
    finally { setBusy(false); }
  };

  const saveHostel = async () => {
    const f = hostelForm!;
    const body = { name: f.name.trim(), block: f.block.trim(), wardenName: f.wardenName.trim(), wardenPhone: f.wardenPhone.trim(), ...(f.capacity ? { capacity: Number(f.capacity) } : {}), hostelType: f.hostelType, ...(f.feePerSemester ? { feePerSemester: Number(f.feePerSemester) } : {}) };
    if (await go(() => (f.id ? putApi(`/registrar/hostels/${f.id}`, body) : postApi('/registrar/hostels', body)), 'Hostel saved')) setHostelForm(null);
  };
  const saveRoute = async () => {
    const f = routeForm!;
    const body = { code: f.code.trim().toUpperCase(), name: f.name.trim(), ...(f.vehicleNumber ? { vehicleNumber: f.vehicleNumber.trim() } : {}), ...(f.driverName ? { driverName: f.driverName.trim() } : {}), ...(f.driverPhone ? { driverPhone: f.driverPhone.trim() } : {}), capacity: Number(f.capacity), stops: f.stops.filter((s) => s.name.trim()).map((s) => ({ name: s.name.trim(), time: s.time, fee: Number(s.fee) || 0 })) };
    if (await go(() => (f.id ? putApi(`/registrar/transport-routes/${f.id}`, body) : postApi('/registrar/transport-routes', body)), 'Route saved')) setRouteForm(null);
  };
  const allocate = async () => {
    const a = alloc;
    const ok = a.service === 'hostel'
      ? await go(() => postApi('/registrar/hostel-allocations', { hostelId: a.hostelId, studentProfileId: a.studentProfileId, roomNumber: a.roomNumber.trim(), roomType: a.roomType, ...(a.requestId ? { requestId: a.requestId } : {}) }), 'Room allotted; fee added to the student’s account')
      : await go(() => postApi('/registrar/transport-allocations', { routeId: a.routeId, studentProfileId: a.studentProfileId, stop: a.stop, ...(a.requestId ? { requestId: a.requestId } : {}) }), 'Bus pass issued; fee added to the student’s account');
    if (ok) setAlloc(null);
  };
  const studentProfileIdOf = (userId: string) => students.find((s) => s.id === userId);
  const pending = requests.filter((r) => r.status === 'requested');
  const allocRoute = alloc?.service === 'transport' ? routes.find((r) => r.id === alloc.routeId) : null;

  return (
    <DashboardLayout>
      {formDialog}
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Hostel & Transport</h1>
          <p className="text-muted-foreground">Rooms, bus routes and student requests. Allocation adds the fee to the student’s account.</p>
        </div>
        <Tabs defaultValue="requests">
          <TabsList>
            <TabsTrigger value="requests">Requests ({pending.length})</TabsTrigger>
            <TabsTrigger value="hostels">Hostels ({hostels.length})</TabsTrigger>
            <TabsTrigger value="transport">Transport ({routes.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="mt-4 space-y-3">
            {!pending.length && <Card><CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Inbox className="h-4 w-4" />No pending requests.</CardContent></Card>}
            {pending.map((r) => (
              <Card key={r.id}><CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div>
                  <p className="text-sm font-medium capitalize">{r.service}: {r.studentName} ({r.rollNumber})</p>
                  <p className="text-xs text-muted-foreground">{r.service === 'hostel' ? `Prefers a ${r.preference?.roomType ?? 'any'} room` : `${routes.find((x) => x.id === r.preference?.routeId)?.code ?? 'route'} · ${r.preference?.stop ?? ''}`}{r.note ? ` · “${r.note}”` : ''} · {new Date(r.createdAt).toLocaleDateString('en-IN')}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setAlloc(r.service === 'hostel'
                    ? { service: 'hostel', requestId: r.id, studentProfileId: r.studentProfileId, studentName: r.studentName, hostelId: hostels[0]?.id ?? '', roomNumber: '', roomType: r.preference?.roomType ?? 'double' }
                    : { service: 'transport', requestId: r.id, studentProfileId: r.studentProfileId, studentName: r.studentName, routeId: r.preference?.routeId ?? '', stop: r.preference?.stop ?? '' })}>Allocate</Button>
                  <Button size="sm" variant="outline" onClick={async () => { const v = await ask({ title: `Decline ${r.studentName}'s request`, fields: [{ name: 'note', label: 'Reason (shown to the student)', type: 'textarea', required: true, minLength: 10 }], submitLabel: 'Decline' }); if (v) go(() => postApi(`/registrar/service-requests/${r.id}/decline`, { note: v.note }), 'Request declined'); }}>Decline</Button>
                </div>
              </CardContent></Card>
            ))}
          </TabsContent>

          <TabsContent value="hostels" className="mt-4 space-y-4">
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAlloc({ service: 'hostel', studentProfileId: '', hostelId: hostels[0]?.id ?? '', roomNumber: '', roomType: 'double' })}>Allot a room</Button>
              <Button onClick={() => setHostelForm({ ...blankHostel })}><Plus className="mr-1 h-4 w-4" />Add hostel</Button>
            </div>
            {hostels.map((h) => (
              <Card key={h.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2"><BedDouble className="h-5 w-5" />{h.name} · Block {h.block}</CardTitle>
                      <CardDescription className="capitalize">{h.hostelType ?? 'hostel'} · warden {h.wardenName} ({h.wardenPhone}) · {h.occupied}{h.capacity ? `/${h.capacity}` : ''} occupied{h.feePerSemester ? ` · ₹${Number(h.feePerSemester).toLocaleString('en-IN')} per semester` : ''}</CardDescription>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setHostelForm({ id: h.id, name: h.name, block: h.block, wardenName: h.wardenName, wardenPhone: h.wardenPhone, capacity: h.capacity ? String(h.capacity) : '', hostelType: h.hostelType ?? 'boys', feePerSemester: h.feePerSemester ? String(h.feePerSemester) : '' })}>Edit</Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1">
                  {!h.residents.length && <p className="text-sm text-muted-foreground">No residents.</p>}
                  {h.residents.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between rounded border px-3 py-1.5 text-sm">
                      <span>Room {r.roomNumber} · {r.name} ({r.rollNumber}) <span className="text-xs capitalize text-muted-foreground">{r.roomType}</span></span>
                      <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(`Vacate room ${r.roomNumber} for ${r.name}?`)) go(() => postApi(`/registrar/hostel-allocations/${r.id}/vacate`, {}), 'Room vacated'); }}>Vacate</Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="transport" className="mt-4 space-y-4">
            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={!routes.length} onClick={() => setAlloc({ service: 'transport', studentProfileId: '', routeId: routes[0]?.id ?? '', stop: '' })}>Issue a bus pass</Button>
              <Button onClick={() => setRouteForm({ ...blankRoute, stops: [{ name: '', time: '07:30', fee: '' }] })}><Plus className="mr-1 h-4 w-4" />Add route</Button>
            </div>
            {!routes.length && <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No routes yet. Add one with its stops and the yearly fee per stop.</CardContent></Card>}
            {routes.map((r) => (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2"><Bus className="h-5 w-5" />{r.code} — {r.name}</CardTitle>
                      <CardDescription>{[r.vehicleNumber, r.driverName && `Driver ${r.driverName}`, r.driverPhone].filter(Boolean).join(' · ')} · {r.riders}/{r.capacity} seats</CardDescription>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setRouteForm({ id: r.id, code: r.code, name: r.name, vehicleNumber: r.vehicleNumber ?? '', driverName: r.driverName ?? '', driverPhone: r.driverPhone ?? '', capacity: String(r.capacity), stops: (r.stops ?? []).map((s: any) => ({ name: s.name, time: s.time, fee: String(s.fee) })) })}>Edit</Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap gap-1">{(r.stops ?? []).map((s: any) => <Badge key={s.name} variant="outline">{s.name} · {s.time} · ₹{Number(s.fee).toLocaleString('en-IN')}</Badge>)}</div>
                  {r.passengers.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between rounded border px-3 py-1.5 text-sm">
                      <span>{p.name} ({p.rollNumber}) · {p.stop}</span>
                      <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(`Cancel ${p.name}'s bus pass?`)) go(() => postApi(`/registrar/transport-allocations/${p.id}/cancel`, {}), 'Bus pass cancelled'); }}>Cancel pass</Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>

        <Dialog open={!!hostelForm} onOpenChange={(o) => { if (!o) setHostelForm(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>{hostelForm?.id ? 'Edit hostel' : 'Add hostel'}</DialogTitle></DialogHeader>
            {hostelForm && <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label>Name</Label><Input value={hostelForm.name} onChange={(e) => setHostelForm({ ...hostelForm, name: e.target.value })} /></div>
              <div className="space-y-1"><Label>Block</Label><Input value={hostelForm.block} onChange={(e) => setHostelForm({ ...hostelForm, block: e.target.value })} /></div>
              <div className="space-y-1"><Label>Warden</Label><Input value={hostelForm.wardenName} onChange={(e) => setHostelForm({ ...hostelForm, wardenName: e.target.value })} /></div>
              <div className="space-y-1"><Label>Warden phone</Label><Input value={hostelForm.wardenPhone} onChange={(e) => setHostelForm({ ...hostelForm, wardenPhone: e.target.value })} /></div>
              <div className="space-y-1"><Label>Beds</Label><Input type="number" value={hostelForm.capacity} onChange={(e) => setHostelForm({ ...hostelForm, capacity: e.target.value })} /></div>
              <div className="space-y-1"><Label>For</Label>
                <Select value={hostelForm.hostelType} onValueChange={(v) => setHostelForm({ ...hostelForm, hostelType: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['boys', 'girls', 'staff'].map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1 sm:col-span-2"><Label>Fee per semester (₹, incl. mess)</Label><Input type="number" value={hostelForm.feePerSemester} onChange={(e) => setHostelForm({ ...hostelForm, feePerSemester: e.target.value })} /></div>
            </div>}
            <DialogFooter><Button variant="outline" onClick={() => setHostelForm(null)}>Cancel</Button><Button disabled={busy || !hostelForm?.name || !hostelForm?.block || !hostelForm?.wardenName || !hostelForm?.wardenPhone} onClick={saveHostel}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!routeForm} onOpenChange={(o) => { if (!o) setRouteForm(null); }}>
          <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
            <DialogHeader><DialogTitle>{routeForm?.id ? 'Edit route' : 'Add route'}</DialogTitle><DialogDescription>Each stop has its pickup time and the yearly fee for boarding there.</DialogDescription></DialogHeader>
            {routeForm && <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1"><Label>Code</Label><Input value={routeForm.code} onChange={(e) => setRouteForm({ ...routeForm, code: e.target.value })} placeholder="R-04" /></div>
                <div className="space-y-1 sm:col-span-2"><Label>Name</Label><Input value={routeForm.name} onChange={(e) => setRouteForm({ ...routeForm, name: e.target.value })} placeholder="Benz Circle – Campus" /></div>
                <div className="space-y-1"><Label>Vehicle</Label><Input value={routeForm.vehicleNumber} onChange={(e) => setRouteForm({ ...routeForm, vehicleNumber: e.target.value })} /></div>
                <div className="space-y-1"><Label>Driver</Label><Input value={routeForm.driverName} onChange={(e) => setRouteForm({ ...routeForm, driverName: e.target.value })} /></div>
                <div className="space-y-1"><Label>Driver phone</Label><Input value={routeForm.driverPhone} onChange={(e) => setRouteForm({ ...routeForm, driverPhone: e.target.value })} /></div>
                <div className="space-y-1"><Label>Seats</Label><Input type="number" value={routeForm.capacity} onChange={(e) => setRouteForm({ ...routeForm, capacity: e.target.value })} /></div>
              </div>
              <Label>Stops</Label>
              {routeForm.stops.map((s, i) => (
                <div key={i} className="grid grid-cols-[1fr_6rem_7rem_auto] gap-2">
                  <Input placeholder="Stop name" value={s.name} onChange={(e) => setRouteForm({ ...routeForm, stops: routeForm.stops.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                  <Input type="time" value={s.time} onChange={(e) => setRouteForm({ ...routeForm, stops: routeForm.stops.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)) })} />
                  <Input type="number" placeholder="Fee/year" value={s.fee} onChange={(e) => setRouteForm({ ...routeForm, stops: routeForm.stops.map((x, j) => (j === i ? { ...x, fee: e.target.value } : x)) })} />
                  <Button size="icon" variant="ghost" onClick={() => setRouteForm({ ...routeForm, stops: routeForm.stops.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => setRouteForm({ ...routeForm, stops: [...routeForm.stops, { name: '', time: '07:45', fee: '' }] })}>Add stop</Button>
            </div>}
            <DialogFooter><Button variant="outline" onClick={() => setRouteForm(null)}>Cancel</Button><Button disabled={busy || !routeForm?.code || !routeForm?.name || !routeForm?.stops.some((s) => s.name.trim())} onClick={saveRoute}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!alloc} onOpenChange={(o) => { if (!o) setAlloc(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>{alloc?.service === 'hostel' ? 'Allot a room' : 'Issue a bus pass'}{alloc?.studentName ? ` — ${alloc.studentName}` : ''}</DialogTitle><DialogDescription>The fee is added to the student’s account and they are notified.</DialogDescription></DialogHeader>
            {alloc && <div className="space-y-3">
              {!alloc.requestId && <div className="space-y-1"><Label>Student</Label>
                <Select value={alloc.studentUserId ?? ''} onValueChange={(v) => setAlloc({ ...alloc, studentUserId: v, studentProfileId: studentProfileIdOf(v)?.profileId ?? '' })}><SelectTrigger><SelectValue placeholder="Choose a student" /></SelectTrigger>
                  <SelectContent>{students.map((s) => <SelectItem key={s.id} value={s.id}>{s.rollNo} — {s.name}</SelectItem>)}</SelectContent></Select>
              </div>}
              {alloc.service === 'hostel' ? <>
                <div className="space-y-1"><Label>Hostel</Label>
                  <Select value={alloc.hostelId} onValueChange={(v) => setAlloc({ ...alloc, hostelId: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{hostels.map((h) => <SelectItem key={h.id} value={h.id}>{h.name} · Block {h.block}{h.vacant != null ? ` · ${h.vacant} vacant` : ''}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Room</Label><Input value={alloc.roomNumber} onChange={(e) => setAlloc({ ...alloc, roomNumber: e.target.value })} placeholder="A-214" /></div>
                  <div className="space-y-1"><Label>Room type</Label>
                    <Select value={alloc.roomType} onValueChange={(v) => setAlloc({ ...alloc, roomType: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{['single', 'double', 'triple', 'dormitory'].map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent></Select>
                  </div>
                </div>
              </> : <>
                <div className="space-y-1"><Label>Route</Label>
                  <Select value={alloc.routeId} onValueChange={(v) => setAlloc({ ...alloc, routeId: v, stop: '' })}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{routes.map((r) => <SelectItem key={r.id} value={r.id}>{r.code} — {r.name} · {r.seatsLeft} seats left</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="space-y-1"><Label>Stop</Label>
                  <Select value={alloc.stop} onValueChange={(v) => setAlloc({ ...alloc, stop: v })}><SelectTrigger><SelectValue placeholder="Boarding stop" /></SelectTrigger>
                    <SelectContent>{(allocRoute?.stops ?? []).map((s: any) => <SelectItem key={s.name} value={s.name}>{s.name} · ₹{Number(s.fee).toLocaleString('en-IN')}</SelectItem>)}</SelectContent></Select>
                </div>
              </>}
            </div>}
            <DialogFooter><Button variant="outline" onClick={() => setAlloc(null)}>Cancel</Button><Button disabled={busy || !alloc?.studentProfileId || (alloc?.service === 'hostel' ? !alloc?.hostelId || !alloc?.roomNumber : !alloc?.routeId || !alloc?.stop)} onClick={allocate}>Allocate</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Users, Medal, Calendar, MapPin, Search, Plus, Dumbbell, Activity, Package, ClipboardList, Heart } from 'lucide-react';
import { sportsAthletes, sportsTeams, sportsFacilities, sportsInventory, sportsEvents } from '@/data/sportsMockData';

export default function SportsDashboard() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Sports Department</h1>
            <p className="text-muted-foreground">Athlete management, teams, facilities, and events</p>
          </div>
          <Button size="sm"><Plus className="mr-2 h-4 w-4" />Register Athlete</Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Users className="h-8 w-8 text-primary" /><div><p className="text-xs text-muted-foreground">Active Athletes</p><p className="text-2xl font-bold">{sportsAthletes.length + 85}</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Trophy className="h-8 w-8 text-amber-500" /><div><p className="text-xs text-muted-foreground">Teams</p><p className="text-2xl font-bold">{sportsTeams.length + 10}</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Medal className="h-8 w-8 text-yellow-600" /><div><p className="text-xs text-muted-foreground">Medals This Year</p><p className="text-2xl font-bold">24</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><MapPin className="h-8 w-8 text-green-600" /><div><p className="text-xs text-muted-foreground">Facilities</p><p className="text-2xl font-bold">{sportsFacilities.length}</p></div></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center gap-3"><Calendar className="h-8 w-8 text-blue-600" /><div><p className="text-xs text-muted-foreground">Upcoming Events</p><p className="text-2xl font-bold">{sportsEvents.length}</p></div></div></CardContent></Card>
        </div>

        <Tabs defaultValue="athletes">
          <TabsList>
            <TabsTrigger value="athletes">Athletes</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="facilities">Facilities</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="health">Health Records</TabsTrigger>
          </TabsList>

          <TabsContent value="athletes" className="space-y-4">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search athletes..." className="pl-10" /></div>
            {sportsAthletes.map((a) => (
              <Card key={a.id}><CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"><Dumbbell className="h-6 w-6 text-primary" /></div>
                  <div>
                    <p className="font-semibold text-foreground">{a.studentName}</p>
                    <p className="text-sm text-muted-foreground">{a.rollNumber} • {a.program} – Year {a.year}</p>
                    <div className="mt-1 flex gap-2">{a.sports.map((s,i) => <Badge key={i} variant="outline">{s.sport} ({s.level})</Badge>)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {a.achievements.length > 0 && <Badge variant="default"><Medal className="mr-1 h-3 w-3" />{a.achievements.length} medals</Badge>}
                  <Badge variant={a.status === 'active' ? 'default' : a.status === 'injured' ? 'destructive' : 'secondary'} className="capitalize">{a.status}</Badge>
                  <Button variant="outline" size="sm">Profile</Button>
                </div>
              </CardContent></Card>
            ))}
          </TabsContent>

          <TabsContent value="teams" className="space-y-4">
            {sportsTeams.map((t) => (
              <Card key={t.id}><CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{t.sport} – {t.category === 'men' ? "Men's" : "Women's"} Team</h3>
                    <p className="text-sm text-muted-foreground">Coach: {t.coach} {t.captain && `• Captain: ${t.captain}`}</p>
                    <p className="text-sm text-muted-foreground">{t.members.length} members • Season: {t.season}</p>
                    <div className="mt-2 flex gap-2">
                      {t.members.slice(0,3).map((m,i) => <Badge key={i} variant="outline">{m.studentName} ({m.position})</Badge>)}
                      {t.members.length > 3 && <Badge variant="secondary">+{t.members.length-3} more</Badge>}
                    </div>
                  </div>
                  <Badge variant={t.status === 'active' ? 'default' : 'secondary'} className="capitalize">{t.status}</Badge>
                </div>
              </CardContent></Card>
            ))}
          </TabsContent>

          <TabsContent value="facilities">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {sportsFacilities.map((f) => (
                <Card key={f.id}><CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">{f.name}</h3>
                      <p className="text-sm text-muted-foreground capitalize">{f.type} • Capacity: {f.capacity}</p>
                      <p className="text-sm text-muted-foreground">Sports: {f.sports.join(', ')}</p>
                      <div className="mt-2 flex flex-wrap gap-1">{f.amenities.map((a,i) => <Badge key={i} variant="outline" className="text-xs">{a}</Badge>)}</div>
                    </div>
                    <Badge variant={f.status === 'available' ? 'default' : f.status === 'maintenance' ? 'destructive' : 'secondary'} className="capitalize">{f.status}</Badge>
                  </div>
                  <Button variant="outline" size="sm" className="mt-3">Book Facility</Button>
                </CardContent></Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="inventory">
            <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Item</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Sport</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Qty</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Available</th>
              <th className="px-4 py-3 text-sm font-medium text-muted-foreground">Condition</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Value</th>
            </tr></thead><tbody>
              {sportsInventory.map((si) => (
                <tr key={si.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3"><p className="text-sm font-medium text-foreground">{si.itemName}</p>{si.brand && <p className="text-xs text-muted-foreground">{si.brand}</p>}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{si.sport}</td>
                  <td className="px-4 py-3 text-center text-sm text-foreground">{si.quantity}</td>
                  <td className="px-4 py-3 text-center text-sm text-foreground">{si.availableQuantity}</td>
                  <td className="px-4 py-3"><Badge variant={si.condition === 'excellent' ? 'default' : si.condition === 'good' ? 'default' : 'secondary'} className="capitalize">{si.condition}</Badge></td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-foreground">₹{si.totalValue.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody></table></div></CardContent></Card>
          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            {sportsEvents.map((e) => (
              <Card key={e.id}><CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{e.name}</h3>
                    <p className="text-sm text-muted-foreground">{e.startDate.toLocaleDateString('en-IN')} – {e.endDate.toLocaleDateString('en-IN')} • {e.venue}</p>
                    <div className="mt-2 flex flex-wrap gap-1">{e.sports.map((s,i) => <Badge key={i} variant="outline">{s}</Badge>)}</div>
                  </div>
                  <Badge variant={e.status === 'ongoing' ? 'default' : 'secondary'} className="capitalize">{e.status}</Badge>
                </div>
              </CardContent></Card>
            ))}
          </TabsContent>

          <TabsContent value="health">
            <Card><CardContent className="flex flex-col items-center justify-center py-16">
              <Heart className="h-16 w-16 text-muted-foreground/30" />
              <h3 className="mt-4 text-lg font-semibold">Health & Fitness Records</h3>
              <p className="text-sm text-muted-foreground">Track fitness tests, medical checkups, and injury records for athletes</p>
              <Button className="mt-4">View Records</Button>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
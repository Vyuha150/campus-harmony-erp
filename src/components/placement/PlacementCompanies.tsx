import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Building2, Search, Plus, Users, Calendar, Mail, Phone,
  Globe, MapPin, Star, Download, Edit, Send, ExternalLink, Award
} from 'lucide-react';
import { companies } from '@/data/placementMockData';

export default function PlacementCompanies() {
  const active = companies.filter(c => c.status === 'active').length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Company Management</h1>
            <p className="text-muted-foreground">Manage recruiting companies, send invitations, and schedule drives</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Export</Button>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Company</Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Companies</p><p className="text-2xl font-bold text-foreground">{companies.length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Active Partners</p><p className="text-2xl font-bold text-green-600">{active}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Invitations Sent</p><p className="text-2xl font-bold text-foreground">142</p><p className="text-xs text-muted-foreground">This season</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Confirmed Visits</p><p className="text-2xl font-bold text-foreground">78</p></CardContent></Card>
        </div>

        <Tabs defaultValue="directory">
          <TabsList>
            <TabsTrigger value="directory">Company Directory</TabsTrigger>
            <TabsTrigger value="invitations">Invitations</TabsTrigger>
            <TabsTrigger value="schedule">Drive Schedule</TabsTrigger>
          </TabsList>

          <TabsContent value="directory" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search companies..." className="pl-10" />
              </div>
              <Select defaultValue="all">
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Industries</SelectItem>
                  <SelectItem value="it">IT Services</SelectItem>
                  <SelectItem value="tech">Technology</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {companies.map((c) => (
                <Card key={c.id} className="hover:bg-muted/20 transition-colors">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                          <Building2 className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground">{c.name}</h3>
                            <Badge variant={c.status === 'active' ? 'default' : 'destructive'} className="capitalize">{c.status}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{c.industry} • {c.companySize} employees</p>
                          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                            <p><Users className="mr-1 inline h-3 w-3" />{c.contactPerson}</p>
                            <p><Mail className="mr-1 inline h-3 w-3" />{c.email}</p>
                            <p><MapPin className="mr-1 inline h-3 w-3" />{c.address}</p>
                          </div>
                          <div className="mt-2 flex items-center gap-3 text-sm">
                            <span className="font-medium text-foreground"><Award className="mr-1 inline h-3 w-3 text-primary" />{c.totalHires} total hires</span>
                            {c.lastVisit && <span className="text-muted-foreground">Last: {c.lastVisit.toLocaleDateString('en-IN')}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2 border-t pt-3">
                      <Button variant="ghost" size="sm"><Edit className="mr-1 h-3 w-3" />Edit</Button>
                      <Button variant="outline" size="sm"><Send className="mr-1 h-3 w-3" />Invite</Button>
                      <Button variant="outline" size="sm"><Calendar className="mr-1 h-3 w-3" />Schedule</Button>
                      {c.website && <Button variant="ghost" size="sm"><ExternalLink className="mr-1 h-3 w-3" />Website</Button>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="invitations">
            <Card>
              <CardHeader><CardTitle className="text-lg">Bulk Invitation Manager</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Send formal invitation letters to companies with student data brochure. Use templates for email or generate PDF letters.</p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Card className="cursor-pointer hover:bg-muted/30">
                    <CardContent className="flex flex-col items-center p-6 text-center">
                      <Mail className="h-10 w-10 text-primary/60" />
                      <h3 className="mt-3 font-semibold text-foreground">Email Invitation</h3>
                      <p className="mt-1 text-xs text-muted-foreground">Send templated email with brochure attachment</p>
                      <Button size="sm" className="mt-3">Compose</Button>
                    </CardContent>
                  </Card>
                  <Card className="cursor-pointer hover:bg-muted/30">
                    <CardContent className="flex flex-col items-center p-6 text-center">
                      <Download className="h-10 w-10 text-primary/60" />
                      <h3 className="mt-3 font-semibold text-foreground">PDF Letter</h3>
                      <p className="mt-1 text-xs text-muted-foreground">Generate formal invitation letter for print/email</p>
                      <Button size="sm" variant="outline" className="mt-3">Generate</Button>
                    </CardContent>
                  </Card>
                  <Card className="cursor-pointer hover:bg-muted/30">
                    <CardContent className="flex flex-col items-center p-6 text-center">
                      <Send className="h-10 w-10 text-primary/60" />
                      <h3 className="mt-3 font-semibold text-foreground">WhatsApp Update</h3>
                      <p className="mt-1 text-xs text-muted-foreground">Quick follow-up via WhatsApp Business API</p>
                      <Button size="sm" variant="outline" className="mt-3">Send</Button>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schedule">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Calendar className="h-16 w-16 text-muted-foreground/30" />
                <h3 className="mt-4 text-lg font-semibold text-foreground">Drive Schedule Calendar</h3>
                <p className="mt-2 text-sm text-muted-foreground">View all scheduled placement drives in a calendar view. Coordinate with academic calendar to avoid clashes.</p>
                <Button className="mt-4">Open Calendar View</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  Settings, Building2, Calendar, GraduationCap, Globe, Mail, Phone, MapPin, Save, Edit, Plus
} from 'lucide-react';
import { academicYears, departments } from '@/data/adminMockData';
import { useState } from 'react';

export default function AdminSystemConfig() {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">System Configuration</h1>
            <p className="text-muted-foreground">University settings, academic calendar, and department management</p>
          </div>
        </div>

        <Tabs defaultValue="university">
          <TabsList>
            <TabsTrigger value="university">University Profile</TabsTrigger>
            <TabsTrigger value="academic">Academic Years</TabsTrigger>
            <TabsTrigger value="departments">Departments</TabsTrigger>
          </TabsList>

          <TabsContent value="university" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">University Information</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(!isEditing)}>
                    <Edit className="mr-2 h-4 w-4" />{isEditing ? 'Cancel' : 'Edit'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div><Label>University Name</Label><Input defaultValue="National Institute of Technology" disabled={!isEditing} /></div>
                  <div><Label>Short Name</Label><Input defaultValue="NIT" disabled={!isEditing} /></div>
                  <div><Label>Website</Label><Input defaultValue="https://www.nit.edu.in" disabled={!isEditing} /></div>
                  <div><Label>Email</Label><Input defaultValue="admin@nit.edu.in" disabled={!isEditing} /></div>
                  <div><Label>Phone</Label><Input defaultValue="+91-44-2257-1000" disabled={!isEditing} /></div>
                  <div><Label>Established Year</Label><Input defaultValue="1985" type="number" disabled={!isEditing} /></div>
                </div>
                <div><Label>Address</Label><Textarea defaultValue="National Institute of Technology Campus, Chennai, Tamil Nadu - 600036, India" disabled={!isEditing} /></div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div><Label>Type</Label><Input defaultValue="Deemed University" disabled={!isEditing} /></div>
                  <div><Label>NAAC Grade</Label><Input defaultValue="A+" disabled={!isEditing} /></div>
                  <div><Label>NIRF Rank</Label><Input defaultValue="42" type="number" disabled={!isEditing} /></div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div><Label>Chancellor</Label><Input defaultValue="Shri. Ravi Shankar" disabled={!isEditing} /></div>
                  <div><Label>Vice Chancellor</Label><Input defaultValue="Dr. Ramesh Venkataraman" disabled={!isEditing} /></div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2"><Switch id="ugc" defaultChecked disabled={!isEditing} /><Label htmlFor="ugc">UGC Recognized</Label></div>
                  <div className="flex items-center gap-2"><Switch id="aicte" defaultChecked disabled={!isEditing} /><Label htmlFor="aicte">AICTE Approved</Label></div>
                </div>
                {isEditing && (
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                    <Button onClick={() => setIsEditing(false)}><Save className="mr-2 h-4 w-4" />Save Changes</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* System Preferences */}
            <Card>
              <CardHeader><CardTitle className="text-base">System Preferences</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div><p className="text-sm font-medium text-foreground">Maintenance Mode</p><p className="text-xs text-muted-foreground">Disable access for non-admin users</p></div>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div><p className="text-sm font-medium text-foreground">Email Notifications</p><p className="text-xs text-muted-foreground">Global email notification toggle</p></div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div><p className="text-sm font-medium text-foreground">Two-Factor Authentication</p><p className="text-xs text-muted-foreground">Require 2FA for all admin users</p></div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div><p className="text-sm font-medium text-foreground">Auto Backup</p><p className="text-xs text-muted-foreground">Daily automated database backups</p></div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div><p className="text-sm font-medium text-foreground">Student Self-Registration</p><p className="text-xs text-muted-foreground">Allow students to register accounts</p></div>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div><p className="text-sm font-medium text-foreground">Audit Logging</p><p className="text-xs text-muted-foreground">Track all user actions in audit log</p></div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="academic" className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Academic Year</Button>
            </div>
            {academicYears.map(ay => (
              <Card key={ay.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-primary" />
                      <div>
                        <CardTitle className="text-base">Academic Year {ay.year}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {ay.startDate.toLocaleDateString('en-IN')} – {ay.endDate.toLocaleDateString('en-IN')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {ay.isCurrent && <Badge>Current</Badge>}
                      <Badge variant={ay.status === 'active' ? 'default' : ay.status === 'upcoming' ? 'secondary' : 'outline'} className="capitalize">{ay.status}</Badge>
                      <Button variant="outline" size="sm"><Edit className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Semester</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>End</TableHead>
                        <TableHead>Registration Deadline</TableHead>
                        <TableHead>Exam Period</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ay.semesters.map(s => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium text-foreground">{s.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{s.startDate.toLocaleDateString('en-IN')}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{s.endDate.toLocaleDateString('en-IN')}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{s.registrationDeadline.toLocaleDateString('en-IN')}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {s.examStartDate ? `${s.examStartDate.toLocaleDateString('en-IN')} – ${s.examEndDate?.toLocaleDateString('en-IN')}` : '—'}
                          </TableCell>
                          <TableCell><Badge variant={s.status === 'active' ? 'default' : s.status === 'completed' ? 'outline' : 'secondary'} className="capitalize">{s.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="departments" className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Department</Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Department</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>HOD</TableHead>
                      <TableHead className="text-center">Faculty</TableHead>
                      <TableHead className="text-center">Students</TableHead>
                      <TableHead className="text-center">Programs</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departments.map(d => (
                      <TableRow key={d.id}>
                        <TableCell>
                          <p className="font-medium text-foreground">{d.name}</p>
                          <p className="text-xs text-muted-foreground">Est. {d.established}</p>
                        </TableCell>
                        <TableCell><Badge variant="outline">{d.code}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{d.hod}</TableCell>
                        <TableCell className="text-center text-sm text-foreground">{d.faculty}</TableCell>
                        <TableCell className="text-center text-sm text-foreground">{d.students}</TableCell>
                        <TableCell className="text-center text-sm text-foreground">{d.programs}</TableCell>
                        <TableCell><Badge variant={d.status === 'active' ? 'default' : 'secondary'} className="capitalize">{d.status}</Badge></TableCell>
                        <TableCell className="text-right"><Button variant="ghost" size="sm"><Edit className="h-4 w-4" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

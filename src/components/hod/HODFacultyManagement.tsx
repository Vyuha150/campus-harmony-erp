import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Users, Search, Mail, Phone, BookOpen, Award, UserCheck,
  UserX, Edit, Eye, MoreHorizontal
} from 'lucide-react';
import { departmentFaculty } from '@/data/hodMockData';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function HODFacultyManagement() {
  const [search, setSearch] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState<string | null>(null);
  const { toast } = useToast();

  const filtered = departmentFaculty.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.specialization.toLowerCase().includes(search.toLowerCase())
  );

  const faculty = departmentFaculty.find(f => f.id === selectedFaculty);

  if (faculty) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Button variant="ghost" size="sm" onClick={() => setSelectedFaculty(null)}>← Back to Faculty List</Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{faculty.name}</h1>
              <p className="text-muted-foreground">{faculty.employeeId} • {faculty.designation} • {faculty.specialization}</p>
            </div>
            <Badge variant={faculty.isOnLeave ? 'destructive' : 'default'}>{faculty.isOnLeave ? 'On Leave' : 'Active'}</Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            {[
              { label: 'Courses', value: faculty.coursesAssigned },
              { label: 'Weekly Hours', value: `${faculty.weeklyHours}h` },
              { label: 'Publications', value: faculty.publications },
              { label: 'Type', value: faculty.type.charAt(0).toUpperCase() + faculty.type.slice(1) },
            ].map(s => (
              <Card key={s.label} className="border-border">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{faculty.email}</p>
              <p className="text-sm flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{faculty.phone}</p>
              <p className="text-sm"><span className="text-muted-foreground">Qualification:</span> {faculty.qualification}</p>
              <p className="text-sm"><span className="text-muted-foreground">Joined:</span> {faculty.dateOfJoining}</p>
            </div>
            <Card className="border-border">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Assigned Roles</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {faculty.roles.length === 0
                  ? <p className="text-sm text-muted-foreground">No special roles assigned</p>
                  : faculty.roles.map((role, i) => <Badge key={i} variant="secondary">{role}</Badge>)
                }
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => toast({ title: 'Role Updated' })}>
              <Edit className="mr-1 h-4 w-4" />Assign Role
            </Button>
            <Button variant="outline" onClick={() => toast({ title: 'Recommendation Submitted' })}>
              <Award className="mr-1 h-4 w-4" />Recommend for Promotion
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Faculty Management</h1>
            <p className="text-muted-foreground">Manage all faculty members in the department</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{departmentFaculty.filter(f => f.type === 'permanent').length} Permanent</Badge>
            <Badge variant="secondary">{departmentFaculty.filter(f => f.type !== 'permanent').length} Adjunct/Visiting</Badge>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search faculty..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <Card className="border-border">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Specialization</TableHead>
                  <TableHead className="text-center">Courses</TableHead>
                  <TableHead className="text-center">Hours/Week</TableHead>
                  <TableHead className="text-center">Publications</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((f) => (
                  <TableRow key={f.id} className="cursor-pointer" onClick={() => setSelectedFaculty(f.id)}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{f.name}</p>
                        <p className="text-xs text-muted-foreground">{f.employeeId}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{f.designation}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate text-sm text-muted-foreground">{f.specialization}</TableCell>
                    <TableCell className="text-center">{f.coursesAssigned}</TableCell>
                    <TableCell className="text-center">{f.weeklyHours}h</TableCell>
                    <TableCell className="text-center">{f.publications}</TableCell>
                    <TableCell>
                      {f.isOnLeave ? (
                        <Badge variant="destructive" className="text-[10px]"><UserX className="mr-1 h-3 w-3" />On Leave</Badge>
                      ) : (
                        <Badge variant="default" className="text-[10px]"><UserCheck className="mr-1 h-3 w-3" />Active</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedFaculty(f.id)}>
                            <Eye className="mr-2 h-4 w-4" />View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast({ title: 'Leave Approved' })}>
                            Approve Leave
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast({ title: 'Role Assigned' })}>
                            Assign Role
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

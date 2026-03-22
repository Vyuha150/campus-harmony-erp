import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Users, Search, Mail, Phone, BookOpen, Award, UserCheck,
  UserX, Edit, Eye, MoreHorizontal, Plus, Send, Clock
} from 'lucide-react';
import { fetchApi, postApi, putApi } from '@/lib/apiService';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { DepartmentFaculty } from '@/types/hod';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const availableRoles = [
  'Class Coordinator', 'Lab In-charge', 'Exam Coordinator', 'NSS Coordinator',
  'Placement Coordinator', 'Mentoring Coordinator', 'Club Advisor',
  'NAAC Criterion Lead', 'IQAC Member', 'BoS Member', 'PhD Guide',
];

export default function HODFacultyManagement() {
  const [departmentFaculty, setDepartmentFaculty] = useState<any>([]);
  const [_apiLoading, _setApiLoading] = useState(true);
  useEffect(() => {
    fetchApi('/hod/departmentfaculty').then(d => setDepartmentFaculty(d)).catch((error) => { console.error('API request failed', error); });
    _setApiLoading(false);
  }, []);

  const [search, setSearch] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState<string | null>(null);
  const [faculty, setFaculty] = useState<DepartmentFaculty[]>([]);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showPromoDialog, setShowPromoDialog] = useState(false);
  const [roleTarget, setRoleTarget] = useState<DepartmentFaculty | null>(null);
  const [newRole, setNewRole] = useState('');
  const [promoReason, setPromoReason] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    setFaculty(Array.isArray(departmentFaculty) ? departmentFaculty : []);
  }, [departmentFaculty]);

  const filtered = faculty.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.specialization.toLowerCase().includes(search.toLowerCase())
  );

  const currentFaculty = faculty.find(f => f.id === selectedFaculty);

  const handleAssignRole = async () => {
    if (roleTarget && newRole) {
      try {
        const updatedRoles = [...roleTarget.roles, newRole];
        await putApi(`/hod/faculty/${roleTarget.id}/roles`, { roles: updatedRoles });
        setFaculty(prev => prev.map(f =>
          f.id === roleTarget.id ? { ...f, roles: updatedRoles } : f
        ));
        toast({ title: 'Role Assigned', description: `"${newRole}" assigned to ${roleTarget.name}` });
        setShowRoleDialog(false);
        setNewRole('');
      } catch (error: any) {
        toast({ title: 'Update failed', description: error?.message || 'Unable to assign role', variant: 'destructive' });
      }
    }
  };

  const handleRemoveRole = async (fId: string, role: string) => {
    try {
      const target = faculty.find((f) => f.id === fId);
      if (!target) return;
      const updatedRoles = target.roles.filter((r) => r !== role);
      await putApi(`/hod/faculty/${fId}/roles`, { roles: updatedRoles });
      setFaculty(prev => prev.map(f =>
        f.id === fId ? { ...f, roles: updatedRoles } : f
      ));
      toast({ title: 'Role Removed', description: `"${role}" removed` });
    } catch (error: any) {
      toast({ title: 'Update failed', description: error?.message || 'Unable to remove role', variant: 'destructive' });
    }
  };

  const handleApproveLeave = async (f: DepartmentFaculty) => {
    try {
      await putApi(`/hod/faculty/${f.id}/leave`, { action: 'approve' });
      setFaculty(prev => prev.map(fac =>
        fac.id === f.id ? { ...fac, isOnLeave: true, leaveType: 'Approved Leave' } : fac
      ));
      toast({ title: 'Leave Approved', description: `Leave approved for ${f.name}` });
      setShowLeaveDialog(false);
    } catch (error: any) {
      toast({ title: 'Update failed', description: error?.message || 'Unable to approve leave', variant: 'destructive' });
    }
  };

  const handleRejectLeave = async (f: DepartmentFaculty) => {
    try {
      await putApi(`/hod/faculty/${f.id}/leave`, { action: 'reject' });
      setFaculty(prev => prev.map(fac =>
        fac.id === f.id ? { ...fac, isOnLeave: false, leaveType: undefined } : fac
      ));
      toast({ title: 'Leave Rejected', description: `Leave rejected for ${f.name}` });
      setShowLeaveDialog(false);
    } catch (error: any) {
      toast({ title: 'Update failed', description: error?.message || 'Unable to reject leave', variant: 'destructive' });
    }
  };

  const handlePromote = async () => {
    if (roleTarget) {
      try {
        await postApi(`/hod/faculty/${roleTarget.id}/promotion-recommendation`, { reason: promoReason });
        toast({ title: '📤 Promotion Recommended', description: `Recommendation for ${roleTarget.name} forwarded to Dean. Reason: ${promoReason || 'N/A'}` });
        setShowPromoDialog(false);
        setPromoReason('');
      } catch (error: any) {
        toast({ title: 'Action failed', description: error?.message || 'Unable to submit recommendation', variant: 'destructive' });
      }
    }
  };

  if (currentFaculty) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Button variant="ghost" size="sm" onClick={() => setSelectedFaculty(null)}>← Back to Faculty List</Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{currentFaculty.name}</h1>
              <p className="text-muted-foreground">{currentFaculty.employeeId} • {currentFaculty.designation} • {currentFaculty.specialization}</p>
            </div>
            <Badge variant={currentFaculty.isOnLeave ? 'destructive' : 'default'}>{currentFaculty.isOnLeave ? `On Leave (${currentFaculty.leaveType})` : 'Active'}</Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            {[
              { label: 'Courses', value: currentFaculty.coursesAssigned },
              { label: 'Weekly Hours', value: `${currentFaculty.weeklyHours}h` },
              { label: 'Publications', value: currentFaculty.publications },
              { label: 'Type', value: currentFaculty.type.charAt(0).toUpperCase() + currentFaculty.type.slice(1) },
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
              <p className="text-sm flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{currentFaculty.email}</p>
              <p className="text-sm flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{currentFaculty.phone}</p>
              <p className="text-sm"><span className="text-muted-foreground">Qualification:</span> {currentFaculty.qualification}</p>
              <p className="text-sm"><span className="text-muted-foreground">Joined:</span> {currentFaculty.dateOfJoining}</p>
            </div>
            <Card className="border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Assigned Roles</CardTitle>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setRoleTarget(currentFaculty); setShowRoleDialog(true); }}>
                    <Plus className="mr-1 h-3 w-3" />Add Role
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {currentFaculty.roles.length === 0
                  ? <p className="text-sm text-muted-foreground">No special roles assigned</p>
                  : currentFaculty.roles.map((role, i) => (
                    <Badge key={i} variant="secondary" className="cursor-pointer hover:bg-destructive/20" onClick={() => handleRemoveRole(currentFaculty.id, role)}>
                      {role} ×
                    </Badge>
                  ))
                }
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setRoleTarget(currentFaculty); setShowRoleDialog(true); }}>
              <Edit className="mr-1 h-4 w-4" />Assign Role
            </Button>
            <Button variant="outline" onClick={() => { setRoleTarget(currentFaculty); setShowPromoDialog(true); }}>
              <Award className="mr-1 h-4 w-4" />Recommend for Promotion
            </Button>
            <Button variant="outline" onClick={() => { setRoleTarget(currentFaculty); setShowLeaveDialog(true); }}>
              <Clock className="mr-1 h-4 w-4" />Manage Leave
            </Button>
            <Button variant="outline" onClick={() => toast({ title: 'Email Sent', description: `Message sent to ${currentFaculty.email}` })}>
              <Send className="mr-1 h-4 w-4" />Send Message
            </Button>
          </div>
        </div>

        {/* Role Dialog */}
        <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Assign Role to {roleTarget?.name}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Select Role</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger><SelectValue placeholder="Choose a role..." /></SelectTrigger>
                  <SelectContent>
                    {availableRoles.filter(r => !roleTarget?.roles.includes(r)).map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowRoleDialog(false)}>Cancel</Button>
                <Button onClick={handleAssignRole} disabled={!newRole}>Assign Role</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Leave Dialog */}
        <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Manage Leave – {roleTarget?.name}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Current Status: {roleTarget?.isOnLeave ? `On Leave (${roleTarget.leaveType})` : 'Active'}
              </p>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => roleTarget && handleApproveLeave(roleTarget)}>
                  <UserCheck className="mr-1 h-4 w-4" />Approve Leave
                </Button>
                <Button variant="destructive" className="flex-1" onClick={() => roleTarget && handleRejectLeave(roleTarget)}>
                  <UserX className="mr-1 h-4 w-4" />Reject / Cancel Leave
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Promotion Dialog */}
        <Dialog open={showPromoDialog} onOpenChange={setShowPromoDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Recommend {roleTarget?.name} for Promotion</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Current: {roleTarget?.designation} • Publications: {roleTarget?.publications} • Experience since {roleTarget?.dateOfJoining}
              </p>
              <div>
                <Label>Justification / Remarks</Label>
                <Textarea placeholder="Reason for recommendation..." value={promoReason} onChange={e => setPromoReason(e.target.value)} rows={3} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowPromoDialog(false)}>Cancel</Button>
                <Button onClick={handlePromote}>
                  <Award className="mr-1 h-4 w-4" />Submit Recommendation
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
            <Badge variant="outline">{faculty.filter(f => f.type === 'permanent').length} Permanent</Badge>
            <Badge variant="secondary">{faculty.filter(f => f.type !== 'permanent').length} Adjunct/Visiting</Badge>
            <Badge variant={faculty.some(f => f.isOnLeave) ? 'destructive' : 'default'}>
              {faculty.filter(f => f.isOnLeave).length} On Leave
            </Badge>
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
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRoleTarget(f); setShowRoleDialog(true); }}>
                            <Edit className="mr-2 h-4 w-4" />Assign Role
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRoleTarget(f); setShowLeaveDialog(true); }}>
                            <Clock className="mr-2 h-4 w-4" />Manage Leave
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRoleTarget(f); setShowPromoDialog(true); }}>
                            <Award className="mr-2 h-4 w-4" />Recommend Promotion
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

      {/* Role Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Role to {roleTarget?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger><SelectValue placeholder="Choose a role..." /></SelectTrigger>
              <SelectContent>
                {availableRoles.filter(r => !roleTarget?.roles.includes(r)).map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowRoleDialog(false)}>Cancel</Button>
              <Button onClick={handleAssignRole} disabled={!newRole}>Assign</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Leave Dialog */}
      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Manage Leave – {roleTarget?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Status: {roleTarget?.isOnLeave ? `On Leave (${roleTarget.leaveType})` : 'Active'}
            </p>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => roleTarget && handleApproveLeave(roleTarget)}>Approve Leave</Button>
              <Button variant="destructive" className="flex-1" onClick={() => roleTarget && handleRejectLeave(roleTarget)}>Reject Leave</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Promotion Dialog */}
      <Dialog open={showPromoDialog} onOpenChange={setShowPromoDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Recommend {roleTarget?.name} for Promotion</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Textarea placeholder="Justification..." value={promoReason} onChange={e => setPromoReason(e.target.value)} rows={3} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPromoDialog(false)}>Cancel</Button>
              <Button onClick={handlePromote}>Submit Recommendation</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { UploadField } from '@/components/ui/upload-field';
import {
  Users, Search, Filter, Plus, Download, MoreHorizontal, Edit, Trash2,
  ShieldCheck, UserX, UserCheck, Mail, Phone, Clock
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { deleteApi, fetchApi, postApi, putApi } from '@/lib/apiService';
import { ROLE_INFO, UserRole } from '@/types/erp';
import { useState, useEffect } from 'react';
import { safeArray, safeDate, safeString } from '@/lib/normalize';
import { toast } from '@/hooks/use-toast';

export default function AdminUserManagement() {
  const [systemUsers, setSystemUsers] = useState<any>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [_apiLoading, _setApiLoading] = useState(true);
  const [importFile, setImportFile] = useState<File | null>(null);

  const normalizeUser = (raw: any) => ({
    id: safeString(raw?.id),
    name: safeString(raw?.name),
    email: safeString(raw?.email),
    role: safeString(raw?.role),
    department: safeString(raw?.department),
    designation: safeString(raw?.designation),
    status: safeString(raw?.status, 'active'),
    loginCount: Number(raw?.loginCount ?? 0),
    lastLogin: raw?.lastLogin ? safeDate(raw?.lastLogin) : null
  });

  useEffect(() => {
    fetchApi('/admin/users').then((d: any) => setSystemUsers(safeArray(d).map(normalizeUser))).catch((error) => { console.error('API request failed', error); });
    fetchApi('/admin/departments').then((d: any) => setDepartments(safeArray(d))).catch((error) => { console.error('API request failed', error); });
    _setApiLoading(false);
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    role: 'student',
    departmentId: '',
    designation: '',
    password: ''
  });

  const resetForm = () => {
    setUserForm({ name: '', email: '', role: 'student', departmentId: '', designation: '', password: '' });
    setEditingUserId(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setShowAddDialog(true);
  };

  const openEditDialog = (user: any) => {
    const department = departments.find((d) => d.name === user.department);
    setUserForm({
      name: user.name,
      email: user.email,
      role: user.role,
      departmentId: safeString(department?.id),
      designation: safeString(user.designation),
      password: ''
    });
    setEditingUserId(user.id);
    setShowAddDialog(true);
  };

  const submitUser = async () => {
    if (!userForm.name.trim() || !userForm.email.trim() || !userForm.role.trim()) {
      toast({ title: 'Missing details', description: 'Name, email, and role are required.', variant: 'destructive' });
      return;
    }

    const payload: Record<string, unknown> = {
      name: userForm.name.trim(),
      email: userForm.email.trim(),
      role: userForm.role,
      designation: userForm.designation.trim() || null,
      departmentId: userForm.departmentId || null
    };

    if (userForm.password.trim()) {
      payload.password = userForm.password.trim();
    }

    try {
      setSubmitting(true);

      if (editingUserId) {
        await putApi(`/admin/users/${editingUserId}`, payload);
        const refreshed = await fetchApi('/admin/users');
        setSystemUsers(safeArray(refreshed).map(normalizeUser));
        toast({ title: 'User updated', description: 'User details were updated successfully.' });
      } else {
        const created = await postApi('/admin/users', {
          ...payload,
          password: userForm.password.trim() || 'password123'
        });
        setSystemUsers((prev: any[]) => [normalizeUser(created), ...prev]);
        toast({ title: 'User created', description: 'New user account created successfully.' });
      }

      setShowAddDialog(false);
      resetForm();
    } catch (error: any) {
      toast({ title: 'Save failed', description: safeString(error?.message, 'Unable to save user.'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const removeUser = async (id: string) => {
    try {
      await deleteApi(`/admin/users/${id}`);
      setSystemUsers((prev: any[]) => prev.filter((user) => user.id !== id));
      toast({ title: 'User deleted', description: 'User account removed successfully.' });
    } catch (error: any) {
      toast({ title: 'Delete failed', description: safeString(error?.message, 'Unable to delete user.'), variant: 'destructive' });
    }
  };

  const exportUsers = () => {
    const blob = new Blob([JSON.stringify(systemUsers, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `admin-users-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importUsersFromFile = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const users = safeArray(data);
      if (users.length === 0) {
        toast({ title: 'Import failed', description: 'File does not contain user records.', variant: 'destructive' });
        return;
      }

      for (const user of users) {
        await postApi('/admin/users', {
          name: safeString(user?.name),
          email: safeString(user?.email),
          role: safeString(user?.role, 'student'),
          designation: safeString(user?.designation),
          departmentId: user?.departmentId || null,
          password: safeString(user?.password, 'password123')
        });
      }

      const refreshed = await fetchApi('/admin/users');
      setSystemUsers(safeArray(refreshed).map(normalizeUser));
      toast({ title: 'Import complete', description: `${users.length} user(s) imported successfully.` });
    } catch (error: any) {
      toast({ title: 'Import failed', description: safeString(error?.message, 'Unable to import users.'), variant: 'destructive' });
    }
  };

  const filtered = systemUsers.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (statusFilter !== 'all' && u.status !== statusFilter) return false;
    if (searchTerm && !u.name.toLowerCase().includes(searchTerm.toLowerCase()) && !u.email.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: systemUsers.length,
    active: systemUsers.filter(u => u.status === 'active').length,
    inactive: systemUsers.filter(u => u.status === 'inactive').length,
    suspended: systemUsers.filter(u => u.status === 'suspended').length,
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default' as const;
      case 'suspended': return 'destructive' as const;
      case 'inactive': return 'secondary' as const;
      default: return 'outline' as const;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">User Management</h1>
            <p className="text-muted-foreground">Manage user accounts, roles, and permissions</p>
          </div>
          <div className="flex gap-2">
            <UploadField
              mode="button"
              buttonText="Bulk Import"
              accept="application/json"
              file={importFile}
              onFileSelect={async (file) => {
                setImportFile(file);
                if (!file) return;
                await importUsersFromFile(file);
                setImportFile(null);
              }}
            />
            <Button variant="outline" size="sm" onClick={exportUsers}><Download className="mr-2 h-4 w-4" />Export</Button>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={openCreateDialog}><Plus className="mr-2 h-4 w-4" />Add User</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>{editingUserId ? 'Edit User' : 'Create New User'}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Full Name</Label><Input placeholder="Dr. John Doe" value={userForm.name} onChange={(event) => setUserForm((prev) => ({ ...prev, name: event.target.value }))} /></div>
                    <div><Label>Email</Label><Input type="email" placeholder="john@university.edu" value={userForm.email} onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Role</Label>
                      <Select value={userForm.role} onValueChange={(value) => setUserForm((prev) => ({ ...prev, role: value }))}>
                        <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(ROLE_INFO).map(([key, info]) => (
                            <SelectItem key={key} value={key}>{info.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Password</Label><Input type="password" placeholder={editingUserId ? 'Leave blank to keep existing' : 'Default: password123'} value={userForm.password} onChange={(event) => setUserForm((prev) => ({ ...prev, password: event.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Department</Label>
                      <Select
                        value={userForm.departmentId || '__none__'}
                        onValueChange={(value) => setUserForm((prev) => ({ ...prev, departmentId: value === '__none__' ? '' : value }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {departments.map((department) => (
                            <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Designation</Label><Input placeholder="Associate Professor" value={userForm.designation} onChange={(event) => setUserForm((prev) => ({ ...prev, designation: event.target.value }))} /></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="send-invite" defaultChecked />
                    <Label htmlFor="send-invite">Send email invitation</Label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => { setShowAddDialog(false); resetForm(); }}>Cancel</Button>
                    <Button onClick={submitUser} disabled={submitting}>{submitting ? 'Saving...' : editingUserId ? 'Save Changes' : 'Create User'}</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card><CardContent className="p-4 text-center">
            <Users className="h-6 w-6 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Users</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <UserCheck className="h-6 w-6 text-green-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <Clock className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
            <p className="text-2xl font-bold text-muted-foreground">{stats.inactive}</p>
            <p className="text-xs text-muted-foreground">Inactive</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <UserX className="h-6 w-6 text-destructive mx-auto mb-1" />
            <p className="text-2xl font-bold text-destructive">{stats.suspended}</p>
            <p className="text-xs text-muted-foreground">Suspended</p>
          </CardContent></Card>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name or email..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-48"><Filter className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {Object.entries(ROLE_INFO).map(([key, info]) => (
                <SelectItem key={key} value={key}>{info.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* User Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Logins</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(u => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                          {u.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{u.name}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{ROLE_INFO[u.role]?.label || u.role}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.department || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(u.status)} className="capitalize">{u.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.lastLogin ? u.lastLogin.toLocaleDateString('en-IN') : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.loginCount}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(u)}><Edit className="mr-2 h-4 w-4" />Edit User</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(u)}><ShieldCheck className="mr-2 h-4 w-4" />Change Role</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => window.open(`mailto:${u.email}`, '_blank')}><Mail className="mr-2 h-4 w-4" />Send Email</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => removeUser(u.id)}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filtered.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">No users match your filters.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Settings, Building2, Calendar, GraduationCap, Globe, Mail, Phone, MapPin, Save, Edit, Plus
} from 'lucide-react';
import { fetchApi, postApi, putApi } from '@/lib/apiService';
import { useState, useEffect } from 'react';
import { safeArray, safeBoolean, safeDate, safeString } from '@/lib/normalize';
import { toast } from '@/hooks/use-toast';

export default function AdminSystemConfig() {
  type SemesterFormItem = {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    registrationDeadline: string;
    examStartDate: string;
    examEndDate: string;
    status: string;
  };

  const [academicYears, setAcademicYears] = useState<any>([]);
  const [departments, setDepartments] = useState<any>([]);
  const [university, setUniversity] = useState<any>({
    name: '',
    code: '',
    type: '',
    accreditation: '',
    website: '',
    email: '',
    phone: '',
    established: '',
    address: '',
    chancellor: '',
    viceChancellor: '',
    ugcRecognized: true,
    aicteApproved: true
  });
  const [_apiLoading, _setApiLoading] = useState(true);

  const normalizeAcademicYear = (raw: any) => ({
    id: safeString(raw?.id),
    year: safeString(raw?.year),
    startDate: safeDate(raw?.startDate),
    endDate: safeDate(raw?.endDate),
    isCurrent: safeBoolean(raw?.isCurrent),
    status: safeString(raw?.status, 'upcoming'),
    semesters: safeArray(raw?.semesters).map((semester: any, index: number) => ({
      id: safeString(semester?.id, `${safeString(raw?.id)}-${index}`),
      name: safeString(semester?.name, `Semester ${index + 1}`),
      startDate: safeDate(semester?.startDate),
      endDate: safeDate(semester?.endDate),
      registrationDeadline: safeDate(semester?.registrationDeadline),
      examStartDate: semester?.examStartDate ? safeDate(semester?.examStartDate) : null,
      examEndDate: semester?.examEndDate ? safeDate(semester?.examEndDate) : null,
      status: safeString(semester?.status, 'upcoming')
    }))
  });

  const normalizeDepartment = (raw: any) => ({
    id: safeString(raw?.id),
    name: safeString(raw?.name),
    code: safeString(raw?.code),
    hod: safeString(raw?.hod, 'Not Assigned'),
    faculty: Number(raw?.faculty ?? 0),
    students: Number(raw?.students ?? 0),
    programs: Number(raw?.programs ?? raw?.courses ?? 0),
    status: safeString(raw?.status, 'active'),
    established: safeString(raw?.established, '—')
  });

  useEffect(() => {
    fetchApi('/admin/config').then((d: any) => {
      setUniversity((prev: any) => ({
        ...prev,
        name: safeString(d?.university?.name, prev.name),
        code: safeString(d?.university?.code, prev.code),
        type: safeString(d?.university?.type, prev.type),
        accreditation: safeString(d?.university?.accreditation, prev.accreditation)
      }));
      setAcademicYears(safeArray(d?.academicYears).map(normalizeAcademicYear));
      setDepartments(safeArray(d?.departments).map(normalizeDepartment));
    }).catch((error) => { console.error('API request failed', error); });
    _setApiLoading(false);
  }, []);

  const [isEditing, setIsEditing] = useState(false);
  const [showAcademicYearDialog, setShowAcademicYearDialog] = useState(false);
  const [editingAcademicYearId, setEditingAcademicYearId] = useState<string | null>(null);
  const [savingAcademicYear, setSavingAcademicYear] = useState(false);
  const [academicYearForm, setAcademicYearForm] = useState({
    year: '',
    startDate: '',
    endDate: '',
    status: 'upcoming',
    isCurrent: false
  });
  const [semesterFormItems, setSemesterFormItems] = useState<SemesterFormItem[]>([]);

  const formatDateInput = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const openCreateAcademicYearDialog = () => {
    setEditingAcademicYearId(null);
    setAcademicYearForm({
      year: '',
      startDate: '',
      endDate: '',
      status: 'upcoming',
      isCurrent: false
    });
    setSemesterFormItems([]);
    setShowAcademicYearDialog(true);
  };

  const openEditAcademicYearDialog = (academicYear: any) => {
    setEditingAcademicYearId(academicYear.id);
    setAcademicYearForm({
      year: safeString(academicYear.year),
      startDate: formatDateInput(academicYear.startDate),
      endDate: formatDateInput(academicYear.endDate),
      status: safeString(academicYear.status, 'upcoming'),
      isCurrent: Boolean(academicYear.isCurrent)
    });
    setSemesterFormItems(
      safeArray(academicYear.semesters).map((semester: any, index: number) => ({
        id: safeString(semester?.id, `${academicYear.id}-${index + 1}`),
        name: safeString(semester?.name, `Semester ${index + 1}`),
        startDate: semester?.startDate ? formatDateInput(safeDate(semester.startDate)) : '',
        endDate: semester?.endDate ? formatDateInput(safeDate(semester.endDate)) : '',
        registrationDeadline: semester?.registrationDeadline ? formatDateInput(safeDate(semester.registrationDeadline)) : '',
        examStartDate: semester?.examStartDate ? formatDateInput(safeDate(semester.examStartDate)) : '',
        examEndDate: semester?.examEndDate ? formatDateInput(safeDate(semester.examEndDate)) : '',
        status: safeString(semester?.status, 'upcoming')
      }))
    );
    setShowAcademicYearDialog(true);
  };

  const addSemesterFormItem = () => {
    setSemesterFormItems((prev) => ([
      ...prev,
      {
        id: crypto.randomUUID(),
        name: `Semester ${prev.length + 1}`,
        startDate: '',
        endDate: '',
        registrationDeadline: '',
        examStartDate: '',
        examEndDate: '',
        status: 'upcoming'
      }
    ]));
  };

  const updateSemesterFormItem = (id: string, field: keyof SemesterFormItem, value: string) => {
    setSemesterFormItems((prev) => prev.map((semester) => (
      semester.id === id ? { ...semester, [field]: value } : semester
    )));
  };

  const removeSemesterFormItem = (id: string) => {
    setSemesterFormItems((prev) => prev.filter((semester) => semester.id !== id));
  };

  const saveUniversityConfig = async () => {
    try {
      await putApi('/admin/config', { university });
      setIsEditing(false);
      toast({ title: 'Configuration saved', description: 'University profile updated successfully.' });
    } catch (error: any) {
      toast({ title: 'Save failed', description: safeString(error?.message, 'Unable to save configuration.'), variant: 'destructive' });
    }
  };

  const submitAcademicYear = async () => {
    if (!academicYearForm.year.trim() || !academicYearForm.startDate || !academicYearForm.endDate) {
      toast({
        title: 'Missing details',
        description: 'Year, start date, and end date are required.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setSavingAcademicYear(true);
      const payload = {
        year: academicYearForm.year.trim(),
        startDate: new Date(academicYearForm.startDate).toISOString(),
        endDate: new Date(academicYearForm.endDate).toISOString(),
        status: academicYearForm.status,
        isCurrent: academicYearForm.isCurrent,
        semesters: semesterFormItems.map((semester) => ({
          id: semester.id,
          name: semester.name.trim(),
          startDate: semester.startDate ? new Date(semester.startDate).toISOString() : null,
          endDate: semester.endDate ? new Date(semester.endDate).toISOString() : null,
          registrationDeadline: semester.registrationDeadline ? new Date(semester.registrationDeadline).toISOString() : null,
          examStartDate: semester.examStartDate ? new Date(semester.examStartDate).toISOString() : null,
          examEndDate: semester.examEndDate ? new Date(semester.examEndDate).toISOString() : null,
          status: semester.status
        }))
      };

      if (editingAcademicYearId) {
        const updated = await putApi(`/admin/academic-years/${editingAcademicYearId}`, payload);
        setAcademicYears((prev: any[]) => prev.map((year) => (
          year.id === editingAcademicYearId ? normalizeAcademicYear(updated) : academicYearForm.isCurrent ? { ...year, isCurrent: false } : year
        )));
        toast({ title: 'Academic year updated', description: 'Academic year saved successfully.' });
      } else {
        const created = await postApi('/admin/academic-years', payload);
        setAcademicYears((prev: any[]) => [normalizeAcademicYear(created), ...prev]);
        toast({ title: 'Academic year added', description: `Academic year ${academicYearForm.year.trim()} created.` });
      }

      setShowAcademicYearDialog(false);
      setEditingAcademicYearId(null);
    } catch (error: any) {
      toast({ title: editingAcademicYearId ? 'Update failed' : 'Add failed', description: safeString(error?.message, 'Unable to save academic year.'), variant: 'destructive' });
    } finally {
      setSavingAcademicYear(false);
    }
  };

  const addDepartment = async () => {
    const name = window.prompt('Department name');
    const code = window.prompt('Department code (e.g. CSE)');
    if (!name || !code) return;

    try {
      const created = await postApi('/admin/departments', {
        name: name.trim(),
        code: code.trim().toUpperCase()
      });
      setDepartments((prev: any[]) => [normalizeDepartment(created), ...prev]);
      toast({ title: 'Department added', description: `${name.trim()} created successfully.` });
    } catch (error: any) {
      toast({ title: 'Add failed', description: safeString(error?.message, 'Unable to add department.'), variant: 'destructive' });
    }
  };

  const toggleDepartmentStatus = (departmentId: string) => {
    setDepartments((prev: any[]) => prev.map((department) => (
      department.id === departmentId
        ? { ...department, status: department.status === 'active' ? 'inactive' : 'active' }
        : department
    )));
    toast({ title: 'Department updated', description: 'Department status updated in the view.' });
  };

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
                  <div><Label>University Name</Label><Input value={university.name} disabled={!isEditing} onChange={(event) => setUniversity((prev: any) => ({ ...prev, name: event.target.value }))} /></div>
                  <div><Label>Short Name</Label><Input value={university.code} disabled={!isEditing} onChange={(event) => setUniversity((prev: any) => ({ ...prev, code: event.target.value }))} /></div>
                  <div><Label>Website</Label><Input value={university.website} disabled={!isEditing} onChange={(event) => setUniversity((prev: any) => ({ ...prev, website: event.target.value }))} /></div>
                  <div><Label>Email</Label><Input value={university.email} disabled={!isEditing} onChange={(event) => setUniversity((prev: any) => ({ ...prev, email: event.target.value }))} /></div>
                  <div><Label>Phone</Label><Input value={university.phone} disabled={!isEditing} onChange={(event) => setUniversity((prev: any) => ({ ...prev, phone: event.target.value }))} /></div>
                  <div><Label>Established Year</Label><Input value={university.established} type="number" disabled={!isEditing} onChange={(event) => setUniversity((prev: any) => ({ ...prev, established: event.target.value }))} /></div>
                </div>
                <div><Label>Address</Label><Textarea value={university.address} disabled={!isEditing} onChange={(event) => setUniversity((prev: any) => ({ ...prev, address: event.target.value }))} /></div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div><Label>Type</Label><Input value={university.type} disabled={!isEditing} onChange={(event) => setUniversity((prev: any) => ({ ...prev, type: event.target.value }))} /></div>
                  <div><Label>NAAC Grade</Label><Input value={university.accreditation} disabled={!isEditing} onChange={(event) => setUniversity((prev: any) => ({ ...prev, accreditation: event.target.value }))} /></div>
                  <div><Label>NIRF Rank</Label><Input value={university.nirfRank || ''} type="number" disabled={!isEditing} onChange={(event) => setUniversity((prev: any) => ({ ...prev, nirfRank: event.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div><Label>Chancellor</Label><Input value={university.chancellor} disabled={!isEditing} onChange={(event) => setUniversity((prev: any) => ({ ...prev, chancellor: event.target.value }))} /></div>
                  <div><Label>Vice Chancellor</Label><Input value={university.viceChancellor} disabled={!isEditing} onChange={(event) => setUniversity((prev: any) => ({ ...prev, viceChancellor: event.target.value }))} /></div>
                </div>
                {isEditing && (
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                    <Button onClick={saveUniversityConfig}><Save className="mr-2 h-4 w-4" />Save Changes</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="academic" className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={openCreateAcademicYearDialog}><Plus className="mr-2 h-4 w-4" />Add Academic Year</Button>
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
                      <Button variant="outline" size="sm" onClick={() => openEditAcademicYearDialog(ay)}><Edit className="h-4 w-4" /></Button>
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

            <Dialog open={showAcademicYearDialog} onOpenChange={setShowAcademicYearDialog}>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingAcademicYearId ? 'Edit Academic Year' : 'Add Academic Year'}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Academic Year</Label>
                    <Input
                      placeholder="e.g. 2026-27"
                      value={academicYearForm.year}
                      onChange={(event) => setAcademicYearForm((prev) => ({ ...prev, year: event.target.value }))}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input
                        type="date"
                        value={academicYearForm.startDate}
                        onChange={(event) => setAcademicYearForm((prev) => ({ ...prev, startDate: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Input
                        type="date"
                        value={academicYearForm.endDate}
                        onChange={(event) => setAcademicYearForm((prev) => ({ ...prev, endDate: event.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={academicYearForm.status}
                      onValueChange={(value) => setAcademicYearForm((prev) => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="upcoming">Upcoming</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Set as Current</Label>
                    <Select
                      value={academicYearForm.isCurrent ? 'yes' : 'no'}
                      onValueChange={(value) => setAcademicYearForm((prev) => ({ ...prev, isCurrent: value === 'yes' }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3 border rounded-md p-3">
                    <div className="flex items-center justify-between">
                      <Label>Semesters</Label>
                      <Button type="button" size="sm" variant="outline" onClick={addSemesterFormItem}>
                        <Plus className="mr-2 h-4 w-4" />Add Semester
                      </Button>
                    </div>

                    {semesterFormItems.length === 0 && (
                      <p className="text-xs text-muted-foreground">No semesters added yet.</p>
                    )}

                    {semesterFormItems.map((semester, index) => (
                      <div key={semester.id} className="space-y-3 border rounded-md p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">Semester {index + 1}</p>
                          <Button type="button" size="sm" variant="ghost" onClick={() => removeSemesterFormItem(semester.id)}>Remove</Button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label>Name</Label>
                            <Input
                              value={semester.name}
                              onChange={(event) => updateSemesterFormItem(semester.id, 'name', event.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Status</Label>
                            <Select
                              value={semester.status}
                              onValueChange={(value) => updateSemesterFormItem(semester.id, 'status', value)}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="upcoming">Upcoming</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <Label>Start Date</Label>
                            <Input
                              type="date"
                              value={semester.startDate}
                              onChange={(event) => updateSemesterFormItem(semester.id, 'startDate', event.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>End Date</Label>
                            <Input
                              type="date"
                              value={semester.endDate}
                              onChange={(event) => updateSemesterFormItem(semester.id, 'endDate', event.target.value)}
                            />
                          </div>

                          <div className="space-y-1">
                            <Label>Registration Deadline</Label>
                            <Input
                              type="date"
                              value={semester.registrationDeadline}
                              onChange={(event) => updateSemesterFormItem(semester.id, 'registrationDeadline', event.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Exam Start Date</Label>
                            <Input
                              type="date"
                              value={semester.examStartDate}
                              onChange={(event) => updateSemesterFormItem(semester.id, 'examStartDate', event.target.value)}
                            />
                          </div>

                          <div className="space-y-1">
                            <Label>Exam End Date</Label>
                            <Input
                              type="date"
                              value={semester.examEndDate}
                              onChange={(event) => updateSemesterFormItem(semester.id, 'examEndDate', event.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAcademicYearDialog(false);
                      setEditingAcademicYearId(null);
                      setSemesterFormItems([]);
                    }}
                    disabled={savingAcademicYear}
                  >
                    Cancel
                  </Button>
                  <Button onClick={submitAcademicYear} disabled={savingAcademicYear}>
                    {savingAcademicYear ? 'Saving...' : editingAcademicYearId ? 'Save Changes' : 'Create Academic Year'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="departments" className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={addDepartment}><Plus className="mr-2 h-4 w-4" />Add Department</Button>
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
                        <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => toggleDepartmentStatus(d.id)}><Edit className="h-4 w-4" /></Button></TableCell>
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

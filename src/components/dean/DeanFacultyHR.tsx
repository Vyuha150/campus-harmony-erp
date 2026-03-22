import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, UserPlus, Briefcase } from 'lucide-react';
import { fetchApi } from '@/lib/apiService';
import { useToast } from '@/hooks/use-toast';

type FacultyRow = {
  id: string;
  name: string;
  email: string;
  department?: string;
  designation?: string;
  qualification?: string;
  specialization?: string;
  experience?: number;
};

type RecruitmentRow = {
  id: string;
  position: string;
  specialization: string;
  applicants: number;
  shortlisted: number;
  status: string;
  department?: { name?: string };
};

export default function DeanFacultyHR() {
  const { toast } = useToast();
  const [faculty, setFaculty] = useState<FacultyRow[]>([]);
  const [recruitments, setRecruitments] = useState<RecruitmentRow[]>([]);

  useEffect(() => {
    Promise.allSettled([
      fetchApi('/dean/faculty').then((d) => setFaculty(Array.isArray(d) ? d : [])),
      fetchApi('/dean/recruitment').then((d) => setRecruitments(Array.isArray(d) ? d : [])),
    ]).then((results) => {
      const failed = results.some((item) => item.status === 'rejected');
      if (failed) {
        toast({ title: 'Partial load', description: 'Some faculty HR data could not be loaded.', variant: 'destructive' });
      }
    });
  }, [toast]);

  const totalVacancies = useMemo(
    () => recruitments.filter((item) => item.status !== 'completed').length,
    [recruitments]
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Faculty HR Actions</h1>
          <p className="text-muted-foreground">Faculty directory and recruitment status</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-border">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{faculty.length}</p>
                <p className="text-xs text-muted-foreground">Total Faculty</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalVacancies}</p>
                <p className="text-xs text-muted-foreground">Open Recruitments</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{recruitments.length}</p>
                <p className="text-xs text-muted-foreground">Recruitment Requests</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="faculty">
          <TabsList>
            <TabsTrigger value="faculty">Faculty Directory</TabsTrigger>
            <TabsTrigger value="recruitment">Recruitment</TabsTrigger>
          </TabsList>

          <TabsContent value="faculty" className="mt-4">
            <Card className="border-border">
              <CardHeader>
                <CardTitle>Faculty</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Designation</TableHead>
                      <TableHead>Specialization</TableHead>
                      <TableHead className="text-center">Experience</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {faculty.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{item.email}</TableCell>
                        <TableCell>{item.department || '-'}</TableCell>
                        <TableCell>{item.designation || '-'}</TableCell>
                        <TableCell>{item.specialization || '-'}</TableCell>
                        <TableCell className="text-center">{item.experience ?? '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recruitment" className="mt-4">
            <Card className="border-border">
              <CardHeader>
                <CardTitle>Recruitment Requests</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Department</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Specialization</TableHead>
                      <TableHead className="text-center">Applicants</TableHead>
                      <TableHead className="text-center">Shortlisted</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recruitments.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.department?.name || '-'}</TableCell>
                        <TableCell className="font-medium">{item.position}</TableCell>
                        <TableCell>{item.specialization}</TableCell>
                        <TableCell className="text-center">{item.applicants}</TableCell>
                        <TableCell className="text-center">{item.shortlisted}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {item.status}
                          </Badge>
                        </TableCell>
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

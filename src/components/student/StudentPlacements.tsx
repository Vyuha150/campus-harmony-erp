import { useState, useEffect } from 'react';
import { 
  Briefcase, Building2, Calendar, MapPin, CheckCircle, 
  Clock, Award, TrendingUp, FileText, Upload, ExternalLink,
  Users, IndianRupee, Filter, Search, AlertCircle
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { UploadField } from '@/components/ui/upload-field';
import { safeString, safeNumber, safeDate, safeArray } from '@/lib/normalize';
import { fetchApi, postApi, uploadApi } from '@/lib/apiService';
import { PlacementDrive } from '@/types/student';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

export default function StudentPlacements() {
  const navigate = useNavigate();
  const [placementDrives, setPlacementDrives] = useState<any>([]);
  const [studentProfile, setStudentProfile] = useState<any>({});
  const [_apiLoading, _setApiLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [onlyEligible, setOnlyEligible] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  const normalizeDrive = (drive: any) => ({
    ...drive,
    companyName: safeString(drive.companyName ?? drive.company?.name, 'Company'),
    role: safeString(drive.role),
    driveDate: safeDate(drive.driveDate),
    eligibility: {
      minCgpa: safeNumber(drive?.eligibility?.minCgpa),
      backlogs: safeNumber(drive?.eligibility?.backlogs),
      allowedBranches: safeArray(drive?.eligibility?.allowedBranches).map((b: any) => safeString(b)),
    },
    rounds: safeArray(drive?.rounds).map((round: any) => ({
      name: safeString(round?.name),
      status: safeString(round?.status),
    })),
    applicationStatus: safeString(drive.applicationStatus, 'not_applied'),
    package: safeString(drive.package),
    location: safeString(drive.location),
    jobDescription: safeString(drive.jobDescription),
  });

  useEffect(() => {
    Promise.all([
      fetchApi('/students/placements'),
      fetchApi('/students/profile'),
    ])
      .then(([drives, profile]) => {
        setPlacementDrives(safeArray(drives).map(normalizeDrive));
        setStudentProfile({
          ...profile,
          cgpa: safeNumber(profile?.cgpa),
        });
      })
      .catch((e: Error) => setApiError(e.message))
      .finally(() => _setApiLoading(false));
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const profile = studentProfile;

  const handleApply = async (driveId: string, companyName: string) => {
    try {
      await postApi(`/students/placements/${driveId}/apply`, {});
      setPlacementDrives((prev: any[]) => prev.map((drive) => (
        drive.id === driveId ? { ...drive, applicationStatus: 'applied' } : drive
      )));
      toast({ title: 'Application submitted', description: `Applied to ${companyName}.` });
    } catch (error: any) {
      toast({ title: 'Application failed', description: safeString(error?.message, 'Unable to apply.'), variant: 'destructive' });
    }
  };

  const handleOfferLetterDownload = (drive: PlacementDrive) => {
    const content = [
      'Campus Harmony ERP - Offer Letter',
      '',
      `Company: ${drive.companyName}`,
      `Role: ${drive.role}`,
      `Package: ${drive.package}`,
      `Location: ${drive.location}`,
      `Generated On: ${new Date().toLocaleString()}`,
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${drive.companyName.replace(/\s+/g, '_')}_offer_letter.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const displayedDrives = placementDrives.filter((drive: PlacementDrive) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query
      || drive.companyName.toLowerCase().includes(query)
      || drive.role.toLowerCase().includes(query)
      || drive.location.toLowerCase().includes(query);

    if (!matchesSearch) return false;
    if (!onlyEligible) return true;
    return isEligible(drive);
  });

  if (apiError) {
    return (
      <DashboardLayout>
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {apiError}
        </div>
      </DashboardLayout>
    );
  }

  const upcomingDrives = placementDrives.filter(d => d.status === 'upcoming');
  const appliedDrives = placementDrives.filter(d => d.applicationStatus === 'applied' || d.applicationStatus === 'shortlisted');
  const selectedOffers = placementDrives.filter(d => d.applicationStatus === 'selected');

  const getApplicationStatusBadge = (status?: string) => {
    switch (status) {
      case 'applied':
        return <Badge className="bg-info/10 text-info">Applied</Badge>;
      case 'shortlisted':
        return <Badge className="bg-primary/10 text-primary">Shortlisted</Badge>;
      case 'selected':
        return <Badge className="bg-success/10 text-success">Selected 🎉</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Not Selected</Badge>;
      case 'not_applied':
        return <Badge variant="outline">Not Applied</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRoundStatusBadge = (status: string) => {
    switch (status) {
      case 'qualified':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'not_qualified':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const isEligible = (drive: PlacementDrive) => {
    return profile.cgpa >= drive.eligibility.minCgpa;
  };

  const DriveCard = ({ drive }: { drive: PlacementDrive }) => {
    const eligible = isEligible(drive);
    const daysUntil = Math.ceil((drive.driveDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    return (
      <Card className={cn(
        'transition-shadow hover:shadow-lg',
        drive.applicationStatus === 'selected' && 'border-success/50 bg-success/5'
      )}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted font-bold">
                {drive.companyName.charAt(0)}
              </div>
              <div>
                <CardTitle className="text-lg">{drive.companyName}</CardTitle>
                <CardDescription>{drive.role}</CardDescription>
              </div>
            </div>
            {getApplicationStatusBadge(drive.applicationStatus)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-success" />
              <span className="font-bold text-success">{drive.package}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {drive.location}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Drive: {drive.driveDate.toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>
                {daysUntil > 0 ? `${daysUntil} days left` : 'Completed'}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Eligibility</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant={profile.cgpa >= drive.eligibility.minCgpa ? 'outline' : 'destructive'}>
                Min CGPA: {drive.eligibility.minCgpa}
              </Badge>
              <Badge variant="outline">
                Backlogs: {drive.eligibility.backlogs}
              </Badge>
            </div>
          </div>

          {/* Selection Rounds */}
          {drive.applicationStatus !== 'not_applied' && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Selection Rounds</p>
              <div className="space-y-1">
                {drive.rounds.map((round, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    {getRoundStatusBadge(round.status)}
                    <span className={cn(
                      round.status === 'qualified' && 'text-success',
                      round.status === 'not_qualified' && 'text-destructive line-through',
                      round.status === 'pending' && 'text-muted-foreground'
                    )}>
                      {round.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex-1">
                  View Details
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted text-2xl font-bold">
                      {drive.companyName.charAt(0)}
                    </div>
                    <div>
                      <DialogTitle className="text-xl">{drive.companyName}</DialogTitle>
                      <DialogDescription>{drive.role}</DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg bg-success/10 p-4">
                      <p className="text-sm text-muted-foreground">Package</p>
                      <p className="text-2xl font-bold text-success">{drive.package}</p>
                    </div>
                    <div className="rounded-lg bg-muted p-4">
                      <p className="text-sm text-muted-foreground">Location</p>
                      <p className="text-xl font-bold">{drive.location}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium">Job Description</h4>
                    <p className="mt-2 text-sm text-muted-foreground">{drive.jobDescription}</p>
                  </div>

                  <div>
                    <h4 className="font-medium">Eligibility Criteria</h4>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground">Minimum CGPA</p>
                        <p className="font-bold">{drive.eligibility.minCgpa}</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground">Max Backlogs</p>
                        <p className="font-bold">{drive.eligibility.backlogs}</p>
                      </div>
                      <div className="col-span-2 rounded-lg bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground">Eligible Branches</p>
                        <p className="font-medium">{drive.eligibility.allowedBranches.join(', ')}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium">Selection Process</h4>
                    <div className="mt-2 space-y-2">
                      {drive.rounds.map((round, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <div className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
                            round.status === 'qualified' ? 'bg-success/10 text-success' :
                            round.status === 'not_qualified' ? 'bg-destructive/10 text-destructive' :
                            'bg-muted text-muted-foreground'
                          )}>
                            {idx + 1}
                          </div>
                          <span className={cn(
                            round.status === 'qualified' && 'text-success',
                            round.status === 'not_qualified' && 'text-destructive line-through'
                          )}>
                            {round.name}
                          </span>
                          {getRoundStatusBadge(round.status)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  {drive.applicationStatus === 'not_applied' && eligible && (
                    <Button
                      className="w-full"
                      onClick={() => handleApply(drive.id, drive.companyName)}
                    >
                      Apply Now
                    </Button>
                  )}
                  {!eligible && (
                    <Button disabled className="w-full">
                      Not Eligible (CGPA below {drive.eligibility.minCgpa})
                    </Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {drive.applicationStatus === 'not_applied' && eligible && (
              <Button
                className="flex-1"
                onClick={() => handleApply(drive.id, drive.companyName)}
              >
                Apply
              </Button>
            )}
            {drive.applicationStatus === 'selected' && (
              <Button
                className="flex-1 bg-success hover:bg-success/90"
                onClick={() => handleOfferLetterDownload(drive)}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Offer Letter
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title">Placements & Career</h1>
            <p className="page-description">View placement drives and manage your applications</p>
          </div>
          <div className="flex gap-2">
            <UploadField
              mode="button"
              buttonText="Upload Resume"
              accept=".pdf,.doc,.docx"
              file={resumeFile}
              onFileSelect={async (selected) => {
                if (!selected) {
                  setResumeFile(null);
                  return;
                }
                try {
                  await uploadApi(selected, 'placement-resumes');
                  setResumeFile(selected);
                  toast({ title: 'Resume uploaded', description: `${selected.name} uploaded successfully.` });
                } catch (error: any) {
                  toast({
                    title: 'Upload failed',
                    description: safeString(error?.message, 'Unable to upload resume.'),
                    variant: 'destructive'
                  });
                }
              }}
            />
            <Button onClick={() => navigate('/student/profile')}>
              <FileText className="mr-2 h-4 w-4" />
              My Profile
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">Upcoming Drives</p>
                <p className="text-3xl font-bold text-primary">{upcomingDrives.length}</p>
              </div>
              <Building2 className="h-8 w-8 text-primary" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">Applied</p>
                <p className="text-3xl font-bold text-info">{appliedDrives.length}</p>
              </div>
              <Briefcase className="h-8 w-8 text-info" />
            </CardContent>
          </Card>
          <Card className={cn(selectedOffers.length > 0 && 'border-success/50 bg-success/5')}>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">Offers</p>
                <p className="text-3xl font-bold text-success">{selectedOffers.length}</p>
              </div>
              <Award className="h-8 w-8 text-success" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">Your CGPA</p>
                <p className="text-3xl font-bold">{profile.cgpa}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </CardContent>
          </Card>
        </div>

        {/* Offer Celebration */}
        {selectedOffers.length > 0 && (
          <Card className="border-success/50 bg-success/5">
            <CardContent className="flex flex-col items-center justify-center p-8 text-center md:flex-row md:justify-between md:text-left">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                  <Award className="h-8 w-8 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-success">Congratulations! 🎉</p>
                  <p className="text-muted-foreground">
                    You have been selected for {selectedOffers[0].companyName} - {selectedOffers[0].role}
                  </p>
                </div>
              </div>
              <div className="mt-4 md:mt-0">
                <p className="text-3xl font-bold text-success">{selectedOffers[0].package}</p>
                <Button
                  className="mt-2 bg-success hover:bg-success/90"
                  onClick={() => handleOfferLetterDownload(selectedOffers[0])}
                >
                  View Offer Letter
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" onClick={() => setOnlyEligible((prev) => !prev)}>
            <Filter className="mr-2 h-4 w-4" />
            {onlyEligible ? 'Eligible Only' : 'All Drives'}
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="all" className="space-y-6">
          <TabsList>
            <TabsTrigger value="all">All Drives ({placementDrives.length})</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming ({upcomingDrives.length})</TabsTrigger>
            <TabsTrigger value="applied">My Applications ({appliedDrives.length})</TabsTrigger>
            <TabsTrigger value="offers">Offers ({selectedOffers.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {displayedDrives.map((drive) => (
                <DriveCard key={drive.id} drive={drive} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="upcoming">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {upcomingDrives.map((drive) => (
                <DriveCard key={drive.id} drive={drive} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="applied">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {appliedDrives.map((drive) => (
                <DriveCard key={drive.id} drive={drive} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="offers">
            {selectedOffers.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {selectedOffers.map((drive) => (
                  <DriveCard key={drive.id} drive={drive} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Briefcase className="h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-lg font-medium">No Offers Yet</p>
                  <p className="text-sm text-muted-foreground">Keep applying to placement drives!</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

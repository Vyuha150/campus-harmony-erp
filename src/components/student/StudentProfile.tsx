import { useState } from 'react';
import { 
  User, Mail, Phone, MapPin, Calendar, GraduationCap, 
  BookOpen, Award, Users, Download, Edit, Save, X,
  Building2, CreditCard, Shield, FileText
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { mockStudentProfile, mockCertificates } from '@/data/studentMockData';
import { cn } from '@/lib/utils';

export default function StudentProfile() {
  const [isEditing, setIsEditing] = useState(false);
  const profile = mockStudentProfile;

  const InfoRow = ({ label, value, icon: Icon }: { label: string; value: string | React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) => (
    <div className="flex items-start gap-3 py-3">
      {Icon && <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />}
      <div className="flex-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title">My Profile</h1>
            <p className="page-description">View and manage your personal information</p>
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button onClick={() => setIsEditing(false)}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Profile
              </Button>
            )}
          </div>
        </div>

        {/* Profile Header Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
              <Avatar className="h-28 w-28 border-4 border-primary">
                <AvatarFallback className="bg-primary/10 text-primary text-3xl font-bold">
                  {profile.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-2xl font-bold">{profile.name}</h2>
                <p className="text-lg text-muted-foreground">{profile.rollNumber}</p>
                <div className="mt-2 flex flex-wrap justify-center gap-2 md:justify-start">
                  <Badge variant="secondary" className="text-sm">
                    <GraduationCap className="mr-1 h-3 w-3" />
                    {profile.program} {profile.branch}
                  </Badge>
                  <Badge variant="outline" className="text-sm">
                    Semester {profile.semester}
                  </Badge>
                  <Badge variant="outline" className="text-sm">
                    Section {profile.section}
                  </Badge>
                  <Badge className="bg-success/10 text-success text-sm">
                    CGPA: {profile.cgpa}
                  </Badge>
                </div>
                <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm text-muted-foreground md:justify-start">
                  <span className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {profile.email}
                  </span>
                  <span className="flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    {profile.phone}
                  </span>
                </div>
              </div>
              <div className="hidden text-right md:block">
                <p className="text-sm text-muted-foreground">Batch</p>
                <p className="text-xl font-bold text-primary">{profile.batch}</p>
                <p className="mt-2 text-sm text-muted-foreground">Credits</p>
                <p className="text-lg font-semibold">{profile.earnedCredits}/{profile.totalCredits}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="personal" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
            <TabsTrigger value="personal">Personal Info</TabsTrigger>
            <TabsTrigger value="academic">Academic Info</TabsTrigger>
            <TabsTrigger value="guardian">Guardian Info</TabsTrigger>
            <TabsTrigger value="address">Address</TabsTrigger>
            <TabsTrigger value="certificates">Certificates</TabsTrigger>
          </TabsList>

          {/* Personal Information */}
          <TabsContent value="personal" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Personal Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {isEditing ? (
                    <>
                      <div className="space-y-2">
                        <Label>Full Name</Label>
                        <Input defaultValue={profile.name} disabled />
                      </div>
                      <div className="space-y-2">
                        <Label>Personal Email</Label>
                        <Input defaultValue={profile.personalEmail} />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone Number</Label>
                        <Input defaultValue={profile.phone} />
                      </div>
                      <div className="space-y-2">
                        <Label>Alternate Phone</Label>
                        <Input defaultValue={profile.alternatePhone} />
                      </div>
                    </>
                  ) : (
                    <>
                      <InfoRow icon={User} label="Full Name" value={profile.name} />
                      <InfoRow icon={Mail} label="University Email" value={profile.email} />
                      <InfoRow icon={Mail} label="Personal Email" value={profile.personalEmail || 'Not provided'} />
                      <InfoRow icon={Phone} label="Phone Number" value={profile.phone} />
                      <InfoRow icon={Phone} label="Alternate Phone" value={profile.alternatePhone || 'Not provided'} />
                      <InfoRow icon={Calendar} label="Date of Birth" value={profile.dateOfBirth.toLocaleDateString()} />
                      <InfoRow label="Gender" value={profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1)} />
                      <InfoRow label="Blood Group" value={profile.bloodGroup} />
                      <InfoRow label="Nationality" value={profile.nationality} />
                      <InfoRow label="Category" value={profile.category.toUpperCase()} />
                      <InfoRow icon={CreditCard} label="Aadhar Number" value={profile.aadharNumber || 'Not provided'} />
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Academic Information */}
          <TabsContent value="academic" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Academic Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  <InfoRow icon={BookOpen} label="Program" value={profile.program} />
                  <InfoRow icon={GraduationCap} label="Branch" value={profile.branch} />
                  <InfoRow label="Specialization" value={profile.specialization || 'None'} />
                  <InfoRow label="Current Semester" value={`Semester ${profile.semester}`} />
                  <InfoRow label="Section" value={profile.section} />
                  <InfoRow label="Batch" value={profile.batch} />
                  <InfoRow label="Admission Year" value={profile.admissionYear.toString()} />
                  <InfoRow label="Admission Type" value={profile.admissionType.charAt(0).toUpperCase() + profile.admissionType.slice(1)} />
                  <InfoRow icon={Award} label="CGPA" value={
                    <span className="text-lg font-bold text-success">{profile.cgpa}</span>
                  } />
                  <InfoRow label="Total Credits" value={profile.totalCredits.toString()} />
                  <InfoRow label="Earned Credits" value={profile.earnedCredits.toString()} />
                </div>
                <Separator className="my-6" />
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="rounded-lg bg-muted/50 p-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      <span className="font-medium">Faculty Mentor</span>
                    </div>
                    <p className="mt-2 text-lg font-semibold">{profile.mentorName}</p>
                    <p className="text-sm text-muted-foreground">{profile.mentorEmail}</p>
                  </div>
                  {profile.scholarshipHolder && (
                    <div className="rounded-lg bg-success/10 p-4">
                      <div className="flex items-center gap-2">
                        <Award className="h-5 w-5 text-success" />
                        <span className="font-medium text-success">Scholarship Holder</span>
                      </div>
                      <p className="mt-2 text-lg font-semibold">{profile.scholarshipName}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Guardian Information */}
          <TabsContent value="guardian" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Father's Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <InfoRow icon={User} label="Name" value={profile.fatherName} />
                  <InfoRow label="Occupation" value={profile.fatherOccupation} />
                  <InfoRow icon={Phone} label="Phone" value={profile.fatherPhone} />
                  <InfoRow icon={Mail} label="Email" value={profile.fatherEmail || 'Not provided'} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Mother's Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <InfoRow icon={User} label="Name" value={profile.motherName} />
                  <InfoRow label="Occupation" value={profile.motherOccupation} />
                  <InfoRow icon={Phone} label="Phone" value={profile.motherPhone || 'Not provided'} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Address */}
          <TabsContent value="address" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Permanent Address
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-medium">{profile.permanentAddress.line1}</p>
                  {profile.permanentAddress.line2 && <p>{profile.permanentAddress.line2}</p>}
                  <p>{profile.permanentAddress.city}, {profile.permanentAddress.state}</p>
                  <p>{profile.permanentAddress.pincode}, {profile.permanentAddress.country}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Current Address
                  </CardTitle>
                  <CardDescription>
                    {profile.hostelResident ? 'Hostel Resident' : 'Day Scholar'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="font-medium">{profile.currentAddress.line1}</p>
                  {profile.currentAddress.line2 && <p>{profile.currentAddress.line2}</p>}
                  <p>{profile.currentAddress.city}, {profile.currentAddress.state}</p>
                  <p>{profile.currentAddress.pincode}, {profile.currentAddress.country}</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Certificates */}
          <TabsContent value="certificates" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Certificate Requests
                </CardTitle>
                <CardDescription>Request and download certificates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <Button>
                    <FileText className="mr-2 h-4 w-4" />
                    Request New Certificate
                  </Button>
                </div>
                <div className="space-y-3">
                  {mockCertificates.map((cert) => (
                    <div key={cert.id} className="flex items-center justify-between rounded-lg border p-4">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-lg',
                          cert.status === 'ready' ? 'bg-success/10' : 'bg-muted'
                        )}>
                          <FileText className={cn(
                            'h-5 w-5',
                            cert.status === 'ready' ? 'text-success' : 'text-muted-foreground'
                          )} />
                        </div>
                        <div>
                          <p className="font-medium capitalize">{cert.type.replace('_', ' ')} Certificate</p>
                          <p className="text-sm text-muted-foreground">
                            Requested: {cert.requestedAt.toLocaleDateString()} • {cert.copies} copies
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={
                          cert.status === 'ready' ? 'default' :
                          cert.status === 'processing' ? 'secondary' : 'outline'
                        }>
                          {cert.status.charAt(0).toUpperCase() + cert.status.slice(1)}
                        </Badge>
                        {cert.status === 'ready' && (
                          <Button size="sm" variant="outline">
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

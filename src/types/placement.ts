// Placement Officer Portal Type Definitions

export interface PlacementDashboard {
  totalCompanies: number;
  companiesScheduled: number;
  offersThisWeek: number;
  placementPercentage: number;
  totalStudents: number;
  placedStudents: number;
  averagePackage: number;
  highestPackage: number;
  upcomingDrives: PlacementDrive[];
  recentOffers: JobOffer[];
}

export interface PlacementDrive {
  id: string;
  company: Company;
  jobRole: string;
  jobType: 'full_time' | 'internship' | 'part_time';
  package: PackageDetails;
  eligibilityCriteria: EligibilityCriteria;
  driveDate: Date;
  registrationDeadline: Date;
  venue: string;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  registeredStudents: number;
  selectedStudents: number;
  rounds: DriveRound[];
}

export interface Company {
  id: string;
  name: string;
  industry: string;
  website?: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  companySize: string;
  description?: string;
  logo?: string;
  status: 'active' | 'inactive' | 'blacklisted';
  lastVisit?: Date;
  totalHires: number;
}

export interface PackageDetails {
  ctc: number;
  baseSalary: number;
  joiningBonus?: number;
  relocationAllowance?: number;
  bonds?: string;
  workLocation: string[];
}

export interface EligibilityCriteria {
  programs: string[];
  minCGPA?: number;
  maxBacklogs?: number;
  yearOfPassing: number[];
  additionalRequirements?: string[];
}

export interface DriveRound {
  id: string;
  name: string;
  type: 'aptitude' | 'technical' | 'hr' | 'group_discussion' | 'presentation';
  date: Date;
  venue: string;
  duration: number;
  maxMarks?: number;
  passingCriteria?: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  attendees: number;
  qualified: number;
}

export interface StudentPlacement {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  program: string;
  branch: string;
  cgpa: number;
  activeBacklogs: number;
  email: string;
  phone: string;
  resumeVerified: boolean;
  status: 'eligible' | 'placed' | 'higher_studies' | 'entrepreneur' | 'not_interested';
  placementDetails?: PlacementDetails;
  internships: InternshipDetails[];
  skills: string[];
  achievements: string[];
  preferences: PlacementPreferences;
}

export interface PlacementDetails {
  companyId: string;
  companyName: string;
  jobRole: string;
  package: number;
  joinDate: Date;
  offerDate: Date;
  status: 'offer_received' | 'accepted' | 'joined' | 'withdrawn';
}

export interface InternshipDetails {
  companyName: string;
  role: string;
  duration: string;
  stipend?: number;
  certificate: boolean;
  feedback?: string;
}

export interface PlacementPreferences {
  preferredIndustries: string[];
  preferredRoles: string[];
  preferredLocations: string[];
  expectedPackage?: number;
  willingToRelocate: boolean;
}

export interface JobOffer {
  id: string;
  studentId: string;
  studentName: string;
  companyName: string;
  jobRole: string;
  package: number;
  offerDate: Date;
  joiningDate: Date;
  status: 'pending' | 'accepted' | 'rejected';
  documents: string[];
}

export interface PlacementReport {
  id: string;
  reportType: 'overall' | 'department' | 'program' | 'company_wise';
  academicYear: string;
  generatedDate: Date;
  metrics: PlacementMetrics;
  data: any;
}

export interface PlacementMetrics {
  totalStudents: number;
  eligibleStudents: number;
  placedStudents: number;
  placementPercentage: number;
  highestPackage: number;
  averagePackage: number;
  medianPackage: number;
  totalOffers: number;
  companiesVisited: number;
  multipleOffers: number;
}

export interface TrainingSession {
  id: string;
  title: string;
  type: 'aptitude' | 'technical' | 'soft_skills' | 'interview_prep' | 'resume_building';
  instructor: string;
  date: Date;
  duration: number;
  venue: string;
  maxCapacity: number;
  registeredCount: number;
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
  description?: string;
  materials: string[];
}
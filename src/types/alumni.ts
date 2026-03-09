// Alumni & Progression Officer Portal Type Definitions

export interface AlumniProfile {
  id: string;
  studentId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  graduationYear: number;
  program: string;
  branch?: string;
  rollNumber?: string;
  currentDesignation?: string;
  currentCompany?: string;
  industry?: string;
  workLocation?: string;
  linkedInProfile?: string;
  personalWebsite?: string;
  achievements: string[];
  status: 'active' | 'inactive' | 'deceased';
  privacySettings: AlumniPrivacySettings;
  lastUpdated: Date;
  verificationStatus: 'verified' | 'pending' | 'rejected';
}

export interface AlumniPrivacySettings {
  showContactInfo: boolean;
  showCurrentJob: boolean;
  showPersonalDetails: boolean;
  allowMentorshipRequests: boolean;
  receiveNewsletters: boolean;
  showInDirectory: boolean;
}

export interface AlumniEvent {
  id: string;
  title: string;
  description: string;
  type: 'reunion' | 'networking' | 'webinar' | 'social' | 'fundraising';
  date: Date;
  endDate?: Date;
  venue: string;
  isVirtual: boolean;
  virtualLink?: string;
  maxCapacity?: number;
  registrationDeadline: Date;
  organizer: string;
  targetAudience: EventAudience;
  registrations: EventRegistration[];
  status: 'draft' | 'published' | 'ongoing' | 'completed' | 'cancelled';
  images: string[];
  documents: string[];
}

export interface EventAudience {
  graduationYears?: number[];
  programs?: string[];
  industries?: string[];
  locations?: string[];
  allAlumni: boolean;
}

export interface EventRegistration {
  id: string;
  alumniId: string;
  alumniName: string;
  email: string;
  registrationDate: Date;
  attendanceStatus: 'registered' | 'attended' | 'no_show' | 'cancelled';
  specialRequirements?: string;
  guestCount: number;
}

export interface MentorshipProgram {
  id: string;
  title: string;
  description: string;
  type: 'career_guidance' | 'entrepreneurship' | 'skills_development' | 'industry_specific';
  duration: string;
  maxMentees: number;
  startDate: Date;
  endDate?: Date;
  status: 'active' | 'completed' | 'paused';
  mentors: MentorProfile[];
  mentees: MenteeProfile[];
  matches: MentorshipMatch[];
}

export interface MentorProfile {
  id: string;
  alumniId: string;
  name: string;
  designation: string;
  company: string;
  industry: string;
  expertise: string[];
  experience: number;
  maxMentees: number;
  currentMentees: number;
  preferredMode: 'online' | 'offline' | 'both';
  availability: string;
  languages: string[];
  status: 'active' | 'inactive' | 'full';
}

export interface MenteeProfile {
  id: string;
  studentId?: string;
  name: string;
  program: string;
  year: number;
  interests: string[];
  goals: string[];
  preferredIndustries: string[];
  status: 'seeking_mentor' | 'matched' | 'completed';
}

export interface MentorshipMatch {
  id: string;
  mentorId: string;
  menteeId: string;
  matchDate: Date;
  status: 'active' | 'completed' | 'terminated';
  sessions: MentorshipSession[];
  feedback: MentorshipFeedback[];
}

export interface MentorshipSession {
  id: string;
  date: Date;
  duration: number;
  mode: 'online' | 'offline' | 'phone';
  agenda: string;
  outcomes?: string;
  nextSteps?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
}

export interface MentorshipFeedback {
  id: string;
  fromRole: 'mentor' | 'mentee';
  rating: number;
  comments: string;
  date: Date;
  anonymous: boolean;
}

export interface AlumniDonation {
  id: string;
  alumniId: string;
  alumniName: string;
  amount: number;
  currency: string;
  purpose: string;
  campaign?: string;
  donationType: 'one_time' | 'recurring' | 'pledge';
  paymentMethod: string;
  transactionId?: string;
  donationDate: Date;
  receiptIssued: boolean;
  taxExemptionClaimed: boolean;
  status: 'completed' | 'pending' | 'cancelled';
  notes?: string;
}

export interface ProgressionSurvey {
  id: string;
  title: string;
  graduationYear: number;
  program?: string;
  surveyPeriod: '6_months' | '1_year' | '2_years' | '5_years';
  questions: SurveyQuestion[];
  responses: SurveyResponse[];
  status: 'draft' | 'active' | 'closed';
  startDate: Date;
  endDate: Date;
}

export interface SurveyQuestion {
  id: string;
  question: string;
  type: 'multiple_choice' | 'single_choice' | 'text' | 'number' | 'scale';
  options?: string[];
  required: boolean;
  category: 'employment' | 'education' | 'satisfaction' | 'feedback';
}

export interface SurveyResponse {
  id: string;
  alumniId: string;
  responses: Record<string, any>;
  submissionDate: Date;
  completionStatus: 'partial' | 'complete';
}

export interface ProgressionMetrics {
  totalGraduates: number;
  responseRate: number;
  employed: number;
  higherEducation: number;
  entrepreneur: number;
  unemployed: number;
  averageSalary?: number;
  topEmployers: EmployerStats[];
  higherEducationInstitutions: EducationStats[];
  geographicDistribution: LocationStats[];
}

export interface EmployerStats {
  companyName: string;
  count: number;
  averagePackage?: number;
}

export interface EducationStats {
  institutionName: string;
  program: string;
  count: number;
}

export interface LocationStats {
  city: string;
  state: string;
  country: string;
  count: number;
}

export interface AlumniCommunication {
  id: string;
  title: string;
  content: string;
  type: 'newsletter' | 'announcement' | 'invitation' | 'update';
  targetAudience: EventAudience;
  sentDate?: Date;
  scheduledDate?: Date;
  status: 'draft' | 'scheduled' | 'sent';
  recipientCount?: number;
  openRate?: number;
  clickRate?: number;
  unsubscribeRate?: number;
}

export interface AlumniJobPosting {
  id: string;
  postedBy: string;
  companyName: string;
  jobTitle: string;
  description: string;
  requirements: string[];
  location: string;
  salaryRange?: string;
  jobType: 'full_time' | 'part_time' | 'contract' | 'internship';
  applicationDeadline: Date;
  contactEmail: string;
  status: 'active' | 'expired' | 'closed';
  postedDate: Date;
  views: number;
  applications: number;
}
import type { AlumniProfile, AlumniEvent, MentorshipProgram, AlumniDonation, ProgressionMetrics, AlumniCommunication, AlumniJobPosting } from '@/types/alumni';

export const alumniProfiles: AlumniProfile[] = [
  { id: 'AL001', firstName: 'Sundar', lastName: 'Pichai', email: 'sundar@example.com', graduationYear: 2010, program: 'B.Tech CSE', currentDesignation: 'VP Engineering', currentCompany: 'Google', industry: 'Technology', workLocation: 'Mountain View, CA', linkedInProfile: 'https://linkedin.com/in/sundar', achievements: ['Google Star Award 2018', 'Patent holder – 3 patents'], status: 'active', privacySettings: { showContactInfo: false, showCurrentJob: true, showPersonalDetails: false, allowMentorshipRequests: true, receiveNewsletters: true, showInDirectory: true }, lastUpdated: new Date('2026-01-15'), verificationStatus: 'verified' },
  { id: 'AL002', firstName: 'Meera', lastName: 'Rajput', email: 'meera.r@example.com', phone: '9876543290', graduationYear: 2015, program: 'MBA', currentDesignation: 'Senior Manager', currentCompany: 'McKinsey', industry: 'Consulting', workLocation: 'Mumbai', achievements: ['Published in HBR'], status: 'active', privacySettings: { showContactInfo: true, showCurrentJob: true, showPersonalDetails: true, allowMentorshipRequests: true, receiveNewsletters: true, showInDirectory: true }, lastUpdated: new Date('2026-02-20'), verificationStatus: 'verified' },
  { id: 'AL003', firstName: 'Arjun', lastName: 'Desai', email: 'arjun.d@example.com', graduationYear: 2018, program: 'B.Tech ECE', currentDesignation: 'Founder & CEO', currentCompany: 'TechVentures AI', industry: 'Startups', workLocation: 'Bangalore', achievements: ['Forbes 30 Under 30 – 2024'], status: 'active', privacySettings: { showContactInfo: true, showCurrentJob: true, showPersonalDetails: true, allowMentorshipRequests: true, receiveNewsletters: true, showInDirectory: true }, lastUpdated: new Date('2026-03-01'), verificationStatus: 'verified' },
];

export const alumniEvents: AlumniEvent[] = [
  { id: 'AE001', title: 'Silver Jubilee Reunion – Batch 2001', description: 'Celebrating 25 years of the founding batch with a grand gala dinner and campus tour.', type: 'reunion', date: new Date('2026-04-15'), venue: 'University Auditorium', isVirtual: false, maxCapacity: 200, registrationDeadline: new Date('2026-04-01'), organizer: 'Alumni Cell', targetAudience: { graduationYears: [2001], allAlumni: false }, registrations: [], status: 'published', images: [], documents: [] },
  { id: 'AE002', title: 'Alumni Tech Talk – AI in Healthcare', description: 'Webinar featuring Dr. Kavitha Iyer (Batch 2012) on AI applications in medical diagnostics.', type: 'webinar', date: new Date('2026-03-22'), venue: 'Online (Zoom)', isVirtual: true, virtualLink: 'https://zoom.us/j/12345', registrationDeadline: new Date('2026-03-20'), organizer: 'Alumni Cell', targetAudience: { allAlumni: true }, registrations: [], status: 'published', images: [], documents: [] },
];

export const mentorshipPrograms: MentorshipProgram[] = [
  { id: 'MP001', title: 'Career Launchpad 2026', description: 'Connect final-year students with industry alumni for career guidance and interview preparation.', type: 'career_guidance', duration: '3 months', maxMentees: 100, startDate: new Date('2026-02-01'), status: 'active', mentors: [
    { id: 'M001', alumniId: 'AL002', name: 'Meera Rajput', designation: 'Senior Manager', company: 'McKinsey', industry: 'Consulting', expertise: ['Strategy', 'Case Interviews'], experience: 10, maxMentees: 3, currentMentees: 2, preferredMode: 'both', availability: 'Weekends', languages: ['English', 'Hindi'], status: 'active' },
  ], mentees: [], matches: [] },
];

export const alumniDonations: AlumniDonation[] = [
  { id: 'AD001', alumniId: 'AL001', alumniName: 'Sundar Pichai', amount: 5000000, currency: 'INR', purpose: 'AI Research Lab Setup', donationType: 'one_time', paymentMethod: 'Bank Transfer', donationDate: new Date('2025-12-15'), receiptIssued: true, taxExemptionClaimed: true, status: 'completed' },
  { id: 'AD002', alumniId: 'AL003', alumniName: 'Arjun Desai', amount: 1000000, currency: 'INR', purpose: 'Startup Incubation Fund', campaign: 'Innovation Drive 2026', donationType: 'one_time', paymentMethod: 'Online', donationDate: new Date('2026-01-10'), receiptIssued: true, taxExemptionClaimed: false, status: 'completed' },
];

export const progressionMetrics: ProgressionMetrics = {
  totalGraduates: 500,
  responseRate: 72,
  employed: 300,
  higherEducation: 120,
  entrepreneur: 25,
  unemployed: 15,
  averageSalary: 850000,
  topEmployers: [
    { companyName: 'TCS', count: 45, averagePackage: 650000 },
    { companyName: 'Infosys', count: 38, averagePackage: 680000 },
    { companyName: 'Wipro', count: 30, averagePackage: 620000 },
    { companyName: 'Microsoft', count: 8, averagePackage: 2800000 },
  ],
  higherEducationInstitutions: [
    { institutionName: 'IIT Bombay', program: 'M.Tech', count: 15 },
    { institutionName: 'IIM Ahmedabad', program: 'MBA', count: 8 },
    { institutionName: 'University of Michigan', program: 'MS', count: 12 },
  ],
  geographicDistribution: [
    { city: 'Bangalore', state: 'Karnataka', country: 'India', count: 120 },
    { city: 'Hyderabad', state: 'Telangana', country: 'India', count: 65 },
    { city: 'Mumbai', state: 'Maharashtra', country: 'India', count: 50 },
    { city: 'San Francisco', state: 'CA', country: 'USA', count: 18 },
  ],
};

export const alumniCommunications: AlumniCommunication[] = [
  { id: 'AC001', title: 'March Newsletter – Campus Highlights', content: 'Monthly newsletter with campus news, achievements, and upcoming events.', type: 'newsletter', targetAudience: { allAlumni: true }, sentDate: new Date('2026-03-01'), status: 'sent', recipientCount: 15200, openRate: 42, clickRate: 12 },
];

export const alumniJobPostings: AlumniJobPosting[] = [
  { id: 'AJP001', postedBy: 'AL003', companyName: 'TechVentures AI', jobTitle: 'ML Engineer', description: 'Looking for passionate ML engineers to work on cutting-edge AI products.', requirements: ['Python', 'TensorFlow', 'NLP'], location: 'Bangalore', salaryRange: '₹15-25 LPA', jobType: 'full_time', applicationDeadline: new Date('2026-04-30'), contactEmail: 'careers@techventures.ai', status: 'active', postedDate: new Date('2026-03-05'), views: 245, applications: 32 },
];
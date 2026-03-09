import type { PlacementDrive, Company, StudentPlacement, JobOffer, TrainingSession, PlacementMetrics } from '@/types/placement';

export const placementMetrics: PlacementMetrics = {
  totalStudents: 1250,
  eligibleStudents: 1180,
  placedStudents: 842,
  placementPercentage: 71.4,
  highestPackage: 4200000,
  averagePackage: 850000,
  medianPackage: 720000,
  totalOffers: 920,
  companiesVisited: 78,
  multipleOffers: 65,
};

export const companies: Company[] = [
  { id: 'C001', name: 'Infosys', industry: 'IT Services', website: 'https://infosys.com', contactPerson: 'Suresh Menon', email: 'suresh@infosys.com', phone: '9876543260', address: 'Bangalore', companySize: '10000+', status: 'active', totalHires: 45, lastVisit: new Date('2026-02-20') },
  { id: 'C002', name: 'TCS', industry: 'IT Services', website: 'https://tcs.com', contactPerson: 'Amit Shah', email: 'amit@tcs.com', phone: '9876543261', address: 'Mumbai', companySize: '10000+', status: 'active', totalHires: 62, lastVisit: new Date('2026-02-15') },
  { id: 'C003', name: 'Microsoft', industry: 'Technology', website: 'https://microsoft.com', contactPerson: 'Pooja Desai', email: 'pooja@microsoft.com', phone: '9876543262', address: 'Hyderabad', companySize: '10000+', status: 'active', totalHires: 8, lastVisit: new Date('2026-01-25') },
  { id: 'C004', name: 'Goldman Sachs', industry: 'Finance', website: 'https://gs.com', contactPerson: 'Ravi Kumar', email: 'ravi@gs.com', phone: '9876543263', address: 'Bangalore', companySize: '5000+', status: 'active', totalHires: 5 },
  { id: 'C005', name: 'Wipro', industry: 'IT Services', website: 'https://wipro.com', contactPerson: 'Neha Verma', email: 'neha@wipro.com', phone: '9876543264', address: 'Bangalore', companySize: '10000+', status: 'active', totalHires: 38, lastVisit: new Date('2026-02-28') },
];

export const placementDrives: PlacementDrive[] = [
  { id: 'PD001', company: companies[3], jobRole: 'Analyst – GS Quantitative Strategies', jobType: 'full_time', package: { ctc: 2400000, baseSalary: 1800000, joiningBonus: 200000, workLocation: ['Bangalore'] }, eligibilityCriteria: { programs: ['B.Tech CSE', 'B.Tech ECE', 'M.Tech'], minCGPA: 8.0, maxBacklogs: 0, yearOfPassing: [2026] }, driveDate: new Date('2026-03-15'), registrationDeadline: new Date('2026-03-12'), venue: 'Seminar Hall A', status: 'upcoming', registeredStudents: 124, selectedStudents: 0, rounds: [
    { id: 'R1', name: 'Online Aptitude Test', type: 'aptitude', date: new Date('2026-03-15'), venue: 'Lab 1-4', duration: 90, maxMarks: 100, passingCriteria: '60%', status: 'upcoming', attendees: 0, qualified: 0 },
    { id: 'R2', name: 'Technical Interview', type: 'technical', date: new Date('2026-03-16'), venue: 'Interview Rooms', duration: 45, status: 'upcoming', attendees: 0, qualified: 0 },
    { id: 'R3', name: 'HR Interview', type: 'hr', date: new Date('2026-03-16'), venue: 'Interview Rooms', duration: 30, status: 'upcoming', attendees: 0, qualified: 0 },
  ]},
  { id: 'PD002', company: companies[4], jobRole: 'Project Engineer', jobType: 'full_time', package: { ctc: 650000, baseSalary: 500000, workLocation: ['Bangalore', 'Pune', 'Chennai'] }, eligibilityCriteria: { programs: ['B.Tech', 'MCA'], minCGPA: 6.5, maxBacklogs: 1, yearOfPassing: [2026] }, driveDate: new Date('2026-03-18'), registrationDeadline: new Date('2026-03-16'), venue: 'Auditorium', status: 'upcoming', registeredStudents: 340, selectedStudents: 0, rounds: [
    { id: 'R4', name: 'Aptitude + Technical MCQ', type: 'aptitude', date: new Date('2026-03-18'), venue: 'Main Hall', duration: 120, maxMarks: 200, status: 'upcoming', attendees: 0, qualified: 0 },
    { id: 'R5', name: 'Group Discussion', type: 'group_discussion', date: new Date('2026-03-19'), venue: 'Seminar Rooms', duration: 30, status: 'upcoming', attendees: 0, qualified: 0 },
    { id: 'R6', name: 'Technical + HR Interview', type: 'hr', date: new Date('2026-03-19'), venue: 'Interview Rooms', duration: 45, status: 'upcoming', attendees: 0, qualified: 0 },
  ]},
];

export const recentOffers: JobOffer[] = [
  { id: 'JO001', studentId: 'STU2022045', studentName: 'Ananya Krishnan', companyName: 'Microsoft', jobRole: 'SDE-1', package: 4200000, offerDate: new Date('2026-01-28'), joiningDate: new Date('2026-07-01'), status: 'accepted', documents: ['OfferLetter.pdf'] },
  { id: 'JO002', studentId: 'STU2022089', studentName: 'Karthik Iyer', companyName: 'Infosys', jobRole: 'Systems Engineer', package: 650000, offerDate: new Date('2026-02-22'), joiningDate: new Date('2026-06-15'), status: 'accepted', documents: ['OfferLetter.pdf'] },
  { id: 'JO003', studentId: 'STU2022112', studentName: 'Sneha Reddy', companyName: 'TCS', jobRole: 'Digital Engineer', package: 700000, offerDate: new Date('2026-02-18'), joiningDate: new Date('2026-07-01'), status: 'pending', documents: ['OfferLetter.pdf'] },
  { id: 'JO004', studentId: 'STU2022067', studentName: 'Arjun Mehta', companyName: 'Goldman Sachs', jobRole: 'Analyst', package: 2400000, offerDate: new Date('2026-03-02'), joiningDate: new Date('2026-07-15'), status: 'accepted', documents: ['OfferLetter.pdf'] },
];

export const trainingSessions: TrainingSession[] = [
  { id: 'TS001', title: 'Aptitude Mastery – Quantitative', type: 'aptitude', instructor: 'Mr. Venkat (TIME Institute)', date: new Date('2026-03-10'), duration: 120, venue: 'Seminar Hall B', maxCapacity: 200, registeredCount: 178, status: 'scheduled', materials: ['QuantPractice.pdf'] },
  { id: 'TS002', title: 'Resume Building Workshop', type: 'resume_building', instructor: 'Ms. Ritu Sharma (Career Counselor)', date: new Date('2026-03-11'), duration: 90, venue: 'Room 305', maxCapacity: 60, registeredCount: 55, status: 'scheduled', materials: [] },
  { id: 'TS003', title: 'Group Discussion Techniques', type: 'soft_skills', instructor: 'Dr. Meena Iyer', date: new Date('2026-03-12'), duration: 90, venue: 'Seminar Hall A', maxCapacity: 100, registeredCount: 89, status: 'scheduled', materials: [] },
  { id: 'TS004', title: 'Data Structures & Algorithms Sprint', type: 'technical', instructor: 'Mr. Prakash (AlgoPrep)', date: new Date('2026-03-13'), duration: 180, venue: 'Lab 1-2', maxCapacity: 80, registeredCount: 80, status: 'scheduled', materials: ['DSACheatSheet.pdf'] },
];
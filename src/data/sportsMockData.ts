import type { SportsAthlete, SportsTeam, SportsFacility, SportsInventory, SportsEvent } from '@/types/sports';

export const sportsAthletes: SportsAthlete[] = [
  { id: 'SA001', studentId: 'STU2023045', studentName: 'Rahul Sharma', rollNumber: 'BT23CS045', program: 'B.Tech CSE', year: 3, email: 'rahul.s@univ.ac.in', phone: '9876543270', sports: [
    { sport: 'Cricket', category: 'Men', position: 'All-rounder', level: 'state', joinDate: new Date('2023-08-15'), status: 'active' },
  ], achievements: [
    { id: 'ACH001', sport: 'Cricket', eventName: 'Inter-University Cricket Championship', level: 'state', position: 1, medal: 'gold', date: new Date('2025-12-15'), venue: 'Hyderabad', verified: true },
  ], fitnessRecords: [], medicalClearance: true, emergencyContact: { name: 'Mr. Sharma', relationship: 'Father', phone: '9876543280' }, status: 'active' },
  { id: 'SA002', studentId: 'STU2024022', studentName: 'Priya Menon', rollNumber: 'BT24ECE022', program: 'B.Tech ECE', year: 2, email: 'priya.m@univ.ac.in', phone: '9876543271', sports: [
    { sport: 'Badminton', category: 'Women Singles', position: 'Seed 1', level: 'national', joinDate: new Date('2024-08-20'), status: 'active' },
  ], achievements: [
    { id: 'ACH002', sport: 'Badminton', eventName: 'All India Inter-University Badminton', level: 'national', position: 2, medal: 'silver', date: new Date('2026-01-20'), venue: 'Pune', verified: true },
  ], fitnessRecords: [], medicalClearance: true, emergencyContact: { name: 'Mrs. Menon', relationship: 'Mother', phone: '9876543281' }, status: 'active' },
];

export const sportsTeams: SportsTeam[] = [
  { id: 'ST001', sport: 'Cricket', category: 'men', level: 'university', coach: 'Mr. Ravi Shastri', captain: 'Rahul Sharma', members: [
    { studentId: 'STU2023045', studentName: 'Rahul Sharma', rollNumber: 'BT23CS045', position: 'All-rounder', joinDate: new Date('2023-08-15'), jerseyNumber: 7, status: 'regular' },
    { studentId: 'STU2023067', studentName: 'Vikas Patel', rollNumber: 'BT23ME067', position: 'Fast Bowler', joinDate: new Date('2023-09-01'), jerseyNumber: 11, status: 'regular' },
  ], practiceSchedule: [
    { id: 'PS001', date: new Date('2026-03-10'), startTime: '06:00', endTime: '08:00', venue: 'Cricket Ground', type: 'training', coach: 'Mr. Ravi Shastri', attendees: [] },
  ], upcomingMatches: [
    { id: 'M001', sport: 'Cricket', type: 'tournament', opponent: 'IIT Madras', date: new Date('2026-03-20'), venue: 'University Ground', homeAway: 'home', status: 'scheduled' },
  ], season: '2025-26', status: 'active' },
  { id: 'ST002', sport: 'Badminton', category: 'women', level: 'university', coach: 'Ms. Saina Kumari', members: [
    { studentId: 'STU2024022', studentName: 'Priya Menon', rollNumber: 'BT24ECE022', position: 'Singles', joinDate: new Date('2024-08-20'), status: 'regular' },
  ], practiceSchedule: [], upcomingMatches: [], season: '2025-26', status: 'active' },
];

export const sportsFacilities: SportsFacility[] = [
  { id: 'SF001', name: 'Main Cricket Ground', type: 'outdoor', sports: ['Cricket'], capacity: 2000, amenities: ['Pavilion', 'Scoreboard', 'Floodlights', 'Practice Nets'], availability: [], maintenanceSchedule: [], status: 'available' },
  { id: 'SF002', name: 'Indoor Sports Complex', type: 'indoor', sports: ['Badminton', 'Table Tennis', 'Basketball'], capacity: 500, amenities: ['AC', 'Wooden Flooring', 'Spectator Gallery', 'Changing Rooms'], availability: [], maintenanceSchedule: [], status: 'available' },
  { id: 'SF003', name: 'Swimming Pool', type: 'outdoor', sports: ['Swimming', 'Water Polo'], capacity: 200, amenities: ['Olympic Size', 'Diving Board', 'Changing Rooms', 'Lifeguard'], availability: [], maintenanceSchedule: [], status: 'maintenance' },
  { id: 'SF004', name: 'Gymnasium', type: 'indoor', sports: ['Weightlifting', 'Fitness'], capacity: 50, amenities: ['Cardio Equipment', 'Free Weights', 'Personal Training Area'], availability: [], maintenanceSchedule: [], status: 'available' },
  { id: 'SF005', name: 'Athletic Track', type: 'outdoor', sports: ['Athletics', 'Running'], capacity: 500, amenities: ['400m Track', 'High Jump', 'Long Jump', 'Shot Put'], availability: [], maintenanceSchedule: [], status: 'available' },
];

export const sportsInventory: SportsInventory[] = [
  { id: 'SI001', itemName: 'Cricket Bat (SG)', category: 'equipment', sport: 'Cricket', brand: 'SG', quantity: 15, availableQuantity: 12, unitPrice: 3500, totalValue: 52500, condition: 'good', purchaseDate: new Date('2025-06-15'), location: 'Sports Store Room' },
  { id: 'SI002', itemName: 'Cricket Ball (SG Test)', category: 'equipment', sport: 'Cricket', brand: 'SG', quantity: 48, availableQuantity: 35, unitPrice: 800, totalValue: 38400, condition: 'good', purchaseDate: new Date('2025-08-01'), location: 'Sports Store Room' },
  { id: 'SI003', itemName: 'Badminton Racket (Yonex)', category: 'equipment', sport: 'Badminton', brand: 'Yonex', quantity: 20, availableQuantity: 16, unitPrice: 4500, totalValue: 90000, condition: 'excellent', purchaseDate: new Date('2025-09-10'), location: 'Indoor Complex' },
  { id: 'SI004', itemName: 'Football (Adidas)', category: 'equipment', sport: 'Football', brand: 'Adidas', quantity: 15, availableQuantity: 13, unitPrice: 2500, totalValue: 37500, condition: 'good', purchaseDate: new Date('2025-07-20'), location: 'Sports Store Room' },
  { id: 'SI005', itemName: 'High Jump Bar', category: 'equipment', sport: 'Athletics', quantity: 2, availableQuantity: 2, unitPrice: 8000, totalValue: 16000, condition: 'fair', purchaseDate: new Date('2024-03-15'), location: 'Athletic Track' },
];

export const sportsEvents: SportsEvent[] = [
  { id: 'SE001', name: 'Annual Sports Day 2026', type: 'championship', sports: ['Athletics', 'Cricket', 'Football', 'Badminton', 'Table Tennis', 'Basketball'], startDate: new Date('2026-03-25'), endDate: new Date('2026-03-28'), venue: 'University Campus', organizer: 'Sports Department', participants: [], results: [], status: 'registration' },
  { id: 'SE002', name: 'Inter-Department Cricket Tournament', type: 'tournament', sports: ['Cricket'], startDate: new Date('2026-04-05'), endDate: new Date('2026-04-15'), venue: 'Cricket Ground', organizer: 'Sports Department', participants: [], results: [], status: 'planning' },
];
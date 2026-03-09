// Sports Department Portal Type Definitions

export interface SportsAthlete {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  program: string;
  year: number;
  email: string;
  phone: string;
  sports: SportParticipation[];
  achievements: SportAchievement[];
  fitnessRecords: FitnessRecord[];
  medicalClearance: boolean;
  emergencyContact: EmergencyContact;
  status: 'active' | 'injured' | 'suspended' | 'inactive';
}

export interface SportParticipation {
  sport: string;
  category: string;
  position?: string;
  level: 'university' | 'state' | 'national' | 'international';
  joinDate: Date;
  status: 'active' | 'bench' | 'retired';
}

export interface SportAchievement {
  id: string;
  sport: string;
  eventName: string;
  level: 'university' | 'inter_college' | 'state' | 'national' | 'international';
  position: number;
  medal?: 'gold' | 'silver' | 'bronze';
  date: Date;
  venue: string;
  certificate?: string;
  verified: boolean;
}

export interface SportsTeam {
  id: string;
  sport: string;
  category: 'men' | 'women' | 'mixed';
  level: 'university' | 'varsity' | 'junior';
  coach: string;
  captain?: string;
  members: TeamMember[];
  practiceSchedule: PracticeSession[];
  upcomingMatches: Match[];
  season: string;
  status: 'active' | 'off_season' | 'disbanded';
}

export interface TeamMember {
  studentId: string;
  studentName: string;
  rollNumber: string;
  position: string;
  joinDate: Date;
  jerseyNumber?: number;
  status: 'regular' | 'substitute' | 'injured' | 'suspended';
}

export interface PracticeSession {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  venue: string;
  type: 'training' | 'friendly' | 'selection';
  coach: string;
  attendees: string[];
  notes?: string;
}

export interface Match {
  id: string;
  sport: string;
  type: 'friendly' | 'tournament' | 'league' | 'championship';
  opponent: string;
  date: Date;
  venue: string;
  homeAway: 'home' | 'away';
  result?: MatchResult;
  status: 'scheduled' | 'live' | 'completed' | 'cancelled';
}

export interface MatchResult {
  ourScore: number;
  opponentScore: number;
  result: 'won' | 'lost' | 'draw';
  manOfMatch?: string;
  summary?: string;
}

export interface SportsFacility {
  id: string;
  name: string;
  type: 'indoor' | 'outdoor';
  sports: string[];
  capacity: number;
  amenities: string[];
  availability: FacilitySlot[];
  maintenanceSchedule: MaintenanceRecord[];
  status: 'available' | 'occupied' | 'maintenance' | 'closed';
}

export interface FacilitySlot {
  date: Date;
  startTime: string;
  endTime: string;
  bookedBy?: string;
  purpose?: string;
  status: 'available' | 'booked' | 'maintenance';
}

export interface MaintenanceRecord {
  id: string;
  date: Date;
  type: 'routine' | 'repair' | 'cleaning' | 'inspection';
  description: string;
  cost?: number;
  vendor?: string;
  status: 'scheduled' | 'in_progress' | 'completed';
}

export interface SportsInventory {
  id: string;
  itemName: string;
  category: 'equipment' | 'uniform' | 'accessory' | 'safety';
  sport: string;
  brand?: string;
  quantity: number;
  availableQuantity: number;
  unitPrice: number;
  totalValue: number;
  condition: 'excellent' | 'good' | 'fair' | 'poor' | 'damaged';
  purchaseDate: Date;
  lastMaintenance?: Date;
  assignedTo?: string[];
  location: string;
}

export interface FitnessRecord {
  id: string;
  studentId: string;
  testDate: Date;
  testType: 'fitness_assessment' | 'beep_test' | 'strength_test' | 'medical_checkup';
  results: FitnessMetric[];
  overallGrade?: 'A' | 'B' | 'C' | 'D' | 'F';
  recommendations?: string;
  restrictions?: string;
  nextTestDate?: Date;
  conductedBy: string;
}

export interface FitnessMetric {
  parameter: string;
  value: string;
  unit?: string;
  normalRange?: string;
  status: 'excellent' | 'good' | 'average' | 'below_average' | 'poor';
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  address?: string;
}

export interface SportsEvent {
  id: string;
  name: string;
  type: 'tournament' | 'championship' | 'friendly' | 'selection_trial';
  sports: string[];
  startDate: Date;
  endDate: Date;
  venue: string;
  organizer: string;
  participants: EventParticipant[];
  results: EventResult[];
  status: 'planning' | 'registration' | 'ongoing' | 'completed' | 'cancelled';
}

export interface EventParticipant {
  studentId: string;
  studentName: string;
  sport: string;
  category: string;
  registrationDate: Date;
  status: 'registered' | 'confirmed' | 'withdrawn';
}

export interface EventResult {
  sport: string;
  category: string;
  position: number;
  studentId: string;
  studentName: string;
  record?: string;
  medal?: 'gold' | 'silver' | 'bronze';
}
import React, { createContext, useContext, useState, useCallback } from 'react';
import { User, UserRole, ROLE_INFO } from '@/types/erp';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (role: UserRole) => void;
  logout: () => void;
  switchRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock user data for different roles
const getMockUser = (role: UserRole): User => {
  const roleInfo = ROLE_INFO[role];
  
  const mockUsers: Record<UserRole, User> = {
    super_admin: {
      id: 'admin-001',
      name: 'System Administrator',
      email: 'admin@university.edu',
      role: 'super_admin',
      designation: 'IT Administrator',
    },
    vice_chancellor: {
      id: 'vc-001',
      name: 'Dr. Rajesh Kumar Sharma',
      email: 'vc@university.edu',
      role: 'vice_chancellor',
      designation: 'Vice Chancellor',
    },
    pro_vc: {
      id: 'pvc-001',
      name: 'Dr. Anita Gupta',
      email: 'provc@university.edu',
      role: 'pro_vc',
      designation: 'Pro Vice Chancellor (Academics)',
    },
    registrar: {
      id: 'reg-001',
      name: 'Dr. Suresh Patel',
      email: 'registrar@university.edu',
      role: 'registrar',
      designation: 'Registrar',
    },
    dean: {
      id: 'dean-001',
      name: 'Dr. Priya Mehta',
      email: 'dean.engineering@university.edu',
      role: 'dean',
      department: 'Faculty of Engineering',
      designation: 'Dean',
    },
    hod: {
      id: 'hod-001',
      name: 'Dr. Vikram Singh',
      email: 'hod.cse@university.edu',
      role: 'hod',
      department: 'Computer Science',
      designation: 'Head of Department',
    },
    faculty: {
      id: 'fac-001',
      name: 'Prof. Neha Agarwal',
      email: 'neha.agarwal@university.edu',
      role: 'faculty',
      department: 'Computer Science',
      designation: 'Associate Professor',
    },
    student: {
      id: 'std-001',
      name: 'Arjun Reddy',
      email: 'arjun.reddy@student.university.edu',
      role: 'student',
      department: 'Computer Science',
      designation: 'B.Tech CSE - 3rd Year',
    },
    finance_officer: {
      id: 'fin-001',
      name: 'Mr. Ramesh Joshi',
      email: 'finance@university.edu',
      role: 'finance_officer',
      designation: 'Finance Officer',
    },
    iqac_coordinator: {
      id: 'iqac-001',
      name: 'Dr. Meena Krishnan',
      email: 'iqac@university.edu',
      role: 'iqac_coordinator',
      designation: 'IQAC Coordinator',
    },
    placement_officer: {
      id: 'plc-001',
      name: 'Mr. Anil Verma',
      email: 'placements@university.edu',
      role: 'placement_officer',
      designation: 'Training & Placement Officer',
    },
    alumni_officer: {
      id: 'alm-001',
      name: 'Ms. Kavitha Nair',
      email: 'alumni@university.edu',
      role: 'alumni_officer',
      designation: 'Alumni Relations Officer',
    },
    sports_director: {
      id: 'spt-001',
      name: 'Mr. Ravi Kumar',
      email: 'sports@university.edu',
      role: 'sports_director',
      designation: 'Director of Sports',
    },
    grievance_officer: {
      id: 'grv-001',
      name: 'Dr. Lakshmi Iyer',
      email: 'grievance@university.edu',
      role: 'grievance_officer',
      designation: 'Grievance Redressal Officer',
    },
    security_officer: {
      id: 'sec-001',
      name: 'Mr. Sunil Rao',
      email: 'security@university.edu',
      role: 'security_officer',
      designation: 'Chief Security Officer',
    },
    librarian: {
      id: 'lib-001',
      name: 'Ms. Deepa Sharma',
      email: 'library@university.edu',
      role: 'librarian',
      designation: 'Chief Librarian',
    },
  };

  return mockUsers[role];
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = useCallback((role: UserRole) => {
    const mockUser = getMockUser(role);
    setUser(mockUser);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const switchRole = useCallback((role: UserRole) => {
    const mockUser = getMockUser(role);
    setUser(mockUser);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
        switchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

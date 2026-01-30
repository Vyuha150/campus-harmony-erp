import { useNavigate } from 'react-router-dom';
import { 
  GraduationCap, Shield, Award, Users, BookOpen, Wallet,
  Briefcase, Trophy, MessageSquare, Library, Building2,
  FileText, Users2, ShieldCheck, Crown
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ROLE_INFO, UserRole } from '@/types/erp';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ElementType> = {
  Shield, Crown: Award, Star: Award, FileText, Building2,
  Users, GraduationCap, BookOpen, Wallet, Award, Briefcase,
  Users2, Trophy, MessageSquare, ShieldCheck, Library
};

const roleGroups = [
  {
    title: 'Leadership',
    roles: ['vice_chancellor', 'pro_vc'] as UserRole[],
  },
  {
    title: 'Administration',
    roles: ['registrar', 'dean', 'hod', 'super_admin'] as UserRole[],
  },
  {
    title: 'Academics',
    roles: ['faculty', 'student'] as UserRole[],
  },
  {
    title: 'Departments',
    roles: ['finance_officer', 'placement_officer', 'iqac_coordinator', 'librarian'] as UserRole[],
  },
  {
    title: 'Support Services',
    roles: ['alumni_officer', 'sports_director', 'grievance_officer', 'security_officer'] as UserRole[],
  },
];

export default function RoleSelection() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleRoleSelect = (role: UserRole) => {
    login(role);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.03%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50" />

      <div className="relative">
        {/* Header */}
        <header className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary shadow-glow-gold">
              <GraduationCap className="h-8 w-8 text-secondary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Campus ERP</h1>
              <p className="text-sm text-white/60">University Management System</p>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 pb-16">
          <div className="mx-auto max-w-5xl">
            <div className="mb-12 text-center">
              <h2 className="text-2xl font-semibold text-white">Select Your Role</h2>
              <p className="mt-2 text-white/60">
                Choose a role to explore the Campus ERP dashboard and features
              </p>
            </div>

            <div className="space-y-8">
              {roleGroups.map((group) => (
                <div key={group.title}>
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-secondary">
                    {group.title}
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {group.roles.map((role) => {
                      const roleInfo = ROLE_INFO[role];
                      const Icon = iconMap[roleInfo.icon] || Shield;

                      return (
                        <button
                          key={role}
                          onClick={() => handleRoleSelect(role)}
                          className="group relative overflow-hidden rounded-xl bg-white/5 p-6 text-left backdrop-blur-sm transition-all duration-300 hover:bg-white/10 hover:scale-[1.02] hover:shadow-xl border border-white/10 hover:border-secondary/50"
                        >
                          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-secondary/10 transition-transform group-hover:scale-150" />
                          
                          <div className="relative">
                            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/20 transition-colors group-hover:bg-secondary">
                              <Icon className="h-6 w-6 text-secondary transition-colors group-hover:text-secondary-foreground" />
                            </div>
                            <h4 className="font-semibold text-white">{roleInfo.label}</h4>
                            <p className="mt-1 text-sm text-white/60 line-clamp-2">
                              {roleInfo.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-white/10 py-6">
          <div className="container mx-auto px-4 text-center">
            <p className="text-sm text-white/40">
              Campus ERP • NAAC/UGC/NIRF Compliant • Built for Indian Universities
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

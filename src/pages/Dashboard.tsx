import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Info } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ROLE_INFO } from '@/types/erp';

/**
 * Generic landing page.
 *
 * Reached by `principal` and `auditor` — the two roles with no dedicated
 * dashboard component in App.tsx — and by the catch-all routes `/academics/*`,
 * `/examinations/*`, `/research/*`, `/reports/*` and `/settings/*`.
 *
 * WHAT WAS HERE BEFORE, AND WHY IT IS GONE
 *
 * A template mockup presented as a working dashboard:
 *
 *   - Four stat cards per role, every figure a literal: '12,458' students,
 *     '847' faculty, '1,247' publications, 'NIRF Rank #42', '₹24.5 Cr' fee
 *     collection, '78%' placement rate — each with an invented
 *     "+8.2% vs last month" trend. None came from the API. An auditor, whose
 *     entire function is oversight, was shown fabricated institutional
 *     statistics as their home screen, and NIRF Rank is a claim about a
 *     regulator's finding.
 *   - A hardcoded date button reading "Dec 10, 2024" and a "3 Alerts" button.
 *   - Five widgets (schedule, tasks, announcements and four charts) calling
 *     /api/dashboard/* endpoints that do not exist; all five 404 on every
 *     load and render empty.
 *   - Quick-action buttons with no onClick handler.
 *   - A "Compliance Status" panel asserting "NAAC SSR 92% Complete",
 *     "NIRF Data 78%", "UGC DCF Submitted" — invented regulatory readiness,
 *     the same category as the fabricated NAAC grade removed from the admin
 *     config endpoint earlier.
 *
 * Nothing here was real, so nothing here is kept. This page now says what it
 * knows: who you are, what you can reach, and that no consolidated view has
 * been built for this role yet.
 */

/** Sidebar destinations that exist today, keyed by the module names in ROLE_INFO. */
const MODULE_LINKS: Record<string, { label: string; path: string }> = {
  // Every path here is an actual <Route> in App.tsx. Only `coe` has a
  // `/dashboard` route; the others land on their first real screen.
  finance: { label: 'Finance', path: '/finance/fees' },
  registrar: { label: 'Registrar', path: '/registrar/student-records' },
  hod: { label: 'Department', path: '/hod/faculty' },
  dean: { label: 'Faculty of Study', path: '/dean/academics' },
  vc: { label: 'Institutional Oversight', path: '/vc/analytics' },
  coe: { label: 'Examinations', path: '/coe/dashboard' },
  iqac: { label: 'Quality Assurance', path: '/iqac/criteria' },
};

export default function Dashboard() {
  const { user } = useAuth();

  const links = useMemo(() => {
    if (!user) return [];
    const roleInfo = ROLE_INFO[user.role];
    return (roleInfo?.modules ?? [])
      .map((m) => MODULE_LINKS[m])
      .filter((entry): entry is { label: string; path: string } => Boolean(entry));
  }, [user]);

  if (!user) return null;

  const roleInfo = ROLE_INFO[user.role];

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  })();

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6">
        <div>
          <h1 className="page-title">
            {greeting}, {user.name.split(' ')[0]}!
          </h1>
          <p className="page-description">
            Signed in as {roleInfo?.label ?? user.role}.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4 text-muted-foreground" />
              No consolidated dashboard yet for this role
            </CardTitle>
            <CardDescription>
              Summary figures for {roleInfo?.label ?? user.role} have not been built. Rather
              than show placeholder numbers, this page shows none — use the
              modules below, or the sidebar, to reach the live records.
            </CardDescription>
          </CardHeader>
          {links.length > 0 && (
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {links.map((link) => (
                  <Button
                    key={link.path}
                    asChild
                    variant="outline"
                    className="justify-between"
                  >
                    <Link to={link.path}>
                      {link.label}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}

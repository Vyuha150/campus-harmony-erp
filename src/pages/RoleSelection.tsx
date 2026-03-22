import { useNavigate } from 'react-router-dom';
import { useState, type FormEvent } from 'react';
import { 
  GraduationCap, LogIn, AlertCircle
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function RoleSelection() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to sign in. Check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="min-h-screen bg-[radial-gradient(1200px_circle_at_10%_10%,hsl(var(--primary)/0.12),transparent_45%),radial-gradient(1200px_circle_at_90%_90%,hsl(var(--secondary)/0.14),transparent_40%)] px-4 py-8 sm:px-6 lg:px-8">
        <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center">
          <div className="grid w-full overflow-hidden rounded-2xl border border-border bg-background shadow-xl lg:grid-cols-5">
            <section className="bg-slate-900 p-8 text-slate-100 lg:col-span-2 lg:p-10">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100/10">
                  <GraduationCap className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold tracking-tight">Campus ERP</h1>
                  <p className="text-sm text-slate-300">University Management System</p>
                </div>
              </div>

              <div className="mt-10 space-y-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Secure Access</p>
                  <h2 className="mt-2 text-2xl font-semibold leading-tight">Sign in to continue to your role dashboard</h2>
                </div>
                <ul className="space-y-3 text-sm text-slate-300">
                  <li>Centralized modules for academics, finance, governance, and compliance.</li>
                  <li>Role-based permissions with institutional access controls.</li>
                  <li>Unified workflows aligned to NAAC, UGC, and NIRF reporting needs.</li>
                </ul>
              </div>
            </section>

            <section className="p-8 lg:col-span-3 lg:p-10">
              <div className="mb-6">
                <h3 className="text-2xl font-semibold text-foreground">Welcome Back</h3>
                <p className="mt-1 text-sm text-muted-foreground">Use your institutional credentials to access the system.</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4 rounded-xl border border-border bg-card p-6">
                {error && (
                  <Alert className="border-destructive/40 bg-destructive/10">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@university.edu"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={submitting || isLoading}>
                  <LogIn className="mr-2 h-4 w-4" />
                  {submitting ? 'Signing In...' : 'Sign In'}
                </Button>
              </form>

              <p className="mt-4 text-xs text-muted-foreground">
                Accounts are provisioned by your institution administrator.
              </p>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

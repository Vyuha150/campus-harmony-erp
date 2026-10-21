import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface Props { children: ReactNode; resetKey: string }
interface State { error: Error | null }

class Boundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page crashed', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    // Moving to another page clears the error, so one broken page never blanks the app.
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md space-y-4 rounded-lg border border-border p-6 text-center">
          <h1 className="text-xl font-semibold text-foreground">Something went wrong on this page</h1>
          <p className="text-sm text-muted-foreground">The rest of the system is fine. Go back, or reload the page; if it happens again, report what you clicked.</p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => window.history.back()}>Go back</Button>
            <Button onClick={() => window.location.reload()}>Reload</Button>
          </div>
        </div>
      </div>
    );
  }
}

/** Catches a crash in any page and keeps the rest of the app usable. */
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return <Boundary resetKey={location.pathname}>{children}</Boundary>;
}

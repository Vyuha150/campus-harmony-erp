import { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
  variant?: 'default' | 'primary' | 'secondary' | 'accent' | 'success' | 'warning';
}

export function StatCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  trend = 'neutral',
  className,
  variant = 'default',
}: StatCardProps) {
  const variantStyles = {
    default: 'bg-card',
    primary: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    accent: 'bg-accent text-accent-foreground',
    success: 'bg-success text-success-foreground',
    warning: 'bg-warning text-warning-foreground',
  };

  const iconBgStyles = {
    default: 'bg-muted text-muted-foreground',
    primary: 'bg-primary-foreground/20 text-primary-foreground',
    secondary: 'bg-secondary-foreground/20 text-secondary-foreground',
    accent: 'bg-accent-foreground/20 text-accent-foreground',
    success: 'bg-success-foreground/20 text-success-foreground',
    warning: 'bg-warning-foreground/20 text-warning-foreground',
  };

  return (
    <div
      className={cn(
        'stat-card group',
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className={cn(
            'text-sm font-medium',
            variant === 'default' ? 'text-muted-foreground' : 'opacity-80'
          )}>
            {title}
          </p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          {(change !== undefined || changeLabel) && (
            <div className="flex items-center gap-1.5">
              {change !== undefined && (
                <>
                  {trend === 'up' ? (
                    <TrendingUp className="h-4 w-4 text-success" />
                  ) : trend === 'down' ? (
                    <TrendingDown className="h-4 w-4 text-destructive" />
                  ) : null}
                  <span
                    className={cn(
                      'text-sm font-medium',
                      trend === 'up' && variant === 'default' && 'text-success',
                      trend === 'down' && variant === 'default' && 'text-destructive',
                      variant !== 'default' && 'opacity-80'
                    )}
                  >
                    {change > 0 ? '+' : ''}{change}%
                  </span>
                </>
              )}
              {changeLabel && (
                <span className={cn(
                  'text-xs',
                  variant === 'default' ? 'text-muted-foreground' : 'opacity-60'
                )}>
                  {changeLabel}
                </span>
              )}
            </div>
          )}
        </div>
        <div className={cn(
          'flex h-12 w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-110',
          iconBgStyles[variant]
        )}>
          {icon}
        </div>
      </div>
    </div>
  );
}

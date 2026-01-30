import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface WidgetCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function WidgetCard({
  title,
  description,
  children,
  action,
  className,
  noPadding = false,
}: WidgetCardProps) {
  return (
    <div className={cn('dashboard-widget', className)}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className={noPadding ? '-mx-6 -mb-6' : ''}>{children}</div>
    </div>
  );
}

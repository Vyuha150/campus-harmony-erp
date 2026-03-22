import { CheckCircle2, Clock, AlertTriangle, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/apiService';

interface Task {
  id: string;
  title: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  progress?: number;
}

const statusConfig = {
  pending: {
    icon: Clock,
    color: 'text-muted-foreground',
    bg: 'bg-muted',
    label: 'Pending',
  },
  in_progress: {
    icon: Clock,
    color: 'text-info',
    bg: 'bg-info/10',
    label: 'In Progress',
  },
  completed: {
    icon: CheckCircle2,
    color: 'text-success',
    bg: 'bg-success/10',
    label: 'Completed',
  },
  overdue: {
    icon: AlertTriangle,
    color: 'text-destructive',
    bg: 'bg-destructive/10',
    label: 'Overdue',
  },
};

const priorityColors = {
  low: 'border-l-muted-foreground/30',
  medium: 'border-l-warning',
  high: 'border-l-destructive',
};

export function TasksWidget() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    fetchApi('/dashboard/tasks')
      .then((data) => setTasks(data))
      .catch((error) => { console.error('API request failed', error); });
  }, []);

  return (
    <div className="space-y-2">
      {tasks.map((task) => {
        const config = statusConfig[task.status];
        const Icon = config.icon;

        return (
          <div
            key={task.id}
            className={cn(
              'group flex items-center gap-3 rounded-lg border border-l-4 p-3 transition-all hover:bg-muted/30',
              priorityColors[task.priority]
            )}
          >
            <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', config.bg)}>
              <Icon className={cn('h-4 w-4', config.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="truncate text-sm font-medium">{task.title}</h4>
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>Due: {task.dueDate}</span>
                <span className={cn('font-medium', config.color)}>{config.label}</span>
              </div>
              {task.progress !== undefined && (
                <div className="mt-2">
                  <Progress value={task.progress} className="h-1.5" />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

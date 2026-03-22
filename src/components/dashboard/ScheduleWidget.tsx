import { format } from 'date-fns';
import { Clock, BookOpen, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/apiService';

interface ScheduleItem {
  id: string;
  title: string;
  time: string;
  endTime?: string;
  location?: string;
  type: 'class' | 'meeting' | 'exam' | 'event';
  status?: 'upcoming' | 'ongoing' | 'completed';
}

const typeColors = {
  class: 'border-info bg-info/10',
  meeting: 'border-warning bg-warning/10',
  exam: 'border-destructive bg-destructive/10',
  event: 'border-success bg-success/10',
};

const statusStyles = {
  completed: 'opacity-50',
  ongoing: 'ring-2 ring-success ring-offset-2',
  upcoming: '',
};

export function ScheduleWidget() {
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);

  useEffect(() => {
    fetchApi('/dashboard/schedule')
      .then((data) => setSchedule(data))
      .catch((error) => { console.error('API request failed', error); });
  }, []);

  return (
    <div className="space-y-3">
      {schedule.map((item) => (
        <div
          key={item.id}
          className={cn(
            'flex gap-4 rounded-lg border-l-4 bg-muted/30 p-3 transition-all hover:bg-muted/50',
            typeColors[item.type],
            statusStyles[item.status || 'upcoming']
          )}
        >
          <div className="flex flex-col items-center justify-center border-r border-border pr-4">
            <span className="text-lg font-bold text-foreground">{item.time}</span>
            {item.endTime && (
              <span className="text-xs text-muted-foreground">to {item.endTime}</span>
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-medium text-foreground">{item.title}</h4>
            </div>
            {item.location && (
              <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span>{item.location}</span>
              </div>
            )}
          </div>
          {item.status === 'ongoing' && (
            <div className="flex items-center">
              <span className="flex items-center gap-1 rounded-full bg-success px-2 py-0.5 text-xs font-medium text-success-foreground">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success-foreground" />
                Live
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

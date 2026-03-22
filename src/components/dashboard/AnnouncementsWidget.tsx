import { AlertCircle, Bell, Calendar, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';
import { fetchApi } from '@/lib/apiService';

interface Announcement {
  id: string;
  title: string;
  excerpt: string;
  priority: 'low' | 'medium' | 'high';
  date: string;
  category: string;
}

const priorityConfig = {
  high: {
    icon: AlertCircle,
    color: 'text-destructive',
    bg: 'bg-destructive/10',
    badge: 'destructive',
  },
  medium: {
    icon: Bell,
    color: 'text-warning',
    bg: 'bg-warning/10',
    badge: 'warning',
  },
  low: {
    icon: Info,
    color: 'text-info',
    bg: 'bg-info/10',
    badge: 'secondary',
  },
};

export function AnnouncementsWidget() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    fetchApi('/dashboard/announcements')
      .then((data) => setAnnouncements(data))
      .catch((error) => { console.error('API request failed', error); });
  }, []);

  return (
    <div className="space-y-3">
      {announcements.map((announcement) => {
        const config = priorityConfig[announcement.priority];
        const Icon = config.icon;

        return (
          <div
            key={announcement.id}
            className="group cursor-pointer rounded-lg border p-4 transition-all hover:border-primary/30 hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', config.bg)}>
                <Icon className={cn('h-5 w-5', config.color)} />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-medium leading-tight text-foreground group-hover:text-primary">
                    {announcement.title}
                  </h4>
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {announcement.category}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{announcement.excerpt}</p>
                <p className="text-xs text-muted-foreground/60">{announcement.date}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

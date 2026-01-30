import { AlertCircle, Bell, Calendar, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface Announcement {
  id: string;
  title: string;
  excerpt: string;
  priority: 'low' | 'medium' | 'high';
  date: string;
  category: string;
}

const mockAnnouncements: Announcement[] = [
  {
    id: '1',
    title: 'Mid-Semester Examination Schedule Released',
    excerpt: 'The examination schedule for Semester VI has been published. Students are advised to check their hall tickets.',
    priority: 'high',
    date: '2 hours ago',
    category: 'Examinations',
  },
  {
    id: '2',
    title: 'Last Date for Fee Payment Extended',
    excerpt: 'The deadline for semester fee payment has been extended to December 20th, 2024.',
    priority: 'medium',
    date: '1 day ago',
    category: 'Finance',
  },
  {
    id: '3',
    title: 'Annual Tech Fest Registration Open',
    excerpt: 'TechnoVision 2024 registrations are now open. Participate in various technical and cultural events.',
    priority: 'low',
    date: '2 days ago',
    category: 'Events',
  },
  {
    id: '4',
    title: 'Library Hours Extended During Exams',
    excerpt: 'Central Library will remain open till 10 PM during examination period.',
    priority: 'low',
    date: '3 days ago',
    category: 'Library',
  },
];

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
  return (
    <div className="space-y-3">
      {mockAnnouncements.map((announcement) => {
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

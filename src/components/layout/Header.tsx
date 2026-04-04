import { Bell, Search, HelpCircle, Settings, ChevronDown, Menu } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ROLE_INFO } from '@/types/erp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useApiData } from '@/hooks/useApiData';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const notificationEndpointByRole: Record<string, string | null> = {
  super_admin: '/admin/notifications',
  vice_chancellor: '/vc/messages',
  pro_vc: '/vc/messages',
  hod: '/hod/messages',
  faculty: '/faculty/messages',
  alumni_officer: '/alumni/communications',
  placement_officer: '/placements/messages',
  iqac_coordinator: '/iqac/meetings',
  grievance_officer: '/grievances/cases',
  security_officer: '/security/incidents',
  student: null,
  registrar: null,
  dean: null,
  finance_officer: null,
  sports_director: null,
  librarian: null,
};

function formatRelativeTime(value?: string | Date): string {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  const diffMin = Math.round((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
  return `${Math.floor(diffMin / 1440)}d ago`;
}

export function Header() {
  const { user } = useAuth();

  if (!user) return null;

  const roleInfo = ROLE_INFO[user.role];
  const notificationsEndpoint = notificationEndpointByRole[user.role] || null;
  const { data: notificationData } = useApiData<any[]>(notificationsEndpoint || '/health', []);
  const notifications = (notificationsEndpoint ? notificationData : []).slice(0, 8).map((item: any) => ({
    id: item.id,
    title: item.title || item.subject || item.type || 'Update',
    message: item.message || item.description || item.content || 'No additional details',
    time: formatRelativeTime(item.createdAt || item.sentAt || item.date || item.submittedAt),
    unread: item.read === false || item.status === 'pending',
  }));
  const unreadCount = notifications.filter((n: any) => n.unread).length;

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const handleOpenSidebar = () => {
    window.dispatchEvent(new Event('erp:toggle-sidebar'));
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-card px-3 sm:h-16 sm:px-6">
      {/* Search */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground lg:hidden"
          onClick={handleOpenSidebar}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="relative hidden w-80 max-w-[60vw] lg:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search students, courses, faculty..."
            className="pl-10 bg-muted/50 border-none"
          />
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* Quick Actions */}
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <HelpCircle className="h-5 w-5" />
        </Button>

        {/* Notifications */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                  {unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h4 className="font-semibold">Notifications</h4>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                Mark all read
              </Button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.map((notification: any) => (
                <div
                  key={notification.id}
                  className={`border-b px-4 py-3 transition-colors hover:bg-muted/50 ${
                    notification.unread ? 'bg-muted/30' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {notification.unread && (
                      <div className="mt-1.5 h-2 w-2 rounded-full bg-info" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium">{notification.title}</p>
                      <p className="text-xs text-muted-foreground">{notification.message}</p>
                      <p className="mt-1 text-xs text-muted-foreground/60">{notification.time}</p>
                    </div>
                  </div>
                </div>
              ))}
              {notifications.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">No notifications</div>
              )}
            </div>
            <div className="border-t p-2">
              <Button variant="ghost" className="w-full text-sm">
                View all notifications
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <Badge variant="secondary" className="hidden font-normal sm:inline-flex">{roleInfo.label}</Badge>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 pl-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left md:block">
                <p className="text-sm font-medium">{user.name.split(' ')[0]}</p>
              </div>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div>
                <p className="font-medium">{user.name}</p>
                <p className="text-xs font-normal text-muted-foreground">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              Profile Settings
            </DropdownMenuItem>
            <DropdownMenuItem>
              <HelpCircle className="mr-2 h-4 w-4" />
              Help & Support
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

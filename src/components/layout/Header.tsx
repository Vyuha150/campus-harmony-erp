import { notificationLink } from '@/lib/notificationLink';
import { Bell, Search, HelpCircle, Settings, ChevronDown, Menu } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ROLE_INFO } from '@/types/erp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useApiData } from '@/hooks/useApiData';
import { postApi } from '@/lib/apiService';
import { useState } from 'react';
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
import { firstName } from '@/lib/names';
import { useNavigate } from 'react-router-dom';


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
  const navigate = useNavigate();
  const { user } = useAuth();
  // Hooks run before the early return below — calling them after it broke the
  // rules of hooks whenever the user signed in or out.
  const { data: inbox, refetch: refetchInbox } = useApiData<any[]>(user ? '/notifications/inbox' : '/health', []);
  const [showAll, setShowAll] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);

  if (!user) return null;

  const roleInfo = ROLE_INFO[user.role];
  const allNotifications = (Array.isArray(inbox) ? inbox : []).map((item: any) => ({
    id: item.id,
    title: item.subject || item.eventType || 'Update',
    message: item.body || '',
    time: formatRelativeTime(item.sentAt || item.createdAt),
    unread: !item.readAt,
    link: notificationLink(item, user.role),
  }));
  const notifications = showAll ? allNotifications : allNotifications.slice(0, 8);
  const unreadCount = allNotifications.filter((n) => n.unread).length;

  const markRead = async (ids: string[]) => {
    await Promise.all(ids.map((id) => postApi(`/notifications/inbox/${id}/read`, {}).catch(() => undefined)));
    refetchInbox();
  };

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
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" title="Help & Support" onClick={() => navigate('/account?tab=support')}>
          <HelpCircle className="h-5 w-5" />
        </Button>

        {/* Notifications */}
        <Popover open={bellOpen} onOpenChange={setBellOpen}>
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
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" disabled={unreadCount === 0}
                onClick={() => markRead(allNotifications.filter((n) => n.unread).map((n) => n.id))}>
                Mark all read
              </Button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.map((notification: any) => (
                <div
                  key={notification.id}
                  role="button"
                  // Opens the page where the notification is acted on.
                  onClick={() => {
                    if (notification.unread) markRead([notification.id]);
                    if (notification.link) {
                      setBellOpen(false);
                      navigate(notification.link);
                    }
                  }}
                  className={`cursor-pointer border-b px-4 py-3 transition-colors hover:bg-muted/50 ${
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
                      <p className="mt-1 text-xs text-muted-foreground/60">{notification.time}{notification.link ? ' · Open →' : ''}</p>
                    </div>
                  </div>
                </div>
              ))}
              {notifications.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">No notifications</div>
              )}
            </div>
            <div className="border-t p-2">
              <Button variant="ghost" className="w-full text-sm" disabled={allNotifications.length <= 8}
                onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Show recent only' : `View all notifications (${allNotifications.length})`}
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
                <p className="text-sm font-medium">{firstName(user.name)}</p>
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
            {/* Both items had no handler and nothing behind them; they now open
                the account page (pages/AccountSettings.tsx). */}
            <DropdownMenuItem onSelect={() => navigate('/account?tab=profile')}>
              <Settings className="mr-2 h-4 w-4" />
              Profile Settings
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate('/account?tab=support')}>
              <HelpCircle className="mr-2 h-4 w-4" />
              Help & Support
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

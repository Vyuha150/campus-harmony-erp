import { Bell, Search, HelpCircle, Settings, ChevronDown } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ROLE_INFO, UserRole } from '@/types/erp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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

const mockNotifications = [
  { id: 1, title: 'New Leave Request', message: 'Dr. Sharma has requested casual leave', time: '5m ago', unread: true },
  { id: 2, title: 'Exam Results Published', message: 'B.Tech Sem 5 results are now available', time: '1h ago', unread: true },
  { id: 3, title: 'Fee Reminder', message: 'Last date for fee payment is Dec 15', time: '2h ago', unread: false },
  { id: 4, title: 'Meeting Scheduled', message: 'Academic Council meeting on Monday', time: '1d ago', unread: false },
];

export function Header() {
  const { user, switchRole } = useAuth();

  if (!user) return null;

  const roleInfo = ROLE_INFO[user.role];
  const unreadCount = mockNotifications.filter(n => n.unread).length;

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const availableRoles: UserRole[] = [
    'super_admin', 'vice_chancellor', 'registrar', 'dean', 'hod', 
    'faculty', 'student', 'finance_officer', 'placement_officer'
  ];

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-card px-6">
      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search students, courses, faculty..."
            className="pl-10 bg-muted/50 border-none"
          />
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-3">
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
              {mockNotifications.map((notification) => (
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
            </div>
            <div className="border-t p-2">
              <Button variant="ghost" className="w-full text-sm">
                View all notifications
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Role Switcher (Demo) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Badge variant="secondary" className="font-normal">
                {roleInfo.label}
              </Badge>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Switch Role (Demo)</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {availableRoles.map((role) => (
              <DropdownMenuItem
                key={role}
                onClick={() => switchRole(role)}
                className={user.role === role ? 'bg-muted' : ''}
              >
                {ROLE_INFO[role].label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

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

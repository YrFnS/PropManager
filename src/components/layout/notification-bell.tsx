'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Bell, Mail, DollarSign, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useRouter } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import { NOTIFICATION_COLORS } from '@/lib/status-config';
import { formatDistanceToNow } from 'date-fns';
import { ar as arLocale } from 'date-fns/locale/ar';

interface Notification {
  id: string;
  type: 'message' | 'payment' | 'maintenance';
  title: string;
  description: string;
  createdAt: string;
  section: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

const notificationIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  message: Mail,
  payment: DollarSign,
  maintenance: Wrench,
};

export function NotificationBell() {
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const dateLocale = locale === 'ar' ? arLocale : undefined;
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/notifications');
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) setData(json);
        }
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      fetch('/api/notifications')
        .then(r => r.json())
        .then(json => setData(json))
        .catch(() => {});
    }
  }, []);

  const handleNotificationClick = useCallback((section: string) => {
    router.push(section);
    setOpen(false);
  }, [router]);

  const handleViewAll = useCallback(() => {
    // Navigate to the section with the most notifications, or dashboard
    if (data?.notifications && data.notifications.length > 0) {
      router.push(data.notifications[0].section);
    }
    setOpen(false);
  }, [data, router]);

  const unreadCount = data?.unreadCount || 0;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative shrink-0"
          aria-label={tc('notifications')}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              className={cn(
                'absolute -top-0.5 -end-0.5 flex items-center justify-center',
                'min-w-[18px] h-[18px] px-1 rounded-full',
                'bg-red-500 text-white text-[10px] font-bold leading-none',
                'animate-in zoom-in-50 duration-200 pulse-dot'
              )}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[calc(100vw-2rem)] sm:w-80 p-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">{tc('notifications')}</h3>
          {unreadCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {unreadCount} {unreadCount === 1 ? '' : ''}
            </span>
          )}
        </div>

        {/* Notification List */}
        <div className="max-h-80 overflow-y-auto scrollbar-thin">
          {loading && !data ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : !data?.notifications || data.notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-2">
                <Bell className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">{tc('noNotifications')}</p>
            </div>
          ) : (
            <div className="divide-y">
              {data.notifications.map((notification) => {
                const Icon = notificationIcons[notification.type] || Bell;
                const colorClass = NOTIFICATION_COLORS[notification.type] || 'text-muted-foreground bg-muted';
                return (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification.section)}
                    className="flex items-start gap-3 w-full px-4 py-3 text-start hover:bg-muted/50 transition-colors"
                  >
                    <div className={cn('shrink-0 h-8 w-8 rounded-full flex items-center justify-center', colorClass)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{notification.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{notification.description}</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: dateLocale })}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer - View All */}
        {data?.notifications && data.notifications.length > 0 && (
          <div className="border-t">
            <button
              onClick={handleViewAll}
              className="flex items-center justify-center w-full py-2.5 text-sm font-medium text-primary hover:text-primary/80 hover:bg-muted/50 transition-colors"
            >
              {tc('viewAll')}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

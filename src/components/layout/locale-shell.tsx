'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { LogOut, Loader2 } from 'lucide-react';
import { usePathname } from '@/i18n/routing';
import { AppShell } from '@/components/layout/app-shell';
import { OrganizationMenu } from '@/components/layout/organization-menu';
import { Button } from '@/components/ui/button';

export function LocaleShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const locale = useLocale();
  const [loggingOut, setLoggingOut] = useState(false);

  if (pathname === '/login') return <>{children}</>;

  const logout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.assign(`/${locale}/login`);
    }
  };

  return (
    <>
      <AppShell>{children}</AppShell>
      <div className="fixed bottom-4 start-4 z-40 flex max-w-[calc(100vw-2rem)] items-center gap-2 sm:bottom-6 sm:start-6">
        <OrganizationMenu />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-2 bg-background/95 shadow-md backdrop-blur"
          onClick={logout}
          disabled={loggingOut}
          aria-label={locale === 'ar' ? 'تسجيل الخروج' : 'Sign out'}
        >
          {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          <span className="hidden lg:inline">{locale === 'ar' ? 'تسجيل الخروج' : 'Sign out'}</span>
        </Button>
      </div>
    </>
  );
}

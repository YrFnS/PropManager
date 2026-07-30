'use client';

import { useAppStore } from '@/lib/store';
import { useTranslations, useLocale } from 'next-intl';
import { Link, useRouter, usePathname } from '@/i18n/routing';
import {
  Building2,
  LayoutDashboard,
  Users,
  CreditCard,
  Wrench,
  MessageSquare,
  Settings,
  DoorOpen,
  FileText,
  Menu,
  X,
  Languages,
  Moon,
  Sun,
  Search,
  BarChart3,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CommandPalette } from '@/components/layout/command-palette';
import { NotificationBell } from '@/components/layout/notification-bell';
import { KeyboardShortcutsDialog, useKeyboardShortcutsHelp } from '@/components/layout/keyboard-shortcuts-dialog';
import { AICopilot } from '@/components/layout/ai-copilot';
import BackToTop from '@/components/ui/back-to-top';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSession } from '@/components/auth/session-provider';

type Section = 'dashboard' | 'properties' | 'units' | 'tenants' | 'leases' | 'payments' | 'maintenance' | 'messages' | 'reports' | 'settings';

const navGroups = [
  {
    label: 'overview',
    items: [
      { key: 'dashboard' as const, icon: LayoutDashboard },
    ],
  },
  {
    label: 'management',
    items: [
      { key: 'properties' as const, icon: Building2 },
      { key: 'units' as const, icon: DoorOpen },
      { key: 'tenants' as const, icon: Users },
    ],
  },
  {
    label: 'finance',
    items: [
      { key: 'leases' as const, icon: FileText },
      { key: 'payments' as const, icon: CreditCard },
    ],
  },
  {
    label: 'operations',
    items: [
      { key: 'maintenance' as const, icon: Wrench },
      { key: 'messages' as const, icon: MessageSquare },
      { key: 'reports' as const, icon: BarChart3 },
    ],
  },
];

const settingsNavItems = [
  { key: 'settings' as const, icon: Settings },
];

// Section dot colors
const sectionDotColors: Record<string, string> = {
  dashboard: 'bg-teal-500',
  properties: 'bg-emerald-500',
  units: 'bg-sky-500',
  tenants: 'bg-purple-500',
  leases: 'bg-blue-500',
  payments: 'bg-green-500',
  maintenance: 'bg-orange-500',
  messages: 'bg-cyan-500',
  reports: 'bg-amber-500',
  settings: 'bg-gray-500',
};

const sectionOrder: Section[] = ['dashboard', 'properties', 'units', 'tenants', 'leases', 'payments', 'maintenance', 'messages', 'reports', 'settings'];

const sectionAddActions: Record<string, string> = {
  properties: 'addProperty',
  units: 'addUnit',
  tenants: 'addTenant',
  leases: 'addLease',
  payments: 'addPayment',
  maintenance: 'addRequest',
  messages: 'newMessage',
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, setSidebarOpen, aiCopilotOpen, setAiCopilotOpen } = useAppStore();
  const { canWrite } = useSession();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const { theme, setTheme } = useTheme();
  const [isMobile, setIsMobile] = useState(false);
  const { open: shortcutsOpen, setOpen: setShortcutsOpen } = useKeyboardShortcutsHelp();
  const mainContentRef = useRef<HTMLDivElement>(null);

  // Determine current section from pathname
  // Note: usePathname() from next-intl returns locale-stripped path (e.g., /dashboard not /en/dashboard)
  const currentSection = (() => {
    const segments = pathname.split('/').filter(Boolean);
    const section = segments[0]; // first segment after stripping locale
    if (section && sectionOrder.includes(section as Section)) {
      return section as Section;
    }
    return 'dashboard' as Section;
  })();

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Auto-close sidebar on mobile, auto-open on desktop
      if (mobile && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(!sidebarOpen);
  }, [sidebarOpen, setSidebarOpen]);

  // Close sidebar when clicking overlay on mobile
  const handleOverlayClick = useCallback(() => {
    setSidebarOpen(false);
  }, [setSidebarOpen]);

  // Keyboard shortcuts: Escape, 1-9, N, E, D, L
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

      // Escape to close sidebar on mobile
      if (e.key === 'Escape') {
        if (isMobile && sidebarOpen) {
          setSidebarOpen(false);
        }
        return;
      }

      // Don't fire shortcuts when in input fields
      if (isInput) return;
      // Don't fire when modifier keys are held (except for Cmd/Ctrl+K and Cmd/Ctrl+J)
      if ((e.metaKey || e.ctrlKey) && e.key !== 'k' && e.key !== 'K' && e.key !== 'j' && e.key !== 'J') return;
      if (e.altKey) return;

      // Ctrl/Cmd+J to toggle AI Copilot
      if ((e.metaKey || e.ctrlKey) && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault();
        setAiCopilotOpen(!aiCopilotOpen);
        return;
      }

      // Other modifier shortcuts (beyond Cmd+K and Cmd+J) should not fire
      if (e.metaKey || e.ctrlKey) return;

      // 1-9 for section navigation
      if (e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key) - 1;
        if (index < sectionOrder.length) {
          e.preventDefault();
          router.push(sectionOrder[index]);
          if (isMobile) setSidebarOpen(false);
        }
        return;
      }

      // N - New item (context-aware)
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        const addAction = sectionAddActions[currentSection];
        if (addAction && canWrite(currentSection)) {
          window.dispatchEvent(new CustomEvent('command-palette-action', { detail: { action: addAction } }));
        }
        return;
      }

      // E - Toggle sidebar
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        setSidebarOpen(!sidebarOpen);
        return;
      }

      // D - Toggle dark mode
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        setTheme(theme === 'dark' ? 'light' : 'dark');
        return;
      }

      // L - Switch language
      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        const newLocale = locale === 'en' ? 'ar' : 'en';
        router.replace(pathname, { locale: newLocale });
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobile, sidebarOpen, setSidebarOpen, currentSection, theme, setTheme, locale, router, pathname, canWrite, aiCopilotOpen, setAiCopilotOpen]);

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
  };

  // Read user profile from localStorage (client only)
  const [userProfile] = useState<{ name: string; email: string } | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem('profile');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.name || parsed.email) {
          return { name: parsed.name || '', email: parsed.email || '' };
        }
      }
    } catch {
      // silent
    }
    return null;
  });

  const isRtl = locale === 'ar';

  const handleLanguageSwitch = () => {
    const newLocale = locale === 'en' ? 'ar' : 'en';
    router.replace(pathname, { locale: newLocale });
  };

  // Render a navigation item (shared between mobile and desktop)
  const renderNavItem = (item: { key: Section; icon: React.ComponentType<{ className?: string }> }, isLink: boolean) => {
    const isActive = currentSection === item.key;
    const IconComp = item.icon;
    const content = (
      <>
        <IconComp className="h-4 w-4 shrink-0" />
        {(sidebarOpen || !isLink) && <span className="truncate">{t(item.key)}</span>}
      </>
    );

    if (isLink) {
      return (
        <Link
          key={item.key}
          href={`/${item.key}`}
          onClick={() => isMobile && setSidebarOpen(false)}
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2.5 text-sm transition-all duration-150',
            'hover:bg-sidebar-accent active:scale-[0.98]',
            isActive
              ? 'bg-primary/10 text-primary font-semibold border-s-[3px] border-s-primary dark:bg-primary/20 dark:text-primary'
              : 'text-sidebar-foreground',
            (!sidebarOpen && isLink) && 'justify-center px-0'
          )}
        >
          {content}
        </Link>
      );
    }

    return (
      <Link
        key={item.key}
        href={`/${item.key}`}
        onClick={() => isMobile && setSidebarOpen(false)}
        className={cn(
          'flex items-center gap-3 w-full px-3 min-h-11 py-2.5 text-sm transition-all duration-150',
          'hover:bg-sidebar-accent active:scale-[0.98]',
          isActive
            ? 'bg-primary/10 text-primary font-semibold border-s-[3px] border-s-primary dark:bg-primary/20 dark:text-primary'
            : 'text-sidebar-foreground',
        )}
      >
        {content}
      </Link>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Command Palette */}
      <CommandPalette />

      {/* Keyboard Shortcuts Help Dialog */}
      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

      {/* Mobile overlay */}
      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
            onClick={handleOverlayClick}
          />
        )}
      </AnimatePresence>

      {/* Mobile Sidebar — slide-in overlay */}
      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <motion.aside
            key="mobile-sidebar"
            initial={{ x: isRtl ? 288 : -288 }}
            animate={{ x: 0 }}
            exit={{ x: isRtl ? 288 : -288 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-y-0 start-0 w-72 bg-sidebar border-e shadow-xl z-50 flex flex-col"
          >
            {/* Logo */}
            <div className="flex items-center gap-2 px-3 h-14 border-b shrink-0">
              <Building2 className="h-6 w-6 text-primary shrink-0" />
              <span className="font-bold text-lg truncate">{tc('appName')}</span>
              <Button
                variant="ghost"
                size="icon"
                className="ms-auto h-9 w-9"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Nav Items */}
            <nav className="flex-1 py-2 overflow-y-auto scrollbar-thin">
              {navGroups.map((group, gi) => (
                <div key={group.label}>
                  <div className="text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase px-3 pt-4 pb-1">
                    {t(group.label as any)}
                  </div>
                  {group.items.map((item) => renderNavItem(item, false))}
                  {gi < navGroups.length - 1 && (
                    <div className="mx-3 my-2 border-t border-border/50" />
                  )}
                </div>
              ))}

              {/* Divider between main nav and settings */}
              <div className="mx-3 my-2 border-t border-border/50" />

              {settingsNavItems.map((item) => renderNavItem(item, false))}
            </nav>

            {/* User profile mini-card */}
            {userProfile && (
              <div className="mx-2 mb-2 p-3 rounded-lg bg-sidebar-accent/50 flex items-center gap-2.5">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {getInitials(userProfile.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{userProfile.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{userProfile.email}</p>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="border-t p-2 space-y-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 h-9"
                onClick={handleLanguageSwitch}
              >
                <Languages className="h-4 w-4" />
                <span>{locale === 'en' ? 'العربية' : 'English'}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 h-9"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                <span>{theme === 'dark' ? tc('light') : tc('dark')}</span>
              </Button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      {!isMobile && (
      <aside
        className={cn(
          'flex flex-col bg-sidebar shrink-0 transition-all duration-300 ease-in-out z-50 border-e',
          sidebarOpen ? 'w-64' : 'w-16',
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-3 h-14 border-b shrink-0">
          <Building2 className="h-6 w-6 text-primary shrink-0" />
          {sidebarOpen && (
            <Link href="/dashboard" className="font-bold text-lg truncate hover:text-primary transition-colors">
              {tc('appName')}
            </Link>
          )}
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-2 overflow-y-auto scrollbar-thin">
          {navGroups.map((group, gi) => (
            <div key={group.label}>
              {/* Section group label - only show when sidebar is expanded */}
              {sidebarOpen && (
                <div className="text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase px-3 pt-4 pb-1">
                  {t(group.label as any)}
                </div>
              )}
              {!sidebarOpen && gi > 0 && (
                <div className="mx-1.5 my-2 border-t border-border/50" />
              )}
              {group.items.map((item) => renderNavItem(item, true))}
            </div>
          ))}

          {/* Divider between main nav and settings */}
          {sidebarOpen ? (
            <div className="mx-3 my-2 border-t border-border/50" />
          ) : (
            <div className="mx-1.5 my-2 border-t border-border/50" />
          )}

          {settingsNavItems.map((item) => renderNavItem(item, true))}
        </nav>

        {/* User profile mini-card */}
        {sidebarOpen && userProfile && (
          <div className="mx-2 mb-2 p-3 rounded-lg bg-sidebar-accent/50 flex items-center gap-2.5">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {getInitials(userProfile.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{userProfile.name}</p>
              <p className="text-xs text-muted-foreground truncate">{userProfile.email}</p>
            </div>
          </div>
        )}
        {!sidebarOpen && userProfile && (
          <div className="flex justify-center mb-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {getInitials(userProfile.name)}
              </AvatarFallback>
            </Avatar>
          </div>
        )}

        {/* Footer */}
        <div className="border-t p-2 space-y-1">
          {sidebarOpen ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={handleLanguageSwitch}
              >
                <Languages className="h-4 w-4" />
                <span>{locale === 'en' ? 'العربية' : 'English'}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                <span>{theme === 'dark' ? tc('light') : tc('dark')}</span>
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="w-full"
                onClick={handleLanguageSwitch}
              >
                <Languages className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="w-full"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </>
          )}
        </div>
      </aside>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Bar */}
        <header className="relative flex items-center gap-2 h-14 px-3 md:px-4 bg-background shrink-0">
          {/* Subtle bottom border gradient */}
          <div className="absolute bottom-0 inset-x-0 h-px bg-border" />

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="shrink-0"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Section title with colored dot + mobile branding */}
          <div className="flex items-center gap-2">
            {isMobile && (
              <>
                <span className="text-xs text-muted-foreground font-medium">PropManager</span>
                <span className="text-muted-foreground/40">·</span>
              </>
            )}
            <span className={cn('h-2 w-2 rounded-full', sectionDotColors[currentSection] || 'bg-primary')} />
            <h2 className="font-semibold text-lg truncate">{t(currentSection)}</h2>
          </div>

          <div className="flex-1" />
          {/* Notification Bell */}
          <NotificationBell />
          {/* Command Palette trigger button with keyboard shortcut badge */}
          <Button
            variant="outline"
            size="sm"
            className="hidden sm:flex items-center gap-2 h-8 px-3 text-muted-foreground"
            onClick={() => useAppStore.getState().setCommandPaletteOpen(true)}
          >
            <Search className="h-3.5 w-3.5" />
            <span className="text-xs">{tc('search')}</span>
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground shadow-sm">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>
          {/* Mobile language/theme controls */}
          {isMobile && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleLanguageSwitch}
              >
                <Languages className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </header>

        {/* Page Content */}
        <div ref={mainContentRef} className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin">
          {children}
        </div>

        {/* Back to Top */}
        <BackToTop scrollContainerRef={mainContentRef} />
      </main>

      {/* AI Copilot FAB & Panel */}
      <AICopilot />
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setAiCopilotOpen(true)}
            className="fixed bottom-6 end-6 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label={tc('aiCopilot')}
          >
            <Sparkles className="h-5 w-5" />
          </motion.button>
        </TooltipTrigger>
        <TooltipContent side="left" className="font-medium">
          <span>{tc('aiCopilot')} (Ctrl+J)</span>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

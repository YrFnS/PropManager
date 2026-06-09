'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Globe,
  Palette,
  Info,
  User,
  Bell,
  Database,
  Download,
  Trash2,
  Sprout,
  Loader2,
  Shield,
  Mail,
  CreditCard,
  Wrench,
  MessageSquare,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';

export default function SettingsSection() {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  // Profile state — lazy-init from localStorage
  const [profileName, setProfileName] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('pm_profile_name') ?? '' : '');
  const [profileEmail, setProfileEmail] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('pm_profile_email') ?? '' : '');

  // Notification preferences state — lazy-init from localStorage
  const [notifNewMessages, setNotifNewMessages] = useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('pm_notifications');
    if (saved) { try { return JSON.parse(saved).emailNewMessages ?? true; } catch { /* default */ } }
    return true;
  });
  const [notifLatePayments, setNotifLatePayments] = useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('pm_notifications');
    if (saved) { try { return JSON.parse(saved).emailLatePayments ?? true; } catch { /* default */ } }
    return true;
  });
  const [notifMaintenanceUpdates, setNotifMaintenanceUpdates] = useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('pm_notifications');
    if (saved) { try { return JSON.parse(saved).emailMaintenanceUpdates ?? true; } catch { /* default */ } }
    return true;
  });
  const [notifUrgentMaintenance, setNotifUrgentMaintenance] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('pm_notifications');
    if (saved) { try { return JSON.parse(saved).smsUrgentMaintenance ?? false; } catch { /* default */ } }
    return false;
  });

  // Loading states
  const [seeding, setSeeding] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleSaveProfile = useCallback(() => {
    localStorage.setItem('pm_profile_name', profileName);
    localStorage.setItem('pm_profile_email', profileEmail);
    toast.success(tc('success'));
  }, [profileName, profileEmail, tc]);

  const handleNotificationChange = useCallback(
    (key: string, value: boolean) => {
      const updates: Record<string, boolean> = {
        emailNewMessages: notifNewMessages,
        emailLatePayments: notifLatePayments,
        emailMaintenanceUpdates: notifMaintenanceUpdates,
        smsUrgentMaintenance: notifUrgentMaintenance,
        [key]: value,
      };
      localStorage.setItem('pm_notifications', JSON.stringify(updates));

      switch (key) {
        case 'emailNewMessages':
          setNotifNewMessages(value);
          break;
        case 'emailLatePayments':
          setNotifLatePayments(value);
          break;
        case 'emailMaintenanceUpdates':
          setNotifMaintenanceUpdates(value);
          break;
        case 'smsUrgentMaintenance':
          setNotifUrgentMaintenance(value);
          break;
      }
    },
    [notifNewMessages, notifLatePayments, notifMaintenanceUpdates, notifUrgentMaintenance]
  );

  const handleSeedData = useCallback(async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/settings/seed', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(t('seedSuccess'));
      } else {
        toast.error(tc('error'));
      }
    } catch {
      toast.error(tc('error'));
    } finally {
      setSeeding(false);
    }
  }, [t, tc]);

  const handleResetDatabase = useCallback(async () => {
    setResetting(true);
    try {
      const res = await fetch('/api/settings/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(t('resetSuccess'));
      } else {
        toast.error(tc('error'));
      }
    } catch {
      toast.error(tc('error'));
    } finally {
      setResetting(false);
    }
  }, [t, tc]);

  const handleExportData = useCallback(async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/settings/export');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `propmanager-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t('exportSuccess'));
    } catch {
      toast.error(tc('error'));
    } finally {
      setExporting(false);
    }
  }, [t, tc]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
      </div>

      <div className="grid gap-6 w-full max-w-2xl">
        {/* Profile Card */}
        <Card className="overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-teal-500 via-emerald-500 to-green-500" />
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-950/30 dark:to-emerald-950/30">
                <User className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <CardTitle className="text-lg">{t('profile')}</CardTitle>
                <CardDescription>{t('profileDescription')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              <div className="flex items-center gap-5">
                <Avatar className="h-16 w-16 text-lg shrink-0">
                  <AvatarFallback className="bg-gradient-to-br from-teal-500 to-emerald-600 text-white font-bold text-lg">
                    {getInitials(profileName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-lg">{profileName}</span>
                    <Badge variant="secondary" className="gap-1">
                      <Shield className="h-3 w-3" />
                      {t('propertyManager')}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{profileEmail}</p>
                </div>
              </div>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="profile-name">{t('name')}</Label>
                  <Input
                    id="profile-name"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="transition-colors hover:border-teal-300 focus:border-teal-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-email">{t('email')}</Label>
                  <Input
                    id="profile-email"
                    type="email"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    className="transition-colors hover:border-teal-300 focus:border-teal-500"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleSaveProfile}
                  className="bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white transition-all"
                >
                  {tc('save')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notification Preferences Card */}
        <Card className="overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500" />
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
                <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-lg">{t('notifications')}</CardTitle>
                <CardDescription>{t('notificationsDescription')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg p-3 transition-colors hover:bg-accent/50">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-950/30">
                    <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">{t('emailNewMessages')}</Label>
                    <p className="text-xs text-muted-foreground">{t('emailChannel')}</p>
                  </div>
                </div>
                <Switch
                  checked={notifNewMessages}
                  onCheckedChange={(v) => handleNotificationChange('emailNewMessages', v)}
                />
              </div>
              <Separator />
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg p-3 transition-colors hover:bg-accent/50">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-md bg-red-50 dark:bg-red-950/30">
                    <CreditCard className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">{t('emailLatePayments')}</Label>
                    <p className="text-xs text-muted-foreground">{t('emailChannel')}</p>
                  </div>
                </div>
                <Switch
                  checked={notifLatePayments}
                  onCheckedChange={(v) => handleNotificationChange('emailLatePayments', v)}
                />
              </div>
              <Separator />
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg p-3 transition-colors hover:bg-accent/50">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-md bg-orange-50 dark:bg-orange-950/30">
                    <Wrench className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">{t('emailMaintenanceUpdates')}</Label>
                    <p className="text-xs text-muted-foreground">{t('emailChannel')}</p>
                  </div>
                </div>
                <Switch
                  checked={notifMaintenanceUpdates}
                  onCheckedChange={(v) => handleNotificationChange('emailMaintenanceUpdates', v)}
                />
              </div>
              <Separator />
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg p-3 transition-colors hover:bg-accent/50">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-md bg-rose-50 dark:bg-rose-950/30">
                    <MessageSquare className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">{t('smsUrgentMaintenance')}</Label>
                    <p className="text-xs text-muted-foreground">{t('smsChannel')}</p>
                  </div>
                </div>
                <Switch
                  checked={notifUrgentMaintenance}
                  onCheckedChange={(v) => handleNotificationChange('smsUrgentMaintenance', v)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Language Settings */}
        <Card className="overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
                <Globe className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-lg">{t('language')}</CardTitle>
                <CardDescription>{t('languageDescription')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={locale}
              onValueChange={(v) => router.replace(pathname, { locale: v as 'en' | 'ar' })}
              className="flex flex-col sm:flex-row gap-3"
            >
              <Label
                htmlFor="lang-en"
                className={`flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-all hover:bg-accent hover:border-emerald-300 dark:hover:border-emerald-700 ${
                  locale === 'en' ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : ''
                }`}
              >
                <RadioGroupItem value="en" id="lang-en" />
                <div>
                  <p className="font-medium">English</p>
                  <p className="text-xs text-muted-foreground">English</p>
                </div>
              </Label>
              <Label
                htmlFor="lang-ar"
                className={`flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-all hover:bg-accent hover:border-emerald-300 dark:hover:border-emerald-700 ${
                  locale === 'ar' ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : ''
                }`}
              >
                <RadioGroupItem value="ar" id="lang-ar" />
                <div>
                  <p className="font-medium">العربية</p>
                  <p className="text-xs text-muted-foreground">العربية</p>
                </div>
              </Label>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Theme Settings */}
        <Card className="overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" />
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30">
                <Palette className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <CardTitle className="text-lg">{t('theme')}</CardTitle>
                <CardDescription>{t('themeDescription')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={theme}
              onValueChange={setTheme}
              className="flex flex-col sm:flex-row gap-3"
            >
              {[
                { value: 'light', label: t('light'), desc: '☀️' },
                { value: 'dark', label: t('dark'), desc: '🌙' },
                { value: 'system', label: t('system'), desc: '💻' },
              ].map((opt) => (
                <Label
                  key={opt.value}
                  htmlFor={`theme-${opt.value}`}
                  className={`flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-all hover:bg-accent hover:border-violet-300 dark:hover:border-violet-700 ${
                    theme === opt.value ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : ''
                  }`}
                >
                  <RadioGroupItem value={opt.value} id={`theme-${opt.value}`} />
                  <div>
                    <p className="font-medium">{opt.label}</p>
                    <p className="text-lg">{opt.desc}</p>
                  </div>
                </Label>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Data Management Card */}
        <Card className="overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-rose-500 via-pink-500 to-red-500" />
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30">
                <Database className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <CardTitle className="text-lg">{t('dataManagement')}</CardTitle>
                <CardDescription>{t('dataManagementDescription')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {/* Seed Demo Data */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg p-3 transition-colors hover:bg-accent/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-green-50 dark:bg-green-950/30">
                    <Sprout className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t('seedData')}</p>
                    <p className="text-xs text-muted-foreground">{t('seedDataDescription')}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSeedData}
                  disabled={seeding}
                  className="gap-1.5 transition-all hover:bg-green-50 hover:border-green-300 hover:text-green-700 dark:hover:bg-green-950/30 dark:hover:border-green-700 dark:hover:text-green-400"
                >
                  {seeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sprout className="h-3.5 w-3.5" />}
                  {t('seedData')}
                </Button>
              </div>

              <Separator />

              {/* Export Data */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg p-3 transition-colors hover:bg-accent/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-blue-50 dark:bg-blue-950/30">
                    <Download className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t('exportData')}</p>
                    <p className="text-xs text-muted-foreground">{t('exportDataDescription')}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportData}
                  disabled={exporting}
                  className="gap-1.5 transition-all hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 dark:hover:bg-blue-950/30 dark:hover:border-blue-700 dark:hover:text-blue-400"
                >
                  {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  {t('exportData')}
                </Button>
              </div>

              <Separator />

              {/* Reset Database */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg p-3 transition-colors hover:bg-accent/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-red-50 dark:bg-red-950/30">
                    <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t('resetDatabase')}</p>
                    <p className="text-xs text-muted-foreground">{t('resetDatabaseDescription')}</p>
                  </div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={resetting}
                      className="gap-1.5 transition-all hover:bg-red-50 hover:border-red-300 hover:text-red-700 dark:hover:bg-red-950/30 dark:hover:border-red-700 dark:hover:text-red-400"
                    >
                      {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      {t('resetDatabase')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('resetDatabase')}</AlertDialogTitle>
                      <AlertDialogDescription>{t('confirmReset')}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleResetDatabase}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {tc('confirm')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* About */}
        <Card className="overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500" />
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/30">
                <Info className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <CardTitle className="text-lg">{t('about')}</CardTitle>
                <CardDescription>{t('aboutDescription')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">{t('appName')}</span>
                <span className="text-sm font-medium">{tc('appName')}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">{t('version')}</span>
                <span className="text-sm font-medium">{t('versionNumber')}</span>
              </div>
              <Separator />
              <div className="py-2">
                <p className="text-sm text-muted-foreground">{t('description')}</p>
              </div>
              <Separator />
              <div className="py-2">
                <p className="text-xs text-muted-foreground">{t('copyright')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

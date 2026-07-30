import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { SessionProvider } from '@/components/auth/session-provider';
import { LocaleShell } from '@/components/layout/locale-shell';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth';
import { Geist, Geist_Mono, Noto_Sans_Arabic } from 'next/font/google';
import '../globals.css';
import '../stabilization.css';

export const metadata: Metadata = {
  title: 'PropManager - Property Management',
  description: 'Modern property management application with multilingual support',
};

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const notoArabic = Noto_Sans_Arabic({
  variable: '--font-noto-arabic',
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
});

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeParam } = await params;
  if (!routing.locales.includes(localeParam as 'en' | 'ar')) notFound();

  const locale = await getLocale();
  const messages = await getMessages();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  return (
    <html
      lang={locale}
      dir={dir}
      data-role={session?.role}
      data-pm-role={session?.role}
      data-organization={session?.organizationId}
      suppressHydrationWarning
    >
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoArabic.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <SessionProvider initialSession={session}>
              <LocaleShell>{children}</LocaleShell>
              <Toaster />
            </SessionProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

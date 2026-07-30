'use client';

import { FormEvent, useState, useSyncExternalStore } from 'react';
import { useLocale } from 'next-intl';
import { Building2, Loader2, LockKeyhole } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const COPY = {
  en: {
    title: 'Sign in to PropManager',
    description: 'Use your organization account. The environment administrator is used only to bootstrap the first owner.',
    email: 'Email',
    password: 'Password',
    submit: 'Sign in',
    signingIn: 'Signing in…',
    genericError: 'Unable to sign in. Verify your credentials and try again.',
  },
  ar: {
    title: 'تسجيل الدخول إلى مدير العقارات',
    description: 'استخدم حساب مؤسستك. بيانات مدير الخادم تُستخدم فقط لإنشاء المالك الأول.',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    submit: 'تسجيل الدخول',
    signingIn: 'جارٍ تسجيل الدخول…',
    genericError: 'تعذر تسجيل الدخول. تحقق من بيانات الحساب ثم حاول مرة أخرى.',
  },
} as const;

const subscribeToHydration = () => () => undefined;
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

export default function LoginPage() {
  const locale = useLocale() as 'en' | 'ar';
  const copy = COPY[locale] ?? COPY.en;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hydrated || submitting) return;

    const formData = new FormData(event.currentTarget);
    const submittedEmail = String(formData.get('email') || email).trim();
    const submittedPassword = String(formData.get('password') || password);

    setError('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: submittedEmail, password: submittedPassword }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error || copy.genericError);
        setSubmitting(false);
        return;
      }

      const requestedPath = new URLSearchParams(window.location.search).get('next');
      const destination = requestedPath && requestedPath.startsWith('/') && !requestedPath.startsWith('//')
        ? requestedPath
        : '/dashboard';
      const localizedDestination = destination === `/${locale}` || destination.startsWith(`/${locale}/`)
        ? destination
        : `/${locale}${destination === '/' ? '' : destination}`;

      // Authentication changes the server-rendered layout session. A full
      // navigation prevents the previous unauthenticated layout state from
      // surviving a client-side route transition.
      window.location.assign(localizedDestination);
    } catch {
      setError(copy.genericError);
      setSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/30 px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,oklch(0.7_0.13_180_/_0.16),transparent_38%),radial-gradient(circle_at_bottom_right,oklch(0.75_0.12_145_/_0.12),transparent_42%)]" />
      <Card className="relative w-full max-w-md border-border/70 shadow-xl">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Building2 className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <CardTitle className="text-2xl">{copy.title}</CardTitle>
            <CardDescription>{copy.description}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            data-hydrated={hydrated ? 'true' : 'false'}
            onSubmit={handleSubmit}
          >
            <div className="space-y-2">
              <Label htmlFor="email">{copy.email}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{copy.password}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {error && (
              <div role="alert" className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <Button className="w-full gap-2" type="submit" disabled={!hydrated || submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
              {submitting ? copy.signingIn : copy.submit}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

'use client';

import { FormEvent, useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Building2, Loader2, LockKeyhole } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const COPY = {
  en: {
    title: 'Sign in to PropManager',
    description: 'Use the administrator credentials configured on the server.',
    email: 'Email',
    password: 'Password',
    submit: 'Sign in',
    signingIn: 'Signing in…',
    genericError: 'Unable to sign in. Please verify the server configuration and try again.',
  },
  ar: {
    title: 'تسجيل الدخول إلى مدير العقارات',
    description: 'استخدم بيانات مدير النظام المعرّفة على الخادم.',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    submit: 'تسجيل الدخول',
    signingIn: 'جارٍ تسجيل الدخول…',
    genericError: 'تعذر تسجيل الدخول. تحقق من إعدادات الخادم ثم حاول مرة أخرى.',
  },
} as const;

export default function LoginPage() {
  const locale = useLocale() as 'en' | 'ar';
  const router = useRouter();
  const copy = COPY[locale] ?? COPY.en;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error || copy.genericError);
        return;
      }

      const requestedPath = new URLSearchParams(window.location.search).get('next');
      const destination = requestedPath && requestedPath.startsWith('/') && !requestedPath.startsWith('//')
        ? requestedPath
        : '/dashboard';
      router.replace(destination);
      router.refresh();
    } catch {
      setError(copy.genericError);
    } finally {
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
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">{copy.email}</Label>
              <Input
                id="email"
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
            <Button className="w-full gap-2" type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
              {submitting ? copy.signingIn : copy.submit}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

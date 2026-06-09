import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  locales: ['en', 'ar'],
  defaultLocale: 'en',
  localeDetection: true,
});

export type Locale = (typeof routing.locales)[number];

// Navigation utilities for App Router
export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);

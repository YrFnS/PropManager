from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace(path: str, old: str, new: str, count: int = -1) -> None:
    target = ROOT / path
    text = target.read_text()
    occurrences = text.count(old)
    if occurrences == 0:
        raise RuntimeError(f"Expected source fragment was not found in {path}: {old!r}")
    target.write_text(text.replace(old, new, count))


format_hook = """'use client';

import { useCallback, useMemo } from 'react';
import { useLocale } from 'next-intl';
import { useSession } from '@/components/auth/session-provider';

type DateValue = Date | string | number | null | undefined;

function validNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function createDateFormatter(
  locale: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
) {
  try {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone });
  } catch {
    return new Intl.DateTimeFormat(locale, options);
  }
}

function toDate(value: DateValue) {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function useOrganizationFormat() {
  const locale = useLocale();
  const { session } = useSession();
  const localeCode = locale === 'ar' ? 'ar-IQ' : 'en-US';
  const currency = session?.currency || 'USD';
  const timeZone = session?.timezone || 'UTC';

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(localeCode, { maximumFractionDigits: 2 }),
    [localeCode],
  );

  const currencyFormatter = useMemo(() => {
    try {
      return new Intl.NumberFormat(localeCode, {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      });
    } catch {
      return null;
    }
  }, [currency, localeCode]);

  const compactCurrencyFormatter = useMemo(() => {
    try {
      return new Intl.NumberFormat(localeCode, {
        style: 'currency',
        currency,
        notation: 'compact',
        maximumFractionDigits: 1,
      });
    } catch {
      return null;
    }
  }, [currency, localeCode]);

  const shortDateFormatter = useMemo(
    () => createDateFormatter(localeCode, timeZone, { year: 'numeric', month: '2-digit', day: '2-digit' }),
    [localeCode, timeZone],
  );
  const longDateFormatter = useMemo(
    () => createDateFormatter(localeCode, timeZone, { year: 'numeric', month: 'long', day: 'numeric' }),
    [localeCode, timeZone],
  );
  const monthFormatter = useMemo(
    () => createDateFormatter(localeCode, timeZone, { month: 'short', year: '2-digit' }),
    [localeCode, timeZone],
  );

  const formatCurrency = useCallback((value: number) => {
    const amount = validNumber(value);
    return currencyFormatter
      ? currencyFormatter.format(amount)
      : `${currency} ${numberFormatter.format(amount)}`;
  }, [currency, currencyFormatter, numberFormatter]);

  const formatCompactCurrency = useCallback((value: number) => {
    const amount = validNumber(value);
    return compactCurrencyFormatter
      ? compactCurrencyFormatter.format(amount)
      : `${currency} ${numberFormatter.format(amount)}`;
  }, [compactCurrencyFormatter, currency, numberFormatter]);

  const formatDate = useCallback((value: DateValue) => {
    const date = toDate(value);
    return date ? shortDateFormatter.format(date) : '—';
  }, [shortDateFormatter]);

  const formatLongDate = useCallback((value: DateValue) => {
    const date = toDate(value);
    return date ? longDateFormatter.format(date) : '—';
  }, [longDateFormatter]);

  const formatMonth = useCallback((value: DateValue) => {
    const date = toDate(value);
    return date ? monthFormatter.format(date) : '—';
  }, [monthFormatter]);

  return {
    currency,
    localeCode,
    timeZone,
    formatCurrency,
    formatCompactCurrency,
    formatDate,
    formatLongDate,
    formatMonth,
  };
}
"""
(ROOT / "src/hooks").mkdir(parents=True, exist_ok=True)
(ROOT / "src/hooks/use-organization-format.ts").write_text(format_hook)

# Session payload includes the organization's timezone.
replace(
    "src/lib/auth.ts",
    "  currency: string;\n  locale: string;\n",
    "  currency: string;\n  locale: string;\n  timezone: string;\n",
)
replace(
    "src/lib/auth.ts",
    "      typeof payload.currency !== 'string' ||\n      typeof payload.locale !== 'string' ||\n",
    "      typeof payload.currency !== 'string' ||\n      typeof payload.locale !== 'string' ||\n      typeof payload.timezone !== 'string' ||\n",
)

replace(
    "src/app/api/auth/login/route.ts",
    """    currency: string;
    locale: string;
""",
    """    currency: string;
    locale: string;
    timezone: string;
""",
)
replace(
    "src/app/api/auth/login/route.ts",
    """    currency: membership.organization.currency,
    locale: membership.organization.locale,
""",
    """    currency: membership.organization.currency,
    locale: membership.organization.locale,
    timezone: membership.organization.timezone,
""",
)

replace(
    "src/app/api/auth/organizations/route.ts",
    "organization: { id: string; name: string; currency: string; locale: string };",
    "organization: { id: string; name: string; currency: string; locale: string; timezone: string };",
)
replace(
    "src/app/api/auth/organizations/route.ts",
    """    currency: membership.organization.currency,
    locale: membership.organization.locale,
""",
    """    currency: membership.organization.currency,
    locale: membership.organization.locale,
    timezone: membership.organization.timezone,
""",
)
replace(
    "src/app/api/settings/organization/route.ts",
    """    currency: organization.currency,
    locale: organization.locale,
""",
    """    currency: organization.currency,
    locale: organization.locale,
    timezone: organization.timezone,
""",
)

# Payments use the active organization's currency and timezone.
replace(
    "src/components/payments/payments-section.tsx",
    "import { useRouteIntent } from '@/lib/route-intent';\n",
    "import { useRouteIntent } from '@/lib/route-intent';\nimport { useOrganizationFormat } from '@/hooks/use-organization-format';\n",
)
replace(
    "src/components/payments/payments-section.tsx",
    """  const locale = useLocale();
  const isAr = locale === 'ar';
  const localeCode = isAr ? 'ar-IQ' : 'en-US';
""",
    """  const locale = useLocale();
  const isAr = locale === 'ar';
  const { formatCurrency, formatDate } = useOrganizationFormat();
""",
)
replace(
    "src/components/payments/payments-section.tsx",
    """  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat(localeCode, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }),
    [localeCode],
  );

  const formatCurrency = useCallback(
    (value: number) => currencyFormatter.format(Number.isFinite(value) ? value : 0),
    [currencyFormatter],
  );

  const formatDate = useCallback(
    (value: string | null) => (value ? new Date(value).toLocaleDateString(localeCode) : '—'),
    [localeCode],
  );

""",
    "",
)

# Leases use the same organization formatter.
replace(
    "src/components/leases/leases-section.tsx",
    "import { useRouteIntent } from '@/lib/route-intent';\n",
    "import { useRouteIntent } from '@/lib/route-intent';\nimport { useOrganizationFormat } from '@/hooks/use-organization-format';\n",
)
replace(
    "src/components/leases/leases-section.tsx",
    """  const locale = useLocale();
  const isAr = locale === 'ar';
  const localeCode = isAr ? 'ar-IQ' : 'en-US';
""",
    """  const locale = useLocale();
  const isAr = locale === 'ar';
  const { formatCurrency, formatDate } = useOrganizationFormat();
""",
)
replace(
    "src/components/leases/leases-section.tsx",
    """  const currency = useMemo(
    () => new Intl.NumberFormat(localeCode, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }),
    [localeCode],
  );
  const formatCurrency = useCallback((value: number) => currency.format(value || 0), [currency]);
  const formatDate = useCallback((value: string) => new Date(value).toLocaleDateString(localeCode), [localeCode]);

""",
    "",
)

# Printed payment receipts follow the same currency and timezone settings.
replace(
    "src/components/payments/payment-receipt.tsx",
    "import { APP_CONFIG } from '@/lib/constants';\n",
    "import { APP_CONFIG } from '@/lib/constants';\nimport { useOrganizationFormat } from '@/hooks/use-organization-format';\n",
)
replace(
    "src/components/payments/payment-receipt.tsx",
    """  const locale = useLocale();
  const isAr = locale === 'ar';
""",
    """  const locale = useLocale();
  const isAr = locale === 'ar';
  const { formatCurrency, formatDate, formatLongDate } = useOrganizationFormat();
""",
)
replace(
    "src/components/payments/payment-receipt.tsx",
    "{receiptDate.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}",
    "{formatLongDate(receiptDate)}",
)
replace(
    "src/components/payments/payment-receipt.tsx",
    "{tc('currency')}{payment.amount.toLocaleString()}",
    "{formatCurrency(payment.amount)}",
)
replace(
    "src/components/payments/payment-receipt.tsx",
    "{new Date(payment.dueDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')}",
    "{formatDate(payment.dueDate)}",
)
replace(
    "src/components/payments/payment-receipt.tsx",
    "{new Date(payment.paidDate).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')}",
    "{formatDate(payment.paidDate)}",
)
replace(
    "src/components/payments/payment-receipt.tsx",
    "{new Date().toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}",
    "{formatLongDate(new Date())}",
)

# Dashboard cards, activity, and charts use organization formatting.
replace(
    "src/components/dashboard/dashboard-section.tsx",
    "import { setRouteIntent } from '@/lib/route-intent';\n",
    "import { setRouteIntent } from '@/lib/route-intent';\nimport { useOrganizationFormat } from '@/hooks/use-organization-format';\n",
)
replace(
    "src/components/dashboard/dashboard-section.tsx",
    """  const locale = useLocale();
  const router = useRouter();
""",
    """  const locale = useLocale();
  const router = useRouter();
  const { formatCurrency, formatCompactCurrency, formatMonth } = useOrganizationFormat();
""",
)
replace(
    "src/components/dashboard/dashboard-section.tsx",
    "${tc('currency')}${p.amount?.toLocaleString() || 0}",
    "${formatCurrency(Number(p.amount) || 0)}",
)
replace(
    "src/components/dashboard/dashboard-section.tsx",
    "  }, [data, isAr, t, tc]);\n",
    "  }, [data, formatCurrency, isAr, t]);\n",
)
replace(
    "src/components/dashboard/dashboard-section.tsx",
    """    { title: t('totalProperties'), value: stats.totalProperties, prefix: '', suffix: '', icon: Building2, sub: `${stats.occupiedUnits}/${stats.totalUnits} ${t('occupiedUnits')}`, trend: 'up' as const },
    { title: t('occupancyRate'), value: stats.occupancyRate, prefix: '', suffix: '%', icon: DoorOpen, sub: stats.occupancyRate >= 80 ? t('healthy') : t('needsAttention'), trend: stats.occupancyRate >= 80 ? 'up' as const : 'down' as const },
    { title: t('monthlyRevenue'), value: stats.monthlyRevenue, prefix: '$', suffix: '', icon: DollarSign, sub: `${stats.activeLeases} ${t('activeLeases') || 'active leases'}`, trend: 'up' as const },
    { title: t('openRequests'), value: stats.openMaintenance, prefix: '', suffix: '', icon: Wrench, sub: stats.openMaintenance > 5 ? t('needsAttention') : t('underControl'), trend: stats.openMaintenance > 5 ? 'down' as const : 'up' as const },
""",
    """    { title: t('totalProperties'), value: stats.totalProperties, prefix: '', suffix: '', money: false, icon: Building2, sub: `${stats.occupiedUnits}/${stats.totalUnits} ${t('occupiedUnits')}`, trend: 'up' as const },
    { title: t('occupancyRate'), value: stats.occupancyRate, prefix: '', suffix: '%', money: false, icon: DoorOpen, sub: stats.occupancyRate >= 80 ? t('healthy') : t('needsAttention'), trend: stats.occupancyRate >= 80 ? 'up' as const : 'down' as const },
    { title: t('monthlyRevenue'), value: stats.monthlyRevenue, prefix: '', suffix: '', money: true, icon: DollarSign, sub: `${stats.activeLeases} ${t('activeLeases') || 'active leases'}`, trend: 'up' as const },
    { title: t('openRequests'), value: stats.openMaintenance, prefix: '', suffix: '', money: false, icon: Wrench, sub: stats.openMaintenance > 5 ? t('needsAttention') : t('underControl'), trend: stats.openMaintenance > 5 ? 'down' as const : 'up' as const },
""",
)
replace(
    "src/components/dashboard/dashboard-section.tsx",
    "monthLabel: new Date(d.month + '-01').toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { month: 'short', year: '2-digit' }),",
    "monthLabel: formatMonth(`${d.month}-01`),",
)
replace(
    "src/components/dashboard/dashboard-section.tsx",
    "<AnimatedCounter value={c.value} prefix={c.prefix} suffix={c.suffix} className=\"text-2xl font-semibold tracking-tight\" />",
    "{c.money ? <span className=\"text-2xl font-semibold tracking-tight\">{formatCurrency(c.value)}</span> : <AnimatedCounter value={c.value} prefix={c.prefix} suffix={c.suffix} className=\"text-2xl font-semibold tracking-tight\" />}",
)
replace(
    "src/components/dashboard/dashboard-section.tsx",
    "tickFormatter={(value: number) => `$${(value / 1000).toFixed(0)}k`}",
    "tickFormatter={(value: number) => formatCompactCurrency(value)}",
)
replace(
    "src/components/dashboard/dashboard-section.tsx",
    "formatter={(value) => `$${Number(value).toLocaleString()}`}",
    "formatter={(value) => formatCurrency(Number(value))}",
)
replace(
    "src/components/dashboard/dashboard-section.tsx",
    "<div>{t('monthlyRevenue')}: ${Number(value).toLocaleString()}</div>",
    "<div>{t('monthlyRevenue')}: {formatCurrency(Number(value))}</div>",
)
replace(
    "src/components/dashboard/dashboard-section.tsx",
    "formatter: (value: number) => `$${value.toLocaleString()}`",
    "formatter: (value: number) => formatCompactCurrency(value)",
)
replace(
    "src/components/dashboard/dashboard-section.tsx",
    "<p className=\"text-xs font-semibold\">{tc('currency')}{p.amount.toLocaleString()}</p>",
    "<p className=\"text-xs font-semibold\">{formatCurrency(p.amount)}</p>",
)

# Health score revenue follows the organization currency.
replace(
    "src/components/dashboard/health-score-card.tsx",
    "import AnimatedCounter from '@/components/ui/animated-counter';\n",
    "import AnimatedCounter from '@/components/ui/animated-counter';\nimport { useOrganizationFormat } from '@/hooks/use-organization-format';\n",
)
replace(
    "src/components/dashboard/health-score-card.tsx",
    """  const locale = useLocale();
  const isAr = locale === 'ar';
""",
    """  const locale = useLocale();
  const isAr = locale === 'ar';
  const { formatCurrency } = useOrganizationFormat();
""",
)
replace(
    "src/components/dashboard/health-score-card.tsx",
    "<AnimatedCounter value={data.summary.totalMonthlyRevenue} prefix=\"$\" />",
    "<span>{formatCurrency(data.summary.totalMonthlyRevenue)}</span>",
)

# Reports remove viewport scripting and use organization money/date formatting throughout.
replace(
    "src/components/reports/reports-section.tsx",
    "import { CHART_COLORS } from '@/lib/status-config';\n",
    "import { CHART_COLORS } from '@/lib/status-config';\nimport { useOrganizationFormat } from '@/hooks/use-organization-format';\n",
)
replace(
    "src/components/reports/reports-section.tsx",
    """  const locale = useLocale();
  const isAr = locale === 'ar';
""",
    """  const locale = useLocale();
  const isAr = locale === 'ar';
  const { formatCurrency, formatCompactCurrency, formatMonth } = useOrganizationFormat();
""",
)
replace(
    "src/components/reports/reports-section.tsx",
    "  const [isMobile, setIsMobile] = useState(false);\n\n",
    "",
)
replace(
    "src/components/reports/reports-section.tsx",
    """  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

""",
    "",
)
replace(
    "src/components/reports/reports-section.tsx",
    """    monthLabel: new Date(d.month + '-01').toLocaleDateString(
      isAr ? 'ar-SA' : 'en-US',
      { month: 'short', year: '2-digit' }
    ),
""",
    "    monthLabel: formatMonth(`${d.month}-01`),\n",
)
replace(
    "src/components/reports/reports-section.tsx",
    "      prefix: '$',\n      suffix: '',\n",
    "      prefix: '',\n      suffix: '',\n      money: true,\n",
    2,
)
replace(
    "src/components/reports/reports-section.tsx",
    """      prefix: '',
      suffix: '%',
""",
    """      prefix: '',
      suffix: '%',
      money: false,
""",
)
replace(
    "src/components/reports/reports-section.tsx",
    """      prefix: '$',
      suffix: '',
      icon: AlertCircle,
""",
    """      prefix: '',
      suffix: '',
      money: true,
      icon: AlertCircle,
""",
)
replace(
    "src/components/reports/reports-section.tsx",
    "<AnimatedCounter value={c.value} prefix={c.prefix} suffix={c.suffix} className=\"text-3xl font-extrabold mt-1 tracking-tight\" />",
    "{c.money ? <p className=\"text-3xl font-extrabold mt-1 tracking-tight\">{formatCurrency(c.value)}</p> : <AnimatedCounter value={c.value} prefix={c.prefix} suffix={c.suffix} className=\"text-3xl font-extrabold mt-1 tracking-tight\" />}",
)
replace(
    "src/components/reports/reports-section.tsx",
    "tickFormatter={(value: number) => `$${(value / 1000).toFixed(0)}k`}",
    "tickFormatter={(value: number) => formatCompactCurrency(value)}",
)
replace(
    "src/components/reports/reports-section.tsx",
    "formatter={(value) => `$${Number(value).toLocaleString()}`}",
    "formatter={(value) => formatCurrency(Number(value))}",
)
replace(
    "src/components/reports/reports-section.tsx",
    "width={isMobile ? 80 : 120}",
    "width={100}",
)
replace(
    "src/components/reports/reports-section.tsx",
    "formatter={(value) => `$${Number(value).toLocaleString()}`}",
    "formatter={(value) => formatCurrency(Number(value))}",
)
replace(
    "src/components/reports/reports-section.tsx",
    "formatter={(value) => `$${Number(value).toLocaleString()}`}",
    "formatter={(value) => formatCurrency(Number(value))}",
)
replace(
    "src/components/reports/reports-section.tsx",
    "{tc('currency')}{pm.amount.toLocaleString()}",
    "{formatCurrency(pm.amount)}",
)
replace(
    "src/components/reports/reports-section.tsx",
    "{tc('currency')}{tenant.totalPaid.toLocaleString()}",
    "{formatCurrency(tenant.totalPaid)}",
)

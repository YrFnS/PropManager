'use client';

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

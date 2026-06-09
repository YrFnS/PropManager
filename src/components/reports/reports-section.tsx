'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  DollarSign, TrendingUp, TrendingDown, BarChart3, PieChart as PieChartIcon,
  Users, AlertCircle,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  PieChart, Pie, Cell,
  BarChart, Bar,
} from 'recharts';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import AnimatedCounter from '@/components/ui/animated-counter';
import EmptyState from '@/components/ui/empty-state';
import { CHART_COLORS } from '@/lib/status-config';

interface ReportData {
  summary: {
    totalRevenue: number;
    totalExpected: number;
    collectionRate: number;
    outstandingAmount: number;
  };
  monthlyRevenue: { month: string; revenue: number }[];
  revenueByProperty: { name: string; nameAr: string | null; revenue: number }[];
  paymentMethods: { method: string; count: number; amount: number }[];
  topTenants: { id: string; name: string; nameAr: string | null; totalPaid: number; paymentCount: number }[];
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: 'easeOut' as const },
  }),
};

const sectionVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

const PIE_COLORS = [CHART_COLORS.teal, CHART_COLORS.blue, CHART_COLORS.amber, CHART_COLORS.red];

export default function ReportsSection() {
  const t = useTranslations('reports');
  const tc = useTranslations('common');
  const tp = useTranslations('payments');
  const locale = useLocale();
  const isAr = locale === 'ar';

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('thisMonth');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/reports?period=${period}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [period]);

  const handlePeriodChange = (value: string) => {
    setPeriod(value);
    setLoading(true);
  };

  // Format month labels
  const formattedMonthlyRevenue = (data?.monthlyRevenue || []).map((d) => ({
    ...d,
    monthLabel: new Date(d.month + '-01').toLocaleDateString(
      isAr ? 'ar-SA' : 'en-US',
      { month: 'short', year: '2-digit' }
    ),
  }));

  // Translate payment methods
  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'cash': return tp('cash');
      case 'bank_transfer': return tp('bankTransfer');
      case 'online': return tp('online');
      case 'check': return tp('check');
      default: return method;
    }
  };

  const translatedPaymentMethods = (data?.paymentMethods || []).map((p) => ({
    ...p,
    label: getMethodLabel(p.method),
  }));

  // Chart configs
  const revenueChartConfig: ChartConfig = {
    revenue: {
      label: t('totalRevenue'),
      color: 'hsl(var(--chart-1))',
    },
  };

  const propertyChartConfig: ChartConfig = {
    revenue: {
      label: t('revenueByProperty'),
      color: 'hsl(var(--chart-2))',
    },
  };

  const paymentMethodConfig: ChartConfig = (() => {
    const config: ChartConfig = {};
    translatedPaymentMethods.forEach((item) => {
      config[item.label] = {
        label: item.label,
        color: PIE_COLORS[translatedPaymentMethods.indexOf(item) % PIE_COLORS.length],
      };
    });
    return config;
  })();

  const periodOptions = [
    { value: 'thisMonth', label: t('thisMonth') },
    { value: 'lastMonth', label: t('lastMonth') },
    { value: 'thisQuarter', label: t('thisQuarter') },
    { value: 'thisYear', label: t('thisYear') },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-7 w-20" />
                  </div>
                  <Skeleton className="h-11 w-11 rounded-xl" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card><CardContent className="p-6"><Skeleton className="h-[300px] w-full" /></CardContent></Card>
          <Card><CardContent className="p-6"><Skeleton className="h-[300px] w-full" /></CardContent></Card>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState
        icon={BarChart3}
        title={t('title')}
        description={t('noData')}
      />
    );
  }

  const { summary } = data;

  const summaryCards = [
    {
      title: t('totalRevenue'),
      value: summary.totalRevenue,
      prefix: '$',
      suffix: '',
      icon: DollarSign,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
      accent: 'border-s-emerald-500',
      gradient: 'from-emerald-50/80 to-card dark:from-emerald-950/20 dark:to-card',
      trend: 'up' as const,
    },
    {
      title: t('totalExpected'),
      value: summary.totalExpected,
      prefix: '$',
      suffix: '',
      icon: TrendingUp,
      color: 'text-sky-600',
      bg: 'bg-sky-50 dark:bg-sky-950/30',
      accent: 'border-s-sky-500',
      gradient: 'from-sky-50/80 to-card dark:from-sky-950/20 dark:to-card',
      trend: 'up' as const,
    },
    {
      title: t('collectionRate'),
      value: summary.collectionRate,
      prefix: '',
      suffix: '%',
      icon: summary.collectionRate >= 80 ? TrendingUp : TrendingDown,
      color: summary.collectionRate >= 80 ? 'text-green-600' : 'text-amber-600',
      bg: summary.collectionRate >= 80 ? 'bg-green-50 dark:bg-green-950/30' : 'bg-amber-50 dark:bg-amber-950/30',
      accent: summary.collectionRate >= 80 ? 'border-s-green-500' : 'border-s-amber-500',
      gradient: summary.collectionRate >= 80
        ? 'from-green-50/80 to-card dark:from-green-950/20 dark:to-card'
        : 'from-amber-50/80 to-card dark:from-amber-950/20 dark:to-card',
      trend: summary.collectionRate >= 80 ? 'up' as const : 'down' as const,
    },
    {
      title: t('outstandingAmount'),
      value: summary.outstandingAmount,
      prefix: '$',
      suffix: '',
      icon: AlertCircle,
      color: 'text-red-600',
      bg: 'bg-red-50 dark:bg-red-950/30',
      accent: 'border-s-red-500',
      gradient: 'from-red-50/80 to-card dark:from-red-950/20 dark:to-card',
      trend: 'down' as const,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-gradient-to-r from-teal-50/80 via-emerald-50/50 to-card dark:from-teal-950/30 dark:via-emerald-950/20 dark:to-card rounded-xl p-5 border border-teal-100/50 dark:border-teal-900/30"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight gradient-text">{t('title')}</h1>
            <p className="text-muted-foreground text-sm">{t('description')}</p>
          </div>
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((c, i) => (
          <motion.div key={c.title} custom={i} variants={cardVariants} initial="hidden" animate="visible">
            <Card className={`hover:shadow-md transition-shadow bg-gradient-to-br ${c.gradient} border-s-4 ${c.accent}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-muted-foreground">{c.title}</p>
                    <AnimatedCounter value={c.value} prefix={c.prefix} suffix={c.suffix} className="text-3xl font-extrabold mt-1 tracking-tight" />
                  </div>
                  <div className={`p-3 rounded-xl ${c.bg} flex-shrink-0 ms-3`}>
                    <c.icon className={`h-5 w-5 ${c.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Monthly Revenue Trend - Area Chart */}
      <motion.div variants={sectionVariants} initial="hidden" animate="visible">
        <Card className="border-s-4 border-s-teal-500">
          <CardHeader>
            <CardTitle className="text-lg">{t('monthlyTrend')}</CardTitle>
            <CardDescription>{t('description')}</CardDescription>
          </CardHeader>
          <CardContent>
            {formattedMonthlyRevenue.length > 0 && formattedMonthlyRevenue.some((d) => d.revenue > 0) ? (
              <ChartContainer config={revenueChartConfig} className="h-[300px] w-full">
                <AreaChart data={formattedMonthlyRevenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="reportRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="monthLabel"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    reversed={isAr}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value: number) => `$${(value / 1000).toFixed(0)}k`}
                    orientation={isAr ? 'right' : 'left'}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent formatter={(value) => `$${Number(value).toLocaleString()}`} />}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    fill="url(#reportRevenueGradient)"
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                {t('noData')}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Revenue by Property + Payment Methods */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Revenue by Property - Horizontal Bar Chart */}
        <motion.div variants={sectionVariants} initial="hidden" animate="visible">
          <Card className="border-s-4 border-s-emerald-500 h-full">
            <CardHeader>
              <CardTitle className="text-lg">{t('revenueByProperty')}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.revenueByProperty.length > 0 ? (
                <ChartContainer config={propertyChartConfig} className="h-[300px] w-full">
                  <BarChart
                    data={data.revenueByProperty.map((p) => ({
                      ...p,
                      displayName: isAr && p.nameAr ? p.nameAr : p.name,
                    }))}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={(value: number) => `$${(value / 1000).toFixed(0)}k`}
                      orientation={isAr ? 'top' : 'bottom'}
                      reversed={isAr}
                    />
                    <YAxis
                      type="category"
                      dataKey="displayName"
                      tickLine={false}
                      axisLine={false}
                      width={isMobile ? 80 : 120}
                      orientation={isAr ? 'right' : 'left'}
                    />
                    <ChartTooltip
                      content={<ChartTooltipContent formatter={(value) => `$${Number(value).toLocaleString()}`} />}
                    />
                    <Bar
                      dataKey="revenue"
                      radius={[0, 4, 4, 0]}
                      fill="hsl(var(--chart-2))"
                    >
                      {data.revenueByProperty.map((_entry, index) => (
                        <Cell
                          key={`prop-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                  {t('noData')}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Payment Methods Breakdown - Pie Chart */}
        <motion.div variants={sectionVariants} initial="hidden" animate="visible">
          <Card className="border-s-4 border-s-amber-500 h-full">
            <CardHeader>
              <CardTitle className="text-lg">{t('paymentMethods')}</CardTitle>
            </CardHeader>
            <CardContent>
              {translatedPaymentMethods.length > 0 && translatedPaymentMethods.some((p) => p.amount > 0) ? (
                <>
                  <ChartContainer config={paymentMethodConfig} className="h-[220px] w-full">
                    <PieChart>
                      <Pie
                        data={translatedPaymentMethods.filter((p) => p.amount > 0)}
                        dataKey="amount"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={40}
                        paddingAngle={3}
                        strokeWidth={2}
                      >
                        {translatedPaymentMethods.filter((p) => p.amount > 0).map((_entry, index) => (
                          <Cell key={`pm-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke="transparent" />
                        ))}
                      </Pie>
                      <ChartTooltip
                        content={<ChartTooltipContent nameKey="label" formatter={(value) => `$${Number(value).toLocaleString()}`} />}
                      />
                      <ChartLegend content={<ChartLegendContent nameKey="label" />} />
                    </PieChart>
                  </ChartContainer>
                  {/* Method details table */}
                  <div className="mt-4 space-y-2">
                    {translatedPaymentMethods.map((pm, index) => (
                      <div key={pm.method} className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                          />
                          <span className="font-medium">{pm.label}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                          <span>{pm.count} {t('paymentCount').toLowerCase()}</span>
                          <span className="font-semibold text-foreground">{tc('currency')}{pm.amount.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                  {t('noData')}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Top Tenants Table */}
      <motion.div variants={sectionVariants} initial="hidden" animate="visible">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              {t('topTenants')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.topTenants.length > 0 ? (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 backdrop-blur-sm sticky top-0">
                      <TableHead className="w-[60px]">{t('rank')}</TableHead>
                      <TableHead>{t('tenant')}</TableHead>
                      <TableHead className="text-end">{t('totalPaid')}</TableHead>
                      <TableHead className="text-end">{t('paymentCount')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topTenants.map((tenant, idx) => (
                      <TableRow
                        key={tenant.id}
                        className={idx % 2 === 1 ? 'bg-muted/20' : ''}
                      >
                        <TableCell>
                          <div
                            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                              idx === 0
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                                : idx === 1
                                  ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                                  : idx === 2
                                    ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                                    : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {idx + 1}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {isAr && tenant.nameAr ? tenant.nameAr : tenant.name}
                          {isAr && tenant.nameAr && (
                            <span className="text-xs text-muted-foreground ms-2">{tenant.name}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-end font-semibold">
                          {tc('currency')}{tenant.totalPaid.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-end">
                          <Badge variant="secondary">{tenant.paymentCount}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="p-4 rounded-full bg-muted/50 mb-4">
                  <Users className="h-10 w-10 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">{t('noData')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Building2, DoorOpen, Users, DollarSign, Wrench, MessageSquare,
  TrendingUp, TrendingDown, Mail, Clock, AlertTriangle,
  CheckCircle2, Activity, FileText, ArrowRight,
} from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from '@/i18n/routing';
import { useLocale } from 'next-intl';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  PieChart, Pie, Cell,
  BarChart, Bar,
} from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import { ar as arLocale } from 'date-fns/locale/ar';
import AnimatedCounter from '@/components/ui/animated-counter';
import HealthScoreCard from '@/components/dashboard/health-score-card';
import { setRouteIntent } from '@/lib/route-intent';

interface PropertyRevenueItem {
  name: string;
  nameAr: string | null;
  revenue: number;
  occupied: number;
  total: number;
}

interface DashboardData {
  stats: {
    totalProperties: number; totalUnits: number; occupiedUnits: number; vacantUnits: number;
    maintenanceUnits: number; occupancyRate: number; totalTenants: number; activeTenants: number;
    activeLeases: number; monthlyRevenue: number; pendingPayments: number; latePayments: number;
    openMaintenance: number; totalCollected: number; totalPendingAmount: number;
  };
  recentPayments: any[];
  recentMaintenance: any[];
  recentMessages: any[];
  expiringLeases: any[];
  unitStatusData: { name: string; value: number; color: string }[];
  paymentStatusData: { name: string; value: number; color: string }[];
  revenueData: { month: string; revenue: number }[];
  propertyRevenueData: PropertyRevenueItem[];
}

type ActivityItem = {
  id: string;
  type: 'payment' | 'maintenance' | 'message';
  title: string;
  timestamp: Date;
  icon: typeof CheckCircle2;
  iconColor: string;
};

export default function DashboardSection() {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const tm = useTranslations('maintenance');
  const tp = useTranslations('payments');
  const locale = useLocale();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('thisMonth');

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/dashboard?period=${period}`).then(r => r.json()).then(d => { if (!cancelled) { setData(d); setLoading(false); } }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [period]);

  const isAr = locale === 'ar';
  const dateLocale = isAr ? arLocale : undefined;

  const translatedUnitData = (data?.unitStatusData || []).map(d => ({ ...d, name: t(d.name as any) || d.name }));
  const translatedPaymentData = (data?.paymentStatusData || []).map(d => {
    const key = `chart${d.name.charAt(0).toUpperCase() + d.name.slice(1)}`;
    return { ...d, name: t(key as any) || d.name };
  });

  const activityTimeline: ActivityItem[] = useMemo(() => {
    if (!data) return [];
    const items: ActivityItem[] = [];

    (data.recentPayments || []).forEach((p: any) => {
      const tenantName = p.tenant?.name || (isAr && p.tenant?.nameAr ? p.tenant.nameAr : 'N/A');
      items.push({
        id: `payment-${p.id}`,
        type: 'payment',
        title: `${t('paymentReceived')} ${t('from')} ${tenantName} - ${tc('currency')}${p.amount?.toLocaleString() || 0}`,
        timestamp: new Date(p.createdAt),
        icon: CheckCircle2,
        iconColor: 'text-emerald-500',
      });
    });

    (data.recentMaintenance || []).forEach((r: any) => {
      const title = isAr && r.titleAr ? r.titleAr : r.title;
      items.push({
        id: `maintenance-${r.id}`,
        type: 'maintenance',
        title: `${t('maintenanceRequest')}: ${title}`,
        timestamp: new Date(r.createdAt),
        icon: Wrench,
        iconColor: 'text-amber-500',
      });
    });

    (data.recentMessages || []).forEach((m: any) => {
      items.push({
        id: `message-${m.id}`,
        type: 'message',
        title: `${t('newMessage')} ${t('from')} ${m.senderName} - ${m.subject}`,
        timestamp: new Date(m.createdAt),
        icon: Mail,
        iconColor: 'text-blue-500',
      });
    });

    items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return items.slice(0, 10);
  }, [data, isAr, t, tc]);

  const revenueChartConfig: ChartConfig = {
    revenue: {
      label: t('monthlyRevenue'),
      color: 'hsl(var(--chart-1))',
    },
  };

  const unitChartConfig: ChartConfig = (() => {
    const config: ChartConfig = {};
    translatedUnitData.forEach(item => {
      const key = item.name;
      config[key] = { label: item.name, color: item.color };
    });
    return config;
  })();

  const paymentChartConfig: ChartConfig = (() => {
    const config: ChartConfig = {};
    translatedPaymentData.forEach(item => {
      const key = item.name;
      config[key] = { label: item.name, color: item.color };
    });
    return config;
  })();

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="h-8 w-40 bg-muted/60 rounded-md shimmer" />
          <div className="h-8 w-32 bg-muted/60 rounded-md shimmer" />
        </div>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-muted/40 rounded-lg shimmer" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {[1,2,3].map(i => <div key={i} className="h-64 bg-muted/40 rounded-lg shimmer" />)}
        </div>
      </div>
    );
  }

  if (!data) return <div className="text-center py-10 text-muted-foreground">{tc('noData')}</div>;

  const { stats, recentPayments, recentMaintenance, revenueData, expiringLeases, propertyRevenueData } = data;

  // Stat card definitions — clean, minimal
  const statCards = [
    { title: t('totalProperties'), value: stats.totalProperties, prefix: '', suffix: '', icon: Building2, sub: `${stats.occupiedUnits}/${stats.totalUnits} ${t('occupiedUnits')}`, trend: 'up' as const },
    { title: t('occupancyRate'), value: stats.occupancyRate, prefix: '', suffix: '%', icon: DoorOpen, sub: stats.occupancyRate >= 80 ? t('healthy') : t('needsAttention'), trend: stats.occupancyRate >= 80 ? 'up' as const : 'down' as const },
    { title: t('monthlyRevenue'), value: stats.monthlyRevenue, prefix: '$', suffix: '', icon: DollarSign, sub: `${stats.activeLeases} ${t('activeLeases') || 'active leases'}`, trend: 'up' as const },
    { title: t('openRequests'), value: stats.openMaintenance, prefix: '', suffix: '', icon: Wrench, sub: stats.openMaintenance > 5 ? t('needsAttention') : t('underControl'), trend: stats.openMaintenance > 5 ? 'down' as const : 'up' as const },
  ];

  const secondaryStats = [
    { title: t('totalTenants'), value: stats.totalTenants, icon: Users },
    { title: t('pendingPayments'), value: stats.pendingPayments, icon: DollarSign },
    { title: t('vacantUnits'), value: stats.vacantUnits, icon: DoorOpen },
    { title: t('recentActivity'), value: data.recentMessages?.length || 0, icon: MessageSquare },
  ];

  const quickActions = [
    { label: t('addProperty'), icon: Building2, section: 'properties' as const, action: 'add' as const },
    { label: t('addTenant'), icon: Users, section: 'tenants' as const, action: 'add' as const },
    { label: t('recordPayment'), icon: DollarSign, section: 'payments' as const, action: 'add' as const },
    { label: t('newMaintenance'), icon: Wrench, section: 'maintenance' as const, action: 'add' as const },
    { label: t('viewMessages'), icon: MessageSquare, section: 'messages' as const },
  ];

  const formattedRevenueData = revenueData.map(d => ({
    ...d,
    monthLabel: new Date(d.month + '-01').toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { month: 'short', year: '2-digit' }),
  }));

  return (
    <div className="space-y-5">
      {/* Header — clean, no gradient */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('welcome')}</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="thisMonth">{t('thisMonth')}</SelectItem>
            <SelectItem value="lastMonth">{t('lastMonth')}</SelectItem>
            <SelectItem value="thisQuarter">{t('thisQuarter')}</SelectItem>
            <SelectItem value="thisYear">{t('thisYear')}</SelectItem>
            <SelectItem value="allTime">{t('allTime')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Quick Actions — simple text buttons */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {quickActions.map((action) => (
          <Button
            key={action.label}
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1.5 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => {
              if (action.action === 'add') setRouteIntent({ section: action.section, action: 'add' });
              router.push(action.section);
            }}
          >
            <action.icon className="h-3.5 w-3.5" />
            {action.label}
          </Button>
        ))}
      </div>

      {/* Primary Stat Cards — compact, clean */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {statCards.map((c) => (
          <div key={c.title} className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">{c.title}</span>
              <c.icon className="h-3.5 w-3.5 text-muted-foreground/60" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <AnimatedCounter value={c.value} prefix={c.prefix} suffix={c.suffix} className="text-2xl font-semibold tracking-tight" />
              {c.trend === 'up' ? (
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-red-400" />
              )}
            </div>
            <p className="text-[11px] text-muted-foreground/70 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Secondary Stats Row — inline mini stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {secondaryStats.map((c) => (
          <div key={c.title} className="rounded-lg border bg-card p-3 flex items-center gap-3">
            <div className="p-2 rounded-md bg-muted/50">
              <c.icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-lg font-semibold leading-none">{c.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{c.title}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Health Score + Revenue Chart */}
      <div className="grid gap-4 md:grid-cols-5">
        <div className="md:col-span-2">
          <HealthScoreCard />
        </div>
        <div className="md:col-span-3">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium">{t('revenueOverview')}</CardTitle>
                  <CardDescription className="text-xs">{t('monthlyRevenue')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {formattedRevenueData.length > 0 ? (
                <ChartContainer config={revenueChartConfig} className="h-[240px] w-full">
                  <AreaChart data={formattedRevenueData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                    <XAxis
                      dataKey="monthLabel"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tick={{ fontSize: 11 }}
                      reversed={isAr}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value: number) => `$${(value / 1000).toFixed(0)}k`}
                      orientation={isAr ? 'right' : 'left'}
                    />
                    <ChartTooltip
                      content={<ChartTooltipContent
                        formatter={(value) => `$${Number(value).toLocaleString()}`}
                      />}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(var(--chart-1))"
                      strokeWidth={1.5}
                      fill="url(#revenueGradient)"
                    />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                  {t('noActivity')}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Property Revenue Comparison */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{t('propertyRevenue')}</CardTitle>
          <CardDescription className="text-xs">{t('monthlyRevenuePerProperty')}</CardDescription>
        </CardHeader>
        <CardContent>
          {propertyRevenueData && propertyRevenueData.length > 0 ? (
            <ChartContainer
              config={{
                revenue: { label: t('monthlyRevenue'), color: 'hsl(var(--chart-2))' },
              }}
              className="h-[220px] w-full"
            >
              <BarChart
                data={propertyRevenueData.map(p => ({
                  ...p,
                  displayName: isAr && p.nameAr ? p.nameAr : p.name,
                  occupancyRate: p.total > 0 ? Math.round((p.occupied / p.total) * 100) : 0,
                }))}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value: number) => `$${(value / 1000).toFixed(0)}k`}
                  orientation={isAr ? 'top' : 'bottom'}
                  reversed={isAr}
                />
                <YAxis
                  type="category"
                  dataKey="displayName"
                  tickLine={false}
                  axisLine={false}
                  width={120}
                  tick={{ fontSize: 11 }}
                  orientation={isAr ? 'right' : 'left'}
                />
                <ChartTooltip
                  content={<ChartTooltipContent
                    formatter={(value, name, item) => {
                      const payload = item.payload as PropertyRevenueItem & { occupancyRate: number; displayName: string };
                      return (
                        <div className="space-y-1 text-xs">
                          <div className="font-medium">{payload.displayName}</div>
                          <div>{t('monthlyRevenue')}: ${Number(value).toLocaleString()}</div>
                          <div>{t('occupancyRate')}: {payload.occupancyRate}% ({payload.occupied}/{payload.total})</div>
                        </div>
                      );
                    }}
                  />}
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar
                  dataKey="revenue"
                  radius={[0, 3, 3, 0]}
                  fill="hsl(var(--chart-2))"
                  label={{
                    position: isAr ? 'left' : 'right',
                    formatter: (value: number) => `$${value.toLocaleString()}`,
                    fill: 'hsl(var(--foreground))',
                    fontSize: 10,
                  }}
                >
                  {propertyRevenueData.map((entry, index) => {
                    const occupancyRate = entry.total > 0 ? (entry.occupied / entry.total) * 100 : 0;
                    let barColor: string;
                    if (occupancyRate >= 75) {
                      barColor = '#22c55e';
                    } else if (occupancyRate >= 50) {
                      barColor = '#f59e0b';
                    } else {
                      barColor = '#ef4444';
                    }
                    return <Cell key={`prop-rev-${index}`} fill={barColor} />;
                  })}
                </Bar>
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="flex items-center justify-center h-[150px] text-muted-foreground text-sm">
              {t('noActivity')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Unit Status & Payment Status Charts */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('unitStatus')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={unitChartConfig} className="h-[200px] w-full">
              <PieChart>
                <Pie
                  data={translatedUnitData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  strokeWidth={1}
                >
                  {translatedUnitData.map((entry, index) => (
                    <Cell key={`unit-cell-${index}`} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                <ChartLegend content={<ChartLegendContent nameKey="name" />} />
              </PieChart>
            </ChartContainer>
            <div className="flex justify-center gap-5 mt-2">
              {translatedUnitData.map(item => {
                const total = translatedUnitData.reduce((s, d) => s + d.value, 0);
                const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                return (
                  <div key={item.name} className="text-center">
                    <p className="text-lg font-semibold" style={{ color: item.color }}>{item.value}</p>
                    <p className="text-[10px] text-muted-foreground">{item.name} ({pct}%)</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('paymentStatus')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={paymentChartConfig} className="h-[200px] w-full">
              <PieChart>
                <Pie
                  data={translatedPaymentData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  strokeWidth={1}
                >
                  {translatedPaymentData.map((entry, index) => (
                    <Cell key={`payment-cell-${index}`} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                <ChartLegend content={<ChartLegendContent nameKey="name" />} />
              </PieChart>
            </ChartContainer>
            <div className="flex justify-center gap-5 mt-2">
              {translatedPaymentData.map(item => {
                const total = translatedPaymentData.reduce((s, d) => s + d.value, 0);
                const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                return (
                  <div key={item.name} className="text-center">
                    <p className="text-lg font-semibold" style={{ color: item.color }}>{item.value}</p>
                    <p className="text-[10px] text-muted-foreground">{item.name} ({pct}%)</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Timeline + Expiring Leases */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
              {t('recentActivity')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activityTimeline.length > 0 ? (
              <div className="space-y-0 max-h-80 overflow-y-auto scrollbar-thin">
                {activityTimeline.map((item, index) => {
                  const IconComp = item.icon;
                  const isLast = index === activityTimeline.length - 1;
                  return (
                    <div key={item.id} className="flex gap-2.5">
                      <div className="flex flex-col items-center">
                        <div className="p-1 rounded-full bg-muted/60 z-10">
                          <IconComp className={`h-3 w-3 ${item.iconColor}`} />
                        </div>
                        {!isLast && (
                          <div className="w-px flex-1 bg-border min-h-4" />
                        )}
                      </div>
                      <div className="pb-3">
                        <p className="text-xs font-medium leading-snug">{item.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {formatDistanceToNow(item.timestamp, { addSuffix: true, locale: dateLocale })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Activity className="h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-xs text-muted-foreground">{t('noActivity')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              {t('expiringLeases')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expiringLeases && expiringLeases.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin">
                {expiringLeases.map((lease: any) => {
                  const endDate = new Date(lease.endDate);
                  const now = new Date();
                  const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                  const tenantName = isAr && lease.tenant?.nameAr ? lease.tenant.nameAr : lease.tenant?.name || 'N/A';
                  const propertyName = isAr && lease.unit?.property?.nameAr ? lease.unit.property.nameAr : lease.unit?.property?.name || '';
                  const unitNumber = lease.unit?.unitNumber || '';
                  const isUrgent = daysLeft <= 7;

                  return (
                    <div key={lease.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{tenantName}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {propertyName}{unitNumber ? ` · ${unitNumber}` : ''}
                        </p>
                      </div>
                      <Badge
                        variant={isUrgent ? 'destructive' : 'secondary'}
                        className="text-[10px] shrink-0 px-1.5 py-0"
                      >
                        {daysLeft}d
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-xs text-muted-foreground">{t('noExpiringLeases')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Payments & Recent Maintenance */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('upcomingPayments')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
              {(recentPayments || []).length > 0 ? (recentPayments || []).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <div className="min-w-0">
                    <p className="text-xs font-medium">{isAr && p.tenant?.nameAr ? p.tenant.nameAr : p.tenant?.name || 'N/A'}</p>
                    <p className="text-[10px] text-muted-foreground">{p.lease?.unit?.unitNumber || ''}{p.lease?.unit?.property ? ` · ${isAr && p.lease.unit.property.nameAr ? p.lease.unit.property.nameAr : p.lease.unit.property.name}` : ''} · {new Date(p.dueDate).toLocaleDateString(isAr ? 'ar-SA' : undefined)}</p>
                  </div>
                  <div className="text-end shrink-0">
                    <p className="text-xs font-semibold">{tc('currency')}{p.amount.toLocaleString()}</p>
                    <Badge variant={p.status === 'paid' ? 'default' : p.status === 'late' ? 'destructive' : 'secondary'} className="text-[10px] px-1.5 py-0">{tp(p.status as any) || p.status}</Badge>
                  </div>
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <DollarSign className="h-6 w-6 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">{t('noActivity')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('recentMaintenance')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
              {(recentMaintenance || []).length > 0 ? (recentMaintenance || []).map((r: any) => {
                const priorityLabel: Record<string, string> = { low: tm('low'), medium: tm('medium'), high: tm('high'), urgent: tm('urgent') };
                const statusLabel: Record<string, string> = { open: tm('open'), in_progress: tm('inProgress'), resolved: tm('resolved'), closed: tm('closed') };
                const propertyName = isAr && r.property?.nameAr ? r.property.nameAr : r.property?.name || '';
                return (
                  <div key={r.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                    <div className="min-w-0">
                      <p className="text-xs font-medium">{isAr && r.titleAr ? r.titleAr : r.title}</p>
                      <p className="text-[10px] text-muted-foreground">{propertyName} {r.unit ? `· ${r.unit.unitNumber}` : ''}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Badge variant={r.priority === 'urgent' ? 'destructive' : r.priority === 'high' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">{priorityLabel[r.priority] || r.priority}</Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{statusLabel[r.status] || r.status.replace('_', ' ')}</Badge>
                    </div>
                  </div>
                );}) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <Wrench className="h-6 w-6 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">{t('noActivity')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

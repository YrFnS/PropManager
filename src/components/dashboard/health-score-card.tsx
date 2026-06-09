'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { DollarSign, Wrench, FileText, Lightbulb, Building2, TrendingUp } from 'lucide-react';
import AnimatedCounter from '@/components/ui/animated-counter';

interface HealthScoreData {
  score: number;
  grade: string;
  gradeColor: string;
  metrics: {
    occupancy: { value: number; weight: number };
    collection: { value: number; weight: number };
    maintenance: { value: number; weight: number };
    renewal: { value: number; weight: number };
  };
  summary: {
    totalProperties: number;
    totalUnits: number;
    occupiedUnits: number;
    occupancyRate: number;
    totalMonthlyRevenue: number;
    collectionRate: number;
    openMaintenance: number;
    urgentOpen: number;
    maintenanceRate: number;
    activeLeases: number;
    renewalRate: number;
  };
  propertyScores: {
    id: string;
    name: string;
    nameAr: string | null;
    score: number;
    grade: string;
    occupancy: number;
    totalUnits: number;
    occupiedUnits: number;
    openMaintenance: number;
  }[];
}

const gradeStyles: Record<string, { text: string; bg: string }> = {
  A: { text: 'text-emerald-600', bg: 'bg-emerald-50' },
  B: { text: 'text-teal-600', bg: 'bg-teal-50' },
  C: { text: 'text-amber-600', bg: 'bg-amber-50' },
  D: { text: 'text-orange-600', bg: 'bg-orange-50' },
  F: { text: 'text-red-600', bg: 'bg-red-50' },
};

// Compact Score Ring
function ScoreRing({ score, gradeColor }: { score: number; gradeColor: string }) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(score), 100);
    return () => clearTimeout(timer);
  }, [score]);

  return (
    <div className="relative flex items-center justify-center">
      <svg width="88" height="88" viewBox="0 0 88 88" className="transform -rotate-90">
        <circle
          cx="44"
          cy="44"
          r={radius}
          stroke="currentColor"
          strokeWidth="6"
          fill="none"
          className="text-muted/30"
        />
        <motion.circle
          cx="44"
          cy="44"
          r={radius}
          stroke={gradeColor}
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-xl font-bold tracking-tight"
          style={{ color: gradeColor }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          dir="ltr"
        >
          <AnimatedCounter value={score} duration={800} />
        </motion.span>
      </div>
    </div>
  );
}

// Compact Metric Bar
function MetricBar({
  label,
  value,
  colorKey,
}: {
  label: string;
  value: number;
  colorKey: string;
}) {
  const barColor: Record<string, string> = {
    occupancy: 'bg-emerald-500',
    collection: 'bg-teal-500',
    maintenance: 'bg-amber-500',
    renewal: 'bg-sky-500',
  };
  const displayValue = Math.round(value);

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-16 sm:w-20 truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${barColor[colorKey] || 'bg-primary'}`}
          initial={{ width: 0 }}
          animate={{ width: `${displayValue}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
        />
      </div>
      <span className="text-[10px] font-medium w-7 text-end" dir="ltr">{displayValue}%</span>
    </div>
  );
}

export default function HealthScoreCard() {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const locale = useLocale();
  const isAr = locale === 'ar';
  const [data, setData] = useState<HealthScoreData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/health-score')
      .then(r => r.json())
      .then(d => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const getRecommendation = () => {
    if (!data) return null;
    const { metrics } = data;
    const entries = [
      { key: 'occupancy', value: metrics.occupancy.value, label: t('focusVacantUnits') },
      { key: 'collection', value: metrics.collection.value, label: t('sendPaymentReminders') },
      { key: 'maintenance', value: metrics.maintenance.value, label: t('prioritizeMaintenance') },
      { key: 'renewal', value: metrics.renewal.value, label: t('reachOutExpiring') },
    ];
    entries.sort((a, b) => a.value - b.value);
    return entries[0];
  };

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{t('healthScore')}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <div className="h-8 w-8 border-2 border-muted border-t-foreground/30 rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{t('healthScore')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground text-xs">{t('noData')}</div>
        </CardContent>
      </Card>
    );
  }

  const recommendation = getRecommendation();
  const gradeStyle = gradeStyles[data.grade] || gradeStyles.F;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{t('healthScore')}</CardTitle>
          <Badge variant="outline" className={`text-xs font-semibold ${gradeStyle.text}`}>
            Grade {data.grade}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score + Grade */}
        <div className="flex items-center gap-3 sm:gap-4">
          <ScoreRing score={data.score} gradeColor={data.gradeColor} />
          <div className="flex-1 space-y-1.5 min-w-0">
            <MetricBar label={t('occupancyRate')} value={data.metrics.occupancy.value} colorKey="occupancy" />
            <MetricBar label={t('collectionRate')} value={data.metrics.collection.value} colorKey="collection" />
            <MetricBar label={t('maintenanceResolution')} value={data.metrics.maintenance.value} colorKey="maintenance" />
            <MetricBar label={t('leaseRenewal')} value={data.metrics.renewal.value} colorKey="renewal" />
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md bg-muted/40 p-2 text-center">
            <DollarSign className="h-3 w-3 text-muted-foreground mx-auto mb-0.5" />
            <p className="text-xs font-semibold" dir="ltr">
              <AnimatedCounter value={data.summary.totalMonthlyRevenue} prefix="$" />
            </p>
            <p className="text-[9px] text-muted-foreground">{t('monthlyRevenue')}</p>
          </div>
          <div className="rounded-md bg-muted/40 p-2 text-center">
            <Wrench className="h-3 w-3 text-muted-foreground mx-auto mb-0.5" />
            <p className="text-xs font-semibold">
              <AnimatedCounter value={data.summary.openMaintenance} />
              {data.summary.urgentOpen > 0 && (
                <span className="text-red-500 text-[9px] ms-0.5">({data.summary.urgentOpen}!)</span>
              )}
            </p>
            <p className="text-[9px] text-muted-foreground">{t('openRequests')}</p>
          </div>
          <div className="rounded-md bg-muted/40 p-2 text-center">
            <FileText className="h-3 w-3 text-muted-foreground mx-auto mb-0.5" />
            <p className="text-xs font-semibold">
              <AnimatedCounter value={data.summary.activeLeases} />
            </p>
            <p className="text-[9px] text-muted-foreground">{t('activeLeases') || 'Active Leases'}</p>
          </div>
        </div>

        {/* Property Scores — compact list */}
        {data.propertyScores.length > 1 && (
          <div className="space-y-1">
            <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              {t('propertyHealth')}
            </h4>
            <div className="max-h-28 overflow-y-auto scrollbar-thin space-y-1">
              {data.propertyScores.map((p) => {
                const pName = isAr && p.nameAr ? p.nameAr : p.name;
                const pStyle = gradeStyles[p.grade] || gradeStyles.F;
                return (
                  <div key={p.id} className="flex items-center justify-between py-1 px-2 rounded-md hover:bg-muted/40 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium truncate">{pName}</p>
                      <p className="text-[9px] text-muted-foreground">
                        {p.occupiedUnits}/{p.totalUnits} {t('occupiedUnits')}
                        {p.openMaintenance > 0 && <span className="text-amber-500 ms-1">· {p.openMaintenance} {t('openRequests')}</span>}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold ${pStyle.text} shrink-0 ms-2`} dir="ltr">{p.grade}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recommendation */}
        {recommendation && recommendation.value < 100 && (
          <div className="flex items-start gap-1.5 rounded-md bg-muted/40 p-2">
            <Lightbulb className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">{t('recommendations')}</p>
              <p className="text-[11px] font-medium">{recommendation.label}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Building2,
  MapPin,
  User,
  Mail,
  Phone,
  Home,
  DoorOpen,
  Wrench,
  DollarSign,
  TrendingUp,
  Plus,
  Pencil,
  Trash2,
  Layers,
  Bath,
  Maximize,
} from 'lucide-react';
import PropertyImage from '@/components/properties/property-image';
import { STATUS_COLORS as BADGE_STATUS_COLORS, DEFAULT_STATUS_COLOR, PRIORITY_COLORS } from '@/lib/status-config';
import { CHART_COLORS } from '@/lib/status-config';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useEffect, useState, useCallback } from 'react';

interface PropertyDetail {
  id: string;
  name: string;
  nameAr: string | null;
  address: string;
  addressAr: string | null;
  city: string;
  cityAr: string | null;
  state: string | null;
  zipCode: string | null;
  description: string | null;
  descriptionAr: string | null;
  type: 'residential' | 'commercial' | 'mixed';
  image: string | null;
  createdAt: string;
  manager: {
    id: string;
    name: string;
    nameAr: string | null;
    email: string;
    phone: string | null;
  } | null;
  stats: {
    totalUnits: number;
    occupiedUnits: number;
    availableUnits: number;
    maintenanceUnits: number;
    occupancyRate: number;
    monthlyRevenue: number;
    averageRent: number;
    totalRent: number;
  };
  units: {
    id: string;
    unitNumber: string;
    floor: number | null;
    rooms: number;
    bathrooms: number;
    area: number | null;
    rentAmount: number;
    status: string;
    tenant: { name: string; nameAr: string | null } | null;
  }[];
  recentMaintenance: {
    id: string;
    title: string;
    titleAr: string | null;
    status: string;
    priority: string;
    category: string;
    unitNumber: string | null;
    tenantName: string | null;
    createdAt: string;
  }[];
}

interface PropertyDetailSheetProps {
  propertyId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (property: any) => void;
  onDelete: (property: any) => void;
}

export default function PropertyDetailSheet({
  propertyId,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: PropertyDetailSheetProps) {
  const t = useTranslations('properties');
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const isAr = locale === 'ar';

  const [data, setData] = useState<PropertyDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!propertyId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/properties/${propertyId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(null);
      return;
    }
    if (!propertyId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/properties/${propertyId}`);
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) setData(json);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [open, propertyId]);

  const typeBadgeVariant = (type: string) => {
    if (type === 'commercial') return 'default' as const;
    if (type === 'mixed') return 'outline' as const;
    return 'secondary' as const;
  };

  const unitStatusBadge = (status: string) => {
    switch (status) {
      case 'rented':
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100">{t('occupied')}</Badge>;
      case 'available':
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100">{t('available')}</Badge>;
      case 'maintenance':
        return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-100">{t('maintenance') || 'Maintenance'}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const chartData = data?.units.map((u) => ({
    name: u.unitNumber,
    rent: u.rentAmount,
    status: u.status,
  })) || [];

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const occupancyProgress = data ? (data.stats.occupancyRate / 100) * circumference : 0;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side={isAr ? 'left' : 'right'}
          className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-0"
        >
          {/* Always render SheetTitle for accessibility, even during loading */}
          <SheetHeader className="sr-only">
            <SheetTitle>{t('propertyDetails')}</SheetTitle>
            <SheetDescription>{t('propertyDetails')}</SheetDescription>
          </SheetHeader>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : data ? (
            <div className="flex flex-col h-full">
              {/* Hero Banner Image */}
              <PropertyImage
                type={data.type || 'residential'}
                name={isAr && data.nameAr ? data.nameAr : data.name}
                className="h-[200px] w-full shrink-0"
              />
              {/* Header */}
              <SheetHeader className="p-6 pb-4 border-b">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <SheetTitle className="text-xl truncate">
                      {isAr && data.nameAr ? data.nameAr : data.name}
                      {isAr && data.nameAr && data.name && (
                        <span className="text-sm text-muted-foreground ms-2">({data.name})</span>
                      )}
                    </SheetTitle>
                    <SheetDescription className="flex items-center gap-2 flex-wrap">
                      <Badge variant={typeBadgeVariant(data.type)}>{t(data.type)}</Badge>
                    </SheetDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span>
                    {isAr && data.addressAr ? data.addressAr : data.address}, {isAr && data.cityAr ? data.cityAr : data.city}
                    {data.state ? `, ${data.state}` : ''} {data.zipCode || ''}
                  </span>
                </div>
                {data.manager && (
                  <div className="mt-3 p-3 rounded-lg bg-muted/50 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <User className="h-4 w-4 text-primary" />
                      <span>{t('manager')}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">{isAr && data.manager.nameAr ? data.manager.nameAr : data.manager.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="truncate">{data.manager.email}</span>
                      </div>
                      {data.manager.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5" />
                          <span>{data.manager.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {data.description && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {isAr && data.descriptionAr ? data.descriptionAr : data.description}
                  </p>
                )}
              </SheetHeader>

              {/* Stats Grid */}
              <div className="p-6 border-b">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">{t('propertyDetails')}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <Home className="h-5 w-5 mx-auto text-primary mb-1" />
                    <p className="text-2xl font-bold">{data.stats.totalUnits}</p>
                    <p className="text-xs text-muted-foreground">{t('totalUnits')}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <DoorOpen className="h-5 w-5 mx-auto text-blue-500 mb-1" />
                    <p className="text-2xl font-bold">{data.stats.occupiedUnits}</p>
                    <p className="text-xs text-muted-foreground">{t('occupiedUnits')}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <Layers className="h-5 w-5 mx-auto text-green-500 mb-1" />
                    <p className="text-2xl font-bold">{data.stats.availableUnits}</p>
                    <p className="text-xs text-muted-foreground">{t('availableUnits')}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <Wrench className="h-5 w-5 mx-auto text-amber-500 mb-1" />
                    <p className="text-2xl font-bold">{data.stats.maintenanceUnits}</p>
                    <p className="text-xs text-muted-foreground">{t('maintenance') || 'Maintenance'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <DollarSign className="h-5 w-5 mx-auto text-emerald-500 mb-1" />
                    <p className="text-2xl font-bold">{tc('currency')}{data.stats.monthlyRevenue.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{t('monthlyRevenue')}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <TrendingUp className="h-5 w-5 mx-auto text-violet-500 mb-1" />
                    <p className="text-2xl font-bold">{tc('currency')}{data.stats.averageRent.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{t('averageRent')}</p>
                  </div>
                </div>

                {/* Occupancy Rate with circular progress */}
                <div className="mt-4 flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                  <div className="relative shrink-0">
                    <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
                      <circle
                        cx="48" cy="48" r={radius}
                        fill="none" stroke="currentColor"
                        className="text-muted/30"
                        strokeWidth="8"
                      />
                      <circle
                        cx="48" cy="48" r={radius}
                        fill="none" stroke="currentColor"
                        className="text-primary"
                        strokeWidth="8"
                        strokeDasharray={circumference}
                        strokeDashoffset={circumference - occupancyProgress}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold">{data.stats.occupancyRate}%</span>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">{t('occupancyRate')}</p>
                    <p className="text-sm text-muted-foreground">
                      {data.stats.occupiedUnits} {t('occupiedUnits')} / {data.stats.totalUnits} {t('totalUnits').toLowerCase()}
                    </p>
                    <Progress value={data.stats.occupancyRate} className="h-2 mt-2" />
                  </div>
                </div>
              </div>

              {/* Revenue per Unit Mini Chart */}
              {chartData.length > 0 && (
                <div className="p-6 border-b">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">{t('revenuePerUnit')}</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11 }}
                          className="fill-muted-foreground"
                        />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          className="fill-muted-foreground"
                          tickFormatter={(v) => `$${v}`}
                        />
                        <Tooltip
                          formatter={(value: number) => [`$${value}`, t('rentAmount') || 'Rent']}
                          contentStyle={{
                            borderRadius: '8px',
                            fontSize: '12px',
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            color: 'hsl(var(--foreground))',
                          }}
                        />
                        <Bar dataKey="rent" radius={[4, 4, 0, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={CHART_COLORS[entry.status === 'available' ? 'green' : entry.status === 'rented' ? 'blue' : 'amber'] || '#94a3b8'}
                              fillOpacity={0.85}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#22c55e]" />{t('available')}</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#3b82f6]" />{t('occupied')}</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#f59e0b]" />{t('maintenance') || 'Maintenance'}</span>
                  </div>
                </div>
              )}

              {/* Units List */}
              <div className="p-6 border-b">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                  {t('unitList')} ({data.units.length})
                </h3>
                {data.units.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">{t('noUnits')}</p>
                ) : (
                  <div className="max-h-72 overflow-y-auto scrollbar-thin space-y-2">
                    {data.units.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors cursor-pointer"
                        onClick={() => {
                          onOpenChange(false);
                          router.push('units');
                        }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-bold text-primary">{u.unitNumber}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">#{u.unitNumber}</span>
                              {u.floor !== null && (
                                <span className="text-xs text-muted-foreground">{t('floor')} {u.floor}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-0.5"><Home className="h-3 w-3" />{u.rooms}</span>
                              <span className="flex items-center gap-0.5"><Bath className="h-3 w-3" />{u.bathrooms}</span>
                              {u.area && (
                                <span className="flex items-center gap-0.5"><Maximize className="h-3 w-3" />{u.area} {tc('squareMeters')}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-end">
                            <p className="font-semibold text-sm">{tc('currency')}{u.rentAmount.toLocaleString()}</p>
                            {u.tenant && (
                              <p className="text-xs text-muted-foreground truncate max-w-[100px]">
                                {isAr && u.tenant.nameAr ? u.tenant.nameAr : u.tenant.name}
                              </p>
                            )}
                          </div>
                          {unitStatusBadge(u.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="p-6 mt-auto">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">{tc('actions')}</h3>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onOpenChange(false);
                      router.push('units');
                    }}
                  >
                    <Plus className="h-4 w-4 me-1.5" />
                    {t('viewUnits')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onOpenChange(false);
                      onEdit(data);
                    }}
                  >
                    <Pencil className="h-4 w-4 me-1.5" />
                    {t('editProperty')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (data) {
                        onOpenChange(false);
                        onDelete(data);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 me-1.5" />
                    {t('deleteProperty')}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

    </>
  );
}

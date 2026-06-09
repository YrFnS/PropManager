'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Mail, Phone, CreditCard, Shield, Home, CalendarDays,
  DollarSign, Wrench, Pencil, Plus, AlertCircle, Clock,
  CheckCircle2, Activity,
} from 'lucide-react';
import { STATUS_COLORS, DEFAULT_STATUS_COLOR, PRIORITY_COLORS } from '@/lib/status-config';
import { useEffect, useState, useCallback } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { ar as arLocale } from 'date-fns/locale/ar';

interface LeaseInfo {
  id: string;
  startDate: string;
  endDate: string;
  rentAmount: number;
  deposit: number | null;
  status: string;
  unit: {
    unitNumber: string;
    property: { name: string; nameAr: string | null };
  };
}

interface PaymentInfo {
  id: string;
  amount: number;
  dueDate: string;
  paidDate: string | null;
  status: string;
  method: string | null;
  lease: {
    unit: {
      unitNumber: string;
      property: { name: string; nameAr: string | null };
    };
  };
}

interface MaintenanceInfo {
  id: string;
  title: string;
  titleAr: string | null;
  priority: string;
  status: string;
  createdAt: string;
  property: { name: string; nameAr: string | null };
  unit: { unitNumber: string } | null;
}

interface TenantDetail {
  id: string;
  name: string;
  nameAr: string | null;
  email: string;
  phone: string | null;
  nationalId: string | null;
  emergencyContact: string | null;
  status: string;
  createdAt: string;
  leases: LeaseInfo[];
  payments: PaymentInfo[];
  maintenanceRequests: MaintenanceInfo[];
  summary: {
    totalPaid: number;
    totalPending: number;
    openMaintenanceCount: number;
  };
}

interface TenantDetailSheetProps {
  tenantId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (tenant: { id: string; name: string; nameAr: string | null; email: string; phone: string | null; nationalId: string | null; emergencyContact: string | null; status: string }) => void;
}

export default function TenantDetailSheet({ tenantId, open, onOpenChange, onEdit }: TenantDetailSheetProps) {
  const t = useTranslations('tenants');
  const tc = useTranslations('common');
  const tp = useTranslations('payments');
  const tm = useTranslations('maintenance');
  const tl = useTranslations('leases');
  const locale = useLocale();
  const router = useRouter();
  const isAr = locale === 'ar';
  const dateLocale = isAr ? arLocale : undefined;

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchTenant = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tenants/${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setTenant(data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (!open || !tenantId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/tenants/${tenantId}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setTenant(data);
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [open, tenantId]);

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
  };

  const getLeaseProgress = (lease: LeaseInfo) => {
    const start = new Date(lease.startDate).getTime();
    const end = new Date(lease.endDate).getTime();
    const now = Date.now();
    if (now >= end) return 100;
    if (now <= start) return 0;
    return Math.round(((now - start) / (end - start)) * 100);
  };

  const getStatusLabel = (status: string, section: 'tenant' | 'lease' | 'payment' | 'maintenance') => {
    switch (section) {
      case 'tenant':
        return status === 'active' ? t('active') : t('inactive');
      case 'lease':
        return status === 'active' ? tl('active') : status === 'expired' ? tl('expired') : tl('terminated');
      case 'payment':
        switch (status) {
          case 'paid': return tp('paid');
          case 'pending': return tp('pending');
          case 'late': return tp('late');
          case 'partial': return tp('partial');
          default: return status;
        }
      case 'maintenance':
        switch (status) {
          case 'open': return tm('open');
          case 'in_progress': return tm('inProgress');
          case 'resolved': return tm('resolved');
          case 'closed': return tm('closed');
          default: return status;
        }
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'low': return tm('low');
      case 'medium': return tm('medium');
      case 'high': return tm('high');
      case 'urgent': return tm('urgent');
      default: return priority;
    }
  };

  const getMethodLabel = (method: string | null) => {
    if (!method) return '-';
    switch (method) {
      case 'cash': return tp('cash');
      case 'bank_transfer': return tp('bankTransfer');
      case 'online': return tp('online');
      case 'check': return tp('check');
      default: return method;
    }
  };

  const activeLease = tenant?.leases.find((l) => l.status === 'active');

  // Build activity timeline from payments and maintenance requests
  const activityItems = tenant
    ? [
        ...tenant.payments.slice(0, 10).map((p) => ({
          type: 'payment' as const,
          date: p.paidDate || p.dueDate,
          description: `${tc('currency')}${p.amount.toLocaleString()} - ${getStatusLabel(p.status, 'payment')}`,
          icon: p.status === 'paid' || p.status === 'partial' ? CheckCircle2 : AlertCircle,
          iconColor: p.status === 'paid' || p.status === 'partial' ? 'text-emerald-500' : p.status === 'late' ? 'text-red-500' : 'text-yellow-500',
        })),
        ...tenant.maintenanceRequests.slice(0, 10).map((m) => ({
          type: 'maintenance' as const,
          date: m.createdAt,
          description: isAr && m.titleAr ? m.titleAr : m.title,
          icon: Wrench,
          iconColor: m.status === 'resolved' || m.status === 'closed' ? 'text-emerald-500' : m.priority === 'urgent' ? 'text-red-500' : 'text-amber-500',
        })),
      ]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 15)
    : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isAr ? 'left' : 'right'} className="w-full sm:max-w-lg p-0">
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle>{t('tenantDetails')}</SheetTitle>
          <SheetDescription className="sr-only">{t('tenantDetails')}</SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : tenant ? (
          <ScrollArea className="h-[calc(100vh-80px)]">
            <div className="px-6 pb-6 space-y-6">
              {/* Header Section */}
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                    {getInitials(tenant.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold truncate">
                    {isAr && tenant.nameAr ? tenant.nameAr : tenant.name}
                  </h2>
                  {isAr && tenant.nameAr && (
                    <p className="text-sm text-muted-foreground truncate">{tenant.name}</p>
                  )}
                  <Badge className={STATUS_COLORS[tenant.status] || DEFAULT_STATUS_COLOR}>
                    {getStatusLabel(tenant.status, 'tenant')}
                  </Badge>
                </div>
              </div>

              {/* Contact Information */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{t('contactInfo')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  <div className="flex items-center gap-2.5 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{tenant.email}</span>
                  </div>
                  {tenant.phone && (
                    <div className="flex items-center gap-2.5 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{tenant.phone}</span>
                    </div>
                  )}
                  {tenant.nationalId && (
                    <div className="flex items-center gap-2.5 text-sm">
                      <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">{t('nationalId')}:</span>
                      <span>{tenant.nationalId}</span>
                    </div>
                  )}
                  {tenant.emergencyContact && (
                    <div className="flex items-center gap-2.5 text-sm">
                      <AlertCircle className="h-4 w-4 text-orange-500 shrink-0" />
                      <span className="text-muted-foreground">{t('emergencyContact')}:</span>
                      <span>{tenant.emergencyContact}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Current Lease */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{t('currentLease')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {activeLease ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Home className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-medium">
                            {activeLease.unit.unitNumber} · {isAr && activeLease.unit.property.nameAr ? activeLease.unit.property.nameAr : activeLease.unit.property.name}
                          </span>
                        </div>
                        <Badge className={STATUS_COLORS[activeLease.status] || DEFAULT_STATUS_COLOR}>
                          {getStatusLabel(activeLease.status, 'lease')}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <DollarSign className="h-3.5 w-3.5" />
                          <span>{tc('currency')}{activeLease.rentAmount.toLocaleString()}/mo</span>
                        </div>
                        {activeLease.deposit && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <CreditCard className="h-3.5 w-3.5" />
                            <span>{tc('currency')}{activeLease.deposit.toLocaleString()} {tl('deposit')}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <CalendarDays className="h-3.5 w-3.5" />
                          <span>{format(new Date(activeLease.startDate), 'MMM d, y')}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <CalendarDays className="h-3.5 w-3.5" />
                          <span>{format(new Date(activeLease.endDate), 'MMM d, y')}</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{t('leaseProgress')}</span>
                          <span>{getLeaseProgress(activeLease)}%</span>
                        </div>
                        <Progress value={getLeaseProgress(activeLease)} className="h-2" />
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('noLease')}</p>
                  )}
                </CardContent>
              </Card>

              {/* Payment History */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t('paymentHistory')}</CardTitle>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {t('totalPaid')}: {tc('currency')}{tenant.summary.totalPaid.toLocaleString()}
                      </span>
                      {tenant.summary.totalPending > 0 && (
                        <span className="text-red-600 dark:text-red-400">
                          {t('totalPending')}: {tc('currency')}{tenant.summary.totalPending.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {tenant.payments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{tc('noData')}</p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto scrollbar-thin space-y-2">
                      {tenant.payments.slice(0, 10).map((payment) => (
                        <div key={payment.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{tc('currency')}{payment.amount.toLocaleString()}</span>
                              <Badge variant="secondary" className={STATUS_COLORS[payment.status] || DEFAULT_STATUS_COLOR}>
                                {getStatusLabel(payment.status, 'payment')}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {format(new Date(payment.dueDate), 'MMM d, y')}
                              {payment.paidDate && ` → ${format(new Date(payment.paidDate), 'MMM d, y')}`}
                              {' · '}{getMethodLabel(payment.method)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Maintenance Requests */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t('maintenanceHistory')}</CardTitle>
                    {tenant.summary.openMaintenanceCount > 0 && (
                      <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                        {t('openRequests')}: {tenant.summary.openMaintenanceCount}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {tenant.maintenanceRequests.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{tc('noData')}</p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto scrollbar-thin space-y-2">
                      {tenant.maintenanceRequests.map((req) => (
                        <div key={req.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">
                                {isAr && req.titleAr ? req.titleAr : req.title}
                              </span>
                              <Badge variant="secondary" className={PRIORITY_COLORS[req.priority] || DEFAULT_STATUS_COLOR}>
                                {getPriorityLabel(req.priority)}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {format(new Date(req.createdAt), 'MMM d, y')} · {req.property.name}
                            </p>
                          </div>
                          <Badge variant="secondary" className={STATUS_COLORS[req.status] || DEFAULT_STATUS_COLOR}>
                            {getStatusLabel(req.status, 'maintenance')}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Activity Timeline */}
              {activityItems.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      {t('activityTimeline')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="relative space-y-0">
                      {activityItems.map((item, index) => {
                        const IconComp = item.icon;
                        return (
                          <div key={index} className="flex gap-3 relative pb-4 last:pb-0">
                            {index < activityItems.length - 1 && (
                              <div className="absolute start-[11px] top-6 bottom-0 w-px bg-border" />
                            )}
                            <div className="relative z-10 mt-0.5">
                              <div className={`flex h-6 w-6 items-center justify-center rounded-full bg-muted ${item.iconColor}`}>
                                <IconComp className="h-3.5 w-3.5" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{item.description}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(item.date), { addSuffix: true, locale: dateLocale })}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Separator />

              {/* Quick Actions */}
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  className="flex flex-col items-center gap-1.5 h-auto py-3"
                  onClick={() => {
                    onEdit({
                      id: tenant.id,
                      name: tenant.name,
                      nameAr: tenant.nameAr,
                      email: tenant.email,
                      phone: tenant.phone,
                      nationalId: tenant.nationalId,
                      emergencyContact: tenant.emergencyContact,
                      status: tenant.status,
                    });
                    onOpenChange(false);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  <span className="text-xs">{tc('edit')}</span>
                </Button>
                <Button
                  variant="outline"
                  className="flex flex-col items-center gap-1.5 h-auto py-3"
                  onClick={() => {
                    onOpenChange(false);
                    router.push('payments');
                  }}
                >
                  <DollarSign className="h-4 w-4" />
                  <span className="text-xs">{tp('addPayment')}</span>
                </Button>
                <Button
                  variant="outline"
                  className="flex flex-col items-center gap-1.5 h-auto py-3"
                  onClick={() => {
                    onOpenChange(false);
                    router.push('maintenance');
                  }}
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-xs">{tm('addRequest')}</span>
                </Button>
              </div>
            </div>
          </ScrollArea>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

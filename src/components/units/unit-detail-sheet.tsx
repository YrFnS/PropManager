'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DoorOpen, Building2, User, Mail, Phone,
  CalendarDays, DollarSign, CreditCard, Wrench,
  Pencil, Eye, Receipt, Bed, Bath, Maximize, Layers,
} from 'lucide-react';
import { STATUS_COLORS, DEFAULT_STATUS_COLOR, PRIORITY_COLORS } from '@/lib/status-config';
import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';

interface PropertyInfo {
  id: string;
  name: string;
  nameAr: string | null;
  address: string;
  addressAr: string | null;
  city: string;
  cityAr: string | null;
}

interface TenantInfo {
  id: string;
  name: string;
  nameAr: string | null;
  email: string;
  phone: string | null;
}

interface LeaseInfo {
  id: string;
  startDate: string;
  endDate: string;
  rentAmount: number;
  deposit: number | null;
  status: string;
  tenant: TenantInfo;
}

interface PaymentInfo {
  id: string;
  amount: number;
  dueDate: string;
  paidDate: string | null;
  status: string;
  method: string | null;
  tenant: { id: string; name: string; nameAr: string | null };
}

interface MaintenanceInfo {
  id: string;
  title: string;
  titleAr: string | null;
  priority: string;
  status: string;
  createdAt: string;
  property: { name: string; nameAr: string | null };
  tenant: { name: string; nameAr: string | null } | null;
}

interface UnitDetail {
  id: string;
  unitNumber: string;
  floor: number | null;
  rooms: number;
  bathrooms: number;
  area: number | null;
  rentAmount: number;
  status: string;
  propertyId: string;
  property: PropertyInfo;
  currentLease: LeaseInfo | null;
  recentPayments: PaymentInfo[];
  maintenanceRequests: MaintenanceInfo[];
}

interface UnitDetailSheetProps {
  unitId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (unit: {
    id: string;
    unitNumber: string;
    propertyId: string;
    floor: number | null;
    rooms: number;
    bathrooms: number;
    area: number | null;
    rentAmount: number;
    status: string;
  }) => void;
  onViewTenant: (tenantId: string) => void;
}

export default function UnitDetailSheet({ unitId, open, onOpenChange, onEdit, onViewTenant }: UnitDetailSheetProps) {
  const t = useTranslations('units');
  const tc = useTranslations('common');
  const tp = useTranslations('payments');
  const tl = useTranslations('leases');
  const tm = useTranslations('maintenance');
  const locale = useLocale();
  const router = useRouter();
  const isAr = locale === 'ar';

  const [unit, setUnit] = useState<UnitDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchUnit = useCallback(async () => {
    if (!unitId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/units/${unitId}`);
      if (res.ok) {
        const data = await res.json();
        setUnit(data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [unitId]);

  useEffect(() => {
    if (!open || !unitId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/units/${unitId}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setUnit(data);
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [open, unitId]);

  const getStatusLabel = (status: string, section: 'unit' | 'lease' | 'payment' | 'maintenance') => {
    switch (section) {
      case 'unit':
        switch (status) {
          case 'available': return t('available');
          case 'rented': return t('rented');
          case 'maintenance': return t('maintenance');
          default: return status;
        }
      case 'lease':
        switch (status) {
          case 'active': return tl('active');
          case 'expired': return tl('expired');
          case 'terminated': return tl('terminated');
          default: return status;
        }
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isAr ? 'left' : 'right'} className="w-full sm:max-w-lg p-0">
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle>{t('unitDetails')}</SheetTitle>
          <SheetDescription className="sr-only">{t('unitDetails')}</SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : unit ? (
          <ScrollArea className="h-[calc(100vh-80px)]">
            <div className="px-6 pb-6 space-y-6">
              {/* Unit Info Header */}
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/30">
                  <DoorOpen className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold">{unit.unitNumber}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={STATUS_COLORS[unit.status] || DEFAULT_STATUS_COLOR}>
                      {getStatusLabel(unit.status, 'unit')}
                    </Badge>
                    <span className="text-sm font-semibold text-primary">
                      {tc('currency')}{unit.rentAmount.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Unit Details Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{t('unitDetails')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    {unit.floor != null && (
                      <div className="flex items-center gap-2 text-sm">
                        <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground">{t('floor')}:</span>
                        <span className="font-medium">{unit.floor}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <Bed className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">{t('rooms')}:</span>
                      <span className="font-medium">{unit.rooms}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Bath className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">{t('bathrooms')}:</span>
                      <span className="font-medium">{unit.bathrooms}</span>
                    </div>
                    {unit.area && (
                      <div className="flex items-center gap-2 text-sm">
                        <Maximize className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground">{t('area')}:</span>
                        <span className="font-medium">{unit.area} {tc('squareMeters')}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">{t('rentAmount')}:</span>
                      <span className="font-medium">{tc('currency')}{unit.rentAmount.toLocaleString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Property Info Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {t('property')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="font-medium">
                    {isAr && unit.property.nameAr ? unit.property.nameAr : unit.property.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {isAr && unit.property.addressAr ? unit.property.addressAr : unit.property.address}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {isAr && unit.property.cityAr ? unit.property.cityAr : unit.property.city}
                  </div>
                </CardContent>
              </Card>

              {/* Current Tenant Card */}
              {unit.currentLease && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {t('currentTenant')}
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-primary"
                        onClick={() => {
                          onViewTenant(unit.currentLease!.tenant.id);
                          onOpenChange(false);
                        }}
                      >
                        <Eye className="h-3 w-3 me-1" />
                        {t('viewTenant')}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2.5">
                    <div className="font-medium">
                      {isAr && unit.currentLease.tenant.nameAr
                        ? unit.currentLease.tenant.nameAr
                        : unit.currentLease.tenant.name}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{unit.currentLease.tenant.email}</span>
                    </div>
                    {unit.currentLease.tenant.phone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span>{unit.currentLease.tenant.phone}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Lease Info Card */}
              {unit.currentLease && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        {t('leaseInfo')}
                      </CardTitle>
                      <Badge className={STATUS_COLORS[unit.currentLease.status] || DEFAULT_STATUS_COLOR}>
                        {getStatusLabel(unit.currentLease.status, 'lease')}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        <span>{format(new Date(unit.currentLease.startDate), 'MMM d, y')}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        <span>{format(new Date(unit.currentLease.endDate), 'MMM d, y')}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <DollarSign className="h-3.5 w-3.5" />
                        <span>{tc('currency')}{unit.currentLease.rentAmount.toLocaleString()}/mo</span>
                      </div>
                      {unit.currentLease.deposit != null && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <CreditCard className="h-3.5 w-3.5" />
                          <span>{tc('currency')}{unit.currentLease.deposit.toLocaleString()} {tl('deposit')}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Payment History Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    {t('paymentHistory')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {unit.recentPayments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{tc('noData')}</p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto scrollbar-thin space-y-2">
                      {unit.recentPayments.map((payment) => (
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

              {/* Maintenance History Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    {t('maintenanceHistory')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {unit.maintenanceRequests.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{tc('noData')}</p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto scrollbar-thin space-y-2">
                      {unit.maintenanceRequests.map((req) => (
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
                              {format(new Date(req.createdAt), 'MMM d, y')}
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

              <Separator />

              {/* Quick Actions */}
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  className="flex flex-col items-center gap-1.5 h-auto py-3"
                  onClick={() => {
                    onEdit({
                      id: unit.id,
                      unitNumber: unit.unitNumber,
                      propertyId: unit.propertyId,
                      floor: unit.floor,
                      rooms: unit.rooms,
                      bathrooms: unit.bathrooms,
                      area: unit.area,
                      rentAmount: unit.rentAmount,
                      status: unit.status,
                    });
                    onOpenChange(false);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  <span className="text-xs">{tc('edit')}</span>
                </Button>
                {unit.currentLease && (
                  <Button
                    variant="outline"
                    className="flex flex-col items-center gap-1.5 h-auto py-3"
                    onClick={() => {
                      onViewTenant(unit.currentLease!.tenant.id);
                      onOpenChange(false);
                    }}
                  >
                    <User className="h-4 w-4" />
                    <span className="text-xs">{t('viewTenant')}</span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="flex flex-col items-center gap-1.5 h-auto py-3"
                  onClick={() => {
                    onOpenChange(false);
                    router.push('payments');
                  }}
                >
                  <Receipt className="h-4 w-4" />
                  <span className="text-xs">{tp('addPayment')}</span>
                </Button>
              </div>
            </div>
          </ScrollArea>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, Users, Mail, Phone, Home, Pencil, Trash2, Download, UserCheck, FileText } from 'lucide-react';
import EmptyState from '@/components/ui/empty-state';
import AnimatedCounter from '@/components/ui/animated-counter';
import TenantDetailSheet from './tenant-detail-sheet';
import { STATUS_COLORS, DEFAULT_STATUS_COLOR } from '@/lib/status-config';
import { toast } from 'sonner';
import { useEffect, useState, useCallback } from 'react';
import { useRouteIntent } from '@/lib/route-intent';

interface Tenant {
  id: string;
  name: string;
  nameAr: string | null;
  email: string;
  phone: string | null;
  nationalId: string | null;
  emergencyContact: string | null;
  status: string;
  leases: {
    id: string;
    rentAmount: number;
    unit: { unitNumber: string; property: { name: string; nameAr: string | null } };
  }[];
  _count: { payments: number; maintenanceRequests: number };
}

const defaultForm = {
  name: '', nameAr: '', email: '', phone: '', nationalId: '', emergencyContact: '', status: 'active',
};

export default function TenantsSection() {
  const t = useTranslations('tenants');
  const tc = useTranslations('common');
  const locale = useLocale();
  const isAr = locale === 'ar';

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [stats, setStats] = useState({ totalTenants: 0, activeTenants: 0, withActiveLeases: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ ...defaultForm });
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  const fetchTenants = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    fetch(`/api/tenants?${params.toString()}`)
      .then(r => r.json())
      .then(data => {
        const result = data.data || data;
        setTenants(result.tenants || result || []);
        setStats(result.stats || data.stats || { totalTenants: 0, activeTenants: 0, withActiveLeases: 0 });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/tenants?search=${encodeURIComponent(search)}`);
        const data = await r.json();
        if (cancelled) return;
        const result = data.data || data;
        setTenants(result.tenants || result || []);
        setStats(result.stats || data.stats || { totalTenants: 0, activeTenants: 0, withActiveLeases: 0 });
      } catch {
        if (!cancelled) setLoading(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [search]);

  const openAddDialog = () => {
    setEditingId(null);
    setForm({ ...defaultForm });
    setDialogOpen(true);
  };

  const openEditDialog = (tenant: { id: string; name: string; nameAr: string | null; email: string; phone: string | null; nationalId: string | null; emergencyContact: string | null; status: string }) => {
    setEditingId(tenant.id);
    setForm({
      name: tenant.name || '',
      nameAr: tenant.nameAr || '',
      email: tenant.email || '',
      phone: tenant.phone || '',
      nationalId: tenant.nationalId || '',
      emergencyContact: tenant.emergencyContact || '',
      status: tenant.status || 'active',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        nameAr: form.nameAr || null,
        email: form.email,
        phone: form.phone || null,
        nationalId: form.nationalId || null,
        emergencyContact: form.emergencyContact || null,
        status: form.status,
      };

      if (editingId) {
        const res = await fetch('/api/tenants', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...payload }),
        });
        if (res.ok) {
          toast.success(tc('success'));
          setDialogOpen(false);
          setEditingId(null);
          setForm({ ...defaultForm });
          fetchTenants();
        } else {
          toast.error(tc('error'));
        }
      } else {
        const res = await fetch('/api/tenants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          toast.success(t('createSuccess'));
          setForm({ ...defaultForm });
          setDialogOpen(false);
          fetchTenants();
        } else {
          toast.error(tc('error'));
        }
      }
    } catch {
      toast.error(tc('error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/tenants?id=${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(tc('success'));
        setDeleteTarget(null);
        fetchTenants();
      } else {
        toast.error(tc('error'));
      }
    } catch {
      toast.error(tc('error'));
    }
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
  };

  const getStatusLabel = (status: string) => {
    return status === 'active' ? t('active') : t('inactive');
  };

  useRouteIntent({
    section: 'tenants',
    onAdd: openAddDialog,
    onRecord: (tenantId) => {
      setSelectedTenantId(tenantId);
      setDetailSheetOpen(true);
    },
  });

  const exportCsv = () => {
    const headers = ['Name', 'Email', 'Phone', 'National ID', 'Status'];
    const rows = tenants.map(tn => [
      isAr && tn.nameAr ? tn.nameAr : tn.name,
      tn.email,
      tn.phone || '',
      tn.nationalId || '',
      getStatusLabel(tn.status),
    ]);
    const csvContent = [headers, ...rows].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tenants.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight gradient-text">{t('title')}</h1>
          {tenants.length > 0 && <Badge variant="secondary">{tenants.length}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={tenants.length === 0}><Download className="h-4 w-4 me-2" />{tc('exportCsv')}</Button>
          <Button onClick={openAddDialog}><Plus className="h-4 w-4 me-2" />{t('addTenant')}</Button>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? t('editTenant') : t('addTenant')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('name')}</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t('nameAr')}</Label>
                <Input dir="rtl" value={form.nameAr} onChange={e => setForm({ ...form, nameAr: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('email')}</Label>
                <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t('phone')}</Label>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('nationalId')}</Label>
                <Input value={form.nationalId} onChange={e => setForm({ ...form, nationalId: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t('emergencyContact')}</Label>
                <Input value={form.emergencyContact} onChange={e => setForm({ ...form, emergencyContact: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{tc('cancel')}</Button>
            <Button onClick={handleSubmit} disabled={submitting || !form.name || !form.email}>
              {submitting ? tc('loading') : tc('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 md:grid-cols-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="hover:shadow-md transition-shadow cursor-default">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('totalTenants')}</p>
                    <AnimatedCounter value={stats.totalTenants} className="text-2xl font-bold mt-1" />
                  </div>
                  <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30"><Users className="h-5 w-5 text-blue-600" /></div>
                </div>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent>{tc('clickToView')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="hover:shadow-md transition-shadow cursor-default">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('activeTenants')}</p>
                    <AnimatedCounter value={stats.activeTenants} className="text-2xl font-bold mt-1" />
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30"><UserCheck className="h-5 w-5 text-emerald-600" /></div>
                </div>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent>{t('outOfTotal', { count: stats.totalTenants })}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="hover:shadow-md transition-shadow cursor-default">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('withActiveLeases')}</p>
                    <AnimatedCounter value={stats.withActiveLeases} className="text-2xl font-bold mt-1" />
                  </div>
                  <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/30"><FileText className="h-5 w-5 text-teal-600" /></div>
                </div>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent>{t('basedOnActiveLeases')}</TooltipContent>
        </Tooltip>
      </div>

      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('searchTenants')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="ps-9 max-w-md focus:ring-2 focus:ring-primary/20 transition-all duration-200"
        />
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : tenants.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('title')}
          description={t('noTenantsDescription')}
          actionLabel={t('addTenant')}
          onAction={openAddDialog}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tenants.map(tn => (
            <Card key={tn.id} className="group hover:-translate-y-1 hover:shadow-xl transition-all duration-300 cursor-pointer rounded-xl border border-border/50" onClick={() => { setSelectedTenantId(tn.id); setDetailSheetOpen(true); }}>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {getInitials(tn.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{isAr && tn.nameAr ? tn.nameAr : tn.name}</p>
                    <Badge className={STATUS_COLORS[tn.status] || DEFAULT_STATUS_COLOR}>
                      {getStatusLabel(tn.status)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEditDialog(tn); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{tc('edit')}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget(tn); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{tc('delete')}</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{tn.email}</span>
                  </div>
                  {tn.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span>{tn.phone}</span>
                    </div>
                  )}
                </div>
                {tn.leases.length > 0 ? (
                  <div className="border-t pt-3 space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">{t('leaseInfo')}</p>
                    {tn.leases.map(l => (
                      <div key={l.id} className="flex items-center gap-2 text-sm">
                        <Home className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">
                          {l.unit.unitNumber} · {isAr && l.unit.property.nameAr ? l.unit.property.nameAr : l.unit.property.name}
                        </span>
                        <span className="ms-auto font-medium">{tc('currency')}{l.rentAmount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border-t pt-3">
                    <p className="text-sm text-muted-foreground">{t('noLease')}</p>
                  </div>
                )}
                <div className="flex gap-4 text-xs text-muted-foreground border-t pt-3">
                  <span>{t('payments')}: {tn._count.payments}</span>
                  <span>{t('maintenanceRequests')}: {tn._count.maintenanceRequests}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tenant Detail Sheet */}
      <TenantDetailSheet
        tenantId={selectedTenantId}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        onEdit={(tenant) => openEditDialog(tenant)}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tc('delete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('confirmDelete')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {tc('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

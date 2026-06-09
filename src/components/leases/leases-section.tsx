'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, FileText, Pencil, Trash2, Download, FileCheck, Clock, DollarSign, ChevronDown } from 'lucide-react';
import EmptyState from '@/components/ui/empty-state';
import AnimatedCounter from '@/components/ui/animated-counter';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { BulkActionsBar } from '@/components/ui/bulk-actions-bar';
import { STATUS_COLORS, DEFAULT_STATUS_COLOR } from '@/lib/status-config';
import { toast } from 'sonner';
import { useEffect, useState, useCallback } from 'react';

interface Lease {
  id: string;
  startDate: string;
  endDate: string;
  rentAmount: number;
  deposit: number | null;
  status: string;
  tenant: { id: string; name: string; nameAr: string | null };
  unit: { id: string; unitNumber: string; property: { name: string; nameAr: string | null } };
  _count: { payments: number };
}

interface UnitOption {
  id: string;
  unitNumber: string;
  property: { name: string; nameAr: string | null };
}

interface TenantOption {
  id: string;
  name: string;
  nameAr: string | null;
}

const emptyForm = {
  unitId: '', tenantId: '', startDate: '', endDate: '', rentAmount: '', deposit: '', status: 'active',
};

export default function LeasesSection() {
  const t = useTranslations('leases');
  const tc = useTranslations('common');
  const locale = useLocale();
  const isAr = locale === 'ar';

  const [leases, setLeases] = useState<Lease[]>([]);
  const [stats, setStats] = useState({ activeLeases: 0, expiringSoon: 0, totalMonthlyRevenue: 0 });
  const [unitOptions, setUnitOptions] = useState<UnitOption[]>([]);
  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [statusFilter, setStatusFilter] = useState('all');
  const [isMobile, setIsMobile] = useState(false);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const fetchLeases = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
    fetch(`/api/leases?${params.toString()}`)
      .then(r => r.json())
      .then(data => {
        const result = data.data || data;
        setLeases(result.leases || result || []);
        setStats(result.stats || data.stats || { activeLeases: 0, expiringSoon: 0, totalMonthlyRevenue: 0 });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      try {
        const r = await fetch(`/api/leases?${params.toString()}`);
        const data = await r.json();
        if (cancelled) return;
        const result = data.data || data;
        setLeases(result.leases || result || []);
        setStats(result.stats || data.stats || { activeLeases: 0, expiringSoon: 0, totalMonthlyRevenue: 0 });
      } catch {
        if (!cancelled) setLoading(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [statusFilter]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/units').then(r => r.json()),
      fetch('/api/tenants').then(r => r.json()),
    ]).then(([unitsData, tenantsData]) => {
      if (cancelled) return;
      setUnitOptions(unitsData.data || unitsData);
      const result = tenantsData.data || tenantsData;
      setTenantOptions(result.tenants || result || []);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const handleOpenAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const handleOpenEdit = (lease: Lease) => {
    setEditingId(lease.id);
    setForm({
      unitId: lease.unit.id,
      tenantId: lease.tenant.id,
      startDate: lease.startDate.split('T')[0],
      endDate: lease.endDate.split('T')[0],
      rentAmount: String(lease.rentAmount),
      deposit: lease.deposit ? String(lease.deposit) : '',
      status: lease.status,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        unitId: form.unitId,
        tenantId: form.tenantId,
        startDate: form.startDate,
        endDate: form.endDate,
        rentAmount: parseFloat(form.rentAmount),
        deposit: form.deposit ? parseFloat(form.deposit) : null,
        status: form.status,
      };

      const res = editingId
        ? await fetch('/api/leases', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editingId, ...payload }),
          })
        : await fetch('/api/leases', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      if (res.ok) {
        setForm({ ...emptyForm });
        setEditingId(null);
        setDialogOpen(false);
        fetchLeases();
        toast.success(editingId ? tc('updatedSuccessfully') : tc('createdSuccessfully'));
      } else {
        toast.error(tc('error'));
      }
    } catch {
      toast.error(tc('error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/leases?id=${deleteId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchLeases();
        toast.success(tc('deletedSuccessfully'));
      } else {
        toast.error(tc('error'));
      }
    } catch {
      toast.error(tc('error'));
    } finally {
      setDeleteId(null);
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      active: t('active'),
      expired: t('expired'),
      terminated: t('terminated'),
    };
    return labels[status] || status;
  };

  const exportCsv = () => {
    const headers = ['Tenant', 'Unit/Property', 'Start Date', 'End Date', 'Rent', 'Deposit', 'Status'];
    const rows = leases.map(l => [
      isAr && l.tenant.nameAr ? l.tenant.nameAr : l.tenant.name,
      `${l.unit.unitNumber} - ${isAr && l.unit.property.nameAr ? l.unit.property.nameAr : l.unit.property.name}`,
      new Date(l.startDate).toLocaleDateString(),
      new Date(l.endDate).toLocaleDateString(),
      String(l.rentAmount),
      l.deposit ? String(l.deposit) : '',
      getStatusLabel(l.status),
    ]);
    const csvContent = [headers, ...rows].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'leases.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Bulk actions
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(leases.map(l => l.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    try {
      const promises = Array.from(selectedIds).map(id =>
        fetch(`/api/leases?id=${id}`, { method: 'DELETE' })
      );
      const results = await Promise.allSettled(promises);
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      toast.success(`${succeeded} ${tc('deletedSuccessfully')}`);
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      fetchLeases();
    } catch {
      toast.error(tc('error'));
    }
  };

  const handleBulkChangeStatus = async (newStatus: string) => {
    try {
      const promises = Array.from(selectedIds).map(id =>
        fetch('/api/leases', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status: newStatus }),
        })
      );
      const results = await Promise.allSettled(promises);
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      toast.success(`${succeeded} ${tc('updatedSuccessfully')}`);
      setSelectedIds(new Set());
      fetchLeases();
    } catch {
      toast.error(tc('error'));
    }
  };

  const handleBulkExport = () => {
    const selectedLeases = leases.filter(l => selectedIds.has(l.id));
    const headers = ['Tenant', 'Unit/Property', 'Start Date', 'End Date', 'Rent', 'Deposit', 'Status'];
    const rows = selectedLeases.map(l => [
      isAr && l.tenant.nameAr ? l.tenant.nameAr : l.tenant.name,
      `${l.unit.unitNumber} - ${isAr && l.unit.property.nameAr ? l.unit.property.nameAr : l.unit.property.name}`,
      new Date(l.startDate).toLocaleDateString(),
      new Date(l.endDate).toLocaleDateString(),
      String(l.rentAmount),
      l.deposit ? String(l.deposit) : '',
      getStatusLabel(l.status),
    ]);
    const csvContent = [headers, ...rows].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'leases.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight gradient-text">{t('title')}</h1>
          {leases.length > 0 && <Badge variant="secondary">{leases.length}</Badge>}
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={exportCsv} disabled={leases.length === 0}><Download className="h-4 w-4 me-2" />{tc('exportCsv')}</Button>
              <Button onClick={handleOpenAdd}><Plus className="h-4 w-4 me-2" />{t('addLease')}</Button>
            </div>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? t('editLease') : t('addLease')}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('tenant')}</Label>
                  <Select value={form.tenantId} onValueChange={v => setForm({ ...form, tenantId: v })}>
                    <SelectTrigger><SelectValue placeholder={t('selectTenant')} /></SelectTrigger>
                    <SelectContent>
                      {tenantOptions.map(tn => (
                        <SelectItem key={tn.id} value={tn.id}>{isAr && tn.nameAr ? tn.nameAr : tn.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('unit')}</Label>
                  <Select value={form.unitId} onValueChange={v => setForm({ ...form, unitId: v })}>
                    <SelectTrigger><SelectValue placeholder={t('selectUnit')} /></SelectTrigger>
                    <SelectContent>
                      {unitOptions.map(u => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.unitNumber} - {isAr && u.property.nameAr ? u.property.nameAr : u.property.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('startDate')}</Label>
                  <Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{t('endDate')}</Label>
                  <Input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t('rentAmount')}</Label>
                  <Input type="number" value={form.rentAmount} onChange={e => setForm({ ...form, rentAmount: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{t('deposit')}</Label>
                  <Input type="number" value={form.deposit} onChange={e => setForm({ ...form, deposit: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{t('status')}</Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">{t('active')}</SelectItem>
                      <SelectItem value="expired">{t('expired')}</SelectItem>
                      <SelectItem value="terminated">{t('terminated')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{tc('cancel')}</Button>
              <Button onClick={handleSubmit} disabled={submitting || !form.unitId || !form.tenantId || !form.startDate || !form.endDate || !form.rentAmount}>
                {submitting ? tc('loading') : tc('save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tc('confirmDeleteTitle')}</AlertDialogTitle>
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

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="hover:shadow-md transition-shadow cursor-default">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('activeLeases')}</p>
                    <AnimatedCounter value={stats.activeLeases} className="text-2xl font-bold mt-1" />
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30"><FileCheck className="h-5 w-5 text-emerald-600" /></div>
                </div>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent>{t('basedOnActiveLeases', { count: stats.activeLeases })}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="hover:shadow-md transition-shadow cursor-default">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('expiringSoon')}</p>
                    <AnimatedCounter value={stats.expiringSoon} className="text-2xl font-bold mt-1" />
                  </div>
                  <div className="p-3 rounded-xl bg-yellow-50 dark:bg-yellow-950/30"><Clock className="h-5 w-5 text-yellow-600" /></div>
                </div>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent>{t('expiringWithin30Days')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="hover:shadow-md transition-shadow cursor-default">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('totalMonthlyRevenue')}</p>
                    <AnimatedCounter value={stats.totalMonthlyRevenue} prefix="$" className="text-2xl font-bold mt-1" />
                  </div>
                  <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/30"><DollarSign className="h-5 w-5 text-teal-600" /></div>
                </div>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent>{t('basedOnActiveLeases', { count: stats.activeLeases })}</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder={t('allStatuses')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allStatuses')}</SelectItem>
            <SelectItem value="active">{t('active')}</SelectItem>
            <SelectItem value="expired">{t('expired')}</SelectItem>
            <SelectItem value="terminated">{t('terminated')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-4">
          {/* Skeleton stat cards */}
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-7 w-16" />
                    </div>
                    <Skeleton className="h-11 w-11 rounded-xl" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {/* Skeleton table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
                    <TableHead key={i}><Skeleton className="h-4 w-16" /></TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1, 2, 3, 4, 5].map(row => (
                  <TableRow key={row}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-14" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-12 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-14" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : leases.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={t('title')}
          description={t('noLeasesDescription')}
          actionLabel={t('addLease')}
          onAction={handleOpenAdd}
        />
      ) : isMobile ? (
        <div className="grid gap-3">
          {leases.map(l => (
            <Card
              key={l.id}
              className="group hover:shadow-lg hover:scale-[1.01] transition-all duration-200"
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedIds.has(l.id)}
                      onCheckedChange={() => toggleSelect(l.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">
                      {isAr && l.tenant.nameAr ? l.tenant.nameAr : l.tenant.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge className={STATUS_COLORS[l.status] || DEFAULT_STATUS_COLOR}>
                      {getStatusLabel(l.status)}
                    </Badge>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={(e) => { e.stopPropagation(); handleOpenEdit(l); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{tc('edit')}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteId(l.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{tc('delete')}</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {l.unit.unitNumber} · {isAr && l.unit.property.nameAr ? l.unit.property.nameAr : l.unit.property.name}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span>{t('startDate')}: {new Date(l.startDate).toLocaleDateString()}</span>
                  <span>{t('endDate')}: {new Date(l.endDate).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{tc('currency')}{l.rentAmount.toLocaleString()}</span>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {l.deposit && <span>{tc('currency')}{l.deposit.toLocaleString()}</span>}
                    <Badge variant="secondary" className="font-normal">
                      {l._count.payments} {tc('results').toLowerCase()}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 backdrop-blur-sm sticky top-0">
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={selectedIds.size === leases.length && leases.length > 0}
                    onCheckedChange={(checked) => { if (checked) selectAll(); else clearSelection(); }}
                  />
                </TableHead>
                <TableHead>{t('tenant')}</TableHead>
                <TableHead>{t('unitProperty')}</TableHead>
                <TableHead>{t('startDate')}</TableHead>
                <TableHead>{t('endDate')}</TableHead>
                <TableHead>{t('rentAmount')}</TableHead>
                <TableHead>{t('deposit')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead>{tc('details')}</TableHead>
                <TableHead className="w-[80px]">{tc('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leases.map((l, idx) => (
                <TableRow key={l.id} className={`hover:bg-muted/50 ${idx % 2 === 1 ? 'bg-muted/20' : ''} ${selectedIds.has(l.id) ? 'bg-primary/5' : ''}`}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(l.id)}
                      onCheckedChange={() => toggleSelect(l.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {isAr && l.tenant.nameAr ? l.tenant.nameAr : l.tenant.name}
                  </TableCell>
                  <TableCell>
                    {l.unit.unitNumber} · {isAr && l.unit.property.nameAr ? l.unit.property.nameAr : l.unit.property.name}
                  </TableCell>
                  <TableCell>{new Date(l.startDate).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(l.endDate).toLocaleDateString()}</TableCell>
                  <TableCell>{tc('currency')}{l.rentAmount.toLocaleString()}</TableCell>
                  <TableCell>{l.deposit ? `${tc('currency')}${l.deposit.toLocaleString()}` : '-'}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[l.status] || DEFAULT_STATUS_COLOR}>
                      {getStatusLabel(l.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    <Badge variant="secondary" className="font-normal">
                      {l._count.payments} {tc('results').toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-0.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleOpenEdit(l)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{tc('edit')}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive" onClick={() => setDeleteId(l.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{tc('delete')}</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedIds.size}
        totalCount={leases.length}
        onSelectAll={selectAll}
        onClearSelection={clearSelection}
        onDelete={() => setBulkDeleteOpen(true)}
        onExport={handleBulkExport}
        onChangeStatus={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                <ChevronDown className="h-3.5 w-3.5" />
                {tc('changeStatus')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleBulkChangeStatus('active')}>{t('active')}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkChangeStatus('expired')}>{t('expired')}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkChangeStatus('terminated')}>{t('terminated')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tc('confirmDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tc('confirmBulkDelete', { count: selectedIds.size })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {tc('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

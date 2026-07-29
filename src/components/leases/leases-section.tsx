'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  ChevronDown,
  Clock,
  DollarSign,
  Download,
  FileCheck,
  FileText,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { BulkActionsBar } from '@/components/ui/bulk-actions-bar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import EmptyState from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DEFAULT_STATUS_COLOR, STATUS_COLORS } from '@/lib/status-config';
import { useRouteIntent } from '@/lib/route-intent';

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
  status: string;
  property: { name: string; nameAr: string | null };
}

interface TenantOption {
  id: string;
  name: string;
  nameAr: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const emptyForm = {
  unitId: '',
  tenantId: '',
  startDate: '',
  endDate: '',
  rentAmount: '',
  deposit: '',
  status: 'active',
};

async function responseError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null);
  return typeof payload?.error === 'string' ? payload.error : fallback;
}

export default function LeasesSection() {
  const t = useTranslations('leases');
  const tc = useTranslations('common');
  const locale = useLocale();
  const isAr = locale === 'ar';
  const localeCode = isAr ? 'ar-IQ' : 'en-US';

  const [leases, setLeases] = useState<Lease[]>([]);
  const [stats, setStats] = useState({ activeLeases: 0, expiringSoon: 0, totalMonthlyRevenue: 0 });
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [unitOptions, setUnitOptions] = useState<UnitOption[]>([]);
  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const currency = useMemo(
    () => new Intl.NumberFormat(localeCode, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }),
    [localeCode],
  );
  const formatCurrency = useCallback((value: number) => currency.format(value || 0), [currency]);
  const formatDate = useCallback((value: string) => new Date(value).toLocaleDateString(localeCode), [localeCode]);

  const loadLeases = useCallback(
    async (page = pagination.page) => {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ page: String(page), limit: String(pagination.limit) });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      try {
        const response = await fetch(`/api/leases?${params.toString()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(await responseError(response, tc('error')));
        const payload = await response.json();
        setLeases(Array.isArray(payload.data) ? payload.data : []);
        setStats(payload.stats || { activeLeases: 0, expiringSoon: 0, totalMonthlyRevenue: 0 });
        setPagination(payload.pagination || { page, limit: pagination.limit, total: 0, totalPages: 1 });
        setSelectedIds(new Set());
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : tc('error');
        setError(message);
        setLeases([]);
      } finally {
        setLoading(false);
      }
    },
    [pagination.limit, pagination.page, statusFilter, tc],
  );

  useEffect(() => {
    void loadLeases(1);
  }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/units?limit=200', { cache: 'no-store' }).then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response, tc('error')));
        return response.json();
      }),
      fetch('/api/tenants?limit=200&status=active', { cache: 'no-store' }).then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response, tc('error')));
        return response.json();
      }),
    ])
      .then(([unitsPayload, tenantsPayload]) => {
        if (cancelled) return;
        setUnitOptions(Array.isArray(unitsPayload.data) ? unitsPayload.data : []);
        setTenantOptions(Array.isArray(tenantsPayload.data) ? tenantsPayload.data : []);
      })
      .catch((loadError) => {
        if (!cancelled) toast.error(loadError instanceof Error ? loadError.message : tc('error'));
      });
    return () => {
      cancelled = true;
    };
  }, [tc]);

  const statusLabel = useCallback(
    (status: string) => {
      const labels: Record<string, string> = {
        active: t('active'),
        expired: t('expired'),
        terminated: t('terminated'),
      };
      return labels[status] || status;
    },
    [t],
  );

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (lease: Lease) => {
    setEditingId(lease.id);
    setForm({
      unitId: lease.unit.id,
      tenantId: lease.tenant.id,
      startDate: lease.startDate.split('T')[0],
      endDate: lease.endDate.split('T')[0],
      rentAmount: String(lease.rentAmount),
      deposit: lease.deposit == null ? '' : String(lease.deposit),
      status: lease.status,
    });
    setDialogOpen(true);
  };

  const openLeaseRecord = async (leaseId: string) => {
    try {
      const response = await fetch(`/api/leases?id=${encodeURIComponent(leaseId)}&limit=1`, { cache: 'no-store' });
      if (!response.ok) throw new Error(await responseError(response, tc('error')));
      const payload = await response.json();
      const lease = Array.isArray(payload.data) ? payload.data[0] : null;
      if (!lease) throw new Error(isAr ? 'لم يتم العثور على عقد الإيجار.' : 'Lease not found.');
      openEdit(lease);
    } catch (recordError) {
      toast.error(recordError instanceof Error ? recordError.message : tc('error'));
    }
  };

  useRouteIntent({ section: 'leases', onAdd: openAdd, onRecord: openLeaseRecord });

  const handleSubmit = async () => {
    const rentAmount = Number.parseFloat(form.rentAmount);
    const deposit = form.deposit ? Number.parseFloat(form.deposit) : null;
    if (!Number.isFinite(rentAmount) || rentAmount < 0) {
      toast.error(isAr ? 'أدخل مبلغ إيجار صحيحاً.' : 'Enter a valid rent amount.');
      return;
    }
    if (form.endDate <= form.startDate) {
      toast.error(isAr ? 'يجب أن يكون تاريخ النهاية بعد تاريخ البداية.' : 'The end date must be after the start date.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        unitId: form.unitId,
        tenantId: form.tenantId,
        startDate: form.startDate,
        endDate: form.endDate,
        rentAmount,
        deposit: deposit !== null && Number.isFinite(deposit) ? deposit : null,
        status: form.status,
      };
      const response = await fetch('/api/leases', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
      });
      if (!response.ok) throw new Error(await responseError(response, tc('error')));
      toast.success(editingId ? tc('updatedSuccessfully') : tc('createdSuccessfully'));
      setDialogOpen(false);
      setEditingId(null);
      setForm({ ...emptyForm });
      await loadLeases();
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : tc('error'));
    } finally {
      setSubmitting(false);
    }
  };

  const deleteLease = async () => {
    if (!deleteId) return;
    try {
      const response = await fetch(`/api/leases?id=${encodeURIComponent(deleteId)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await responseError(response, tc('error')));
      toast.success(tc('deletedSuccessfully'));
      await loadLeases();
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : tc('error'));
    } finally {
      setDeleteId(null);
    }
  };

  const runBulk = async (requests: Promise<Response>[], successLabel: string) => {
    const responses = await Promise.all(requests);
    const succeeded = responses.filter((response) => response.ok).length;
    const failed = responses.length - succeeded;
    if (succeeded) toast.success(`${succeeded} ${successLabel}`);
    if (failed) {
      const firstFailure = responses.find((response) => !response.ok);
      toast.error(`${failed} ${isAr ? 'فشلت' : 'failed'}: ${firstFailure ? await responseError(firstFailure, tc('error')) : tc('error')}`);
    }
  };

  const bulkDelete = async () => {
    try {
      await runBulk(
        Array.from(selectedIds, (id) => fetch(`/api/leases?id=${encodeURIComponent(id)}`, { method: 'DELETE' })),
        tc('deletedSuccessfully'),
      );
      setBulkDeleteOpen(false);
      await loadLeases();
    } catch {
      toast.error(tc('error'));
    }
  };

  const bulkStatus = async (status: string) => {
    try {
      await runBulk(
        Array.from(selectedIds, (id) =>
          fetch('/api/leases', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status }),
          }),
        ),
        tc('updatedSuccessfully'),
      );
      await loadLeases();
    } catch {
      toast.error(tc('error'));
    }
  };

  const exportRows = (rowsToExport: Lease[], filename: string) => {
    const headers = isAr
      ? ['المستأجر', 'العقار / الوحدة', 'البداية', 'النهاية', 'الإيجار', 'التأمين', 'الحالة']
      : ['Tenant', 'Property / Unit', 'Start date', 'End date', 'Rent', 'Deposit', 'Status'];
    const rows = rowsToExport.map((lease) => [
      isAr && lease.tenant.nameAr ? lease.tenant.nameAr : lease.tenant.name,
      `${lease.unit.unitNumber} - ${isAr && lease.unit.property.nameAr ? lease.unit.property.nameAr : lease.unit.property.name}`,
      formatDate(lease.startDate),
      formatDate(lease.endDate),
      String(lease.rentAmount),
      lease.deposit == null ? '' : String(lease.deposit),
      statusLabel(lease.status),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelectedIds(new Set(leases.map((lease) => lease.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const selectableUnits = unitOptions.filter(
    (unit) => unit.status === 'available' || unit.id === form.unitId || form.status !== 'active',
  );

  const cards = [
    { title: t('activeLeases'), value: String(stats.activeLeases), icon: FileCheck, tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
    { title: t('expiringSoon'), value: String(stats.expiringSoon), icon: Clock, tone: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
    { title: t('totalMonthlyRevenue'), value: formatCurrency(stats.totalMonthlyRevenue), icon: DollarSign, tone: 'text-teal-600 bg-teal-50 dark:bg-teal-950/30' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          {pagination.total > 0 && <Badge variant="secondary">{pagination.total}</Badge>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!leases.length} onClick={() => exportRows(leases, 'leases.csv')}><Download className="me-2 h-4 w-4" />{tc('exportCsv')}</Button>
          <Button onClick={openAdd}><Plus className="me-2 h-4 w-4" />{t('addLease')}</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map(({ title, value, icon: Icon, tone }) => (
          <Card key={title}><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-muted-foreground">{title}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div><div className={`rounded-xl p-3 ${tone}`}><Icon className="h-5 w-5" /></div></CardContent></Card>
        ))}
      </div>

      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder={t('allStatuses')} /></SelectTrigger>
        <SelectContent><SelectItem value="all">{t('allStatuses')}</SelectItem><SelectItem value="active">{t('active')}</SelectItem><SelectItem value="expired">{t('expired')}</SelectItem><SelectItem value="terminated">{t('terminated')}</SelectItem></SelectContent>
      </Select>

      {error && <div role="alert" className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"><span className="text-sm text-destructive">{error}</span><Button variant="outline" size="sm" onClick={() => void loadLeases()}>{tc('refresh')}</Button></div>}

      {loading ? (
        <div className="space-y-3">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-16 w-full" />)}</div>
      ) : !leases.length ? (
        <EmptyState icon={FileText} title={t('title')} description={t('noLeasesDescription')} actionLabel={t('addLease')} onAction={openAdd} />
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {leases.map((lease) => (
              <Card key={lease.id}><CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><Checkbox checked={selectedIds.has(lease.id)} onCheckedChange={() => toggleSelected(lease.id)} aria-label={tc('selected')} /><div className="min-w-0"><p className="truncate font-semibold">{isAr && lease.tenant.nameAr ? lease.tenant.nameAr : lease.tenant.name}</p><p className="truncate text-xs text-muted-foreground">{lease.unit.unitNumber} · {isAr && lease.unit.property.nameAr ? lease.unit.property.nameAr : lease.unit.property.name}</p></div></div><Badge className={STATUS_COLORS[lease.status] || DEFAULT_STATUS_COLOR}>{statusLabel(lease.status)}</Badge></div>
                <div className="grid grid-cols-2 gap-2 text-sm"><div><span className="text-muted-foreground">{t('rentAmount')}</span><p className="font-medium">{formatCurrency(lease.rentAmount)}</p></div><div><span className="text-muted-foreground">{t('endDate')}</span><p>{formatDate(lease.endDate)}</p></div></div>
                <div className="flex items-center justify-between border-t pt-2"><span className="text-xs text-muted-foreground">{lease._count.payments} {tc('results').toLowerCase()}</span><div className="flex gap-1"><Button variant="ghost" size="icon" aria-label={tc('edit')} onClick={() => openEdit(lease)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="text-destructive" aria-label={tc('delete')} onClick={() => setDeleteId(lease.id)}><Trash2 className="h-4 w-4" /></Button></div></div>
              </CardContent></Card>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <Table><TableHeader><TableRow className="bg-muted/50"><TableHead className="w-10"><Checkbox checked={selectedIds.size === leases.length} onCheckedChange={(checked) => checked ? selectAll() : clearSelection()} aria-label={tc('selectAll')} /></TableHead><TableHead>{t('tenant')}</TableHead><TableHead>{t('unitProperty')}</TableHead><TableHead>{t('startDate')}</TableHead><TableHead>{t('endDate')}</TableHead><TableHead>{t('rentAmount')}</TableHead><TableHead>{t('deposit')}</TableHead><TableHead>{t('status')}</TableHead><TableHead>{tc('details')}</TableHead><TableHead className="w-20">{tc('actions')}</TableHead></TableRow></TableHeader>
              <TableBody>{leases.map((lease) => <TableRow key={lease.id} className={selectedIds.has(lease.id) ? 'bg-primary/5' : ''}><TableCell><Checkbox checked={selectedIds.has(lease.id)} onCheckedChange={() => toggleSelected(lease.id)} aria-label={tc('selected')} /></TableCell><TableCell className="font-medium">{isAr && lease.tenant.nameAr ? lease.tenant.nameAr : lease.tenant.name}</TableCell><TableCell>{lease.unit.unitNumber} · {isAr && lease.unit.property.nameAr ? lease.unit.property.nameAr : lease.unit.property.name}</TableCell><TableCell>{formatDate(lease.startDate)}</TableCell><TableCell>{formatDate(lease.endDate)}</TableCell><TableCell>{formatCurrency(lease.rentAmount)}</TableCell><TableCell>{lease.deposit == null ? '—' : formatCurrency(lease.deposit)}</TableCell><TableCell><Badge className={STATUS_COLORS[lease.status] || DEFAULT_STATUS_COLOR}>{statusLabel(lease.status)}</Badge></TableCell><TableCell><Badge variant="secondary">{lease._count.payments}</Badge></TableCell><TableCell><div className="flex gap-1"><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" aria-label={tc('edit')} onClick={() => openEdit(lease)}><Pencil className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>{tc('edit')}</TooltipContent></Tooltip><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="text-destructive" aria-label={tc('delete')} onClick={() => setDeleteId(lease.id)}><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>{tc('delete')}</TooltipContent></Tooltip></div></TableCell></TableRow>)}</TableBody>
            </Table>
          </div>

          {pagination.totalPages > 1 && <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{tc('showing')} {leases.length} {tc('of')} {pagination.total}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => void loadLeases(pagination.page - 1)}>{tc('previous')}</Button><Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => void loadLeases(pagination.page + 1)}>{tc('next')}</Button></div></div>}
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto"><DialogHeader><DialogTitle>{editingId ? t('editLease') : t('addLease')}</DialogTitle></DialogHeader><div className="grid gap-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>{t('tenant')}</Label><Select value={form.tenantId} onValueChange={(value) => setForm((current) => ({ ...current, tenantId: value }))}><SelectTrigger><SelectValue placeholder={t('selectTenant')} /></SelectTrigger><SelectContent>{tenantOptions.map((tenant) => <SelectItem key={tenant.id} value={tenant.id}>{isAr && tenant.nameAr ? tenant.nameAr : tenant.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>{t('unit')}</Label><Select value={form.unitId} onValueChange={(value) => setForm((current) => ({ ...current, unitId: value }))}><SelectTrigger><SelectValue placeholder={t('selectUnit')} /></SelectTrigger><SelectContent>{selectableUnits.map((unit) => <SelectItem key={unit.id} value={unit.id}>{unit.unitNumber} · {isAr && unit.property.nameAr ? unit.property.nameAr : unit.property.name}</SelectItem>)}</SelectContent></Select></div></div>
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>{t('startDate')}</Label><Input type="date" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} /></div><div className="space-y-2"><Label>{t('endDate')}</Label><Input type="date" value={form.endDate} onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))} /></div></div>
          <div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>{t('rentAmount')}</Label><Input type="number" min="0" step="0.01" value={form.rentAmount} onChange={(event) => setForm((current) => ({ ...current, rentAmount: event.target.value }))} /></div><div className="space-y-2"><Label>{t('deposit')}</Label><Input type="number" min="0" step="0.01" value={form.deposit} onChange={(event) => setForm((current) => ({ ...current, deposit: event.target.value }))} /></div><div className="space-y-2"><Label>{t('status')}</Label><Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">{t('active')}</SelectItem><SelectItem value="expired">{t('expired')}</SelectItem><SelectItem value="terminated">{t('terminated')}</SelectItem></SelectContent></Select></div></div>
        </div><DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>{tc('cancel')}</Button><Button onClick={() => void handleSubmit()} disabled={submitting || !form.unitId || !form.tenantId || !form.startDate || !form.endDate || !form.rentAmount}>{submitting ? tc('loading') : tc('save')}</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{tc('confirmDeleteTitle')}</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">{t('confirmDelete')}</p><DialogFooter><Button variant="outline" onClick={() => setDeleteId(null)}>{tc('cancel')}</Button><Button variant="destructive" onClick={() => void deleteLease()}>{tc('delete')}</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{tc('confirmDeleteTitle')}</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">{tc('confirmBulkDelete', { count: selectedIds.size })}</p><DialogFooter><Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>{tc('cancel')}</Button><Button variant="destructive" onClick={() => void bulkDelete()}>{tc('delete')}</Button></DialogFooter></DialogContent></Dialog>

      <BulkActionsBar
        selectedCount={selectedIds.size}
        totalCount={leases.length}
        onSelectAll={selectAll}
        onClearSelection={clearSelection}
        onDelete={() => setBulkDeleteOpen(true)}
        onExport={() => exportRows(leases.filter((lease) => selectedIds.has(lease.id)), 'leases-selected.csv')}
        onChangeStatus={<DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"><ChevronDown className="h-3.5 w-3.5" />{tc('changeStatus')}</Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onClick={() => void bulkStatus('active')}>{t('active')}</DropdownMenuItem><DropdownMenuItem onClick={() => void bulkStatus('expired')}>{t('expired')}</DropdownMenuItem><DropdownMenuItem onClick={() => void bulkStatus('terminated')}>{t('terminated')}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}
      />
    </div>
  );
}

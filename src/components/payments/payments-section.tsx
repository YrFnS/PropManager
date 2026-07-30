'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  AlertTriangle,
  Clock,
  CreditCard,
  DollarSign,
  Download,
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
import EmptyState from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PaymentReceipt from '@/components/payments/payment-receipt';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DEFAULT_STATUS_COLOR, STATUS_COLORS } from '@/lib/status-config';
import { useRouteIntent } from '@/lib/route-intent';
import { useOrganizationFormat } from '@/hooks/use-organization-format';

interface Payment {
  id: string;
  amount: number;
  dueDate: string;
  paidDate: string | null;
  status: string;
  method: string | null;
  reference: string | null;
  notes: string | null;
  tenant: { id: string; name: string; nameAr: string | null; email?: string };
  lease: {
    id: string;
    unit: { unitNumber: string; property: { name: string; nameAr: string | null } };
  };
}

interface LeaseOption {
  id: string;
  tenant: { id: string; name: string; nameAr: string | null };
  unit: { unitNumber: string; property: { name: string; nameAr: string | null } };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const emptyForm = {
  leaseId: '',
  tenantId: '',
  amount: '',
  dueDate: '',
  paidDate: '',
  status: 'pending',
  method: '',
  reference: '',
  notes: '',
};

async function readResponseError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null);
  return typeof payload?.error === 'string' ? payload.error : fallback;
}

export default function PaymentsSection() {
  const t = useTranslations('payments');
  const tc = useTranslations('common');
  const locale = useLocale();
  const isAr = locale === 'ar';
  const { formatCurrency, formatDate } = useOrganizationFormat();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState({ totalCollected: 0, totalPending: 0, totalLate: 0 });
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [leaseOptions, setLeaseOptions] = useState<LeaseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const loadPayments = useCallback(
    async (page = pagination.page) => {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ page: String(page), limit: String(pagination.limit) });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (methodFilter !== 'all') params.set('method', methodFilter);

      try {
        const response = await fetch(`/api/payments?${params.toString()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(await readResponseError(response, tc('error')));
        const payload = await response.json();
        setPayments(Array.isArray(payload.data) ? payload.data : []);
        setStats(payload.stats || { totalCollected: 0, totalPending: 0, totalLate: 0 });
        setPagination(payload.pagination || { page, limit: pagination.limit, total: 0, totalPages: 1 });
        setSelectedIds(new Set());
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : tc('error');
        setError(message);
        setPayments([]);
      } finally {
        setLoading(false);
      }
    },
    [methodFilter, pagination.limit, pagination.page, statusFilter, tc],
  );

  useEffect(() => {
    void loadPayments(1);
  }, [statusFilter, methodFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    fetch('/api/leases?limit=200', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readResponseError(response, tc('error')));
        return response.json();
      })
      .then((payload) => {
        if (!cancelled) setLeaseOptions(Array.isArray(payload.data) ? payload.data : []);
      })
      .catch((loadError) => {
        if (!cancelled) toast.error(loadError instanceof Error ? loadError.message : tc('error'));
      });
    return () => {
      cancelled = true;
    };
  }, [tc]);

  const getStatusLabel = useCallback(
    (status: string) => {
      const labels: Record<string, string> = {
        paid: t('paid'),
        pending: t('pending'),
        late: t('late'),
        partial: t('partial'),
      };
      return labels[status] || status;
    },
    [t],
  );

  const getMethodLabel = useCallback(
    (method: string) => {
      const labels: Record<string, string> = {
        cash: t('cash'),
        bank_transfer: t('bankTransfer'),
        online: t('online'),
        check: t('check'),
      };
      return labels[method] || method;
    },
    [t],
  );

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (payment: Payment) => {
    setEditingId(payment.id);
    setForm({
      leaseId: payment.lease?.id || '',
      tenantId: payment.tenant?.id || '',
      amount: String(payment.amount),
      dueDate: payment.dueDate.split('T')[0],
      paidDate: payment.paidDate ? payment.paidDate.split('T')[0] : '',
      status: payment.status,
      method: payment.method || '',
      reference: payment.reference || '',
      notes: payment.notes || '',
    });
    setDialogOpen(true);
  };

  const openPaymentRecord = async (paymentId: string) => {
    try {
      const response = await fetch(`/api/payments?id=${encodeURIComponent(paymentId)}&limit=1`, { cache: 'no-store' });
      if (!response.ok) throw new Error(await readResponseError(response, tc('error')));
      const payload = await response.json();
      const payment = Array.isArray(payload.data) ? payload.data[0] : null;
      if (!payment) throw new Error(isAr ? 'لم يتم العثور على الدفعة.' : 'Payment not found.');
      setSelectedPayment(payment);
      setReceiptOpen(true);
    } catch (recordError) {
      toast.error(recordError instanceof Error ? recordError.message : tc('error'));
    }
  };

  useRouteIntent({ section: 'payments', onAdd: openAdd, onRecord: openPaymentRecord });

  const handleSubmit = async () => {
    const amount = Number.parseFloat(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error(isAr ? 'أدخل مبلغاً صحيحاً أكبر من صفر.' : 'Enter a valid amount greater than zero.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        leaseId: form.leaseId,
        tenantId: form.tenantId,
        amount,
        dueDate: form.dueDate,
        paidDate: form.paidDate || null,
        status: form.status,
        method: form.method || null,
        reference: form.reference || null,
        notes: form.notes || null,
      };
      const response = await fetch('/api/payments', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
      });
      if (!response.ok) throw new Error(await readResponseError(response, tc('error')));

      toast.success(editingId ? tc('updatedSuccessfully') : tc('createdSuccessfully'));
      setDialogOpen(false);
      setEditingId(null);
      setForm({ ...emptyForm });
      await loadPayments();
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : tc('error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const response = await fetch(`/api/payments?id=${encodeURIComponent(deleteId)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await readResponseError(response, tc('error')));
      toast.success(tc('deletedSuccessfully'));
      await loadPayments();
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : tc('error'));
    } finally {
      setDeleteId(null);
    }
  };

  const runBulkRequests = async (requests: Promise<Response>[], successLabel: string) => {
    const responses = await Promise.all(requests);
    const succeeded = responses.filter((response) => response.ok).length;
    const failed = responses.length - succeeded;
    if (succeeded > 0) toast.success(`${succeeded} ${successLabel}`);
    if (failed > 0) {
      const firstFailure = responses.find((response) => !response.ok);
      const message = firstFailure ? await readResponseError(firstFailure, tc('error')) : tc('error');
      toast.error(`${failed} ${isAr ? 'فشلت' : 'failed'}: ${message}`);
    }
    return { succeeded, failed };
  };

  const handleBulkDelete = async () => {
    try {
      await runBulkRequests(
        Array.from(selectedIds, (id) => fetch(`/api/payments?id=${encodeURIComponent(id)}`, { method: 'DELETE' })),
        tc('deletedSuccessfully'),
      );
      setBulkDeleteOpen(false);
      await loadPayments();
    } catch {
      toast.error(tc('error'));
    }
  };

  const handleBulkMarkPaid = async () => {
    const eligibleIds = payments
      .filter((payment) => selectedIds.has(payment.id) && (payment.status === 'pending' || payment.status === 'late'))
      .map((payment) => payment.id);
    const skipped = selectedIds.size - eligibleIds.length;

    if (!eligibleIds.length) {
      toast.error(isAr ? 'حدد دفعات معلقة أو متأخرة.' : 'Select pending or late payments.');
      return;
    }

    try {
      await runBulkRequests(
        eligibleIds.map((id) =>
          fetch('/api/payments', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status: 'paid', paidDate: new Date().toISOString().split('T')[0] }),
          }),
        ),
        tc('updatedSuccessfully'),
      );
      if (skipped > 0) {
        toast.error(isAr ? `تم تجاوز ${skipped} دفعات مدفوعة أو جزئية.` : `${skipped} paid or partial payments were skipped.`);
      }
      await loadPayments();
    } catch {
      toast.error(tc('error'));
    }
  };

  const exportRows = (rowsToExport: Payment[], filename: string) => {
    const headers = isAr
      ? ['المستأجر', 'العقار / الوحدة', 'المبلغ', 'تاريخ الاستحقاق', 'تاريخ الدفع', 'الطريقة', 'الحالة']
      : ['Tenant', 'Property / Unit', 'Amount', 'Due date', 'Paid date', 'Method', 'Status'];
    const rows = rowsToExport.map((payment) => [
      isAr && payment.tenant.nameAr ? payment.tenant.nameAr : payment.tenant.name,
      `${payment.lease.unit.unitNumber} - ${isAr && payment.lease.unit.property.nameAr ? payment.lease.unit.property.nameAr : payment.lease.unit.property.name}`,
      String(payment.amount),
      formatDate(payment.dueDate),
      formatDate(payment.paidDate),
      payment.method ? getMethodLabel(payment.method) : '',
      getStatusLabel(payment.status),
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

  const selectAll = () => setSelectedIds(new Set(payments.map((payment) => payment.id)));
  const clearSelection = () => setSelectedIds(new Set());
  const selectedLease = leaseOptions.find((lease) => lease.id === form.leaseId);
  const partialHint = isAr
    ? 'عند اختيار دفع جزئي، أدخل المبلغ المستلم فعلياً.'
    : 'For a partial payment, enter the amount actually received.';

  const statCards = [
    { title: t('totalCollected'), value: stats.totalCollected, icon: DollarSign, tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
    { title: t('totalPending'), value: stats.totalPending, icon: Clock, tone: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
    { title: t('totalLate'), value: stats.totalLate, icon: AlertTriangle, tone: 'text-red-600 bg-red-50 dark:bg-red-950/30' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          {pagination.total > 0 && <Badge variant="secondary">{pagination.total}</Badge>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => exportRows(payments, 'payments.csv')} disabled={payments.length === 0}>
            <Download className="me-2 h-4 w-4" />
            {tc('exportCsv')}
          </Button>
          <Button onClick={openAdd}>
            <Plus className="me-2 h-4 w-4" />
            {t('addPayment')}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {statCards.map(({ title, value, icon: Icon, tone }) => (
          <Card key={title}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-sm text-muted-foreground">{title}</p>
                <p className="mt-1 text-2xl font-semibold">{formatCurrency(value)}</p>
              </div>
              <div className={`rounded-xl p-3 ${tone}`}><Icon className="h-5 w-5" /></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder={tc('status')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tc('all')}</SelectItem>
            <SelectItem value="paid">{t('paid')}</SelectItem>
            <SelectItem value="pending">{t('pending')}</SelectItem>
            <SelectItem value="late">{t('late')}</SelectItem>
            <SelectItem value="partial">{t('partial')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder={t('method')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tc('all')}</SelectItem>
            <SelectItem value="cash">{t('cash')}</SelectItem>
            <SelectItem value="bank_transfer">{t('bankTransfer')}</SelectItem>
            <SelectItem value="online">{t('online')}</SelectItem>
            <SelectItem value="check">{t('check')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div role="alert" className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-destructive">{error}</span>
          <Button variant="outline" size="sm" onClick={() => void loadPayments()}>{tc('refresh')}</Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-16 w-full" />)}
        </div>
      ) : payments.length === 0 ? (
        <EmptyState icon={CreditCard} title={t('title')} description={t('noPaymentsDescription')} actionLabel={t('addPayment')} onAction={openAdd} />
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {payments.map((payment) => (
              <Card key={payment.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <Checkbox checked={selectedIds.has(payment.id)} onCheckedChange={() => toggleSelected(payment.id)} aria-label={tc('selected')} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{isAr && payment.tenant.nameAr ? payment.tenant.nameAr : payment.tenant.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{payment.lease.unit.unitNumber} · {isAr && payment.lease.unit.property.nameAr ? payment.lease.unit.property.nameAr : payment.lease.unit.property.name}</p>
                      </div>
                    </div>
                    <Badge className={STATUS_COLORS[payment.status] || DEFAULT_STATUS_COLOR}>{getStatusLabel(payment.status)}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">{t('amount')}</span><p className="font-medium">{formatCurrency(payment.amount)}</p></div>
                    <div><span className="text-muted-foreground">{t('dueDate')}</span><p>{formatDate(payment.dueDate)}</p></div>
                  </div>
                  <div className="flex justify-end gap-1 border-t pt-2">
                    <Button variant="ghost" size="icon" aria-label={t('receipt')} onClick={() => { setSelectedPayment(payment); setReceiptOpen(true); }}><FileText className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label={tc('edit')} onClick={() => openEdit(payment)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive" aria-label={tc('delete')} onClick={() => setDeleteId(payment.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-10"><Checkbox checked={selectedIds.size === payments.length} onCheckedChange={(checked) => checked ? selectAll() : clearSelection()} aria-label={tc('selectAll')} /></TableHead>
                  <TableHead>{t('tenant')}</TableHead>
                  <TableHead>{t('propertyUnit')}</TableHead>
                  <TableHead>{t('amount')}</TableHead>
                  <TableHead>{t('dueDate')}</TableHead>
                  <TableHead>{t('paidDate')}</TableHead>
                  <TableHead>{t('method')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead className="w-28">{tc('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id} className={selectedIds.has(payment.id) ? 'bg-primary/5' : ''}>
                    <TableCell><Checkbox checked={selectedIds.has(payment.id)} onCheckedChange={() => toggleSelected(payment.id)} aria-label={tc('selected')} /></TableCell>
                    <TableCell className="font-medium">{isAr && payment.tenant.nameAr ? payment.tenant.nameAr : payment.tenant.name}</TableCell>
                    <TableCell>{payment.lease.unit.unitNumber} · {isAr && payment.lease.unit.property.nameAr ? payment.lease.unit.property.nameAr : payment.lease.unit.property.name}</TableCell>
                    <TableCell>{formatCurrency(payment.amount)}</TableCell>
                    <TableCell>{formatDate(payment.dueDate)}</TableCell>
                    <TableCell>{formatDate(payment.paidDate)}</TableCell>
                    <TableCell>{payment.method ? getMethodLabel(payment.method) : '—'}</TableCell>
                    <TableCell><Badge className={STATUS_COLORS[payment.status] || DEFAULT_STATUS_COLOR}>{getStatusLabel(payment.status)}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" aria-label={t('receipt')} onClick={() => { setSelectedPayment(payment); setReceiptOpen(true); }}><FileText className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>{t('receipt')}</TooltipContent></Tooltip>
                        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" aria-label={tc('edit')} onClick={() => openEdit(payment)}><Pencil className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>{tc('edit')}</TooltipContent></Tooltip>
                        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="text-destructive" aria-label={tc('delete')} onClick={() => setDeleteId(payment.id)}><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>{tc('delete')}</TooltipContent></Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{tc('showing')} {payments.length} {tc('of')} {pagination.total}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => void loadPayments(pagination.page - 1)}>{tc('previous')}</Button>
                <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => void loadPayments(pagination.page + 1)}>{tc('next')}</Button>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? t('editPayment') : t('addPayment')}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>{t('selectLease')}</Label>
              <Select value={form.leaseId} onValueChange={(value) => {
                const lease = leaseOptions.find((option) => option.id === value);
                setForm((current) => ({ ...current, leaseId: value, tenantId: lease?.tenant.id || '' }));
              }}>
                <SelectTrigger><SelectValue placeholder={t('selectLease')} /></SelectTrigger>
                <SelectContent>{leaseOptions.map((lease) => <SelectItem key={lease.id} value={lease.id}>{isAr && lease.tenant.nameAr ? lease.tenant.nameAr : lease.tenant.name} · {lease.unit.unitNumber}</SelectItem>)}</SelectContent>
              </Select>
              {selectedLease && <p className="text-xs text-muted-foreground">{isAr && selectedLease.unit.property.nameAr ? selectedLease.unit.property.nameAr : selectedLease.unit.property.name}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>{t('amount')}</Label><Input type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} /></div>
              <div className="space-y-2"><Label>{t('dueDate')}</Label><Input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} /></div>
            </div>
            {form.status === 'partial' && <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">{partialHint}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>{t('paidDate')}</Label><Input type="date" value={form.paidDate} onChange={(event) => setForm((current) => ({ ...current, paidDate: event.target.value }))} /></div>
              <div className="space-y-2">
                <Label>{t('status')}</Label>
                <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="pending">{t('pending')}</SelectItem><SelectItem value="paid">{t('paid')}</SelectItem><SelectItem value="late">{t('late')}</SelectItem><SelectItem value="partial">{t('partial')}</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('method')}</Label>
                <Select value={form.method} onValueChange={(value) => setForm((current) => ({ ...current, method: value }))}>
                  <SelectTrigger><SelectValue placeholder={t('selectMethod')} /></SelectTrigger>
                  <SelectContent><SelectItem value="cash">{t('cash')}</SelectItem><SelectItem value="bank_transfer">{t('bankTransfer')}</SelectItem><SelectItem value="online">{t('online')}</SelectItem><SelectItem value="check">{t('check')}</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>{t('reference')}</Label><Input value={form.reference} onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))} /></div>
            </div>
            <div className="space-y-2"><Label>{t('notes')}</Label><Textarea rows={3} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{tc('cancel')}</Button>
            <Button onClick={() => void handleSubmit()} disabled={submitting || !form.leaseId || !form.amount || !form.dueDate}>{submitting ? tc('loading') : tc('save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{tc('confirmDeleteTitle')}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t('confirmDelete')}</p>
          <DialogFooter><Button variant="outline" onClick={() => setDeleteId(null)}>{tc('cancel')}</Button><Button variant="destructive" onClick={() => void handleDelete()}>{tc('delete')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{tc('confirmDeleteTitle')}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{tc('confirmBulkDelete', { count: selectedIds.size })}</p>
          <DialogFooter><Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>{tc('cancel')}</Button><Button variant="destructive" onClick={() => void handleBulkDelete()}>{tc('delete')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkActionsBar
        selectedCount={selectedIds.size}
        totalCount={payments.length}
        onSelectAll={selectAll}
        onClearSelection={clearSelection}
        onDelete={() => setBulkDeleteOpen(true)}
        onExport={() => exportRows(payments.filter((payment) => selectedIds.has(payment.id)), 'payments-selected.csv')}
        onMarkPaid={() => void handleBulkMarkPaid()}
      />

      <PaymentReceipt open={receiptOpen} onOpenChange={setReceiptOpen} payment={selectedPayment} />
    </div>
  );
}

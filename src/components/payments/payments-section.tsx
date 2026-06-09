'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, CreditCard, DollarSign, Clock, AlertTriangle, Pencil, Trash2, Download, FileText } from 'lucide-react';
import EmptyState from '@/components/ui/empty-state';
import AnimatedCounter from '@/components/ui/animated-counter';
import PaymentReceipt from '@/components/payments/payment-receipt';
import { BulkActionsBar } from '@/components/ui/bulk-actions-bar';
import { STATUS_COLORS, DEFAULT_STATUS_COLOR } from '@/lib/status-config';
import { toast } from 'sonner';
import { useEffect, useState, useCallback } from 'react';

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

const emptyForm = {
  leaseId: '', tenantId: '', amount: '', dueDate: '', paidDate: '', status: 'pending', method: '', reference: '', notes: '',
};

export default function PaymentsSection() {
  const t = useTranslations('payments');
  const tc = useTranslations('common');
  const locale = useLocale();
  const isAr = locale === 'ar';

  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState({ totalCollected: 0, totalPending: 0, totalLate: 0 });
  const [leaseOptions, setLeaseOptions] = useState<LeaseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
    if (methodFilter && methodFilter !== 'all') params.set('method', methodFilter);
    try {
      const r = await fetch(`/api/payments?${params.toString()}`);
      const data = await r.json();
      const result = data.data || data;
      setPayments(result.payments || result || []);
      setStats(result.stats || data.stats || { totalCollected: 0, totalPending: 0, totalLate: 0 });
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [statusFilter, methodFilter]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadPayments(); }, [loadPayments]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/leases')
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const result = data.data || data;
        setLeaseOptions(result.leases || result || []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const handleOpenAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const handleOpenEdit = (payment: Payment) => {
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

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        leaseId: form.leaseId,
        tenantId: form.tenantId,
        amount: parseFloat(form.amount),
        dueDate: form.dueDate,
        paidDate: form.paidDate || null,
        status: form.status,
        method: form.method || null,
        reference: form.reference || null,
        notes: form.notes || null,
      };

      const res = editingId
        ? await fetch('/api/payments', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editingId, ...payload }),
          })
        : await fetch('/api/payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      if (res.ok) {
        setForm({ ...emptyForm });
        setEditingId(null);
        setDialogOpen(false);
        loadPayments();
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
      const res = await fetch(`/api/payments?id=${deleteId}`, { method: 'DELETE' });
      if (res.ok) {
        loadPayments();
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
      paid: t('paid'), pending: t('pending'), late: t('late'), partial: t('partial'),
    };
    return labels[status] || status;
  };

  const getMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      cash: t('cash'), bank_transfer: t('bankTransfer'), online: t('online'), check: t('check'),
    };
    return labels[method] || method;
  };

  const exportCsv = () => {
    const headers = ['Tenant', 'Property/Unit', 'Amount', 'Due Date', 'Paid Date', 'Method', 'Status'];
    const rows = payments.map(p => [
      isAr && p.tenant.nameAr ? p.tenant.nameAr : p.tenant.name,
      `${p.lease?.unit?.unitNumber || ''} - ${isAr && p.lease?.unit?.property?.nameAr ? p.lease.unit.property.nameAr : p.lease?.unit?.property?.name || ''}`,
      String(p.amount),
      p.dueDate ? new Date(p.dueDate).toLocaleDateString() : '',
      p.paidDate ? new Date(p.paidDate).toLocaleDateString() : '',
      p.method ? getMethodLabel(p.method) : '',
      getStatusLabel(p.status),
    ]);
    const csvContent = [headers, ...rows].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'payments.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const openReceipt = (payment: Payment) => {
    setSelectedPayment(payment);
    setReceiptOpen(true);
  };

  const selectedLease = leaseOptions.find(l => l.id === form.leaseId);

  const statCards = [
    { title: t('totalCollected'), value: stats.totalCollected, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30', tooltip: `${payments.filter(p => p.status === 'paid').length} ${t('paid').toLowerCase()}` },
    { title: t('totalPending'), value: stats.totalPending, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-950/30', tooltip: `${payments.filter(p => p.status === 'pending').length} ${t('pending').toLowerCase()}` },
    { title: t('totalLate'), value: stats.totalLate, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30', tooltip: `${payments.filter(p => p.status === 'late').length} ${t('late').toLowerCase()}` },
  ];

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
    setSelectedIds(new Set(payments.map(p => p.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    try {
      const promises = Array.from(selectedIds).map(id =>
        fetch(`/api/payments?id=${id}`, { method: 'DELETE' })
      );
      const results = await Promise.allSettled(promises);
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      toast.success(`${succeeded} ${tc('deletedSuccessfully')}`);
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      loadPayments();
    } catch {
      toast.error(tc('error'));
    }
  };

  const handleBulkMarkPaid = async () => {
    try {
      const promises = Array.from(selectedIds).map(id =>
        fetch('/api/payments', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status: 'paid', paidDate: new Date().toISOString().split('T')[0] }),
        })
      );
      const results = await Promise.allSettled(promises);
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      toast.success(`${succeeded} ${tc('updatedSuccessfully')}`);
      setSelectedIds(new Set());
      loadPayments();
    } catch {
      toast.error(tc('error'));
    }
  };

  const handleBulkExport = () => {
    const selectedPayments = payments.filter(p => selectedIds.has(p.id));
    const headers = ['Tenant', 'Property/Unit', 'Amount', 'Due Date', 'Paid Date', 'Method', 'Status'];
    const rows = selectedPayments.map(p => [
      isAr && p.tenant.nameAr ? p.tenant.nameAr : p.tenant.name,
      `${p.lease?.unit?.unitNumber || ''} - ${isAr && p.lease?.unit?.property?.nameAr ? p.lease.unit.property.nameAr : p.lease?.unit?.property?.name || ''}`,
      String(p.amount),
      p.dueDate ? new Date(p.dueDate).toLocaleDateString() : '',
      p.paidDate ? new Date(p.paidDate).toLocaleDateString() : '',
      p.method ? getMethodLabel(p.method) : '',
      getStatusLabel(p.status),
    ]);
    const csvContent = [headers, ...rows].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'payments.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight gradient-text">{t('title')}</h1>
          {payments.length > 0 && <Badge variant="secondary">{payments.length}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={payments.length === 0}><Download className="h-4 w-4 me-2" />{tc('exportCsv')}</Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenAdd}><Plus className="h-4 w-4 me-2" />{t('addPayment')}</Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? t('editPayment') : t('addPayment')}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>{t('selectLease')}</Label>
                <Select value={form.leaseId} onValueChange={v => {
                  const lease = leaseOptions.find(l => l.id === v);
                  setForm({ ...form, leaseId: v, tenantId: lease?.tenant?.id || '' });
                }}>
                  <SelectTrigger><SelectValue placeholder={t('selectLease')} /></SelectTrigger>
                  <SelectContent>
                    {leaseOptions.map(l => (
                      <SelectItem key={l.id} value={l.id}>
                        {isAr && l.tenant.nameAr ? l.tenant.nameAr : l.tenant.name} - {l.unit.unitNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('amount')}</Label>
                  <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{t('dueDate')}</Label>
                  <Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('paidDate')}</Label>
                  <Input type="date" value={form.paidDate} onChange={e => setForm({ ...form, paidDate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{t('status')}</Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">{t('pending')}</SelectItem>
                      <SelectItem value="paid">{t('paid')}</SelectItem>
                      <SelectItem value="late">{t('late')}</SelectItem>
                      <SelectItem value="partial">{t('partial')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('method')}</Label>
                  <Select value={form.method} onValueChange={v => setForm({ ...form, method: v })}>
                    <SelectTrigger><SelectValue placeholder={t('selectMethod')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">{t('cash')}</SelectItem>
                      <SelectItem value="bank_transfer">{t('bankTransfer')}</SelectItem>
                      <SelectItem value="online">{t('online')}</SelectItem>
                      <SelectItem value="check">{t('check')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('reference')}</Label>
                  <Input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('notes')}</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{tc('cancel')}</Button>
              <Button onClick={handleSubmit} disabled={submitting || !form.leaseId || !form.amount || !form.dueDate}>
                {submitting ? tc('loading') : tc('save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
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
        {statCards.map(c => (
          <Tooltip key={c.title}>
            <TooltipTrigger asChild>
              <Card className="hover:shadow-md transition-shadow cursor-default">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{c.title}</p>
                      <AnimatedCounter value={c.value} prefix="$" className="text-2xl font-bold mt-1" />
                    </div>
                    <div className={`p-3 rounded-xl ${c.bg}`}><c.icon className={`h-5 w-5 ${c.color}`} /></div>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>{c.tooltip}</TooltipContent>
          </Tooltip>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder={tc('status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tc('all')}</SelectItem>
            <SelectItem value="paid">{t('paid')}</SelectItem>
            <SelectItem value="pending">{t('pending')}</SelectItem>
            <SelectItem value="late">{t('late')}</SelectItem>
            <SelectItem value="partial">{t('partial')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder={t('method')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tc('all')}</SelectItem>
            <SelectItem value="cash">{t('cash')}</SelectItem>
            <SelectItem value="bank_transfer">{t('bankTransfer')}</SelectItem>
            <SelectItem value="online">{t('online')}</SelectItem>
            <SelectItem value="check">{t('check')}</SelectItem>
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
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-7 w-20" />
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
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                    <TableHead key={i}><Skeleton className="h-4 w-16" /></TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1, 2, 3, 4, 5].map(row => (
                  <TableRow key={row}>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : payments.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={t('title')}
          description={t('noPaymentsDescription')}
          actionLabel={t('addPayment')}
          onAction={handleOpenAdd}
        />
      ) : isMobile ? (
        <div className="grid gap-3">
          {payments.map(p => (
            <Card
              key={p.id}
              className="group hover:shadow-lg hover:scale-[1.01] transition-all duration-200"
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedIds.has(p.id)}
                      onCheckedChange={() => toggleSelect(p.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">
                      {isAr && p.tenant.nameAr ? p.tenant.nameAr : p.tenant.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge className={STATUS_COLORS[p.status] || DEFAULT_STATUS_COLOR}>
                      {getStatusLabel(p.status)}
                    </Badge>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => openReceipt(p)}>
                          <FileText className="h-4 w-4 text-teal-600" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('receipt')}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleOpenEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{tc('edit')}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive" onClick={() => setDeleteId(p.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{tc('delete')}</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {p.lease?.unit?.unitNumber || '-'} · {isAr && p.lease?.unit?.property?.nameAr ? p.lease.unit.property.nameAr : p.lease?.unit?.property?.name || '-'}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span>{t('amount')}: <span className="font-medium">{tc('currency')}{p.amount.toLocaleString()}</span></span>
                  <span>{t('dueDate')}: {new Date(p.dueDate).toLocaleDateString()}</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {p.paidDate && <span>{t('paidDate')}: {new Date(p.paidDate).toLocaleDateString()}</span>}
                  {p.method && <span>{t('method')}: {getMethodLabel(p.method)}</span>}
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
                    checked={selectedIds.size === payments.length && payments.length > 0}
                    onCheckedChange={(checked) => { if (checked) selectAll(); else clearSelection(); }}
                  />
                </TableHead>
                <TableHead>{t('tenant')}</TableHead>
                <TableHead>{t('propertyUnit')}</TableHead>
                <TableHead>{t('amount')}</TableHead>
                <TableHead>{t('dueDate')}</TableHead>
                <TableHead>{t('paidDate')}</TableHead>
                <TableHead>{t('method')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead className="w-[100px]">{tc('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p, idx) => (
                <TableRow key={p.id} className={`hover:bg-muted/50 ${idx % 2 === 1 ? 'bg-muted/20' : ''} ${selectedIds.has(p.id) ? 'bg-primary/5' : ''}`}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(p.id)}
                      onCheckedChange={() => toggleSelect(p.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {isAr && p.tenant.nameAr ? p.tenant.nameAr : p.tenant.name}
                  </TableCell>
                  <TableCell>
                    {p.lease?.unit?.unitNumber || '-'} · {isAr && p.lease?.unit?.property?.nameAr ? p.lease.unit.property.nameAr : p.lease?.unit?.property?.name || '-'}
                  </TableCell>
                  <TableCell>{tc('currency')}{p.amount.toLocaleString()}</TableCell>
                  <TableCell>{new Date(p.dueDate).toLocaleDateString()}</TableCell>
                  <TableCell>{p.paidDate ? new Date(p.paidDate).toLocaleDateString() : '-'}</TableCell>
                  <TableCell>{p.method ? getMethodLabel(p.method) : '-'}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[p.status] || DEFAULT_STATUS_COLOR}>
                      {getStatusLabel(p.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-0.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={t('receipt')} onClick={() => openReceipt(p)}>
                            <FileText className="h-4 w-4 text-teal-600" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('receipt')}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={tc('edit')} onClick={() => handleOpenEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{tc('edit')}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive" aria-label={tc('delete')} onClick={() => setDeleteId(p.id)}>
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
        totalCount={payments.length}
        onSelectAll={selectAll}
        onClearSelection={clearSelection}
        onDelete={() => setBulkDeleteOpen(true)}
        onExport={handleBulkExport}
        onMarkPaid={handleBulkMarkPaid}
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

      {/* Payment Receipt Dialog */}
      <PaymentReceipt
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        payment={selectedPayment}
      />
    </div>
  );
}

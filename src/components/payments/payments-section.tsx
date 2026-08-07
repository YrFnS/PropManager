'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { Ban, CreditCard, Download, FileText, Loader2, Pencil, Plus, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from '@/components/auth/session-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import EmptyState from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PaymentReceipt from '@/components/payments/payment-receipt';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { DEFAULT_STATUS_COLOR, STATUS_COLORS } from '@/lib/status-config';

interface Adjustment { id: string; type: string; amount: number; reason: string; createdAt: string }
interface Payment {
  id: string; amount: number; netAmount: number; refundedAmount: number; dueDate: string; paidDate: string | null;
  status: string; method: string | null; reference: string | null; notes: string | null; adjustments: Adjustment[];
  tenant: { id: string; name: string; nameAr: string | null };
  lease: { id: string; unit: { unitNumber: string; property: { name: string; nameAr: string | null } } };
}
interface LeaseOption {
  id: string; rentAmount: number; status: string;
  tenant: { id: string; name: string; nameAr: string | null };
  unit: { unitNumber: string; property: { name: string; nameAr: string | null } };
}

const emptyForm = { leaseId: '', tenantId: '', amount: '', dueDate: '', paidDate: '', status: 'pending', method: '', reference: '', notes: '' };
const lockedStatuses = new Set(['voided', 'partially_refunded', 'refunded']);
const refundableStatuses = new Set(['paid', 'partial', 'partially_refunded']);

const COPY = {
  en: {
    title: 'Payments', add: 'Record payment', edit: 'Edit payment', export: 'Export CSV', tenant: 'Tenant', property: 'Property / unit',
    gross: 'Gross amount', net: 'Net collected', refunded: 'Refunded', due: 'Due date', paid: 'Paid date', method: 'Method', status: 'Status',
    actions: 'Actions', lease: 'Lease', selectLease: 'Select a lease', amount: 'Amount', reference: 'Reference', notes: 'Notes', save: 'Save', cancel: 'Cancel',
    all: 'All', pending: 'Pending', paidStatus: 'Paid', late: 'Late', partial: 'Partial', voided: 'Voided', partially_refunded: 'Partially refunded', refundedStatus: 'Refunded',
    cash: 'Cash', bank_transfer: 'Bank transfer', online: 'Online', check: 'Check', receipt: 'Receipt', void: 'Void', refund: 'Refund',
    voidTitle: 'Void unsettled payment', refundTitle: 'Refund collected payment', reason: 'Reason', available: 'Refundable balance', confirm: 'Confirm',
    readOnly: 'Your role has read-only access to payments.', noData: 'No payments match the current filters.', previous: 'Previous', next: 'Next',
    collected: 'Collected', pendingTotal: 'Pending', lateTotal: 'Late', lifecycleError: 'Unable to apply the payment adjustment.', loadError: 'Unable to load payments.',
  },
  ar: {
    title: 'المدفوعات', add: 'تسجيل دفعة', edit: 'تعديل الدفعة', export: 'تصدير CSV', tenant: 'المستأجر', property: 'العقار / الوحدة',
    gross: 'المبلغ الأصلي', net: 'صافي المحصل', refunded: 'المسترد', due: 'تاريخ الاستحقاق', paid: 'تاريخ الدفع', method: 'الطريقة', status: 'الحالة',
    actions: 'الإجراءات', lease: 'العقد', selectLease: 'اختر عقداً', amount: 'المبلغ', reference: 'المرجع', notes: 'ملاحظات', save: 'حفظ', cancel: 'إلغاء',
    all: 'الكل', pending: 'معلق', paidStatus: 'مدفوع', late: 'متأخر', partial: 'جزئي', voided: 'ملغى', partially_refunded: 'مسترد جزئياً', refundedStatus: 'مسترد',
    cash: 'نقداً', bank_transfer: 'تحويل مصرفي', online: 'إلكتروني', check: 'شيك', receipt: 'إيصال', void: 'إلغاء', refund: 'استرداد',
    voidTitle: 'إلغاء دفعة غير محصلة', refundTitle: 'استرداد دفعة محصلة', reason: 'السبب', available: 'الرصيد القابل للاسترداد', confirm: 'تأكيد',
    readOnly: 'صلاحيتك تتيح عرض المدفوعات فقط.', noData: 'لا توجد مدفوعات مطابقة للفلاتر.', previous: 'السابق', next: 'التالي',
    collected: 'المحصل', pendingTotal: 'المعلق', lateTotal: 'المتأخر', lifecycleError: 'تعذر تنفيذ تعديل الدفعة.', loadError: 'تعذر تحميل المدفوعات.',
  },
} as const;

export default function PaymentsSection() {
  const locale = useLocale() as 'en' | 'ar';
  const copy = COPY[locale] || COPY.en;
  const isAr = locale === 'ar';
  const { session } = useSession();
  const canWrite = Boolean(session && ['owner', 'manager', 'accountant'].includes(session.role));
  const [payments, setPayments] = useState<Payment[]>([]);
  const [leases, setLeases] = useState<LeaseOption[]>([]);
  const [stats, setStats] = useState({ totalCollected: 0, totalPending: 0, totalLate: 0 });
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [lifecycle, setLifecycle] = useState<{ type: 'void' | 'refund'; payment: Payment } | null>(null);
  const [reason, setReason] = useState('');
  const [refundAmount, setRefundAmount] = useState('');

  const money = useMemo(() => new Intl.NumberFormat(isAr ? 'ar-IQ' : 'en-US', { style: 'currency', currency: session?.currency || 'USD', maximumFractionDigits: 2 }), [isAr, session?.currency]);
  const date = (value: string | null) => value ? new Intl.DateTimeFormat(isAr ? 'ar-IQ' : 'en-US').format(new Date(value)) : '—';
  const name = (item: { name: string; nameAr: string | null }) => isAr && item.nameAr ? item.nameAr : item.name;

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (methodFilter !== 'all') params.set('method', methodFilter);
      const response = await fetch(`/api/payments?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || copy.loadError);
      setPayments(data.data || []);
      setStats(data.stats || { totalCollected: 0, totalPending: 0, totalLate: 0 });
      setPagination(data.pagination || { page, totalPages: 1, total: 0 });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.loadError);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, methodFilter, copy.loadError]);

  useEffect(() => { void load(1); }, [load]);
  useEffect(() => {
    fetch('/api/leases?limit=200').then((response) => response.json()).then((data) => setLeases(data.data || [])).catch(() => setLeases([]));
  }, []);

  const openAdd = () => { setEditingId(null); setForm({ ...emptyForm }); setFormOpen(true); };
  const openEdit = (payment: Payment) => {
    if (lockedStatuses.has(payment.status)) return;
    setEditingId(payment.id);
    setForm({
      leaseId: payment.lease.id,
      tenantId: payment.tenant.id,
      amount: String(payment.amount),
      dueDate: payment.dueDate.split('T')[0],
      paidDate: payment.paidDate ? payment.paidDate.split('T')[0] : '',
      status: payment.status,
      method: payment.method || '',
      reference: payment.reference || '',
      notes: payment.notes || '',
    });
    setFormOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch('/api/payments', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          ...form,
          amount: Number(form.amount),
          paidDate: form.paidDate || null,
          method: form.method || null,
          reference: form.reference || null,
          notes: form.notes || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save payment.');
      setFormOpen(false);
      await load(pagination.page);
      toast.success(copy.save);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save payment.');
    } finally {
      setSaving(false);
    }
  };

  const applyLifecycle = async (event: FormEvent) => {
    event.preventDefault();
    if (!lifecycle) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/payments/${lifecycle.payment.id}/${lifecycle.type}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, ...(lifecycle.type === 'refund' ? { amount: Number(refundAmount) } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || copy.lifecycleError);
      setLifecycle(null); setReason(''); setRefundAmount('');
      await load(pagination.page);
      toast.success(lifecycle.type === 'refund' ? copy.refund : copy.void);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.lifecycleError);
    } finally {
      setSaving(false);
    }
  };

  const statusLabel = (status: string) => ({ pending: copy.pending, paid: copy.paidStatus, late: copy.late, partial: copy.partial, voided: copy.voided, partially_refunded: copy.partially_refunded, refunded: copy.refundedStatus }[status] || status);
  const methodLabel = (method: string | null) => method ? ({ cash: copy.cash, bank_transfer: copy.bank_transfer, online: copy.online, check: copy.check }[method] || method) : '—';
  const exportCsv = () => {
    const headers = [copy.tenant, copy.property, copy.gross, copy.net, copy.refunded, copy.due, copy.paid, copy.method, copy.status];
    const rows = payments.map((payment) => [name(payment.tenant), `${payment.lease.unit.unitNumber} - ${name(payment.lease.unit.property)}`, payment.amount, payment.netAmount, payment.refundedAmount, date(payment.dueDate), date(payment.paidDate), methodLabel(payment.method), statusLabel(payment.status)]);
    const csv = '\ufeff' + [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'payments.csv'; link.click(); URL.revokeObjectURL(url);
  };

  const actionButtons = (payment: Payment) => {
    const available = Math.max(0, payment.netAmount);
    return (
      <div className="flex items-center justify-end gap-1">
        <Button variant="ghost" size="icon" aria-label={copy.receipt} onClick={() => setReceipt(payment)}><FileText className="h-4 w-4" /></Button>
        {canWrite && !lockedStatuses.has(payment.status) && <Button variant="ghost" size="icon" aria-label={copy.edit} onClick={() => openEdit(payment)}><Pencil className="h-4 w-4" /></Button>}
        {canWrite && ['pending', 'late'].includes(payment.status) && <Button variant="ghost" size="icon" aria-label={copy.void} onClick={() => { setLifecycle({ type: 'void', payment }); setReason(''); }}><Ban className="h-4 w-4 text-destructive" /></Button>}
        {canWrite && refundableStatuses.has(payment.status) && available > 0 && <Button variant="ghost" size="icon" aria-label={copy.refund} onClick={() => { setLifecycle({ type: 'refund', payment }); setReason(''); setRefundAmount(available.toFixed(2)); }}><RotateCcw className="h-4 w-4 text-amber-600" /></Button>}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-semibold">{copy.title}</h1><p className="text-sm text-muted-foreground">{pagination.total} {copy.title.toLowerCase()}</p></div>
        <div className="flex gap-2"><Button variant="outline" onClick={exportCsv} disabled={!payments.length}><Download className="me-2 h-4 w-4" />{copy.export}</Button>{canWrite && <Button onClick={openAdd}><Plus className="me-2 h-4 w-4" />{copy.add}</Button>}</div>
      </div>

      {!canWrite && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">{copy.readOnly}</div>}

      <div className="grid gap-3 sm:grid-cols-3">
        {[[copy.collected, stats.totalCollected], [copy.pendingTotal, stats.totalPending], [copy.lateTotal, stats.totalLate]].map(([label, value]) => <Card key={String(label)}><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{money.format(Number(value))}</p></CardContent></Card>)}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger><SelectContent>{['all', 'pending', 'paid', 'late', 'partial', 'voided', 'partially_refunded', 'refunded'].map((status) => <SelectItem key={status} value={status}>{status === 'all' ? copy.all : statusLabel(status)}</SelectItem>)}</SelectContent></Select>
        <Select value={methodFilter} onValueChange={setMethodFilter}><SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger><SelectContent>{['all', 'cash', 'bank_transfer', 'online', 'check'].map((method) => <SelectItem key={method} value={method}>{method === 'all' ? copy.all : methodLabel(method)}</SelectItem>)}</SelectContent></Select>
      </div>

      {loading ? <div className="space-y-3">{[1,2,3,4].map((item) => <Skeleton key={item} className="h-16 w-full" />)}</div> : !payments.length ? <EmptyState icon={CreditCard} title={copy.title} description={copy.noData} actionLabel={canWrite ? copy.add : undefined} onAction={canWrite ? openAdd : undefined} /> : (
        <>
          <div className="grid gap-3 md:hidden">{payments.map((payment) => <Card key={payment.id}><CardContent className="space-y-3 p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-medium">{name(payment.tenant)}</p><p className="text-xs text-muted-foreground">{payment.lease.unit.unitNumber} · {name(payment.lease.unit.property)}</p></div><Badge className={STATUS_COLORS[payment.status] || DEFAULT_STATUS_COLOR}>{statusLabel(payment.status)}</Badge></div><div className="grid grid-cols-2 gap-2 text-sm"><div><p className="text-xs text-muted-foreground">{copy.gross}</p><p>{money.format(payment.amount)}</p></div><div><p className="text-xs text-muted-foreground">{copy.net}</p><p className="font-semibold">{money.format(payment.netAmount)}</p></div><div><p className="text-xs text-muted-foreground">{copy.due}</p><p>{date(payment.dueDate)}</p></div><div><p className="text-xs text-muted-foreground">{copy.method}</p><p>{methodLabel(payment.method)}</p></div></div>{actionButtons(payment)}</CardContent></Card>)}</div>
          <div className="hidden overflow-x-auto rounded-lg border md:block"><Table><TableHeader><TableRow><TableHead>{copy.tenant}</TableHead><TableHead>{copy.property}</TableHead><TableHead>{copy.gross}</TableHead><TableHead>{copy.net}</TableHead><TableHead>{copy.refunded}</TableHead><TableHead>{copy.due}</TableHead><TableHead>{copy.method}</TableHead><TableHead>{copy.status}</TableHead><TableHead className="text-end">{copy.actions}</TableHead></TableRow></TableHeader><TableBody>{payments.map((payment) => <TableRow key={payment.id}><TableCell className="font-medium">{name(payment.tenant)}</TableCell><TableCell>{payment.lease.unit.unitNumber} · {name(payment.lease.unit.property)}</TableCell><TableCell>{money.format(payment.amount)}</TableCell><TableCell className="font-semibold">{money.format(payment.netAmount)}</TableCell><TableCell>{payment.refundedAmount ? money.format(payment.refundedAmount) : '—'}</TableCell><TableCell>{date(payment.dueDate)}</TableCell><TableCell>{methodLabel(payment.method)}</TableCell><TableCell><Badge className={STATUS_COLORS[payment.status] || DEFAULT_STATUS_COLOR}>{statusLabel(payment.status)}</Badge></TableCell><TableCell>{actionButtons(payment)}</TableCell></TableRow>)}</TableBody></Table></div>
          <div className="flex items-center justify-between"><Button variant="outline" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}>{copy.previous}</Button><span className="text-sm text-muted-foreground">{pagination.page} / {Math.max(1, pagination.totalPages)}</span><Button variant="outline" disabled={pagination.page >= pagination.totalPages} onClick={() => load(pagination.page + 1)}>{copy.next}</Button></div>
        </>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}><DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{editingId ? copy.edit : copy.add}</DialogTitle><DialogDescription className="sr-only">{copy.title}</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4"><div className="space-y-2"><Label>{copy.lease}</Label><Select value={form.leaseId} disabled={Boolean(editingId)} onValueChange={(leaseId) => { const lease = leases.find((item) => item.id === leaseId); setForm({ ...form, leaseId, tenantId: lease?.tenant.id || '', amount: lease ? String(lease.rentAmount) : form.amount }); }}><SelectTrigger><SelectValue placeholder={copy.selectLease} /></SelectTrigger><SelectContent>{leases.map((lease) => <SelectItem key={lease.id} value={lease.id}>{name(lease.tenant)} — {lease.unit.unitNumber} · {name(lease.unit.property)}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>{copy.amount}</Label><Input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></div><div className="space-y-2"><Label>{copy.due}</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} required /></div><div className="space-y-2"><Label>{copy.paid}</Label><Input type="date" value={form.paidDate} onChange={(e) => setForm({ ...form, paidDate: e.target.value })} /></div><div className="space-y-2"><Label>{copy.status}</Label><Select value={form.status} onValueChange={(status) => setForm({ ...form, status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['pending','paid','late','partial'].map((status) => <SelectItem key={status} value={status}>{statusLabel(status)}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>{copy.method}</Label><Select value={form.method || 'none'} onValueChange={(method) => setForm({ ...form, method: method === 'none' ? '' : method })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">—</SelectItem>{['cash','bank_transfer','online','check'].map((method) => <SelectItem key={method} value={method}>{methodLabel(method)}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>{copy.reference}</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div></div><div className="space-y-2"><Label>{copy.notes}</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setFormOpen(false)}>{copy.cancel}</Button><Button disabled={saving || !form.leaseId || !form.amount || !form.dueDate}>{saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}{copy.save}</Button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={Boolean(lifecycle)} onOpenChange={(open) => !open && setLifecycle(null)}><DialogContent><DialogHeader><DialogTitle>{lifecycle?.type === 'refund' ? copy.refundTitle : copy.voidTitle}</DialogTitle><DialogDescription className="sr-only">{copy.reason}</DialogDescription></DialogHeader><form onSubmit={applyLifecycle} className="space-y-4">{lifecycle?.type === 'refund' && <><div className="rounded-lg bg-muted p-3 text-sm">{copy.available}: <strong>{money.format(lifecycle.payment.netAmount)}</strong></div><div className="space-y-2"><Label>{copy.amount}</Label><Input aria-label={copy.amount} type="number" min="0.01" step="0.01" max={lifecycle.payment.netAmount} value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} required /></div></>}<div className="space-y-2"><Label>{copy.reason}</Label><Textarea aria-label={copy.reason} minLength={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} required /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setLifecycle(null)}>{copy.cancel}</Button><Button disabled={saving || reason.trim().length < 3 || (lifecycle?.type === 'refund' && Number(refundAmount) <= 0)}>{saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}{copy.confirm}</Button></DialogFooter></form></DialogContent></Dialog>

      <PaymentReceipt open={Boolean(receipt)} onOpenChange={(open) => !open && setReceipt(null)} payment={receipt} />
    </div>
  );
}

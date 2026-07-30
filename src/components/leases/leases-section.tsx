'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { Download, FileText, Loader2, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from '@/components/auth/session-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import EmptyState from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DEFAULT_STATUS_COLOR, STATUS_COLORS } from '@/lib/status-config';

interface Lease {
  id: string; startDate: string; endDate: string; rentAmount: number; deposit: number | null; status: string;
  tenant: { id: string; name: string; nameAr: string | null };
  unit: { id: string; unitNumber: string; property: { name: string; nameAr: string | null } };
  _count: { payments: number };
}
interface UnitOption { id: string; unitNumber: string; status: string; rentAmount: number; property: { name: string; nameAr: string | null } }
interface TenantOption { id: string; name: string; nameAr: string | null }
const emptyForm = { unitId: '', tenantId: '', startDate: '', endDate: '', rentAmount: '', deposit: '', status: 'active' };

const COPY = {
  en: {
    title: 'Leases', add: 'Create lease', edit: 'Edit lease', export: 'Export CSV', tenant: 'Tenant', unit: 'Unit / property',
    start: 'Start date', end: 'End date', rent: 'Monthly rent', deposit: 'Deposit', status: 'Status', payments: 'Payments', actions: 'Actions',
    active: 'Active', expired: 'Expired', terminated: 'Terminated', all: 'All statuses', save: 'Save', cancel: 'Cancel', selectTenant: 'Select tenant',
    selectUnit: 'Select available unit', readOnly: 'Your role has read-only access to leases.', noData: 'No leases match the current filter.',
    previous: 'Previous', next: 'Next', activeLeases: 'Active leases', expiring: 'Expiring in 30 days', revenue: 'Active monthly rent', loadError: 'Unable to load leases.',
  },
  ar: {
    title: 'العقود', add: 'إنشاء عقد', edit: 'تعديل العقد', export: 'تصدير CSV', tenant: 'المستأجر', unit: 'الوحدة / العقار',
    start: 'تاريخ البدء', end: 'تاريخ الانتهاء', rent: 'الإيجار الشهري', deposit: 'التأمين', status: 'الحالة', payments: 'الدفعات', actions: 'الإجراءات',
    active: 'نشط', expired: 'منتهي', terminated: 'ملغى', all: 'كل الحالات', save: 'حفظ', cancel: 'إلغاء', selectTenant: 'اختر مستأجراً',
    selectUnit: 'اختر وحدة متاحة', readOnly: 'صلاحيتك تتيح عرض العقود فقط.', noData: 'لا توجد عقود مطابقة للفلتر.', previous: 'السابق', next: 'التالي',
    activeLeases: 'العقود النشطة', expiring: 'تنتهي خلال 30 يوماً', revenue: 'الإيجار الشهري النشط', loadError: 'تعذر تحميل العقود.',
  },
} as const;

export default function LeasesSection() {
  const locale = useLocale() as 'en' | 'ar';
  const copy = COPY[locale] || COPY.en;
  const isAr = locale === 'ar';
  const { session, canWrite } = useSession();
  const writable = canWrite('leases');
  const [leases, setLeases] = useState<Lease[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [stats, setStats] = useState({ activeLeases: 0, expiringSoon: 0, totalMonthlyRevenue: 0 });
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const money = useMemo(() => new Intl.NumberFormat(isAr ? 'ar-IQ' : 'en-US', { style: 'currency', currency: session?.currency || 'USD', maximumFractionDigits: 2 }), [isAr, session?.currency]);
  const date = (value: string) => new Intl.DateTimeFormat(isAr ? 'ar-IQ' : 'en-US').format(new Date(value));
  const name = (item: { name: string; nameAr: string | null }) => isAr && item.nameAr ? item.nameAr : item.name;
  const statusLabel = (status: string) => ({ active: copy.active, expired: copy.expired, terminated: copy.terminated } as Record<string, string>)[status] || status;

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const response = await fetch(`/api/leases?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || copy.loadError);
      setLeases(data.data || []);
      setStats(data.stats || { activeLeases: 0, expiringSoon: 0, totalMonthlyRevenue: 0 });
      setPagination(data.pagination || { page, totalPages: 1, total: 0 });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.loadError);
      setLeases([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, copy.loadError]);

  useEffect(() => { void load(1); }, [load]);
  useEffect(() => {
    Promise.all([
      fetch('/api/units?limit=200').then((response) => response.json()),
      fetch('/api/tenants?limit=200').then((response) => response.json()),
    ]).then(([unitData, tenantData]) => {
      setUnits(unitData.data || []);
      setTenants(tenantData.data || []);
    }).catch(() => { setUnits([]); setTenants([]); });
  }, []);

  const openAdd = () => { setEditingId(null); setForm({ ...emptyForm }); setFormOpen(true); };
  const openEdit = (lease: Lease) => {
    setEditingId(lease.id);
    setForm({ unitId: lease.unit.id, tenantId: lease.tenant.id, startDate: lease.startDate.split('T')[0], endDate: lease.endDate.split('T')[0], rentAmount: String(lease.rentAmount), deposit: lease.deposit == null ? '' : String(lease.deposit), status: lease.status });
    setFormOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch('/api/leases', {
        method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(editingId ? { id: editingId } : {}), ...form, rentAmount: Number(form.rentAmount), deposit: form.deposit ? Number(form.deposit) : null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save lease.');
      setFormOpen(false);
      await load(pagination.page);
      toast.success(copy.save);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save lease.');
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const headers = [copy.tenant, copy.unit, copy.start, copy.end, copy.rent, copy.deposit, copy.status, copy.payments];
    const rows = leases.map((lease) => [name(lease.tenant), `${lease.unit.unitNumber} - ${name(lease.unit.property)}`, date(lease.startDate), date(lease.endDate), lease.rentAmount, lease.deposit || '', statusLabel(lease.status), lease._count.payments]);
    const csv = '\ufeff' + [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'leases.csv'; link.click(); URL.revokeObjectURL(url);
  };

  const availableUnits = units.filter((unit) => unit.status === 'available' || unit.id === form.unitId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-semibold">{copy.title}</h1><p className="text-sm text-muted-foreground">{pagination.total} {copy.title.toLowerCase()}</p></div><div className="flex gap-2"><Button variant="outline" onClick={exportCsv} disabled={!leases.length}><Download className="me-2 h-4 w-4" />{copy.export}</Button>{writable && <Button onClick={openAdd}><Plus className="me-2 h-4 w-4" />{copy.add}</Button>}</div></div>
      {!writable && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">{copy.readOnly}</div>}
      <div className="grid gap-3 sm:grid-cols-3">{[[copy.activeLeases, stats.activeLeases, false], [copy.expiring, stats.expiringSoon, false], [copy.revenue, stats.totalMonthlyRevenue, true]].map(([label, value, currency]) => <Card key={String(label)}><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{currency ? money.format(Number(value)) : Number(value).toLocaleString(isAr ? 'ar-IQ' : 'en-US')}</p></CardContent></Card>)}</div>
      <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full sm:w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{copy.all}</SelectItem>{['active','expired','terminated'].map((status) => <SelectItem key={status} value={status}>{statusLabel(status)}</SelectItem>)}</SelectContent></Select>
      {loading ? <div className="space-y-3">{[1,2,3,4].map((item) => <Skeleton key={item} className="h-16 w-full" />)}</div> : !leases.length ? <EmptyState icon={FileText} title={copy.title} description={copy.noData} actionLabel={writable ? copy.add : undefined} onAction={writable ? openAdd : undefined} /> : <><div className="grid gap-3 md:hidden">{leases.map((lease) => <Card key={lease.id}><CardContent className="space-y-3 p-4"><div className="flex items-start justify-between"><div><p className="font-medium">{name(lease.tenant)}</p><p className="text-xs text-muted-foreground">{lease.unit.unitNumber} · {name(lease.unit.property)}</p></div><Badge className={STATUS_COLORS[lease.status] || DEFAULT_STATUS_COLOR}>{statusLabel(lease.status)}</Badge></div><div className="grid grid-cols-2 gap-2 text-sm"><div><p className="text-xs text-muted-foreground">{copy.start}</p><p>{date(lease.startDate)}</p></div><div><p className="text-xs text-muted-foreground">{copy.end}</p><p>{date(lease.endDate)}</p></div><div><p className="text-xs text-muted-foreground">{copy.rent}</p><p className="font-semibold">{money.format(lease.rentAmount)}</p></div><div><p className="text-xs text-muted-foreground">{copy.payments}</p><p>{lease._count.payments}</p></div></div>{writable && <div className="flex justify-end"><Button variant="ghost" size="sm" onClick={() => openEdit(lease)}><Pencil className="me-2 h-4 w-4" />{copy.edit}</Button></div>}</CardContent></Card>)}</div><div className="hidden overflow-x-auto rounded-lg border md:block"><Table><TableHeader><TableRow><TableHead>{copy.tenant}</TableHead><TableHead>{copy.unit}</TableHead><TableHead>{copy.start}</TableHead><TableHead>{copy.end}</TableHead><TableHead>{copy.rent}</TableHead><TableHead>{copy.deposit}</TableHead><TableHead>{copy.status}</TableHead><TableHead>{copy.payments}</TableHead>{writable && <TableHead className="text-end">{copy.actions}</TableHead>}</TableRow></TableHeader><TableBody>{leases.map((lease) => <TableRow key={lease.id}><TableCell className="font-medium">{name(lease.tenant)}</TableCell><TableCell>{lease.unit.unitNumber} · {name(lease.unit.property)}</TableCell><TableCell>{date(lease.startDate)}</TableCell><TableCell>{date(lease.endDate)}</TableCell><TableCell>{money.format(lease.rentAmount)}</TableCell><TableCell>{lease.deposit == null ? '—' : money.format(lease.deposit)}</TableCell><TableCell><Badge className={STATUS_COLORS[lease.status] || DEFAULT_STATUS_COLOR}>{statusLabel(lease.status)}</Badge></TableCell><TableCell>{lease._count.payments}</TableCell>{writable && <TableCell className="text-end"><Button variant="ghost" size="icon" aria-label={copy.edit} onClick={() => openEdit(lease)}><Pencil className="h-4 w-4" /></Button></TableCell>}</TableRow>)}</TableBody></Table></div><div className="flex items-center justify-between"><Button variant="outline" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}>{copy.previous}</Button><span className="text-sm text-muted-foreground">{pagination.page} / {Math.max(1, pagination.totalPages)}</span><Button variant="outline" disabled={pagination.page >= pagination.totalPages} onClick={() => load(pagination.page + 1)}>{copy.next}</Button></div></>}
      <Dialog open={formOpen} onOpenChange={setFormOpen}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>{editingId ? copy.edit : copy.add}</DialogTitle></DialogHeader><form onSubmit={submit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>{copy.tenant}</Label><Select value={form.tenantId} disabled={Boolean(editingId)} onValueChange={(tenantId) => setForm({ ...form, tenantId })}><SelectTrigger><SelectValue placeholder={copy.selectTenant} /></SelectTrigger><SelectContent>{tenants.map((tenant) => <SelectItem key={tenant.id} value={tenant.id}>{name(tenant)}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>{copy.unit}</Label><Select value={form.unitId} disabled={Boolean(editingId)} onValueChange={(unitId) => { const unit = units.find((item) => item.id === unitId); setForm({ ...form, unitId, rentAmount: unit ? String(unit.rentAmount) : form.rentAmount }); }}><SelectTrigger><SelectValue placeholder={copy.selectUnit} /></SelectTrigger><SelectContent>{availableUnits.map((unit) => <SelectItem key={unit.id} value={unit.id}>{unit.unitNumber} · {name(unit.property)}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>{copy.start}</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required /></div><div className="space-y-2"><Label>{copy.end}</Label><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required /></div><div className="space-y-2"><Label>{copy.rent}</Label><Input type="number" min="0.01" step="0.01" value={form.rentAmount} onChange={(e) => setForm({ ...form, rentAmount: e.target.value })} required /></div><div className="space-y-2"><Label>{copy.deposit}</Label><Input type="number" min="0" step="0.01" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} /></div>{editingId && <div className="space-y-2 sm:col-span-2"><Label>{copy.status}</Label><Select value={form.status} onValueChange={(status) => setForm({ ...form, status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['active','expired','terminated'].map((status) => <SelectItem key={status} value={status}>{statusLabel(status)}</SelectItem>)}</SelectContent></Select></div>}</div><DialogFooter><Button type="button" variant="outline" onClick={() => setFormOpen(false)}>{copy.cancel}</Button><Button disabled={saving || !form.unitId || !form.tenantId || !form.startDate || !form.endDate || !form.rentAmount}>{saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}{copy.save}</Button></DialogFooter></form></DialogContent></Dialog>
    </div>
  );
}

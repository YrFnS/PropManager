'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Wrench, AlertCircle, CheckCircle, AlertTriangle, Pencil, Trash2, LayoutList, Kanban } from 'lucide-react';
import EmptyState from '@/components/ui/empty-state';
import AnimatedCounter from '@/components/ui/animated-counter';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import MaintenanceKanban from '@/components/maintenance/maintenance-kanban';
import { STATUS_COLORS, DEFAULT_STATUS_COLOR, PRIORITY_COLORS } from '@/lib/status-config';
import { toast } from 'sonner';
import { useEffect, useState, useCallback } from 'react';

interface MaintenanceRequest {
  id: string;
  title: string;
  titleAr: string | null;
  description: string | null;
  descriptionAr: string | null;
  priority: string;
  status: string;
  category: string;
  assignedTo: string | null;
  createdAt: string;
  property: { id: string; name: string; nameAr: string | null };
  unit: { id: string; unitNumber: string } | null;
  tenant: { id: string; name: string; nameAr: string | null } | null;
}

interface PropertyInfo {
  id: string;
  name: string;
  nameAr: string | null;
  units: { id: string; unitNumber: string }[];
}

const emptyForm = {
  propertyId: '', unitId: '', tenantId: '', title: '', titleAr: '', description: '', descriptionAr: '',
  priority: 'medium', category: 'other', assignedTo: '', status: 'open',
};

export default function MaintenanceSection() {
  const t = useTranslations('maintenance');
  const tc = useTranslations('common');
  const locale = useLocale();
  const isAr = locale === 'ar';

  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [stats, setStats] = useState({ openCount: 0, inProgressCount: 0, resolvedCount: 0, urgentCount: 0 });
  const [properties, setProperties] = useState<PropertyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');

  const fetchMaintenance = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
    if (priorityFilter && priorityFilter !== 'all') params.set('priority', priorityFilter);
    if (categoryFilter && categoryFilter !== 'all') params.set('category', categoryFilter);
    fetch(`/api/maintenance?${params.toString()}`)
      .then(r => r.json())
      .then(data => {
        const result = data.data || data;
        setRequests(result.requests || result || []);
        setStats(result.stats || data.stats || { openCount: 0, inProgressCount: 0, resolvedCount: 0, urgentCount: 0 });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [statusFilter, priorityFilter, categoryFilter]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (priorityFilter && priorityFilter !== 'all') params.set('priority', priorityFilter);
      if (categoryFilter && categoryFilter !== 'all') params.set('category', categoryFilter);
      try {
        const r = await fetch(`/api/maintenance?${params.toString()}`);
        const data = await r.json();
        if (cancelled) return;
        const result = data.data || data;
        setRequests(result.requests || result || []);
        setStats(result.stats || data.stats || { openCount: 0, inProgressCount: 0, resolvedCount: 0, urgentCount: 0 });
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [statusFilter, priorityFilter, categoryFilter]);

  useEffect(() => {
    fetch('/api/properties').then(r => r.json()).then(data => {
      const result = data.data || data;
      setProperties(result.map((p: any) => ({ id: p.id, name: p.name, nameAr: p.nameAr, units: [] })));
    }).catch(() => {});
  }, []);

  // Fetch units for selected property in form
  const [propertyUnits, setPropertyUnits] = useState<{ id: string; unitNumber: string }[]>([]);
  useEffect(() => {
    let cancelled = false;
    if (form.propertyId) {
      fetch(`/api/units?propertyId=${form.propertyId}`)
        .then(r => r.json())
        .then(data => {
          if (cancelled) return;
          const result = data.data || data;
          setPropertyUnits(result.map((u: any) => ({ id: u.id, unitNumber: u.unitNumber })));
        })
        .catch(() => { if (!cancelled) setPropertyUnits([]); });
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPropertyUnits([]);
    }
    return () => { cancelled = true; };
  }, [form.propertyId]);

  const handleOpenAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const handleOpenEdit = (req: MaintenanceRequest) => {
    setEditingId(req.id);
    setForm({
      propertyId: req.property.id,
      unitId: req.unit?.id || '',
      tenantId: req.tenant?.id || '',
      title: req.title,
      titleAr: req.titleAr || '',
      description: req.description || '',
      descriptionAr: req.descriptionAr || '',
      priority: req.priority,
      category: req.category,
      assignedTo: req.assignedTo || '',
      status: req.status,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        propertyId: form.propertyId,
        unitId: form.unitId || null,
        tenantId: form.tenantId || null,
        title: form.title,
        titleAr: form.titleAr || null,
        description: form.description || null,
        descriptionAr: form.descriptionAr || null,
        priority: form.priority,
        category: form.category,
        assignedTo: form.assignedTo || null,
        status: form.status,
      };

      const res = editingId
        ? await fetch('/api/maintenance', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editingId, ...payload }),
          })
        : await fetch('/api/maintenance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      if (res.ok) {
        setForm({ ...emptyForm });
        setEditingId(null);
        setDialogOpen(false);
        fetchMaintenance();
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
      const res = await fetch(`/api/maintenance?id=${deleteId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchMaintenance();
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

  const getPriorityLabel = (p: string) => {
    const labels: Record<string, string> = { low: t('low'), medium: t('medium'), high: t('high'), urgent: t('urgent') };
    return labels[p] || p;
  };

  const getStatusLabel = (s: string) => {
    const labels: Record<string, string> = { open: t('open'), in_progress: t('inProgress'), resolved: t('resolved'), closed: t('closed') };
    return labels[s] || s;
  };

  const getCategoryLabel = (c: string) => {
    const labels: Record<string, string> = {
      plumbing: t('plumbing'), electrical: t('electrical'), structural: t('structural'),
      appliance: t('appliance'), hvac: t('hvac'), other: t('other'),
    };
    return labels[c] || c;
  };

  const statCards = [
    { title: t('openCount'), value: stats.openCount, icon: AlertCircle, color: 'text-sky-600', bg: 'bg-sky-50 dark:bg-sky-950/30' },
    { title: t('inProgressCount'), value: stats.inProgressCount, icon: Wrench, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-950/30' },
    { title: t('resolvedCount'), value: stats.resolvedCount, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
    { title: t('urgentCount'), value: stats.urgentCount, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight gradient-text">{t('title')}</h1>
          {requests.length > 0 && <Badge variant="secondary">{requests.length}</Badge>}
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenAdd}><Plus className="h-4 w-4 me-2" />{t('addRequest')}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? t('editRequest') : t('addRequest')}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('property')}</Label>
                  <Select value={form.propertyId} onValueChange={v => setForm({ ...form, propertyId: v, unitId: '' })}>
                    <SelectTrigger><SelectValue placeholder={t('selectProperty')} /></SelectTrigger>
                    <SelectContent>
                      {properties.map(p => (
                        <SelectItem key={p.id} value={p.id}>{isAr && p.nameAr ? p.nameAr : p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('unit')}</Label>
                  <Select value={form.unitId} onValueChange={v => setForm({ ...form, unitId: v })}>
                    <SelectTrigger><SelectValue placeholder={t('selectUnit')} /></SelectTrigger>
                    <SelectContent>
                      {propertyUnits.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.unitNumber}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('requestTitle')}</Label>
                  <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{t('titleAr')}</Label>
                  <Input dir="rtl" value={form.titleAr} onChange={e => setForm({ ...form, titleAr: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('description')}</Label>
                  <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>{t('descriptionAr')}</Label>
                  <Textarea dir="rtl" value={form.descriptionAr} onChange={e => setForm({ ...form, descriptionAr: e.target.value })} rows={3} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('priority')}</Label>
                  <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                    <SelectTrigger><SelectValue placeholder={t('selectPriority')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">{t('low')}</SelectItem>
                      <SelectItem value="medium">{t('medium')}</SelectItem>
                      <SelectItem value="high">{t('high')}</SelectItem>
                      <SelectItem value="urgent">{t('urgent')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('category')}</Label>
                  <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue placeholder={t('selectCategory')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="plumbing">{t('plumbing')}</SelectItem>
                      <SelectItem value="electrical">{t('electrical')}</SelectItem>
                      <SelectItem value="structural">{t('structural')}</SelectItem>
                      <SelectItem value="appliance">{t('appliance')}</SelectItem>
                      <SelectItem value="hvac">{t('hvac')}</SelectItem>
                      <SelectItem value="other">{t('other')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {editingId && (
                <div className="space-y-2">
                  <Label>{t('status')}</Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue placeholder={t('selectStatus')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">{t('open')}</SelectItem>
                      <SelectItem value="in_progress">{t('inProgress')}</SelectItem>
                      <SelectItem value="resolved">{t('resolved')}</SelectItem>
                      <SelectItem value="closed">{t('closed')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>{t('assignedTo')}</Label>
                <Input value={form.assignedTo} onChange={e => setForm({ ...form, assignedTo: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{tc('cancel')}</Button>
              <Button onClick={handleSubmit} disabled={submitting || !form.propertyId || !form.title}>
                {submitting ? tc('loading') : tc('save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* View Toggle */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'list' | 'board')}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="list" className="gap-1.5">
              <LayoutList className="h-4 w-4" />
              {t('listView')}
            </TabsTrigger>
            <TabsTrigger value="board" className="gap-1.5">
              <Kanban className="h-4 w-4" />
              {t('boardView')}
            </TabsTrigger>
          </TabsList>
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map(c => (
          <Tooltip key={c.title}>
            <TooltipTrigger asChild>
              <Card className="hover:shadow-md transition-shadow cursor-default">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{c.title}</p>
                      <AnimatedCounter value={c.value} className="text-2xl font-bold mt-1" />
                    </div>
                    <div className={`p-3 rounded-xl ${c.bg}`}><c.icon className={`h-5 w-5 ${c.color}`} /></div>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>{c.title}: {c.value}</TooltipContent>
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
            <SelectItem value="open">{t('open')}</SelectItem>
            <SelectItem value="in_progress">{t('inProgress')}</SelectItem>
            <SelectItem value="resolved">{t('resolved')}</SelectItem>
            <SelectItem value="closed">{t('closed')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder={t('priority')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tc('all')}</SelectItem>
            <SelectItem value="low">{t('low')}</SelectItem>
            <SelectItem value="medium">{t('medium')}</SelectItem>
            <SelectItem value="high">{t('high')}</SelectItem>
            <SelectItem value="urgent">{t('urgent')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder={t('category')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tc('all')}</SelectItem>
            <SelectItem value="plumbing">{t('plumbing')}</SelectItem>
            <SelectItem value="electrical">{t('electrical')}</SelectItem>
            <SelectItem value="structural">{t('structural')}</SelectItem>
            <SelectItem value="appliance">{t('appliance')}</SelectItem>
            <SelectItem value="hvac">{t('hvac')}</SelectItem>
            <SelectItem value="other">{t('other')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <TabsContent value="list">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title={t('title')}
            description={t('noMaintenanceDescription')}
            actionLabel={t('addRequest')}
            onAction={handleOpenAdd}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {requests.map(r => (
              <Card key={r.id} className="group hover:shadow-lg hover:scale-[1.01] transition-all duration-200 rounded-xl border border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{isAr && r.titleAr ? r.titleAr : r.title}</CardTitle>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge className={PRIORITY_COLORS[r.priority] || DEFAULT_STATUS_COLOR}>
                        {getPriorityLabel(r.priority)}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(r.description || r.descriptionAr) && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {isAr && r.descriptionAr ? r.descriptionAr : r.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge className={STATUS_COLORS[r.status] || DEFAULT_STATUS_COLOR}>
                      {getStatusLabel(r.status)}
                    </Badge>
                    <Badge variant="outline">{getCategoryLabel(r.category)}</Badge>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>{isAr && r.property.nameAr ? r.property.nameAr : r.property.name}{r.unit ? ` · ${r.unit.unitNumber}` : ''}</p>
                    {r.tenant && <p>{isAr && r.tenant.nameAr ? r.tenant.nameAr : r.tenant.name}</p>}
                  </div>
                  {r.assignedTo && (
                    <div className="text-xs text-muted-foreground border-t pt-2">
                      {t('assignedTo')}: {r.assignedTo}
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-1 border-t pt-3">
                    <Button variant="ghost" size="sm" className="h-9 gap-1" onClick={() => handleOpenEdit(r)}>
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="text-xs">{tc('edit')}</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-9 gap-1 text-destructive hover:text-destructive" onClick={() => setDeleteId(r.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="text-xs">{tc('delete')}</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="board">
        {loading ? (
          <div className="flex flex-col md:flex-row gap-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} className="flex-1">
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-4 w-20" />
                  {[1, 2].map(j => (
                    <div key={j} className="space-y-2 border rounded-lg p-3">
                      <Skeleton className="h-4 w-full" />
                      <div className="flex gap-2">
                        <Skeleton className="h-4 w-12 rounded-full" />
                        <Skeleton className="h-4 w-16 rounded-full" />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title={t('title')}
            description={t('noMaintenanceDescription')}
            actionLabel={t('addRequest')}
            onAction={handleOpenAdd}
          />
        ) : (
          <div className="overflow-x-auto">
            <MaintenanceKanban requests={requests} onUpdate={fetchMaintenance} />
          </div>
        )}
      </TabsContent>
      </Tabs>
    </div>
  );
}

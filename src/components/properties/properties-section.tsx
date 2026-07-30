'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
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
import EmptyState from '@/components/ui/empty-state';
import PropertyDetailSheet from '@/components/properties/property-detail-sheet';
import PropertyImage from '@/components/properties/property-image';
import { Building2, Plus, Search, MapPin, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { useRouteIntent } from '@/lib/route-intent';

export default function PropertiesSection() {
  const t = useTranslations('properties');
  const tc = useTranslations('common');
  const locale = useLocale();
  const isAr = locale === 'ar';
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<any>({});
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchData = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (typeFilter !== 'all') params.set('type', typeFilter);
    fetch(`/api/properties?${params}`).then(r => r.json()).then(d => { setData(d.data || d); setLoading(false); });
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (typeFilter !== 'all') params.set('type', typeFilter);
      try {
        const r = await fetch(`/api/properties?${params}`);
        const d = await r.json();
        if (cancelled) return;
        setData(d.data || d);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [search, typeFilter]);

  const openAddDialog = () => {
    setEditingId(null);
    setForm({});
    setDialogOpen(true);
  };

  const openDetailSheet = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    setDetailOpen(true);
  };

  const openEditDialog = (property: any) => {
    setEditingId(property.id);
    setForm({
      name: property.name || '',
      nameAr: property.nameAr || '',
      address: property.address || '',
      addressAr: property.addressAr || '',
      city: property.city || '',
      cityAr: property.cityAr || '',
      state: property.state || '',
      zipCode: property.zipCode || '',
      type: property.type || 'residential',
      description: property.description || '',
      manager: property.manager ? {
        name: property.manager.name || '',
        email: property.manager.email || '',
        phone: property.manager.phone || '',
      } : { name: '', email: '', phone: '' },
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (editingId) {
        const res = await fetch('/api/properties', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...form }),
        });
        if (res.ok) {
          toast.success(tc('success'));
          setDialogOpen(false);
          setEditingId(null);
          setForm({});
          fetchData();
        } else {
          toast.error(tc('error'));
        }
      } else {
        const res = await fetch('/api/properties', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (res.ok) {
          toast.success(t('createSuccess'));
          setDialogOpen(false);
          setForm({});
          fetchData();
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
      const res = await fetch(`/api/properties?id=${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(tc('success'));
        setDeleteTarget(null);
        fetchData();
      } else {
        toast.error(tc('error'));
      }
    } catch {
      toast.error(tc('error'));
    }
  };

  const updateForm = (key: string, value: any) => setForm((p: any) => ({ ...p, [key]: value }));

  useRouteIntent({
    section: 'properties',
    onAdd: openAddDialog,
    onRecord: openDetailSheet,
  });

  if (loading) return <div className="grid gap-4 md:grid-cols-3">{[1,2,3].map(i => <Card key={i} className="animate-pulse"><CardContent className="p-6"><div className="h-32 bg-muted rounded" /></CardContent></Card>)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold gradient-text">{t('title')}</h1>
          {data.length > 0 && <Badge variant="secondary">{data.length}</Badge>}
        </div>
        <Button data-pm-write-resource="properties" onClick={openAddDialog}><Plus className="h-4 w-4 me-2" />{t('addProperty')}</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1"><Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="ps-9 focus:ring-2 focus:ring-primary/20 transition-all duration-200" placeholder={tc('search')} value={search} onChange={e => setSearch(e.target.value)} /></div>
        <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-full sm:w-40"><SelectValue placeholder={tc('all')} /></SelectTrigger><SelectContent><SelectItem value="all">{tc('all')}</SelectItem><SelectItem value="residential">{t('residential')}</SelectItem><SelectItem value="commercial">{t('commercial')}</SelectItem><SelectItem value="mixed">{t('mixed')}</SelectItem></SelectContent></Select>
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t('noProperties')}
          description={t('noPropertiesDescription')}
          actionLabel={t('addProperty')}
          onAction={openAddDialog}
        />
      ) : (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.map((p: any) => {
          const accentBorder = p.type === 'residential'
            ? 'border-s-emerald-500'
            : p.type === 'commercial'
              ? 'border-s-sky-500'
              : 'border-s-purple-500';
          return (
          <Card key={p.id} className={`group hover:-translate-y-1 hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden rounded-xl border border-border/50 border-s-4 ${accentBorder}`} onClick={() => openDetailSheet(p.id)}>
            {/* Property Image Placeholder */}
            <PropertyImage
              type={p.type || 'residential'}
              name={isAr && p.nameAr ? p.nameAr : p.name}
              image={p.image}
              className="h-[120px] rounded-t-xl"
            />
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{isAr && p.nameAr ? p.nameAr : p.name}</CardTitle>
                <div className="flex items-center gap-1">
                  <Badge variant={p.type === 'commercial' ? 'default' : 'secondary'}>{t(p.type)}</Badge>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button data-pm-write-resource="properties" variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEditDialog(p); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{tc('edit')}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button data-pm-write-resource="properties" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{tc('delete')}</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span>{isAr && p.addressAr ? p.addressAr : p.address}, {isAr && p.cityAr ? p.cityAr : p.city}</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm"><span>{t('units')}: {p.unitCount}</span><span>{p.occupancyRate}%</span></div>
                <Progress value={p.occupancyRate} className="h-2" />
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground"><span className="text-green-600 dark:text-green-400">{p.occupiedUnits} {t('occupiedUnits')}</span><span>·</span><span className="text-blue-600 dark:text-blue-400">{p.availableUnits} {t('availableUnits')}</span><span>·</span><span className="text-amber-600 dark:text-amber-400">{p.maintenanceUnits ?? 0} {t('maintenanceUnits')}</span></div>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="font-semibold">${p.totalRent?.toLocaleString()}/mo</span>
                {p.manager && <span className="text-xs text-muted-foreground">{p.manager.name}</span>}
              </div>
              <div className="pt-2">
                <span className="text-sm font-medium text-teal-600 dark:text-teal-400 hover:underline cursor-pointer inline-flex items-center gap-1">
                  {t('viewDetails')} →
                </span>
              </div>
            </CardContent>
          </Card>
          );
        })}
      </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? t('editProperty') : t('addProperty')}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>{t('propertyName')}</Label><Input value={form.name || ''} onChange={e => updateForm('name', e.target.value)} /></div>
              <div><Label>{t('propertyNameAr')}</Label><Input dir="rtl" value={form.nameAr || ''} onChange={e => updateForm('nameAr', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>{t('address')}</Label><Input value={form.address || ''} onChange={e => updateForm('address', e.target.value)} /></div>
              <div><Label>{t('addressAr')}</Label><Input dir="rtl" value={form.addressAr || ''} onChange={e => updateForm('addressAr', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>{t('city')}</Label><Input value={form.city || ''} onChange={e => updateForm('city', e.target.value)} /></div>
              <div><Label>{t('cityAr')}</Label><Input dir="rtl" value={form.cityAr || ''} onChange={e => updateForm('cityAr', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><Label>{t('state')}</Label><Input value={form.state || ''} onChange={e => updateForm('state', e.target.value)} /></div>
              <div><Label>{t('zipCode')}</Label><Input value={form.zipCode || ''} onChange={e => updateForm('zipCode', e.target.value)} /></div>
              <div><Label>{t('type')}</Label><Select value={form.type || 'residential'} onValueChange={v => updateForm('type', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="residential">{t('residential')}</SelectItem><SelectItem value="commercial">{t('commercial')}</SelectItem><SelectItem value="mixed">{t('mixed')}</SelectItem></SelectContent></Select></div>
            </div>
            <div><Label>{t('description')}</Label><Textarea value={form.description || ''} onChange={e => updateForm('description', e.target.value)} /></div>
            <Separator className="my-2" />
            <p className="text-sm font-medium">{t('manager')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>{t('managerName')}</Label><Input value={form.manager?.name || ''} onChange={e => updateForm('manager', { ...form.manager, name: e.target.value })} /></div>
              <div><Label>{t('managerEmail')}</Label><Input type="email" value={form.manager?.email || ''} onChange={e => updateForm('manager', { ...form.manager, email: e.target.value })} /></div>
            </div>
            <div><Label>{t('managerPhone')}</Label><Input value={form.manager?.phone || ''} onChange={e => updateForm('manager', { ...form.manager, phone: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{tc('cancel')}</Button>
            <Button data-pm-write-resource="properties" onClick={handleSubmit} disabled={submitting}>{submitting ? tc('loading') : tc('save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Property Detail Sheet */}
      <PropertyDetailSheet
        propertyId={selectedPropertyId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={(property) => openEditDialog(property)}
        onDelete={(property) => setDeleteTarget(property)}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteProperty')}</AlertDialogTitle>
            <AlertDialogDescription>{t('confirmDelete')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
            <AlertDialogAction data-pm-write-resource="properties" onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {tc('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

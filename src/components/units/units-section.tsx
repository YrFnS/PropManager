'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Plus, Search, DoorOpen, Pencil, Trash2 } from 'lucide-react';
import EmptyState from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { BulkActionsBar } from '@/components/ui/bulk-actions-bar';
import { STATUS_COLORS, DEFAULT_STATUS_COLOR } from '@/lib/status-config';
import { toast } from 'sonner';
import { useEffect, useState, useCallback } from 'react';
import UnitDetailSheet from './unit-detail-sheet';
import { setRouteIntent, useRouteIntent } from '@/lib/route-intent';

interface Unit {
  id: string;
  unitNumber: string;
  floor: number | null;
  rooms: number;
  bathrooms: number;
  area: number | null;
  rentAmount: number;
  status: string;
  propertyId: string;
  property: { id: string; name: string; nameAr: string | null; city: string };
  lease: { tenant: { id: string; name: string; nameAr: string | null } }[];
}

interface PropertyInfo {
  id: string;
  name: string;
  nameAr: string | null;
}

const defaultForm = {
  unitNumber: '', propertyId: '', floor: '', rooms: '1', bathrooms: '1',
  area: '', rentAmount: '', status: 'available',
};

export default function UnitsSection() {
  const t = useTranslations('units');
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const isAr = locale === 'ar';

  const [units, setUnits] = useState<Unit[]>([]);
  const [properties, setProperties] = useState<PropertyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Unit | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [form, setForm] = useState({ ...defaultForm });

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Unit Detail Sheet state
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const fetchUnits = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
    if (propertyFilter && propertyFilter !== 'all') params.set('propertyId', propertyFilter);
    fetch(`/api/units?${params.toString()}`)
      .then(r => r.json())
      .then(data => { setUnits(data.data || data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [search, statusFilter, propertyFilter]);

  useEffect(() => {
    fetch('/api/properties').then(r => r.json()).then(data => setProperties(data.data || data)).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (propertyFilter && propertyFilter !== 'all') params.set('propertyId', propertyFilter);
      try {
        const r = await fetch(`/api/units?${params.toString()}`);
        const data = await r.json();
        if (cancelled) return;
        setUnits(data.data || data);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [search, statusFilter, propertyFilter]);

  const openAddDialog = () => {
    setEditingId(null);
    setForm({ ...defaultForm });
    setDialogOpen(true);
  };

  const openEditDialog = (unit: Unit) => {
    setEditingId(unit.id);
    setForm({
      unitNumber: unit.unitNumber,
      propertyId: unit.propertyId,
      floor: unit.floor != null ? String(unit.floor) : '',
      rooms: String(unit.rooms),
      bathrooms: String(unit.bathrooms),
      area: unit.area != null ? String(unit.area) : '',
      rentAmount: String(unit.rentAmount),
      status: unit.status,
    });
    setDialogOpen(true);
  };

  const handleUnitClick = (unit: Unit) => {
    setSelectedUnitId(unit.id);
    setDetailSheetOpen(true);
  };

  const handleViewTenant = (tenantId: string) => {
    setRouteIntent({ section: 'tenants', recordId: tenantId });
    router.push('tenants');
  };

  const handleEditFromSheet = (unit: {
    id: string;
    unitNumber: string;
    propertyId: string;
    floor: number | null;
    rooms: number;
    bathrooms: number;
    area: number | null;
    rentAmount: number;
    status: string;
  }) => {
    setEditingId(unit.id);
    setForm({
      unitNumber: unit.unitNumber,
      propertyId: unit.propertyId,
      floor: unit.floor != null ? String(unit.floor) : '',
      rooms: String(unit.rooms),
      bathrooms: String(unit.bathrooms),
      area: unit.area != null ? String(unit.area) : '',
      rentAmount: String(unit.rentAmount),
      status: unit.status,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        unitNumber: form.unitNumber,
        propertyId: form.propertyId,
        floor: form.floor ? parseInt(form.floor) : null,
        rooms: parseInt(form.rooms),
        bathrooms: parseInt(form.bathrooms),
        area: form.area ? parseFloat(form.area) : null,
        rentAmount: parseFloat(form.rentAmount),
        status: form.status,
      };

      if (editingId) {
        const res = await fetch('/api/units', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...payload }),
        });
        if (res.ok) {
          toast.success(tc('success'));
          setDialogOpen(false);
          setEditingId(null);
          setForm({ ...defaultForm });
          fetchUnits();
        } else {
          toast.error(tc('error'));
        }
      } else {
        const res = await fetch('/api/units', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          toast.success(t('createSuccess'));
          setForm({ ...defaultForm });
          setDialogOpen(false);
          fetchUnits();
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
      const res = await fetch(`/api/units?id=${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(tc('success'));
        setDeleteTarget(null);
        fetchUnits();
      } else {
        toast.error(tc('error'));
      }
    } catch {
      toast.error(tc('error'));
    }
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
    setSelectedIds(new Set(units.map(u => u.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    try {
      const promises = Array.from(selectedIds).map(id =>
        fetch(`/api/units?id=${id}`, { method: 'DELETE' })
      );
      const results = await Promise.allSettled(promises);
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      toast.success(`${succeeded} ${tc('deletedSuccessfully')}`);
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      fetchUnits();
    } catch {
      toast.error(tc('error'));
    }
  };

  const handleBulkExport = () => {
    const selectedUnits = units.filter(u => selectedIds.has(u.id));
    const headers = ['Unit Number', 'Property', 'Floor', 'Rooms', 'Bathrooms', 'Area', 'Rent Amount', 'Status', 'Tenant'];
    const rows = selectedUnits.map(u => [
      u.unitNumber,
      isAr && u.property.nameAr ? u.property.nameAr : u.property.name,
      String(u.floor ?? ''),
      String(u.rooms),
      String(u.bathrooms),
      u.area ? String(u.area) : '',
      String(u.rentAmount),
      u.status,
      u.lease?.[0]?.tenant ? (isAr && u.lease[0].tenant.nameAr ? u.lease[0].tenant.nameAr : u.lease[0].tenant.name) : '',
    ]);
    const csvContent = [headers, ...rows].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'units.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      available: t('available'),
      rented: t('rented'),
      maintenance: t('maintenance'),
    };
    return labels[status] || status;
  };

  const getStatusBadge = (status: string) => STATUS_COLORS[status] || DEFAULT_STATUS_COLOR;

  useRouteIntent({
    section: 'units',
    onAdd: openAddDialog,
    onRecord: (unitId) => {
      setSelectedUnitId(unitId);
      setDetailSheetOpen(true);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight gradient-text">{t('title')}</h1>
          {units.length > 0 && <Badge variant="secondary">{units.length}</Badge>}
        </div>
        <Button onClick={openAddDialog}><Plus className="h-4 w-4 me-2" />{t('addUnit')}</Button>
      </div>

      {/* Unit Detail Sheet */}
      <UnitDetailSheet
        unitId={selectedUnitId}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        onEdit={handleEditFromSheet}
        onViewTenant={handleViewTenant}
      />

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? t('editUnit') : t('addUnit')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('unitNumber')}</Label>
                <Input value={form.unitNumber} onChange={e => setForm({ ...form, unitNumber: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t('property')}</Label>
                <Select value={form.propertyId} onValueChange={v => setForm({ ...form, propertyId: v })}>
                  <SelectTrigger><SelectValue placeholder={tc('all')} /></SelectTrigger>
                  <SelectContent>
                    {properties.map(p => (
                      <SelectItem key={p.id} value={p.id}>{isAr && p.nameAr ? p.nameAr : p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>{t('floor')}</Label>
                <Input type="number" value={form.floor} onChange={e => setForm({ ...form, floor: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t('rooms')}</Label>
                <Input type="number" value={form.rooms} onChange={e => setForm({ ...form, rooms: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t('bathrooms')}</Label>
                <Input type="number" value={form.bathrooms} onChange={e => setForm({ ...form, bathrooms: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t('area')}</Label>
                <Input type="number" value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('rentAmount')}</Label>
                <Input type="number" value={form.rentAmount} onChange={e => setForm({ ...form, rentAmount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t('status')}</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">{t('available')}</SelectItem>
                    <SelectItem value="rented">{t('rented')}</SelectItem>
                    <SelectItem value="maintenance">{t('maintenance')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{tc('cancel')}</Button>
            <Button onClick={handleSubmit} disabled={submitting || !form.unitNumber || !form.propertyId || !form.rentAmount}>
              {submitting ? tc('loading') : tc('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={tc('search')} value={search} onChange={e => setSearch(e.target.value)} className="ps-9 focus:ring-2 focus:ring-primary/20 transition-all duration-200" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder={tc('status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tc('all')}</SelectItem>
            <SelectItem value="available">{t('available')}</SelectItem>
            <SelectItem value="rented">{t('rented')}</SelectItem>
            <SelectItem value="maintenance">{t('maintenance')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={propertyFilter} onValueChange={setPropertyFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder={t('property')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tc('all')}</SelectItem>
            {properties.map(p => (
              <SelectItem key={p.id} value={p.id}>{isAr && p.nameAr ? p.nameAr : p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-4">
          {/* Skeleton stat cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                    <TableHead key={i}><Skeleton className="h-4 w-14" /></TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1, 2, 3, 4, 5].map(row => (
                  <TableRow key={row}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(cell => (
                      <TableCell key={cell}><Skeleton className={cell === 1 ? 'h-4 w-20' : cell === 7 ? 'h-4 w-16' : 'h-4 w-14'} /></TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : units.length === 0 ? (
        <EmptyState
          icon={DoorOpen}
          title={t('title')}
          description={t('noUnitsDescription')}
          actionLabel={t('addUnit')}
          onAction={openAddDialog}
        />
      ) : isMobile ? (
        <div className="grid gap-3">
          {units.map(u => (
            <Card
              key={u.id}
              role="button"
              tabIndex={0}
              className="group cursor-pointer hover:shadow-lg hover:scale-[1.01] transition-all duration-200"
              onClick={() => handleUnitClick(u)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') handleUnitClick(u);
              }}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedIds.has(u.id)}
                      onCheckedChange={() => toggleSelect(u.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <DoorOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{u.unitNumber}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge className={getStatusBadge(u.status)}>{getStatusLabel(u.status)}</Badge>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEditDialog(u); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{tc('edit')}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget(u); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{tc('delete')}</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {isAr && u.property.nameAr ? u.property.nameAr : u.property.name}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span>{t('rooms')}: {u.rooms}</span>
                  <span>{t('bathrooms')}: {u.bathrooms}</span>
                  {u.area && <span>{u.area} {tc('squareMeters')}</span>}
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{tc('currency')}{u.rentAmount.toLocaleString()}</span>
                  {u.lease?.[0]?.tenant && (
                    <span className="text-sm text-muted-foreground">
                      {t('tenant')}: {isAr && u.lease[0].tenant.nameAr ? u.lease[0].tenant.nameAr : u.lease[0].tenant.name}
                    </span>
                  )}
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
                    checked={selectedIds.size === units.length && units.length > 0}
                    onCheckedChange={(checked) => { if (checked) selectAll(); else clearSelection(); }}
                  />
                </TableHead>
                <TableHead>{t('unitNumber')}</TableHead>
                <TableHead>{t('property')}</TableHead>
                <TableHead>{t('floor')}</TableHead>
                <TableHead>{t('rooms')}</TableHead>
                <TableHead>{t('bathrooms')}</TableHead>
                <TableHead>{t('area')}</TableHead>
                <TableHead>{t('rentAmount')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead>{t('tenant')}</TableHead>
                <TableHead className="w-[80px]">{tc('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((u, idx) => (
                <TableRow
                  key={u.id}
                  className={`hover:bg-muted/50 cursor-pointer ${idx % 2 === 1 ? 'bg-muted/20' : ''} ${selectedIds.has(u.id) ? 'bg-primary/5' : ''}`}
                  onClick={() => handleUnitClick(u)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(u.id)}
                      onCheckedChange={() => toggleSelect(u.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{u.unitNumber}</TableCell>
                  <TableCell>{isAr && u.property.nameAr ? u.property.nameAr : u.property.name}</TableCell>
                  <TableCell>{u.floor ?? '-'}</TableCell>
                  <TableCell>{u.rooms}</TableCell>
                  <TableCell>{u.bathrooms}</TableCell>
                  <TableCell>{u.area ? `${u.area} ${tc('squareMeters')}` : '-'}</TableCell>
                  <TableCell>{tc('currency')}{u.rentAmount.toLocaleString()}</TableCell>
                  <TableCell><Badge className={getStatusBadge(u.status)}>{getStatusLabel(u.status)}</Badge></TableCell>
                  <TableCell>
                    {u.lease?.[0]?.tenant
                      ? (isAr && u.lease[0].tenant.nameAr ? u.lease[0].tenant.nameAr : u.lease[0].tenant.name)
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-0.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEditDialog(u); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{tc('edit')}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget(u); }}>
                            <Trash2 className="h-3.5 w-3.5" />
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
        totalCount={units.length}
        onSelectAll={selectAll}
        onClearSelection={clearSelection}
        onDelete={() => setBulkDeleteOpen(true)}
        onExport={handleBulkExport}
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

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tc('delete')}</AlertDialogTitle>
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

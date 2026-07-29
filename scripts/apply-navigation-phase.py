from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace(path: str, old: str, new: str, count: int = -1) -> None:
    target = ROOT / path
    text = target.read_text()
    occurrences = text.count(old)
    if occurrences == 0:
        raise RuntimeError(f"Expected source fragment was not found in {path}: {old!r}")
    if count > 0 and occurrences < count:
        raise RuntimeError(f"Expected at least {count} occurrences in {path}, found {occurrences}: {old!r}")
    target.write_text(text.replace(old, new, count))


route_intent = """'use client';

import { useEffect, useRef } from 'react';

const STORAGE_KEY = 'pm_route_intent';
const EVENT_NAME = 'pm-route-intent';
const MAX_AGE_MS = 60_000;

export interface RouteIntent {
  section: string;
  action?: 'add';
  recordId?: string;
  createdAt?: number;
}

interface RouteIntentHandlers {
  section: string;
  ready?: boolean;
  onAdd?: () => void | Promise<void>;
  onRecord?: (recordId: string) => void | Promise<void>;
}

function isRouteIntent(value: unknown): value is RouteIntent {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RouteIntent>;
  return typeof candidate.section === 'string';
}

function readStoredIntent(): RouteIntent | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isRouteIntent(parsed) ? parsed : null;
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function setRouteIntent(intent: Omit<RouteIntent, 'createdAt'>) {
  const prepared: RouteIntent = { ...intent, createdAt: Date.now() };
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(prepared));
  window.dispatchEvent(new CustomEvent<RouteIntent>(EVENT_NAME, { detail: prepared }));
}

export function useRouteIntent({ section, ready = true, onAdd, onRecord }: RouteIntentHandlers) {
  const addHandler = useRef(onAdd);
  const recordHandler = useRef(onRecord);

  useEffect(() => {
    addHandler.current = onAdd;
    recordHandler.current = onRecord;
  }, [onAdd, onRecord]);

  useEffect(() => {
    if (!ready) return;

    const applyIntent = (intent: RouteIntent | null) => {
      if (!intent || intent.section !== section) return;
      if (intent.createdAt && Date.now() - intent.createdAt > MAX_AGE_MS) {
        window.sessionStorage.removeItem(STORAGE_KEY);
        return;
      }

      window.sessionStorage.removeItem(STORAGE_KEY);
      if (intent.action === 'add') {
        void addHandler.current?.();
      } else if (intent.recordId) {
        void recordHandler.current?.(intent.recordId);
      }
    };

    const listener = (event: Event) => {
      applyIntent((event as CustomEvent<RouteIntent>).detail);
    };

    window.addEventListener(EVENT_NAME, listener);
    applyIntent(readStoredIntent());
    return () => window.removeEventListener(EVENT_NAME, listener);
  }, [ready, section]);
}
"""
(ROOT / "src/lib/route-intent.ts").write_text(route_intent)

# Command palette: persist intent before navigation so it survives a route change.
replace(
    "src/components/layout/command-palette.tsx",
    "import { useRouter } from '@/i18n/routing';\n",
    "import { useRouter } from '@/i18n/routing';\nimport { setRouteIntent } from '@/lib/route-intent';\n",
)
replace(
    "src/components/layout/command-palette.tsx",
    """  const handleActionSelect = (action: ActionItem) => {
    router.push(action.section);
    setCommandPaletteOpen(false);
    window.dispatchEvent(new CustomEvent('command-palette-action', { detail: { action: action.key } }));
  };

  const handleSearchResultSelect = (item: SearchResultItem) => {
    router.push(item.section as Section);
    setCommandPaletteOpen(false);
  };
""",
    """  const handleActionSelect = (action: ActionItem) => {
    setRouteIntent({ section: action.section, action: 'add' });
    router.push(action.section);
    setCommandPaletteOpen(false);
  };

  const handleSearchResultSelect = (item: SearchResultItem) => {
    setRouteIntent({ section: item.section, recordId: item.id });
    router.push(item.section as Section);
    setCommandPaletteOpen(false);
  };
""",
)

# Dashboard quick actions use the same durable intent channel.
replace(
    "src/components/dashboard/dashboard-section.tsx",
    "import HealthScoreCard from '@/components/dashboard/health-score-card';\n",
    "import HealthScoreCard from '@/components/dashboard/health-score-card';\nimport { setRouteIntent } from '@/lib/route-intent';\n",
)
replace(
    "src/components/dashboard/dashboard-section.tsx",
    """  const quickActions = [
    { label: t('addProperty'), icon: Building2, section: 'properties' as const },
    { label: t('addTenant'), icon: Users, section: 'tenants' as const },
    { label: t('recordPayment'), icon: DollarSign, section: 'payments' as const },
    { label: t('newMaintenance'), icon: Wrench, section: 'maintenance' as const },
    { label: t('viewMessages'), icon: MessageSquare, section: 'messages' as const },
  ];
""",
    """  const quickActions = [
    { label: t('addProperty'), icon: Building2, section: 'properties' as const, action: 'add' as const },
    { label: t('addTenant'), icon: Users, section: 'tenants' as const, action: 'add' as const },
    { label: t('recordPayment'), icon: DollarSign, section: 'payments' as const, action: 'add' as const },
    { label: t('newMaintenance'), icon: Wrench, section: 'maintenance' as const, action: 'add' as const },
    { label: t('viewMessages'), icon: MessageSquare, section: 'messages' as const },
  ];
""",
)
replace(
    "src/components/dashboard/dashboard-section.tsx",
    "            onClick={() => router.push(action.section)}\n",
    """            onClick={() => {
              if (action.action === 'add') setRouteIntent({ section: action.section, action: 'add' });
              router.push(action.section);
            }}
""",
)

# Properties: fix the All filter and consume add/detail intents.
replace(
    "src/components/properties/properties-section.tsx",
    "import { useEffect, useState } from 'react';\n",
    "import { useEffect, useState } from 'react';\nimport { useRouteIntent } from '@/lib/route-intent';\n",
)
replace(
    "src/components/properties/properties-section.tsx",
    "  const [typeFilter, setTypeFilter] = useState('');\n",
    "  const [typeFilter, setTypeFilter] = useState('all');\n",
)
replace(
    "src/components/properties/properties-section.tsx",
    "if (typeFilter) params.set('type', typeFilter);",
    "if (typeFilter !== 'all') params.set('type', typeFilter);",
)
replace(
    "src/components/properties/properties-section.tsx",
    "  const updateForm = (key: string, value: any) => setForm((p: any) => ({ ...p, [key]: value }));\n\n",
    """  const updateForm = (key: string, value: any) => setForm((p: any) => ({ ...p, [key]: value }));

  useRouteIntent({
    section: 'properties',
    onAdd: openAddDialog,
    onRecord: openDetailSheet,
  });

""",
)

# Tenants: quick add and search results open the correct detail sheet.
replace(
    "src/components/tenants/tenants-section.tsx",
    "import { useEffect, useState, useCallback } from 'react';\n",
    "import { useEffect, useState, useCallback } from 'react';\nimport { useRouteIntent } from '@/lib/route-intent';\n",
)
replace(
    "src/components/tenants/tenants-section.tsx",
    """  const getStatusLabel = (status: string) => {
    return status === 'active' ? t('active') : t('inactive');
  };

""",
    """  const getStatusLabel = (status: string) => {
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

""",
)

# Units: open mobile cards, route tenant links to the exact tenant, and consume record intents.
replace(
    "src/components/units/units-section.tsx",
    "import UnitDetailSheet from './unit-detail-sheet';\n",
    "import UnitDetailSheet from './unit-detail-sheet';\nimport { setRouteIntent, useRouteIntent } from '@/lib/route-intent';\n",
)
replace(
    "src/components/units/units-section.tsx",
    """  const handleViewTenant = (_tenantId: string) => {
    router.push('tenants');
  };
""",
    """  const handleViewTenant = (tenantId: string) => {
    setRouteIntent({ section: 'tenants', recordId: tenantId });
    router.push('tenants');
  };
""",
)
replace(
    "src/components/units/units-section.tsx",
    "  const getStatusBadge = (status: string) => STATUS_COLORS[status] || DEFAULT_STATUS_COLOR;\n\n",
    """  const getStatusBadge = (status: string) => STATUS_COLORS[status] || DEFAULT_STATUS_COLOR;

  useRouteIntent({
    section: 'units',
    onAdd: openAddDialog,
    onRecord: (unitId) => {
      setSelectedUnitId(unitId);
      setDetailSheetOpen(true);
    },
  });

""",
)
replace(
    "src/components/units/units-section.tsx",
    "<TableCell key={cell}><Skeleton className={`h-4 w-${cell === 1 ? 20 : cell === 7 ? 16 : 14}`} /></TableCell>",
    "<TableCell key={cell}><Skeleton className={cell === 1 ? 'h-4 w-20' : cell === 7 ? 'h-4 w-16' : 'h-4 w-14'} /></TableCell>",
)
replace(
    "src/components/units/units-section.tsx",
    """            <Card
              key={u.id}
              className="group hover:shadow-lg hover:scale-[1.01] transition-all duration-200"
            >
""",
    """            <Card
              key={u.id}
              role="button"
              tabIndex={0}
              className="group cursor-pointer hover:shadow-lg hover:scale-[1.01] transition-all duration-200"
              onClick={() => handleUnitClick(u)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') handleUnitClick(u);
              }}
            >
""",
)

# Payments: exact search results open the receipt; quick action opens the create form.
replace(
    "src/components/payments/payments-section.tsx",
    "import { DEFAULT_STATUS_COLOR, STATUS_COLORS } from '@/lib/status-config';\n",
    "import { DEFAULT_STATUS_COLOR, STATUS_COLORS } from '@/lib/status-config';\nimport { useRouteIntent } from '@/lib/route-intent';\n",
)
replace(
    "src/components/payments/payments-section.tsx",
    """  const openEdit = (payment: Payment) => {
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

""",
    """  const openEdit = (payment: Payment) => {
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

""",
)

# Leases: exact search results open the existing lease form.
replace(
    "src/components/leases/leases-section.tsx",
    "import { DEFAULT_STATUS_COLOR, STATUS_COLORS } from '@/lib/status-config';\n",
    "import { DEFAULT_STATUS_COLOR, STATUS_COLORS } from '@/lib/status-config';\nimport { useRouteIntent } from '@/lib/route-intent';\n",
)
replace(
    "src/components/leases/leases-section.tsx",
    """  const openEdit = (lease: Lease) => {
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

""",
    """  const openEdit = (lease: Lease) => {
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

""",
)

# Maintenance: quick add, exact record navigation, and client-side required-description validation.
replace(
    "src/components/maintenance/maintenance-section.tsx",
    "import { useEffect, useState, useCallback } from 'react';\n",
    "import { useEffect, useState, useCallback } from 'react';\nimport { useRouteIntent } from '@/lib/route-intent';\n",
)
replace(
    "src/components/maintenance/maintenance-section.tsx",
    """  const handleOpenEdit = (req: MaintenanceRequest) => {
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

""",
    """  const handleOpenEdit = (req: MaintenanceRequest) => {
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

  const openMaintenanceRecord = async (requestId: string) => {
    try {
      const response = await fetch(`/api/maintenance?id=${encodeURIComponent(requestId)}&limit=1`, { cache: 'no-store' });
      if (!response.ok) throw new Error(tc('error'));
      const payload = await response.json();
      const maintenanceRequest = Array.isArray(payload.data) ? payload.data[0] : null;
      if (!maintenanceRequest) throw new Error(isAr ? 'لم يتم العثور على طلب الصيانة.' : 'Maintenance request not found.');
      handleOpenEdit(maintenanceRequest);
    } catch (recordError) {
      toast.error(recordError instanceof Error ? recordError.message : tc('error'));
    }
  };

  useRouteIntent({ section: 'maintenance', onAdd: handleOpenAdd, onRecord: openMaintenanceRecord });

""",
)
replace(
    "src/components/maintenance/maintenance-section.tsx",
    """  const handleSubmit = async () => {
    setSubmitting(true);
""",
    """  const handleSubmit = async () => {
    if (!form.description.trim()) {
      toast.error(isAr ? 'وصف طلب الصيانة مطلوب.' : 'A maintenance description is required.');
      return;
    }
    setSubmitting(true);
""",
)

# Messages: remove the nested trigger, check mutation responses, and expand exact search results.
replace(
    "src/components/messages/messages-section.tsx",
    "import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';\n",
    "import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';\n",
)
replace(
    "src/components/messages/messages-section.tsx",
    "import { useEffect, useState, useCallback } from 'react';\n",
    "import { useEffect, useState, useCallback } from 'react';\nimport { useRouteIntent } from '@/lib/route-intent';\n",
)
replace(
    "src/components/messages/messages-section.tsx",
    """const emptyForm = {
  senderName: '', senderEmail: '', subject: '', content: '', category: 'general',
};

""",
    """const emptyForm = {
  senderName: '', senderEmail: '', subject: '', content: '', category: 'general',
};

async function messageResponseError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null);
  return typeof payload?.error === 'string' ? payload.error : fallback;
}

""",
)
replace(
    "src/components/messages/messages-section.tsx",
    """  const handleOpenAdd = () => {
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

""",
    """  const handleOpenAdd = () => {
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openMessageRecord = async (messageId: string) => {
    try {
      const response = await fetch(`/api/messages?id=${encodeURIComponent(messageId)}&limit=1`, { cache: 'no-store' });
      if (!response.ok) throw new Error(await messageResponseError(response, tc('error')));
      const payload = await response.json();
      const message = Array.isArray(payload.data) ? payload.data[0] : null;
      if (!message) throw new Error(isAr ? 'لم يتم العثور على الرسالة.' : 'Message not found.');
      setMessages([message]);
      setExpandedId(message.id);
    } catch (recordError) {
      toast.error(recordError instanceof Error ? recordError.message : tc('error'));
    }
  };

  useRouteIntent({ section: 'messages', onAdd: handleOpenAdd, onRecord: openMessageRecord });

""",
)
replace(
    "src/components/messages/messages-section.tsx",
    """      await fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: msg.id, isRead: newRead }),
      });
      fetchMessages();
""",
    """      const response = await fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: msg.id, isRead: newRead }),
      });
      if (!response.ok) throw new Error(await messageResponseError(response, tc('error')));
      fetchMessages();
""",
)
replace(
    "src/components/messages/messages-section.tsx",
    """      await fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });
      fetchMessages();
""",
    """      const response = await fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });
      if (!response.ok) throw new Error(await messageResponseError(response, tc('error')));
      fetchMessages();
""",
)
replace(
    "src/components/messages/messages-section.tsx",
    """        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button variant="outline" onClick={handleMarkAllRead}>
                  <CheckCheck className="h-4 w-4 me-2" />{t('markAllRead')}
                </Button>
              )}
              <Button onClick={handleOpenAdd}><Plus className="h-4 w-4 me-2" />{t('newMessage')}</Button>
            </div>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
""",
    """        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" onClick={handleMarkAllRead}>
              <CheckCheck className="h-4 w-4 me-2" />{t('markAllRead')}
            </Button>
          )}
          <Button onClick={handleOpenAdd}><Plus className="h-4 w-4 me-2" />{t('newMessage')}</Button>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
""",
)

# Exact record filters for list APIs used by route-intent consumers.
replace(
    "src/app/api/payments/route.ts",
    """    const status = searchParams.get('status') || '';
    const method = searchParams.get('method') || '';
""",
    """    const id = searchParams.get('id') || '';
    const status = searchParams.get('status') || '';
    const method = searchParams.get('method') || '';
""",
)
replace(
    "src/app/api/payments/route.ts",
    """    const where: Prisma.PaymentWhereInput = {};
    if (status && status !== 'all') where.status = status;
""",
    """    const where: Prisma.PaymentWhereInput = {};
    if (id) where.id = id;
    if (status && status !== 'all') where.status = status;
""",
)
replace(
    "src/app/api/leases/route.ts",
    """    const status = searchParams.get('status') || '';
    const { page, limit, skip } = getPagination(searchParams);
    const where: Prisma.LeaseWhereInput = status && status !== 'all' ? { status } : {};
""",
    """    const id = searchParams.get('id') || '';
    const status = searchParams.get('status') || '';
    const { page, limit, skip } = getPagination(searchParams);
    const where: Prisma.LeaseWhereInput = {};
    if (id) where.id = id;
    if (status && status !== 'all') where.status = status;
""",
)
replace(
    "src/app/api/maintenance/route.ts",
    """    const status = searchParams.get('status') || '';
    const priority = searchParams.get('priority') || '';
""",
    """    const id = searchParams.get('id') || '';
    const status = searchParams.get('status') || '';
    const priority = searchParams.get('priority') || '';
""",
)
replace(
    "src/app/api/maintenance/route.ts",
    """    const where: Prisma.MaintenanceRequestWhereInput = {};
    if (status && status !== 'all') where.status = status;
""",
    """    const where: Prisma.MaintenanceRequestWhereInput = {};
    if (id) where.id = id;
    if (status && status !== 'all') where.status = status;
""",
)
replace(
    "src/app/api/messages/route.ts",
    """    const category = searchParams.get('category') || '';
    const isRead = searchParams.get('isRead');
""",
    """    const id = searchParams.get('id') || '';
    const category = searchParams.get('category') || '';
    const isRead = searchParams.get('isRead');
""",
)
replace(
    "src/app/api/messages/route.ts",
    """    const where: any = {};
    if (category) where.category = category;
""",
    """    const where: any = {};
    if (id) where.id = id;
    if (category && category !== 'all') where.category = category;
""",
)

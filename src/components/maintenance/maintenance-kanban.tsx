'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { PRIORITY_COLORS, DEFAULT_STATUS_COLOR } from '@/lib/status-config';
import { AlertCircle, Wrench, CheckCircle, XCircle, GripVertical } from 'lucide-react';

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

interface KanbanColumnProps {
  id: string;
  title: string;
  headerColor: string;
  headerBg: string;
  icon: typeof AlertCircle;
  requests: MaintenanceRequest[];
  isAr: boolean;
  t: ReturnType<typeof useTranslations>;
  tc: ReturnType<typeof useTranslations>;
  getCategoryLabel: (c: string) => string;
}

function SortableCard({
  request,
  isAr,
  t,
  getCategoryLabel,
}: {
  request: MaintenanceRequest;
  isAr: boolean;
  t: ReturnType<typeof useTranslations>;
  getCategoryLabel: (c: string) => string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: request.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const title = isAr && request.titleAr ? request.titleAr : request.title;
  const propertyName = isAr && request.property.nameAr ? request.property.nameAr : request.property.name;

  return (
    <Card ref={setNodeRef} style={style} className="mb-2 cursor-default hover:shadow-md transition-shadow">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <button
            className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{title}</p>
          </div>
          <Badge className={`text-xs shrink-0 ${PRIORITY_COLORS[request.priority] || DEFAULT_STATUS_COLOR}`}>
            {request.priority}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap ps-6">
          <Badge variant="outline" className="text-xs">{getCategoryLabel(request.category)}</Badge>
          <span className="text-xs text-muted-foreground truncate">
            {propertyName}{request.unit ? ` · ${request.unit.unitNumber}` : ''}
          </span>
        </div>
        {request.assignedTo && (
          <p className="text-xs text-muted-foreground ps-6">
            {t('assignedTo')}: {request.assignedTo}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function KanbanColumn({
  id,
  title,
  headerColor,
  headerBg,
  icon: Icon,
  requests,
  isAr,
  t,
  tc,
  getCategoryLabel,
}: KanbanColumnProps) {
  const requestIds = useMemo(() => requests.map(r => r.id), [requests]);

  return (
    <div className="flex flex-col min-w-[260px] sm:min-w-0">
      <div className={`flex items-center gap-2 rounded-t-lg px-3 py-2 ${headerBg}`}>
        <Icon className={`h-4 w-4 ${headerColor}`} />
        <h3 className={`text-sm font-semibold ${headerColor}`}>{title}</h3>
        <Badge variant="secondary" className="text-xs ms-auto">{requests.length}</Badge>
      </div>
      <div className="flex-1 rounded-b-lg border border-t-0 bg-muted/30 p-2 min-h-[200px] max-h-[60vh] overflow-y-auto scrollbar-thin">
        <SortableContext items={requestIds} strategy={verticalListSortingStrategy}>
          {requests.length > 0 ? (
            requests.map(request => (
              <SortableCard
                key={request.id}
                request={request}
                isAr={isAr}
                t={t}
                getCategoryLabel={getCategoryLabel}
              />
            ))
          ) : (
            <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
              {tc('noData')}
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}

interface MaintenanceKanbanProps {
  requests: MaintenanceRequest[];
  onUpdate: () => void;
}

const COLUMNS = [
  { id: 'open', labelKey: 'kanbanOpen', headerColor: 'text-blue-700 dark:text-blue-400', headerBg: 'bg-blue-50 dark:bg-blue-950/30', icon: AlertCircle },
  { id: 'in_progress', labelKey: 'kanbanInProgress', headerColor: 'text-amber-700 dark:text-amber-400', headerBg: 'bg-amber-50 dark:bg-amber-950/30', icon: Wrench },
  { id: 'resolved', labelKey: 'kanbanResolved', headerColor: 'text-emerald-700 dark:text-emerald-400', headerBg: 'bg-emerald-50 dark:bg-emerald-950/30', icon: CheckCircle },
  { id: 'closed', labelKey: 'kanbanClosed', headerColor: 'text-gray-700 dark:text-gray-400', headerBg: 'bg-gray-50 dark:bg-gray-900/30', icon: XCircle },
] as const;

export default function MaintenanceKanban({ requests, onUpdate }: MaintenanceKanbanProps) {
  const t = useTranslations('maintenance');
  const tc = useTranslations('common');
  const locale = useLocale();
  const isAr = locale === 'ar';
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const getCategoryLabel = useCallback((c: string) => {
    const labels: Record<string, string> = {
      plumbing: t('plumbing'), electrical: t('electrical'), structural: t('structural'),
      appliance: t('appliance'), hvac: t('hvac'), other: t('other'),
    };
    return labels[c] || c;
  }, [t]);

  // Group requests by status
  const columnRequests = useMemo(() => {
    const grouped: Record<string, MaintenanceRequest[]> = {
      open: [],
      in_progress: [],
      resolved: [],
      closed: [],
    };
    for (const req of requests) {
      if (grouped[req.status]) {
        grouped[req.status].push(req);
      }
    }
    return grouped;
  }, [requests]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeRequestId = String(active.id);
    // Determine the target column
    let targetStatus: string | null = null;

    // Check if dropped on a column
    for (const col of COLUMNS) {
      if (String(over.id) === col.id) {
        targetStatus = col.id;
        break;
      }
    }

    // If dropped on another card, find its column
    if (!targetStatus) {
      const overRequestId = String(over.id);
      const overRequest = requests.find(r => r.id === overRequestId);
      if (overRequest) {
        targetStatus = overRequest.status;
      }
    }

    if (!targetStatus) return;

    const activeRequest = requests.find(r => r.id === activeRequestId);
    if (!activeRequest || activeRequest.status === targetStatus) return;

    // Optimistically update
    try {
      const res = await fetch('/api/maintenance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeRequestId,
          status: targetStatus,
          propertyId: activeRequest.property.id,
          unitId: activeRequest.unit?.id || null,
          tenantId: activeRequest.tenant?.id || null,
          title: activeRequest.title,
          titleAr: activeRequest.titleAr,
          description: activeRequest.description,
          descriptionAr: activeRequest.descriptionAr,
          priority: activeRequest.priority,
          category: activeRequest.category,
          assignedTo: activeRequest.assignedTo,
        }),
      });

      if (res.ok) {
        toast.success(t('statusUpdated'));
        onUpdate();
      } else {
        toast.error(tc('error'));
        onUpdate();
      }
    } catch {
      toast.error(tc('error'));
      onUpdate();
    }
  };

  const activeRequest = activeId ? requests.find(r => r.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            title={t(col.labelKey as any)}
            headerColor={col.headerColor}
            headerBg={col.headerBg}
            icon={col.icon}
            requests={columnRequests[col.id] || []}
            isAr={isAr}
            t={t}
            tc={tc}
            getCategoryLabel={getCategoryLabel}
          />
        ))}
      </div>
      <DragOverlay>
        {activeRequest ? (
          <Card className="shadow-xl rotate-2 opacity-90">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium truncate">
                  {isAr && activeRequest.titleAr ? activeRequest.titleAr : activeRequest.title}
                </p>
                <Badge className={`text-xs ${PRIORITY_COLORS[activeRequest.priority] || DEFAULT_STATUS_COLOR}`}>
                  {activeRequest.priority}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-xs">{getCategoryLabel(activeRequest.category)}</Badge>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

'use client';

import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { Trash2, Download, X, CheckSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode } from 'react';

interface BulkActionsBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDelete?: () => void;
  onExport?: () => void;
  onMarkPaid?: () => void;
  onChangeStatus?: ReactNode;
  children?: ReactNode;
}

export function BulkActionsBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onDelete,
  onExport,
  onMarkPaid,
  onChangeStatus,
  children,
}: BulkActionsBarProps) {
  const tc = useTranslations('common');

  if (selectedCount === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed bottom-6 inset-x-0 z-50 flex justify-center pointer-events-none"
      >
        <div className="glass-card pointer-events-auto rounded-xl shadow-lg border px-4 py-3 flex items-center gap-3 flex-wrap justify-center max-w-2xl mx-4">
          {/* Selected count */}
          <span className="text-sm font-medium">
            {selectedCount} {tc('selected')}
          </span>

          {/* Select All / Clear */}
          {selectedCount < totalCount && (
            <Button variant="ghost" size="sm" onClick={onSelectAll} className="h-7 text-xs gap-1">
              <CheckSquare className="h-3.5 w-3.5" />
              {tc('selectAll')}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClearSelection} className="h-7 text-xs gap-1">
            <X className="h-3.5 w-3.5" />
            {tc('clearSelection')}
          </Button>

          <div className="h-5 w-px bg-border" />

          {/* Delete action */}
          {onDelete && (
            <Button variant="destructive" size="sm" onClick={onDelete} className="h-8 text-xs gap-1.5">
              <Trash2 className="h-3.5 w-3.5" />
              {tc('bulkDelete')}
            </Button>
          )}

          {/* Export action */}
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport} className="h-8 text-xs gap-1.5">
              <Download className="h-3.5 w-3.5" />
              {tc('bulkExport')}
            </Button>
          )}

          {/* Mark as Paid action */}
          {onMarkPaid && (
            <Button variant="outline" size="sm" onClick={onMarkPaid} className="h-8 text-xs gap-1.5">
              <CheckSquare className="h-3.5 w-3.5" />
              {tc('bulkMarkPaid')}
            </Button>
          )}

          {/* Change Status dropdown */}
          {onChangeStatus}

          {/* Custom actions */}
          {children}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

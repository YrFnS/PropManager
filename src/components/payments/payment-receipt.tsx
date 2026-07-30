'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Printer, Download, Building2 } from 'lucide-react';
import { STATUS_COLORS, DEFAULT_STATUS_COLOR } from '@/lib/status-config';
import { APP_CONFIG } from '@/lib/constants';
import { useOrganizationFormat } from '@/hooks/use-organization-format';

interface PaymentReceiptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: {
    id: string;
    amount: number;
    dueDate: string;
    paidDate: string | null;
    status: string;
    method: string | null;
    reference: string | null;
    notes: string | null;
    tenant: { name: string; nameAr: string | null; email?: string };
    lease: {
      unit: { unitNumber: string; property: { name: string; nameAr: string | null } };
    };
  } | null;
  receiptNumber?: string;
}

export default function PaymentReceipt({ open, onOpenChange, payment, receiptNumber }: PaymentReceiptProps) {
  const t = useTranslations('payments');
  const tc = useTranslations('common');
  const locale = useLocale();
  const isAr = locale === 'ar';
  const { formatCurrency, formatDate, formatLongDate } = useOrganizationFormat();

  if (!payment) return null;

  const tenantName = isAr && payment.tenant.nameAr ? payment.tenant.nameAr : payment.tenant.name;
  const propertyName = isAr && payment.lease?.unit?.property?.nameAr
    ? payment.lease.unit.property.nameAr
    : payment.lease?.unit?.property?.name || '-';
  const unitNumber = payment.lease?.unit?.unitNumber || '-';

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

  const rcpNumber = receiptNumber || `RCP-${payment.id.slice(-6).toUpperCase()}`;
  const receiptDate = payment.paidDate ? new Date(payment.paidDate) : new Date(payment.dueDate);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto no-print">
        <DialogHeader>
          <DialogTitle>{t('paymentReceipt')}</DialogTitle>
        </DialogHeader>

        {/* Receipt Content - This is the print area */}
        <div className="print-area bg-white text-gray-900 rounded-lg border p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-600 text-white">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{APP_CONFIG.name}</h2>
                <p className="text-sm text-gray-500">{APP_CONFIG.description}</p>
              </div>
            </div>
            <div className="text-end">
              <p className="text-lg font-bold text-teal-700">{t('paymentReceipt')}</p>
              <p className="text-sm text-gray-500">{t('receiptNumber')}: {rcpNumber}</p>
            </div>
          </div>

          <Separator />

          {/* Property & Tenant Info */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{tc('property') || 'Property'}</p>
              <p className="font-semibold text-gray-900">{propertyName}</p>
              <p className="text-sm text-gray-600">{t('propertyUnit')}: {unitNumber}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('tenant') || 'Tenant'}</p>
              <p className="font-semibold text-gray-900">{tenantName}</p>
              {payment.tenant.email && (
                <p className="text-sm text-gray-600">{payment.tenant.email}</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Payment Details Table */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('paymentDetails')}</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-600 w-[40%]">{t('receiptNumber')}</td>
                    <td className="px-4 py-2.5 text-gray-900">{rcpNumber}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="px-4 py-2.5 font-medium text-gray-600">{tc('date')}</td>
                    <td className="px-4 py-2.5 text-gray-900">{formatLongDate(receiptDate)}</td>
                  </tr>
                  <tr className="border-b bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-600">{t('amount')}</td>
                    <td className="px-4 py-2.5 text-gray-900 font-bold text-lg">{formatCurrency(payment.amount)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="px-4 py-2.5 font-medium text-gray-600">{t('method')}</td>
                    <td className="px-4 py-2.5 text-gray-900">{payment.method ? getMethodLabel(payment.method) : '-'}</td>
                  </tr>
                  {payment.reference && (
                    <tr className="border-b bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-600">{t('reference')}</td>
                      <td className="px-4 py-2.5 text-gray-900">{payment.reference}</td>
                    </tr>
                  )}
                  <tr className="border-b">
                    <td className="px-4 py-2.5 font-medium text-gray-600">{t('dueDate')}</td>
                    <td className="px-4 py-2.5 text-gray-900">{formatDate(payment.dueDate)}</td>
                  </tr>
                  {payment.paidDate && (
                    <tr className="border-b bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-600">{t('paidDate')}</td>
                      <td className="px-4 py-2.5 text-gray-900">{formatDate(payment.paidDate)}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="px-4 py-2.5 font-medium text-gray-600">{tc('status')}</td>
                    <td className="px-4 py-2.5">
                      <Badge className={STATUS_COLORS[payment.status] || DEFAULT_STATUS_COLOR}>
                        {getStatusLabel(payment.status)}
                      </Badge>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          {payment.notes && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{t('notes')}</p>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{payment.notes}</p>
            </div>
          )}

          <Separator />

          {/* Footer */}
          <div className="text-center space-y-2">
            <p className="text-teal-700 font-semibold text-lg">{t('thankYou')}</p>
            <div className="text-xs text-gray-400 space-y-0.5">
              <p>{APP_CONFIG.name} - {APP_CONFIG.description}</p>
              <p>{APP_CONFIG.contactEmail} · {APP_CONFIG.website}</p>
              <p>{formatLongDate(new Date())}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 no-print">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 me-2" />
            {t('printReceipt')}
          </Button>
          <Button variant="outline" onClick={handleDownloadPdf}>
            <Download className="h-4 w-4 me-2" />
            {t('downloadPdf')}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc('close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

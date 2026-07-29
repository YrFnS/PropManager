'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Mail, MailOpen, ChevronDown, ChevronUp, Trash2, CheckCheck } from 'lucide-react';
import EmptyState from '@/components/ui/empty-state';
import { toast } from 'sonner';
import { CATEGORY_COLORS, DEFAULT_STATUS_COLOR } from '@/lib/status-config';
import { useEffect, useState, useCallback } from 'react';
import { useRouteIntent } from '@/lib/route-intent';

interface Message {
  id: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  content: string;
  isRead: boolean;
  category: string;
  createdAt: string;
}

const emptyForm = {
  senderName: '', senderEmail: '', subject: '', content: '', category: 'general',
};

async function messageResponseError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null);
  return typeof payload?.error === 'string' ? payload.error : fallback;
}

export default function MessagesSection() {
  const t = useTranslations('messages');
  const tc = useTranslations('common');
  const locale = useLocale();
  const isAr = locale === 'ar';

  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [readFilter, setReadFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const fetchMessages = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (categoryFilter && categoryFilter !== 'all') params.set('category', categoryFilter);
    if (readFilter === 'read') params.set('isRead', 'true');
    else if (readFilter === 'unread') params.set('isRead', 'false');
    fetch(`/api/messages?${params.toString()}`)
      .then(r => r.json())
      .then(data => {
        const result = data.data || data;
        setMessages(result.messages || result || []);
        setUnreadCount(result.unreadCount || data.unreadCount || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [categoryFilter, readFilter]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (categoryFilter && categoryFilter !== 'all') params.set('category', categoryFilter);
      if (readFilter === 'read') params.set('isRead', 'true');
      else if (readFilter === 'unread') params.set('isRead', 'false');
      try {
        const r = await fetch(`/api/messages?${params.toString()}`);
        const data = await r.json();
        if (cancelled) return;
        const result = data.data || data;
        setMessages(result.messages || result || []);
        setUnreadCount(result.unreadCount || data.unreadCount || 0);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [categoryFilter, readFilter]);

  const handleOpenAdd = () => {
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

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderName: form.senderName,
          senderEmail: form.senderEmail,
          subject: form.subject,
          content: form.content,
          category: form.category,
        }),
      });
      if (res.ok) {
        setForm({ ...emptyForm });
        setDialogOpen(false);
        fetchMessages();
        toast.success(tc('createdSuccessfully'));
      } else {
        toast.error(tc('error'));
      }
    } catch {
      toast.error(tc('error'));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleRead = async (msg: Message) => {
    const newRead = !msg.isRead;
    try {
      const response = await fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: msg.id, isRead: newRead }),
      });
      if (!response.ok) throw new Error(await messageResponseError(response, tc('error')));
      fetchMessages();
      toast.success(newRead ? t('markAsRead') : t('markAsUnread'));
    } catch {
      toast.error(tc('error'));
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const response = await fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });
      if (!response.ok) throw new Error(await messageResponseError(response, tc('error')));
      fetchMessages();
      toast.success(t('markAllRead'));
    } catch {
      toast.error(tc('error'));
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/messages?id=${deleteId}`, { method: 'DELETE' });
      if (res.ok) {
        if (expandedId === deleteId) setExpandedId(null);
        fetchMessages();
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

  const getCategoryLabel = (c: string) => {
    const labels: Record<string, string> = {
      general: t('general'), maintenance: t('maintenance'), payment: t('payment'), lease: t('lease'), other: t('other'),
    };
    return labels[c] || c;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight gradient-text">{t('title')}</h1>
          {unreadCount > 0 && (
            <Badge variant="destructive">{unreadCount} {t('unreadMessages')}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" onClick={handleMarkAllRead}>
              <CheckCheck className="h-4 w-4 me-2" />{t('markAllRead')}
            </Button>
          )}
          <Button onClick={handleOpenAdd}><Plus className="h-4 w-4 me-2" />{t('newMessage')}</Button>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('newMessage')}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('senderName')}</Label>
                  <Input value={form.senderName} onChange={e => setForm({ ...form, senderName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{t('senderEmail')}</Label>
                  <Input type="email" value={form.senderEmail} onChange={e => setForm({ ...form, senderEmail: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('subject')}</Label>
                <Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t('content')}</Label>
                <Textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={4} />
              </div>
              <div className="space-y-2">
                <Label>{t('category')}</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue placeholder={t('selectCategory')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">{t('general')}</SelectItem>
                    <SelectItem value="maintenance">{t('maintenance')}</SelectItem>
                    <SelectItem value="payment">{t('payment')}</SelectItem>
                    <SelectItem value="lease">{t('lease')}</SelectItem>
                    <SelectItem value="other">{t('other')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{tc('cancel')}</Button>
              <Button onClick={handleSubmit} disabled={submitting || !form.senderName || !form.subject || !form.content}>
                {submitting ? tc('loading') : tc('save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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

      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder={t('allCategories')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allCategories')}</SelectItem>
            <SelectItem value="general">{t('general')}</SelectItem>
            <SelectItem value="maintenance">{t('maintenance')}</SelectItem>
            <SelectItem value="payment">{t('payment')}</SelectItem>
            <SelectItem value="lease">{t('lease')}</SelectItem>
            <SelectItem value="other">{t('other')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={readFilter} onValueChange={setReadFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allMessages')}</SelectItem>
            <SelectItem value="read">{t('readMessages')}</SelectItem>
            <SelectItem value="unread">{t('unreadMessagesFilter')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Card key={i} className="animate-pulse"><CardContent className="p-4"><div className="h-16 bg-muted rounded" /></CardContent></Card>)}
        </div>
      ) : messages.length === 0 ? (
        <EmptyState
          icon={Mail}
          title={t('title')}
          description={t('noMessagesDescription')}
        />
      ) : (
        <div className="space-y-2 max-h-[70vh] overflow-y-auto">
          {messages.map(msg => (
            <Card
              key={msg.id}
              className={`hover:shadow-sm transition-shadow cursor-pointer ${!msg.isRead ? 'border-s-4 border-s-primary bg-primary/5' : ''}`}
              onClick={() => setExpandedId(expandedId === msg.id ? null : msg.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {msg.isRead ? (
                      <MailOpen className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Mail className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`min-w-0 flex-1 text-sm truncate ${!msg.isRead ? 'font-bold' : 'font-medium'}`}>
                        {msg.subject}
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={CATEGORY_COLORS[msg.category] || DEFAULT_STATUS_COLOR}>
                          {getCategoryLabel(msg.category)}
                        </Badge>
                        {expandedId === msg.id ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="font-medium">{msg.senderName}</span>
                      <span>·</span>
                      <span>{msg.senderEmail}</span>
                      <span>·</span>
                      <span>{new Date(msg.createdAt).toLocaleDateString()}</span>
                    </div>
                    {expandedId === msg.id && (
                      <div className="mt-3 space-y-3">
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); toggleRead(msg); }}
                          >
                            {msg.isRead ? t('markAsUnread') : t('markAsRead')}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); setDeleteId(msg.id); }}
                          >
                            <Trash2 className="h-3.5 w-3.5 me-1" />
                            {tc('delete')}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

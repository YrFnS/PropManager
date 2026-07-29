'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { Building2, Loader2, Plus, RefreshCw, Save, Trash2, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from '@/components/auth/session-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import type { AppRole, SessionInput } from '@/lib/auth';

interface OrganizationMembership {
  membershipId: string;
  role: AppRole;
  organization: {
    id: string;
    name: string;
    nameAr: string | null;
    slug: string;
    currency: string;
    locale: string;
    timezone: string;
  };
}

interface OrganizationRecord {
  id: string;
  name: string;
  nameAr: string | null;
  currency: string;
  locale: string;
  timezone: string;
}

interface MemberRecord {
  id: string;
  role: AppRole;
  isActive: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    isActive: boolean;
  };
}

const roles: AppRole[] = ['owner', 'manager', 'accountant', 'maintenance', 'viewer'];

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(data.error || 'Request failed.'));
  return data as unknown as T;
}

export function OrganizationMenu() {
  const locale = useLocale();
  const isAr = locale === 'ar';
  const { session, setSession } = useSession();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [memberships, setMemberships] = useState<OrganizationMembership[]>([]);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(session?.organizationId || '');
  const [organization, setOrganization] = useState<OrganizationRecord | null>(null);
  const [createForm, setCreateForm] = useState({ name: '', nameAr: '', currency: session?.currency || 'USD' });
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', password: '', role: 'viewer' as AppRole });

  const roleLabel = useCallback((role: AppRole) => {
    const labels: Record<AppRole, [string, string]> = {
      owner: ['Owner', 'مالك'],
      manager: ['Manager', 'مدير'],
      accountant: ['Accountant', 'محاسب'],
      maintenance: ['Maintenance', 'صيانة'],
      viewer: ['Viewer', 'مشاهد'],
    };
    return labels[role][isAr ? 1 : 0];
  }, [isAr]);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [organizationsResponse, organizationResponse, membersResponse] = await Promise.all([
        jsonRequest<{ memberships: OrganizationMembership[]; currentOrganizationId: string }>('/api/auth/organizations'),
        jsonRequest<{ organization: OrganizationRecord }>('/api/settings/organization'),
        session.role === 'owner'
          ? jsonRequest<{ members: MemberRecord[] }>('/api/settings/users')
          : Promise.resolve({ members: [] as MemberRecord[] }),
      ]);
      setMemberships(organizationsResponse.memberships);
      setSelectedOrganizationId(organizationsResponse.currentOrganizationId);
      setOrganization(organizationResponse.organization);
      setMembers(membersResponse.members);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load organization settings.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const displayOrganizationName = useMemo(() => {
    const current = memberships.find((item) => item.organization.id === session?.organizationId)?.organization;
    if (isAr && current?.nameAr) return current.nameAr;
    return current?.name || session?.organizationName || (isAr ? 'المؤسسة' : 'Organization');
  }, [memberships, session, isAr]);

  if (!session) return null;

  const switchOrganization = async () => {
    if (!selectedOrganizationId || selectedOrganizationId === session.organizationId) return;
    setSaving(true);
    try {
      const data = await jsonRequest<{ session: SessionInput }>('/api/auth/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'switch', organizationId: selectedOrganizationId }),
      });
      setSession(data.session);
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to switch organization.');
    } finally {
      setSaving(false);
    }
  };

  const createOrganization = async () => {
    setSaving(true);
    try {
      const data = await jsonRequest<{ session: SessionInput }>('/api/auth/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', ...createForm }),
      });
      setSession(data.session);
      toast.success(isAr ? 'تم إنشاء المؤسسة' : 'Organization created');
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create organization.');
    } finally {
      setSaving(false);
    }
  };

  const saveOrganization = async () => {
    if (!organization) return;
    setSaving(true);
    try {
      const data = await jsonRequest<{ organization: OrganizationRecord; session: SessionInput }>(
        '/api/settings/organization',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(organization),
        },
      );
      setOrganization(data.organization);
      setSession(data.session);
      toast.success(isAr ? 'تم حفظ إعدادات المؤسسة' : 'Organization settings saved');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save organization.');
    } finally {
      setSaving(false);
    }
  };

  const inviteMember = async () => {
    setSaving(true);
    try {
      await jsonRequest('/api/settings/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      });
      setInviteForm({ name: '', email: '', password: '', role: 'viewer' });
      toast.success(isAr ? 'تمت إضافة المستخدم' : 'User added');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add user.');
    } finally {
      setSaving(false);
    }
  };

  const updateMember = async (member: MemberRecord, changes: Partial<Pick<MemberRecord, 'role' | 'isActive'>>) => {
    setSaving(true);
    try {
      await jsonRequest('/api/settings/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId: member.id, ...changes }),
      });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update user.');
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (member: MemberRecord) => {
    setSaving(true);
    try {
      await jsonRequest(`/api/settings/users?id=${encodeURIComponent(member.id)}`, { method: 'DELETE' });
      toast.success(isAr ? 'تمت إزالة المستخدم' : 'User removed');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove user.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="max-w-[240px] gap-2 bg-background/95 shadow-md backdrop-blur">
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="truncate">{displayOrganizationName}</span>
          <Badge variant="secondary" className="hidden text-[10px] sm:inline-flex">{roleLabel(session.role)}</Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isAr ? 'المؤسسة والصلاحيات' : 'Organization & access'}</DialogTitle>
          <DialogDescription>
            {isAr ? 'بدّل المؤسسة وأدر إعداداتها وأعضاءها.' : 'Switch organizations and manage settings and members.'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex min-h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="space-y-6">
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-medium">{isAr ? 'المؤسسات المتاحة' : 'Available organizations'}</h3>
                  <p className="text-xs text-muted-foreground">{isAr ? 'كل البيانات أدناه معزولة حسب المؤسسة.' : 'All portfolio data is isolated by organization.'}</p>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => void load()} aria-label={isAr ? 'تحديث' : 'Refresh'}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select value={selectedOrganizationId} onValueChange={setSelectedOrganizationId}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {memberships.map((membership) => (
                      <SelectItem key={membership.membershipId} value={membership.organization.id}>
                        {isAr && membership.organization.nameAr ? membership.organization.nameAr : membership.organization.name}
                        {' · '}{roleLabel(membership.role)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" onClick={switchOrganization} disabled={saving || selectedOrganizationId === session.organizationId}>
                  {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                  {isAr ? 'تبديل' : 'Switch'}
                </Button>
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <div className="flex items-center gap-2"><Plus className="h-4 w-4" /><h3 className="font-medium">{isAr ? 'إنشاء مؤسسة' : 'Create organization'}</h3></div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5"><Label>{isAr ? 'الاسم' : 'Name'}</Label><Input value={createForm.name} onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })} /></div>
                <div className="space-y-1.5"><Label>{isAr ? 'الاسم العربي' : 'Arabic name'}</Label><Input dir="rtl" value={createForm.nameAr} onChange={(event) => setCreateForm({ ...createForm, nameAr: event.target.value })} /></div>
                <div className="space-y-1.5"><Label>{isAr ? 'العملة' : 'Currency'}</Label><Input maxLength={3} value={createForm.currency} onChange={(event) => setCreateForm({ ...createForm, currency: event.target.value.toUpperCase() })} /></div>
              </div>
              <Button type="button" variant="outline" onClick={createOrganization} disabled={saving || createForm.name.trim().length < 2}>
                <Plus className="me-2 h-4 w-4" />{isAr ? 'إنشاء والتبديل' : 'Create and switch'}
              </Button>
            </section>

            {session.role === 'owner' && organization && (
              <>
                <Separator />
                <section className="space-y-3">
                  <div className="flex items-center gap-2"><Save className="h-4 w-4" /><h3 className="font-medium">{isAr ? 'إعدادات المؤسسة الحالية' : 'Current organization settings'}</h3></div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5"><Label>{isAr ? 'الاسم' : 'Name'}</Label><Input value={organization.name} onChange={(event) => setOrganization({ ...organization, name: event.target.value })} /></div>
                    <div className="space-y-1.5"><Label>{isAr ? 'الاسم العربي' : 'Arabic name'}</Label><Input dir="rtl" value={organization.nameAr || ''} onChange={(event) => setOrganization({ ...organization, nameAr: event.target.value })} /></div>
                    <div className="space-y-1.5"><Label>{isAr ? 'العملة' : 'Currency'}</Label><Input maxLength={3} value={organization.currency} onChange={(event) => setOrganization({ ...organization, currency: event.target.value.toUpperCase() })} /></div>
                    <div className="space-y-1.5"><Label>{isAr ? 'المنطقة الزمنية' : 'Timezone'}</Label><Input value={organization.timezone} onChange={(event) => setOrganization({ ...organization, timezone: event.target.value })} /></div>
                  </div>
                  <Button type="button" onClick={saveOrganization} disabled={saving}><Save className="me-2 h-4 w-4" />{isAr ? 'حفظ' : 'Save settings'}</Button>
                </section>

                <Separator />

                <section className="space-y-4">
                  <div className="flex items-center gap-2"><Users className="h-4 w-4" /><h3 className="font-medium">{isAr ? 'أعضاء المؤسسة' : 'Organization members'}</h3></div>
                  <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-4">
                    <div className="space-y-1.5"><Label>{isAr ? 'الاسم' : 'Name'}</Label><Input value={inviteForm.name} onChange={(event) => setInviteForm({ ...inviteForm, name: event.target.value })} /></div>
                    <div className="space-y-1.5"><Label>{isAr ? 'البريد' : 'Email'}</Label><Input type="email" value={inviteForm.email} onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })} /></div>
                    <div className="space-y-1.5"><Label>{isAr ? 'كلمة المرور للمستخدم الجديد' : 'New-user password'}</Label><Input type="password" value={inviteForm.password} onChange={(event) => setInviteForm({ ...inviteForm, password: event.target.value })} /></div>
                    <div className="space-y-1.5"><Label>{isAr ? 'الدور' : 'Role'}</Label><Select value={inviteForm.role} onValueChange={(value) => setInviteForm({ ...inviteForm, role: value as AppRole })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{roles.map((role) => <SelectItem key={role} value={role}>{roleLabel(role)}</SelectItem>)}</SelectContent></Select></div>
                    <Button type="button" className="sm:col-span-4 sm:w-fit" onClick={inviteMember} disabled={saving || !inviteForm.name || !inviteForm.email}>
                      <UserPlus className="me-2 h-4 w-4" />{isAr ? 'إضافة المستخدم' : 'Add user'}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {members.map((member) => (
                      <div key={member.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{member.user.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
                        </div>
                        <Select value={member.role} disabled={member.id === session.membershipId || saving} onValueChange={(value) => void updateMember(member, { role: value as AppRole })}>
                          <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>{roles.map((role) => <SelectItem key={role} value={role}>{roleLabel(role)}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button type="button" variant="outline" size="sm" disabled={member.id === session.membershipId || saving} onClick={() => void updateMember(member, { isActive: !member.isActive })}>
                          {member.isActive ? (isAr ? 'تعطيل' : 'Disable') : (isAr ? 'تفعيل' : 'Enable')}
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="text-destructive" disabled={member.id === session.membershipId || saving} onClick={() => void removeMember(member)} aria-label={isAr ? 'إزالة' : 'Remove'}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

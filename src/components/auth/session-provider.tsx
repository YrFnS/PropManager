'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AppRole, SessionInput } from '@/lib/auth';
import { canWriteResource, type AppResource } from '@/lib/permissions';

interface SessionContextValue {
  session: SessionInput | null;
  setSession: (session: SessionInput | null) => void;
  refreshSession: () => Promise<SessionInput | null>;
  hasAnyRole: (...roles: AppRole[]) => boolean;
  canWrite: (resource: AppResource) => boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  initialSession,
  children,
}: {
  initialSession: SessionInput | null;
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<SessionInput | null>(initialSession);

  useEffect(() => {
    if (!session) {
      delete document.documentElement.dataset.role;
      delete document.documentElement.dataset.pmRole;
      delete document.documentElement.dataset.organization;
      return;
    }
    document.documentElement.dataset.role = session.role;
    document.documentElement.dataset.pmRole = session.role;
    document.documentElement.dataset.organization = session.organizationId;
  }, [session]);

  const refreshSession = useCallback(async () => {
    const response = await fetch('/api/auth/session', { cache: 'no-store' });
    if (!response.ok) {
      setSession(null);
      return null;
    }
    const data = await response.json() as { session: SessionInput };
    setSession(data.session);
    return data.session;
  }, []);

  const value = useMemo<SessionContextValue>(() => ({
    session,
    setSession,
    refreshSession,
    hasAnyRole: (...roles) => Boolean(session && roles.includes(session.role)),
    canWrite: (resource) => canWriteResource(session?.role, resource),
  }), [session, refreshSession]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider.');
  return value;
}

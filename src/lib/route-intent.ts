'use client';

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

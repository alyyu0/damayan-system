import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from '../supabase';
import { getApiBaseUrlCandidates } from '../api';
import { loadSession } from '../session';

export type SystemPhase = 'BEFORE' | 'DURING' | 'AFTER';

export type CitizenPhase = 'before' | 'during' | 'after';
export type OperationalStage = 'STAGING' | 'RESPONSE' | 'RECOVERY';

const PHASE_CACHE_KEY = 'local_disaster_phase';
const SETTINGS_ROW_ID = 1;
const POLL_MS = 10_000; // poll every 10 s as realtime fallback

interface SystemPhaseContextValue {
  systemPhase: SystemPhase;
  citizenPhase: CitizenPhase;
  operationalStage: OperationalStage;
  /** Call this after login to immediately apply persona-specific phase overrides. */
  refreshPhase: () => Promise<void>;
}

const CITIZEN_PHASE_MAP: Record<SystemPhase, CitizenPhase> = {
  BEFORE: 'before',
  DURING: 'during',
  AFTER: 'after',
};

const STAGE_MAP: Record<SystemPhase, OperationalStage> = {
  BEFORE: 'STAGING',
  DURING: 'RESPONSE',
  AFTER: 'RECOVERY',
};

const VALID_PHASES = new Set<string>(['BEFORE', 'DURING', 'AFTER']);

function isSystemPhase(v: unknown): v is SystemPhase {
  return typeof v === 'string' && VALID_PHASES.has(v);
}

const SystemPhaseContext = createContext<SystemPhaseContextValue>({
  systemPhase: 'BEFORE',
  citizenPhase: 'before',
  operationalStage: 'STAGING',
  refreshPhase: async () => {},
});

export function useSystemPhase(): SystemPhaseContextValue {
  return useContext(SystemPhaseContext);
}

function buildContextValue(
  phase: SystemPhase,
  refreshPhase: () => Promise<void>,
): SystemPhaseContextValue {
  return {
    systemPhase: phase,
    citizenPhase: CITIZEN_PHASE_MAP[phase],
    operationalStage: STAGE_MAP[phase],
    refreshPhase,
  };
}

/**
 * Fetch current_phase from the REST API.
 * Always reads the session from AsyncStorage so it picks up the regionId
 * and role AFTER the user has logged in (the provider mounts before login).
 */
async function fetchPhaseForCurrentUser(): Promise<SystemPhase | null> {
  // Always load fresh — the provider mounts before login so refs set at
  // mount time will be stale/null. AsyncStorage reads are fast (< 5 ms).
  const session = await loadSession();
  const regionId = session?.user?.assignedRegionId ?? null;
  const personaRole = session?.user?.role ?? null;

  const params = new URLSearchParams();
  if (regionId) params.set('regionId', regionId);
  if (personaRole) params.set('personaRole', personaRole);
  const query = params.toString() ? `?${params.toString()}` : '';

  const candidates = getApiBaseUrlCandidates();
  for (const base of candidates) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`${base}/system-settings/phase${query}`, {
        signal: controller.signal,
      });
      clearTimeout(tid);
      if (!res.ok) continue;
      const json = await res.json() as Record<string, unknown>;
      // Backend returns { currentPhase: ... } (camelCase)
      const phase =
        json?.currentPhase ??
        json?.current_phase ??
        json?.phase ??
        (json?.data as Record<string, unknown> | undefined)?.current_phase;
      if (isSystemPhase(phase)) return phase;
    } catch {
      clearTimeout(tid);
    }
  }
  return null;
}

export function SystemPhaseProvider({ children }: { readonly children: React.ReactNode }) {
  const [systemPhase, setSystemPhase] = useState<SystemPhase>('BEFORE');
  const phaseRef = useRef<SystemPhase>('BEFORE');

  function applyPhase(raw: unknown) {
    if (!isSystemPhase(raw)) return;
    if (raw === phaseRef.current) return;
    phaseRef.current = raw;
    setSystemPhase(raw);
    AsyncStorage.setItem(PHASE_CACHE_KEY, raw).catch(() => {});
  }

  /**
   * Exposed via context so dashboard screens can trigger a phase sync
   * right after login (when the session — including regionId — is available).
   */
  const refreshPhase = useCallback(async () => {
    const phase = await fetchPhaseForCurrentUser();
    applyPhase(phase);
  }, []);

  useEffect(() => {
    // 1. Restore cached phase immediately (offline resilience)
    AsyncStorage.getItem(PHASE_CACHE_KEY).then(applyPhase);

    // 2. Fetch fresh phase. On first mount the user is not yet logged in so
    //    this returns the global phase. After login, dashboard screens call
    //    refreshPhase() which re-fetches with the persona context.
    fetchPhaseForCurrentUser().then(applyPhase);

    // 3. Supabase Realtime — instant delivery when WebSocket works.
    //    Each callback re-reads the session from AsyncStorage so it always
    //    uses the logged-in user's regionId, even if the session was stored
    //    after this provider first mounted.
    const supabase = getSupabaseClient();
    let channel: RealtimeChannel | null = null;

    if (supabase) {
      channel = supabase
        .channel('citizen_phase_watch')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'system_settings',
            filter: `id=eq.${SETTINGS_ROW_ID}`,
          },
          () => {
            // Global phase changed — re-fetch with persona context so that
            // any active persona override is still honoured.
            fetchPhaseForCurrentUser().then(applyPhase);
          },
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'region_persona_phase_controls',
          },
          () => {
            // Admin saved a persona-phase override — re-fetch immediately
            // with the current user's session so the right override is applied.
            fetchPhaseForCurrentUser().then(applyPhase);
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'regions',
          },
          () => {
            fetchPhaseForCurrentUser().then(applyPhase);
          },
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // Reconcile any missed events while connecting
            fetchPhaseForCurrentUser().then(applyPhase);
          }
        });
    }

    // 4. Polling fallback — catches missed realtime events.
    //    Always reads session fresh so overrides are applied after login.
    const pollId = setInterval(() => {
      fetchPhaseForCurrentUser().then(applyPhase);
    }, POLL_MS);

    // 5. Re-fetch whenever the app returns to the foreground
    function onAppState(next: AppStateStatus) {
      if (next === 'active') {
        fetchPhaseForCurrentUser().then(applyPhase);
      }
    }
    const appSub = AppState.addEventListener('change', onAppState);

    return () => {
      clearInterval(pollId);
      appSub.remove();
      if (channel) {
        void supabase?.removeChannel(channel);
      }
    };
  }, []);

  return (
    <SystemPhaseContext.Provider value={buildContextValue(systemPhase, refreshPhase)}>
      {children}
    </SystemPhaseContext.Provider>
  );
}

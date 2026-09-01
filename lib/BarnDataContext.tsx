import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from './supabase';
import { useProfile } from './useProfile';

interface BarnSettings {
  id: string;
  schedule_privacy: 'show_details' | 'show_busy';
}

interface BarnDataContextValue {
  // Horses
  horses: any[];
  horsesLoading: boolean;
  refreshHorses: () => Promise<void>;
  // Barn settings
  barnSettings: BarnSettings | null;
  refreshBarnSettings: () => Promise<void>;
  // Billing
  invoices: any[];
  pendingCharges: any[];
  billingLoading: boolean;
  refreshBilling: () => Promise<void>;
  // Service visits
  serviceVisits: any[];
  barnQrToken: string | null;
  serviceVisitsLoading: boolean;
  refreshServiceVisits: () => Promise<void>;
  // Events
  cachedEvents: any[];
  eventsLoading: boolean;
  refreshEvents: () => Promise<void>;
}

const BarnDataContext = createContext<BarnDataContextValue | null>(null);

export function BarnDataProvider({ children }: { children: React.ReactNode }) {
  const { profile, isHorseOwner, isOwner, horseLinks, loading: profileLoading } = useProfile();

  const [horses, setHorses] = useState<any[]>([]);
  const [horsesLoading, setHorsesLoading] = useState(true);
  const [barnSettings, setBarnSettings] = useState<BarnSettings | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [pendingCharges, setPendingCharges] = useState<any[]>([]);
  const [billingLoading, setBillingLoading] = useState(true);
  const [serviceVisits, setServiceVisits] = useState<any[]>([]);
  const [barnQrToken, setBarnQrToken] = useState<string | null>(null);
  const [serviceVisitsLoading, setServiceVisitsLoading] = useState(true);
  const [cachedEvents, setCachedEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  const refreshHorses = useCallback(async () => {
    if (!profile) return;
    if (isHorseOwner) {
      const ids = horseLinks.map((l: any) => l.horse_id);
      if (ids.length === 0) { setHorses([]); setHorsesLoading(false); return; }
      const { data } = await supabase.from('horses').select('*').in('id', ids).order('name');
      if (data) setHorses(data);
    } else {
      const { data } = await supabase.from('horses').select('*').order('name');
      if (data) setHorses(data);
    }
    setHorsesLoading(false);
  }, [profile, isHorseOwner, horseLinks]);

  const refreshBarnSettings = useCallback(async () => {
    const { data } = await supabase.from('barn_settings').select('*').single();
    if (data) setBarnSettings(data as BarnSettings);
  }, []);

  const refreshBilling = useCallback(async () => {
    if (!profile) return;
    let query = supabase
      .from('invoices')
      .select('*, invoice_line_items(*)')
      .order('created_at', { ascending: false });
    if (isHorseOwner) {
      const ids = horseLinks.map((l: any) => l.horse_id);
      if (ids.length > 0) query = (query as any).in('horse_id', ids);
    }
    const [{ data: invData }, { data: pending }] = await Promise.all([
      query,
      isOwner
        ? supabase
            .from('service_visits')
            .select('*, horses(id, name, owner)')
            .eq('barn_invoiced', true)
            .is('invoice_id', null)
            .not('amount', 'is', null)
            .order('date', { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);
    if (invData) setInvoices(invData);
    setPendingCharges(pending || []);
    setBillingLoading(false);
  }, [profile, isHorseOwner, isOwner, horseLinks]);

  const refreshServiceVisits = useCallback(async () => {
    const [{ data }, { data: settings }] = await Promise.all([
      supabase.from('service_visits').select('*, horses(name, color)').order('date', { ascending: false }),
      supabase.from('alert_settings').select('barn_qr_token').eq('barn_id', 'default').single(),
    ]);
    if (data) setServiceVisits(data);
    if (settings?.barn_qr_token) {
      setBarnQrToken(settings.barn_qr_token);
    } else {
      const newToken = crypto.randomUUID();
      await supabase.from('alert_settings').update({ barn_qr_token: newToken }).eq('barn_id', 'default');
      setBarnQrToken(newToken);
    }
    setServiceVisitsLoading(false);
  }, []);

  const refreshEvents = useCallback(async () => {
    const past = new Date();
    past.setDate(past.getDate() - 7);
    const future = new Date();
    future.setDate(future.getDate() + 30);
    const { data } = await supabase
      .from('events')
      .select('*, horses(name)')
      .gte('date', past.toISOString().split('T')[0])
      .lte('date', future.toISOString().split('T')[0])
      .order('date', { ascending: true })
      .order('time', { ascending: true });
    if (data) setCachedEvents(data);
    setEventsLoading(false);
  }, []);

  useEffect(() => {
    if (!profileLoading && profile) {
      refreshHorses();
      refreshBarnSettings();
      refreshBilling();
      refreshServiceVisits();
      refreshEvents();
    } else if (!profileLoading && !profile) {
      setHorsesLoading(false);
      setBillingLoading(false);
      setServiceVisitsLoading(false);
      setEventsLoading(false);
    }
  }, [profile?.id, profileLoading]);

  const value = useMemo<BarnDataContextValue>(() => ({
    horses, horsesLoading, refreshHorses,
    barnSettings, refreshBarnSettings,
    invoices, pendingCharges, billingLoading, refreshBilling,
    serviceVisits, barnQrToken, serviceVisitsLoading, refreshServiceVisits,
    cachedEvents, eventsLoading, refreshEvents,
  }), [
    horses, horsesLoading, barnSettings,
    invoices, pendingCharges, billingLoading,
    serviceVisits, barnQrToken, serviceVisitsLoading,
    cachedEvents, eventsLoading,
    refreshHorses, refreshBarnSettings, refreshBilling, refreshServiceVisits, refreshEvents,
  ]);

  return React.createElement(BarnDataContext.Provider, { value }, children);
}

export function useBarnData() {
  const ctx = useContext(BarnDataContext);
  if (!ctx) throw new Error('useBarnData must be used inside BarnDataProvider');
  return ctx;
}

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from './supabase';
import { useProfile } from './useProfile';

interface BarnSettings {
  id: string;
  schedule_privacy: 'show_details' | 'show_busy';
}

interface BarnDataContextValue {
  horses: any[];
  horsesLoading: boolean;
  barnSettings: BarnSettings | null;
  refreshHorses: () => Promise<void>;
  refreshBarnSettings: () => Promise<void>;
}

const BarnDataContext = createContext<BarnDataContextValue | null>(null);

export function BarnDataProvider({ children }: { children: React.ReactNode }) {
  const { profile, isHorseOwner, horseLinks, loading: profileLoading } = useProfile();
  const [horses, setHorses] = useState<any[]>([]);
  const [horsesLoading, setHorsesLoading] = useState(true);
  const [barnSettings, setBarnSettings] = useState<BarnSettings | null>(null);

  const refreshHorses = useCallback(async () => {
    if (!profile) return;
    if (isHorseOwner) {
      const ids = horseLinks.map(l => l.horse_id);
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

  useEffect(() => {
    if (!profileLoading && profile) {
      refreshHorses();
      refreshBarnSettings();
    } else if (!profileLoading && !profile) {
      setHorsesLoading(false);
    }
  }, [profile?.id, profileLoading]);

  const value = useMemo<BarnDataContextValue>(() => ({
    horses, horsesLoading, barnSettings,
    refreshHorses, refreshBarnSettings,
  }), [horses, horsesLoading, barnSettings, refreshHorses, refreshBarnSettings]);

  return React.createElement(BarnDataContext.Provider, { value }, children);
}

export function useBarnData() {
  const ctx = useContext(BarnDataContext);
  if (!ctx) throw new Error('useBarnData must be used inside BarnDataProvider');
  return ctx;
}

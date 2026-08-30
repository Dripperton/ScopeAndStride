import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from './supabase';
import { useLanguage, Language } from './LanguageContext';

export type Role = 'owner' | 'staff' | 'horse_owner' | 'rider';
export type Relationship = 'owner' | 'leasee';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  barn_id: string | null;
}

export interface HorseLink {
  horse_id: number;
  relationship: Relationship;
  billing_contact: boolean;
  horses: { id: number; name: string; color: string | null };
}

interface ProfileContextValue {
  profile: Profile | null;
  horseLinks: HorseLink[];
  loading: boolean;
  profileLoadError: string | null;
  isOwner: boolean;
  isStaff: boolean;
  isHorseOwner: boolean;
  isRider: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageUsers: boolean;
  primaryHorse: { id: number; name: string; color: string | null } | null;
  refresh: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { setLanguage } = useLanguage();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [horseLinks, setHorseLinks] = useState<HorseLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (!user) {
      setProfileLoadError('No session — user is null');
      setLoading(false);
      return;
    }
    const [{ data: profileData, error: profileErr }, { data: linksData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('horse_users').select('horse_id, relationship, billing_contact, horses(id, name, color)').eq('user_id', user.id),
    ]);
    if (profileErr) {
      setProfileLoadError(`profiles query: ${profileErr.message} [${profileErr.code}] uid=${user.id}`);
    }
    if (profileData) {
      setProfileLoadError(null);
      setProfile(prev => prev?.id === profileData.id && prev?.role === profileData.role && prev?.full_name === profileData.full_name ? prev : profileData);
      if (profileData.language) setLanguage(profileData.language as Language);
    }
    if (linksData) {
      setHorseLinks(prev => {
        const next = linksData as HorseLink[];
        if (prev.length === next.length && prev.every((l, i) => l.horse_id === next[i].horse_id)) return prev;
        return next;
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session) {
          fetchProfile();
        } else {
          setLoading(false);
        }
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        setHorseLinks([]);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const isOwner = profile?.role === 'owner';
  const isStaff = profile?.role === 'staff';
  const isHorseOwner = profile?.role === 'horse_owner';
  const canEdit = isOwner || isStaff;
  const canDelete = isOwner;
  const canManageUsers = isOwner;

  const validLinks = horseLinks.filter(l => l.horses);
  const primaryLink = validLinks.find(l => l.billing_contact) ?? validLinks[0] ?? null;
  const isRider = isHorseOwner && primaryLink?.relationship === 'leasee';
  const primaryHorse = primaryLink?.horses ?? null;

  const value = useMemo<ProfileContextValue>(() => ({
    profile, horseLinks, loading, profileLoadError,
    isOwner, isStaff, isHorseOwner, isRider, canEdit, canDelete, canManageUsers,
    primaryHorse, refresh: fetchProfile,
  }), [profile, horseLinks, loading, profileLoadError, fetchProfile]);

  return React.createElement(ProfileContext.Provider, { value }, children);
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used inside ProfileProvider');
  return ctx;
}

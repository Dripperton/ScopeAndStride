import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from './supabase';
import { useLanguage, Language } from './LanguageContext';

export type Role = 'owner' | 'staff' | 'horse_owner';
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
  isOwner: boolean;
  isStaff: boolean;
  isHorseOwner: boolean;
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

  const fetchProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const [{ data: profileData }, { data: linksData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('horse_users').select('horse_id, relationship, billing_contact, horses(id, name, color)').eq('user_id', user.id),
    ]);
    if (profileData) {
      // Only update if data actually changed to avoid unnecessary re-renders
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
    fetchProfile();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        fetchProfile();
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
  const primaryHorse = validLinks.find(l => l.billing_contact)?.horses
    ?? validLinks[0]?.horses
    ?? null;

  const value = useMemo<ProfileContextValue>(() => ({
    profile, horseLinks, loading,
    isOwner, isStaff, isHorseOwner, canEdit, canDelete, canManageUsers,
    primaryHorse, refresh: fetchProfile,
  }), [profile, horseLinks, loading, fetchProfile]);

  return React.createElement(ProfileContext.Provider, { value }, children);
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used inside ProfileProvider');
  return ctx;
}

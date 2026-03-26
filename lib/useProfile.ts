import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export type Role = 'owner' | 'staff' | 'horse_owner';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  barn_id: string | null;
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (data) setProfile(data);
      setLoading(false);
    }
    fetchProfile();
  }, []);

  const isOwner = profile?.role === 'owner';
  const isStaff = profile?.role === 'staff';
  const isHorseOwner = profile?.role === 'horse_owner';
  const canEdit = isOwner || isStaff;
  const canDelete = isOwner;
  const canManageUsers = isOwner;

  return { profile, loading, isOwner, isStaff, isHorseOwner, canEdit, canDelete, canManageUsers };
}

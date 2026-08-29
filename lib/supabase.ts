import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://kzpdukjkttkaaligxsmb.supabase.co';
const supabaseKey = 'sb_publishable_6HLbfXt3q5rjEi8eoq8lJg_B_LlNqV6';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

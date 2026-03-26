import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kzpdukjkttkaaligxsmb.supabase.co';
const supabaseKey = 'sb_publishable_6HLbfXt3q5rjEi8eoq8lJg_B_LlNqV6';

export const supabase = createClient(supabaseUrl, supabaseKey);

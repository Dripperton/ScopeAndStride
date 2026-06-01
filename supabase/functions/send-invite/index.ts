import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_URL = Deno.env.get('APP_URL') || 'http://localhost:8081'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const ROLE_LABELS: Record<string, string> = {
  owner: 'Barn Owner',
  staff: 'Staff',
  horse_owner: 'Horse Owner',
  rider: 'Rider',
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, role, barnName } = await req.json()

    if (!email || !role) {
      return new Response(JSON.stringify({ error: 'email and role are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const roleLabel = ROLE_LABELS[role] ?? role
    const displayBarnName = barnName || 'your barn'

    const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: APP_URL,
      data: { invited_role: role },
    })

    // If user already exists in auth, send a password reset instead so they can log in
    if (error?.message?.includes('already been registered')) {
      const { error: resetError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo: APP_URL },
      })
      if (resetError) {
        return new Response(JSON.stringify({ error: resetError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ success: true, note: 'existing_user_magic_link' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

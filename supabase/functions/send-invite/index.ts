import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
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

    // If user already exists in auth, send a magic link via Resend
    if (error?.message?.includes('already been registered')) {
      const { data: linkData, error: resetError } = await supabase.auth.admin.generateLink({
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
      const magicLink = linkData?.properties?.action_link
      if (magicLink) {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Scope & Stride <hello@scopeandstride.com>',
            to: email,
            subject: `You've been invited to ${displayBarnName} on Scope & Stride`,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
              <h2 style="color:#2C4A35;">You're invited to ${displayBarnName}</h2>
              <p>You've been added as <strong>${roleLabel}</strong>. Click below to sign in:</p>
              <a href="${magicLink}" style="display:inline-block;background:#2C4A35;color:#C9A85C;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">Sign In to Scope & Stride</a>
              <p style="color:#999;font-size:12px;">This link expires in 24 hours.</p>
            </div>`,
          }),
        })
        const resendBody = await resendRes.json()
        console.log('Resend response:', resendRes.status, JSON.stringify(resendBody))
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

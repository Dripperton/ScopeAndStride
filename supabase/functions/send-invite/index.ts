import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const ROLE_LABELS: Record<string, string> = {
  owner: 'Barn Owner',
  staff: 'Staff',
  horse_owner: 'Horse Owner',
  rider: 'Rider',
}

function generateTempPassword(): string {
  const words = ['Stable', 'Horse', 'Barn', 'Rider', 'Field', 'Saddle', 'Bridle', 'Canter']
  const word = words[Math.floor(Math.random() * words.length)]
  const num = Math.floor(1000 + Math.random() * 9000)
  return `${word}${num}!`
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
    const { email, role, barnName, barnId } = await req.json()

    if (!email || !role) {
      return new Response(JSON.stringify({ error: 'email and role are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const roleLabel = ROLE_LABELS[role] ?? role
    const displayBarnName = barnName || 'your barn'
    const tempPassword = generateTempPassword()

    // Try to create the user with a temp password
    const { error: createError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { invited_role: role, barn_id: barnId },
    })

    // If user already exists, reset their password to a new temp password
    if (createError?.message?.includes('already been registered') || createError?.message?.includes('already exists')) {
      const { data: existingUser } = await supabase.auth.admin.listUsers()
      const user = existingUser?.users?.find(u => u.email === email)
      if (user) {
        const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
          password: tempPassword,
        })
        if (updateError) {
          return new Response(JSON.stringify({ error: updateError.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
    } else if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Send email with temp password via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${displayBarnName} <hello@scopeandstride.com>`,
        to: email,
        subject: `You've been invited to ${displayBarnName}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <div style="background:#1E3F9B;padding:24px;border-radius:12px;margin-bottom:24px;">
            <h1 style="color:#FFFFFF;margin:0;font-size:24px;">${displayBarnName}</h1>
          </div>
          <h2 style="color:#1A1A1A;">You've been invited</h2>
          <p style="color:#3A3A3A;">You've been added as <strong>${roleLabel}</strong> at ${displayBarnName}. Download the app and sign in with these credentials:</p>
          <p style="margin:16px 0;"><a href="https://apps.apple.com/us/app/id6808262044" style="background:#1E3F9B;color:#FFFFFF;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Download the App →</a></p>
          <div style="background:#F4F5F7;border-radius:8px;padding:20px;margin:20px 0;">
            <p style="margin:0 0 8px;color:#5A5A6A;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Email</p>
            <p style="margin:0 0 16px;color:#1A1A1A;font-size:16px;font-weight:bold;">${email}</p>
            <p style="margin:0 0 8px;color:#5A5A6A;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Temporary Password</p>
            <p style="margin:0;color:#1A1A1A;font-size:16px;font-weight:bold;">${tempPassword}</p>
          </div>
          <p style="color:#3A3A3A;">Once you're in, you can change your password anytime using the <strong>Forgot Password</strong> option on the sign-in screen.</p>
          <p style="color:#999;font-size:12px;margin-top:24px;">If you didn't expect this invitation, you can ignore this email.</p>
        </div>`,
      }),
    })

    const resendBody = await resendRes.json()
    console.log('Resend response:', resendRes.status, JSON.stringify(resendBody))

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

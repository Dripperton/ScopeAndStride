import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const APP_URL = Deno.env.get('APP_URL') || 'scopeandstride://'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { email, barnName } = await req.json()
    if (!email) return json({ error: 'email is required' }, 400)

    const displayBarnName = barnName || 'your barn'

    // Generate a magic link for this user — works for invited users who have no password yet
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: APP_URL },
    })

    if (linkError) return json({ error: linkError.message }, 400)

    const magicLink = linkData?.properties?.action_link
    if (!magicLink) return json({ error: 'Could not generate sign-in link' }, 500)

    // Send via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${displayBarnName} <notifications@scopeandstride.com>`,
        to: email,
        subject: `Your sign-in link for ${displayBarnName}`,
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;background:#FAF7F2;padding:0;">
            <div style="background:#1A1A1A;padding:24px 32px;">
              <p style="margin:0;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:1px;text-transform:uppercase;">${displayBarnName}</p>
              <h1 style="margin:4px 0 0;color:#FFFFFF;font-size:20px;">Sign in to the app</h1>
            </div>
            <div style="padding:28px 32px;">
              <p style="margin:0 0 24px;color:#3A3830;font-size:15px;">Tap the button below to sign in. This link expires in 24 hours.</p>
              <a href="${magicLink}" style="display:inline-block;background:#1A1A1A;color:#FFFFFF;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:700;">Sign In</a>
              <p style="margin:20px 0 0;color:#9A9285;font-size:12px;">If the button doesn't work, copy and paste this link:<br/><span style="word-break:break-all;color:#5A5A6A;">${magicLink}</span></p>
            </div>
            <div style="padding:16px 32px 24px;border-top:1px solid #E8E0CC;">
              <p style="margin:0;color:#9A9285;font-size:12px;">If you didn't request this, you can ignore this email.</p>
            </div>
          </div>
        `,
      }),
    })

    const resendBody = await resendRes.json()
    console.log('Resend response:', resendRes.status, JSON.stringify(resendBody))

    if (!resendRes.ok) return json({ error: 'Failed to send email' }, 500)

    return json({ success: true })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

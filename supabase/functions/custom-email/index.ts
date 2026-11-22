import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'noreply@scopeandstride.com'
const HOOK_SECRET = Deno.env.get('SEND_EMAIL_HOOK_SECRET') ?? ''

async function getBarnBranding(userId: string, userMetadata: any): Promise<{ barnName: string; primaryColor: string }> {
  try {
    const headers = {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    }

    // Profile lookup — works for all existing users
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=barn_id`,
      { headers }
    )
    const profiles = await profileRes.json()
    let barnId = profiles?.[0]?.barn_id

    // Invite emails fire before the profile row exists; barn_id is in user metadata
    if (!barnId) barnId = userMetadata?.barn_id

    if (!barnId) throw new Error('no barn_id')

    const barnRes = await fetch(
      `${SUPABASE_URL}/rest/v1/barn_settings?id=eq.${barnId}&select=barn_name,primary_color`,
      { headers }
    )
    const barns = await barnRes.json()
    const barn = barns?.[0]
    return {
      barnName: barn?.barn_name ?? 'Your Barn',
      primaryColor: barn?.primary_color ?? '#182C63',
    }
  } catch {
    return { barnName: 'Your Barn', primaryColor: '#182C63' }
  }
}

serve(async (req) => {
  try {
    const payload = await req.json()
    const { user, email_data } = payload
    const { token_hash, email_action_type, redirect_to } = email_data

    const { barnName, primaryColor } = await getBarnBranding(user.id, user.user_metadata ?? user.raw_user_meta_data)

    const appRedirect = redirect_to || 'scopeandstride://auth-callback'
    const confirmationUrl =
      `${SUPABASE_URL}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${encodeURIComponent(appRedirect)}`

    let subject = `Your ${barnName} Login Link`
    let heading = `Log in to ${barnName}`
    let body = `Tap the button below to sign in. This link expires in 24 hours.`
    let buttonText = `Log In to ${barnName}`

    if (email_action_type === 'recovery') {
      subject = `Reset your ${barnName} password`
      heading = `Reset your password`
      body = `Tap the button below to reset your password. This link expires in 24 hours.`
      buttonText = `Reset Password`
    } else if (email_action_type === 'signup') {
      subject = `Welcome to ${barnName}`
      heading = `Welcome to ${barnName}`
      body = `Tap the button below to confirm your email and get started.`
      buttonText = `Confirm Email`
    } else if (email_action_type === 'invite') {
      subject = `You've been invited to ${barnName}`
      heading = `You've been invited`
      body = `You've been added to ${barnName}. Tap below to accept your invitation and set up your account.`
      buttonText = `Accept Invitation`
    }

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#ffffff;">
        <div style="background:${primaryColor};padding:24px;border-radius:12px;text-align:center;margin-bottom:28px;">
          <p style="color:#ffffff;font-size:20px;font-weight:700;margin:0;letter-spacing:1px;">${barnName}</p>
        </div>
        <h2 style="color:#1A1A1A;font-size:20px;margin:0 0 12px;">${heading}</h2>
        <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 28px;">${body}</p>
        <div style="text-align:center;margin-bottom:28px;">
          <a href="${confirmationUrl}"
             style="background:${primaryColor};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:700;display:inline-block;">
            ${buttonText}
          </a>
        </div>
        <p style="color:#aaa;font-size:12px;text-align:center;margin:0;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${barnName} <${FROM_EMAIL}>`,
        to: user.email,
        subject,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Resend error:', err)
      return new Response(JSON.stringify({ error: err }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('custom-email error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})

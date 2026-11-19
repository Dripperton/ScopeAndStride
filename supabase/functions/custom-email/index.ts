import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const BARN_NAME = Deno.env.get('BARN_NAME') ?? 'Hidden Hill Farm'
const BARN_PRIMARY = Deno.env.get('BARN_PRIMARY_COLOR') ?? '#182C63'
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'noreply@scopeandstride.com'
const HOOK_SECRET = Deno.env.get('SEND_EMAIL_HOOK_SECRET') ?? ''

serve(async (req) => {
  try {
    // Log auth header for debugging
    console.log('Authorization header:', req.headers.get('authorization'))
    const payload = await req.json()
    const { user, email_data } = payload
    const { token_hash, email_action_type, redirect_to } = email_data

    const appRedirect = redirect_to || 'scopeandstride://auth-callback'
    const confirmationUrl =
      `${SUPABASE_URL}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${encodeURIComponent(appRedirect)}`

    let subject = `Your ${BARN_NAME} Login Link`
    let heading = `Log in to ${BARN_NAME}`
    let body = `Tap the button below to sign in. This link expires in 24 hours.`
    let buttonText = `Log In to ${BARN_NAME}`

    if (email_action_type === 'recovery') {
      subject = `Reset your ${BARN_NAME} password`
      heading = `Reset your password`
      body = `Tap the button below to reset your password. This link expires in 24 hours.`
      buttonText = `Reset Password`
    } else if (email_action_type === 'signup') {
      subject = `Welcome to ${BARN_NAME}`
      heading = `Welcome to ${BARN_NAME}`
      body = `Tap the button below to confirm your email and get started.`
      buttonText = `Confirm Email`
    } else if (email_action_type === 'invite') {
      subject = `You've been invited to ${BARN_NAME}`
      heading = `You've been invited`
      body = `You've been added to ${BARN_NAME}. Tap below to accept your invitation and set up your account.`
      buttonText = `Accept Invitation`
    }

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#ffffff;">
        <div style="background:${BARN_PRIMARY};padding:24px;border-radius:12px;text-align:center;margin-bottom:28px;">
          <p style="color:#ffffff;font-size:20px;font-weight:700;margin:0;letter-spacing:1px;">${BARN_NAME}</p>
        </div>
        <h2 style="color:#1A1A1A;font-size:20px;margin:0 0 12px;">${heading}</h2>
        <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 28px;">${body}</p>
        <div style="text-align:center;margin-bottom:28px;">
          <a href="${confirmationUrl}"
             style="background:${BARN_PRIMARY};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:700;display:inline-block;">
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
        from: `${BARN_NAME} <${FROM_EMAIL}>`,
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

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!

serve(async (req) => {
  try {
    const payload = await req.json()
    const email = payload?.record?.email
    const source = payload?.record?.source || 'unknown'

    if (!email) {
      return new Response(JSON.stringify({ error: 'No email in payload' }), { status: 400 })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Scope & Stride <hello@scopeandstride.com>',
        to: 'dana@scopeandstride.com',
        subject: '🐴 New waitlist signup',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <div style="background: #2C4A35; padding: 20px 24px; border-radius: 10px; margin-bottom: 20px;">
              <h1 style="color: #C9A85C; margin: 0; font-size: 20px;">Scope & Stride</h1>
            </div>
            <p style="color: #1A1A14; font-size: 16px;">New waitlist signup:</p>
            <p style="font-size: 20px; font-weight: bold; color: #2C4A35;">${email}</p>
            <p style="color: #9A9285; font-size: 13px; margin-top: 8px;">Source: ${source}</p>
          </div>
        `,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return new Response(JSON.stringify({ error: err }), { status: 500 })
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})

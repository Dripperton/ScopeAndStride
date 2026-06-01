import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const QB_CLIENT_ID = Deno.env.get('QUICKBOOKS_CLIENT_ID')!
const QB_CLIENT_SECRET = Deno.env.get('QUICKBOOKS_CLIENT_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } },
})

serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const realmId = url.searchParams.get('realmId')
  const userId = url.searchParams.get('state')

  if (!code || !realmId || !userId) {
    return new Response('Missing required parameters', { status: 400 })
  }

  const redirectUri = `${SUPABASE_URL}/functions/v1/quickbooks-oauth-callback`

  const tokenRes = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  })

  const tokens = await tokenRes.json()

  if (!tokens.access_token) {
    return new Response('Failed to get tokens from QuickBooks', { status: 500 })
  }

  const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  await supabase.from('barn_integrations').upsert({
    user_id: userId,
    provider: 'quickbooks',
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    realm_id: realmId,
    token_expiry: tokenExpiry,
  }, { onConflict: 'user_id,provider' })

  return new Response(`
    <!DOCTYPE html>
    <html>
      <head><title>QuickBooks Connected</title></head>
      <body style="font-family: -apple-system, sans-serif; text-align: center; padding: 80px 40px; background: #FAF7F2;">
        <div style="max-width: 400px; margin: 0 auto;">
          <div style="font-size: 48px; margin-bottom: 16px;">✓</div>
          <h2 style="color: #2C4A35; margin-bottom: 8px;">QuickBooks Connected</h2>
          <p style="color: #9A9285;">You can close this window and return to Scope & Stride.</p>
        </div>
      </body>
    </html>
  `, { headers: { 'Content-Type': 'text/html' } })
})

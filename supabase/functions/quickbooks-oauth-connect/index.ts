import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const QB_CLIENT_ID = Deno.env.get('QUICKBOOKS_CLIENT_ID')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { userId } = await req.json()
  if (!userId) return new Response('Missing userId', { status: 400, headers: corsHeaders })

  const redirectUri = `${SUPABASE_URL}/functions/v1/quickbooks-oauth-callback`

  const authUrl = new URL('https://appcenter.intuit.com/connect/oauth2')
  authUrl.searchParams.set('client_id', QB_CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', 'com.intuit.quickbooks.accounting')
  authUrl.searchParams.set('state', userId)

  return new Response(JSON.stringify({ url: authUrl.toString() }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

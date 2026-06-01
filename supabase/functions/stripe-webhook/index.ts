import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!
const QB_CLIENT_ID = Deno.env.get('QUICKBOOKS_CLIENT_ID')!
const QB_CLIENT_SECRET = Deno.env.get('QUICKBOOKS_CLIENT_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } },
})

async function getValidAccessToken(integration: any): Promise<string> {
  const isExpired = new Date(integration.token_expiry) <= new Date(Date.now() + 60_000)
  if (!isExpired) return integration.access_token

  const tokenRes = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: integration.refresh_token,
    }),
  })

  const tokens = await tokenRes.json()
  const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  await supabase.from('barn_integrations').update({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expiry: tokenExpiry,
  }).eq('id', integration.id)

  return tokens.access_token
}

async function recordPaymentInQuickBooks(invoice: any, amountPaid: number) {
  if (!invoice.quickbooks_realm_id || !invoice.quickbooks_invoice_id || !invoice.quickbooks_customer_ref) return

  const { data: integration } = await supabase
    .from('barn_integrations')
    .select('*')
    .eq('realm_id', invoice.quickbooks_realm_id)
    .eq('provider', 'quickbooks')
    .single()

  if (!integration) return

  const accessToken = await getValidAccessToken(integration)

  await fetch(`https://quickbooks.api.intuit.com/v3/company/${invoice.quickbooks_realm_id}/payment?minorversion=65`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      TotalAmt: amountPaid,
      CustomerRef: { value: invoice.quickbooks_customer_ref },
      Line: [{
        Amount: amountPaid,
        LinkedTxn: [{ TxnId: invoice.quickbooks_invoice_id, TxnType: 'Invoice' }],
      }],
    }),
  })
}

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  if (!signature) return new Response('Missing signature', { status: 400 })

  const body = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEventFromPayload(body, signature, STRIPE_WEBHOOK_SECRET)
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent
    const invoiceId = paymentIntent.metadata.invoice_id

    if (!invoiceId) return new Response('ok', { status: 200 })

    const { data: invoice } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single()

    if (!invoice) return new Response('ok', { status: 200 })

    await supabase.from('invoices').update({
      status: 'paid',
      payment_method: 'stripe',
      paid_at: new Date().toISOString(),
    }).eq('id', invoiceId)

    const amountPaid = paymentIntent.amount / 100
    await recordPaymentInQuickBooks(invoice, amountPaid)
  }

  return new Response('ok', { status: 200 })
})

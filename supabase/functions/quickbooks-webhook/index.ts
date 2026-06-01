import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const QB_CLIENT_ID = Deno.env.get('QUICKBOOKS_CLIENT_ID')!
const QB_CLIENT_SECRET = Deno.env.get('QUICKBOOKS_CLIENT_SECRET')!
const QB_VERIFIER_TOKEN = Deno.env.get('QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

async function syncInvoice(realmId: string, invoiceId: string, accessToken: string) {
  const baseUrl = 'https://quickbooks.api.intuit.com'
  const res = await fetch(`${baseUrl}/v3/company/${realmId}/invoice/${invoiceId}?minorversion=65`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  })

  const data = await res.json()
  const inv = data.Invoice
  if (!inv) return

  const total = inv.TotalAmt || 0
  const dueDate = inv.DueDate || null
  const ownerName = inv.CustomerRef?.name || null
  const status = inv.Balance === 0 ? 'paid' : new Date(dueDate) < new Date() ? 'overdue' : 'pending'

  const lineItems = (inv.Line || [])
    .filter((l: any) => l.DetailType === 'SalesItemLineDetail' || l.DetailType === 'DescriptionOnly')
    .map((l: any) => ({
      description: l.Description || l.SalesItemLineDetail?.ItemRef?.name || 'Service',
      amount: l.Amount || 0,
    }))

  const { data: existing } = await supabase
    .from('invoices')
    .select('id')
    .eq('quickbooks_invoice_id', invoiceId)
    .eq('quickbooks_realm_id', realmId)
    .single()

  if (existing) {
    await supabase.from('invoices').update({
      owner_name: ownerName,
      due_date: dueDate,
      status,
    }).eq('id', existing.id)
  } else {
    const { data: newInvoice } = await supabase.from('invoices').insert({
      quickbooks_invoice_id: invoiceId,
      quickbooks_realm_id: realmId,
      quickbooks_customer_ref: inv.CustomerRef?.value || null,
      owner_name: ownerName,
      due_date: dueDate,
      status,
    }).select('id').single()

    if (newInvoice && lineItems.length > 0) {
      await supabase.from('invoice_line_items').insert(
        lineItems.map((item: any) => ({ ...item, invoice_id: newInvoice.id }))
      )
    }
  }
}

serve(async (req) => {
  const signature = req.headers.get('intuit-signature')
  const body = await req.text()

  // Verify HMAC-SHA256 signature
  if (signature) {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(QB_VERIFIER_TOKEN),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
    const expectedSig = btoa(String.fromCharCode(...new Uint8Array(sigBytes)))
    if (signature !== expectedSig) {
      return new Response('Unauthorized', { status: 401 })
    }
  }

  const payload = JSON.parse(body)

  for (const notification of payload.eventNotifications || []) {
    const realmId = notification.realmId
    const entities = notification.dataChangeEvent?.entities || []

    const { data: integration } = await supabase
      .from('barn_integrations')
      .select('*')
      .eq('realm_id', realmId)
      .eq('provider', 'quickbooks')
      .single()

    if (!integration) continue

    const accessToken = await getValidAccessToken(integration)

    for (const entity of entities) {
      if (entity.name === 'Invoice' && entity.operation !== 'Delete') {
        await syncInvoice(realmId, entity.id, accessToken)
      }
    }
  }

  return new Response('ok', { status: 200 })
})

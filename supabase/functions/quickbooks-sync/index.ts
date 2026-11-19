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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

async function fetchAllInvoices(accessToken: string, realmId: string): Promise<any[]> {
  const baseUrl = 'https://quickbooks.api.intuit.com'
  const pageSize = 100
  const all: any[] = []
  let startPosition = 1

  while (true) {
    const query = encodeURIComponent(
      `SELECT * FROM Invoice MAXRESULTS ${pageSize} STARTPOSITION ${startPosition}`
    )
    const res = await fetch(
      `${baseUrl}/v3/company/${realmId}/query?query=${query}&minorversion=65`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      }
    )
    const data = await res.json()
    const page = data.QueryResponse?.Invoice || []
    all.push(...page)
    if (page.length < pageSize) break
    startPosition += pageSize
  }

  return all
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { userId } = await req.json()
  if (!userId) return new Response('Missing userId', { status: 400, headers: corsHeaders })

  const { data: integration } = await supabase
    .from('barn_integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'quickbooks')
    .single()

  if (!integration) {
    return new Response(JSON.stringify({ error: 'QuickBooks not connected' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const accessToken = await getValidAccessToken(integration)
  const realmId = integration.realm_id

  // Fetch all invoices with pagination
  const invoices = await fetchAllInvoices(accessToken, realmId)

  const fetchedQbIds: string[] = []
  let synced = 0

  for (const inv of invoices) {
    const qbId = String(inv.Id)
    fetchedQbIds.push(qbId)

    const dueDate = inv.DueDate || null
    const ownerName = inv.CustomerRef?.name || null
    const total = inv.TotalAmt || 0
    const balance = inv.Balance ?? total
    const status = balance === 0 ? 'paid' : dueDate && new Date(dueDate) < new Date() ? 'overdue' : 'pending'

    const lineItems = (inv.Line || [])
      .filter((l: any) => l.DetailType === 'SalesItemLineDetail' || l.DetailType === 'DescriptionOnly')
      .map((l: any) => ({
        description: l.Description || l.SalesItemLineDetail?.ItemRef?.name || 'Service',
        amount: l.Amount || 0,
      }))

    const { data: existing } = await supabase
      .from('invoices')
      .select('id')
      .eq('quickbooks_invoice_id', qbId)
      .eq('quickbooks_realm_id', realmId)
      .single()

    if (existing) {
      // Update invoice fields
      await supabase.from('invoices').update({
        owner_name: ownerName,
        due_date: dueDate,
        status,
      }).eq('id', existing.id)

      // Refresh line items: delete old, insert fresh
      await supabase.from('invoice_line_items').delete().eq('invoice_id', existing.id)
      if (lineItems.length > 0) {
        await supabase.from('invoice_line_items').insert(
          lineItems.map((item: any) => ({ ...item, invoice_id: existing.id }))
        )
      }
    } else {
      const { data: newInvoice } = await supabase.from('invoices').insert({
        quickbooks_invoice_id: qbId,
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
    synced++
  }

  // Delete local QB invoices that no longer exist in QB
  if (fetchedQbIds.length > 0) {
    await supabase
      .from('invoices')
      .delete()
      .eq('quickbooks_realm_id', realmId)
      .not('quickbooks_invoice_id', 'in', `(${fetchedQbIds.join(',')})`)
  }

  return new Response(JSON.stringify({ synced }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

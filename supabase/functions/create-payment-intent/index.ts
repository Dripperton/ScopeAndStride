import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } },
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { invoiceId } = await req.json()
  if (!invoiceId) return new Response('Missing invoiceId', { status: 400, headers: corsHeaders })

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, invoice_line_items(*)')
    .eq('id', invoiceId)
    .single()

  if (!invoice) return new Response('Invoice not found', { status: 404, headers: corsHeaders })
  if (invoice.status === 'paid') return new Response('Invoice already paid', { status: 400, headers: corsHeaders })

  const total = (invoice.invoice_line_items || []).reduce(
    (sum: number, item: any) => sum + Number(item.amount), 0
  )
  const amountInCents = Math.round(total * 100)

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: 'usd',
    metadata: { invoice_id: String(invoiceId) },
    automatic_payment_methods: { enabled: true },
  })

  await supabase.from('invoices')
    .update({ stripe_payment_intent_id: paymentIntent.id })
    .eq('id', invoiceId)

  return new Response(JSON.stringify({ clientSecret: paymentIntent.client_secret }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
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

// ── Gather barn context for the AI based on role ─────────────────────────────

async function gatherContext(userId: string, role: string, horseIds: number[]) {
  const sections: string[] = []

  if (role === 'owner' || role === 'staff') {
    // All horses
    const { data: horses } = await supabase
      .from('horses')
      .select('id, name, breed, color, board_type, stall_number, alert, coggins_expiry_date')
    if (horses?.length) {
      sections.push(`HORSES (${horses.length} total):\n` + horses.map(h => {
        const parts = [`${h.name} (ID ${h.id})`]
        if (h.breed) parts.push(`breed: ${h.breed}`)
        if (h.board_type) parts.push(`board: ${h.board_type}`)
        if (h.stall_number) parts.push(`stall: ${h.stall_number}`)
        if (h.coggins_expiry_date) parts.push(`coggins expires: ${h.coggins_expiry_date}`)
        if (h.alert) parts.push('⚠️ ALERT FLAGGED')
        return '- ' + parts.join(', ')
      }).join('\n'))
    }

    // Upcoming events (next 14 days)
    const today = new Date().toISOString().split('T')[0]
    const twoWeeks = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
    const { data: events } = await supabase
      .from('events')
      .select('title, date, time, notes')
      .gte('date', today)
      .lte('date', twoWeeks)
      .order('date')
      .limit(20)
    if (events?.length) {
      sections.push(`UPCOMING EVENTS (next 14 days):\n` + events.map(e =>
        `- ${e.date}${e.time ? ' ' + e.time : ''}: ${e.title}${e.notes ? ' — ' + e.notes : ''}`
      ).join('\n'))
    }

    // Outstanding invoices
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, status, due_date, horse_id, invoice_line_items(description, amount)')
      .neq('status', 'paid')
      .limit(20)
    if (invoices?.length) {
      sections.push(`OUTSTANDING INVOICES:\n` + invoices.map(inv => {
        const total = (inv.invoice_line_items || []).reduce((s: number, li: any) => s + Number(li.amount), 0)
        return `- Invoice #${inv.id}: $${total.toFixed(2)} (${inv.status}), due ${inv.due_date || 'N/A'}`
      }).join('\n'))
    }

    // Recent farrier visits
    const { data: farrier } = await supabase
      .from('service_visits')
      .select('horse_id, date, next_appointment_date, notes, horses(name)')
      .eq('service_type', 'farrier')
      .order('date', { ascending: false })
      .limit(15)
    if (farrier?.length) {
      sections.push(`RECENT FARRIER VISITS:\n` + farrier.map(f =>
        `- ${(f as any).horses?.name || 'Horse ' + f.horse_id}: last visit ${f.date}${f.next_appointment_date ? ', next due ' + f.next_appointment_date : ''}`
      ).join('\n'))
    }

    // Alert settings
    const { data: settings } = await supabase
      .from('alert_settings')
      .select('coggins_days, farrier_days')
      .eq('barn_id', 'default')
      .single()
    if (settings) {
      sections.push(`ALERT THRESHOLDS: Coggins warning at ${settings.coggins_days} days, Farrier warning at ${settings.farrier_days} days`)
    }

  } else {
    // Horse owner — only their horses
    if (horseIds.length) {
      const { data: horses } = await supabase
        .from('horses')
        .select('id, name, breed, board_type, stall_number, coggins_expiry_date')
        .in('id', horseIds)
      if (horses?.length) {
        sections.push(`YOUR HORSES:\n` + horses.map(h => {
          const parts = [`${h.name}`]
          if (h.breed) parts.push(`breed: ${h.breed}`)
          if (h.board_type) parts.push(`board: ${h.board_type}`)
          if (h.coggins_expiry_date) parts.push(`coggins expires: ${h.coggins_expiry_date}`)
          return '- ' + parts.join(', ')
        }).join('\n'))
      }

      // Their invoices
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, status, due_date, invoice_line_items(description, amount)')
        .in('horse_id', horseIds)
        .neq('status', 'paid')
      if (invoices?.length) {
        sections.push(`YOUR OUTSTANDING INVOICES:\n` + invoices.map(inv => {
          const total = (inv.invoice_line_items || []).reduce((s: number, li: any) => s + Number(li.amount), 0)
          return `- Invoice #${inv.id}: $${total.toFixed(2)} (${inv.status}), due ${inv.due_date || 'N/A'}`
        }).join('\n'))
      }

      // Their farrier visits
      const { data: farrier } = await supabase
        .from('service_visits')
        .select('date, next_appointment_date, notes')
        .eq('service_type', 'farrier')
        .in('horse_id', horseIds)
        .order('date', { ascending: false })
        .limit(5)
      if (farrier?.length) {
        sections.push(`FARRIER HISTORY:\n` + farrier.map(f =>
          `- Last visit ${f.date}${f.next_appointment_date ? ', next due ' + f.next_appointment_date : ''}`
        ).join('\n'))
      }
    }
  }

  return sections.join('\n\n')
}

// ── Handler ──────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { question, userId, role, horseIds } = await req.json()

    if (!question || !userId) {
      return new Response(JSON.stringify({ error: 'Missing question or userId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get user profile for name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, barn_id')
      .eq('id', userId)
      .single()

    // Get barn name
    const barnName = 'Hidden Hill Farm' // TODO: fetch from barn_settings when multi-tenant

    // Gather data context
    const context = await gatherContext(userId, role || 'horse_owner', horseIds || [])

    const systemPrompt = `You are the AI Concierge for ${barnName}, an equestrian barn management assistant. You help barn owners, staff, and horse owners with questions about their barn operations.

CURRENT DATE: ${new Date().toISOString().split('T')[0]}
USER: ${profile?.full_name || 'Unknown'} (role: ${role || 'unknown'})

Here is the current barn data you have access to:

${context || 'No data available yet.'}

GUIDELINES:
- Be friendly, concise, and helpful. Keep answers to 2-3 short paragraphs max.
- Reference specific data when answering (horse names, dates, amounts).
- If asked about something not in the data above, say you don't have that information and suggest who to contact.
- For medical or veterinary questions, always recommend consulting a veterinarian — never give medical advice.
- Format currency as $X,XXX.XX. Format dates in a readable way.
- You can suggest operational improvements based on the data you see.
- If the user's role is horse_owner, only reference their own horse data — never reveal other horses' information.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: question }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Anthropic API error:', err)
      return new Response(JSON.stringify({ error: 'AI service error' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const data = await response.json()
    const answer = data.content?.[0]?.text || 'Sorry, I could not generate a response.'

    return new Response(JSON.stringify({ answer }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('Concierge error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

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

// ── Gather barn context ──────────────────────────────────────────────────────

async function gatherContext(role: string, horseIds: number[]) {
  const sections: string[] = []
  const today = new Date().toISOString().split('T')[0]
  const oneWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

  if (role === 'owner' || role === 'staff') {
    // All horses
    const { data: horses } = await supabase
      .from('horses')
      .select('id, name, breed, board_type, stall_number, alert, coggins_expiry_date')
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

    // Today's events
    const { data: todayEvents } = await supabase
      .from('events').select('title, date, time, notes')
      .eq('date', today).order('time')
    if (todayEvents?.length) {
      sections.push(`TODAY'S EVENTS:\n` + todayEvents.map(e =>
        `- ${e.time || 'All day'}: ${e.title}${e.notes ? ' — ' + e.notes : ''}`
      ).join('\n'))
    }

    // This week's events (excluding today)
    const { data: weekEvents } = await supabase
      .from('events').select('title, date, time, notes')
      .gt('date', today).lte('date', oneWeek).order('date').order('time').limit(20)
    if (weekEvents?.length) {
      sections.push(`THIS WEEK'S EVENTS:\n` + weekEvents.map(e =>
        `- ${e.date}${e.time ? ' ' + e.time : ''}: ${e.title}${e.notes ? ' — ' + e.notes : ''}`
      ).join('\n'))
    }

    // Outstanding invoices
    const { data: invoices } = await supabase
      .from('invoices')
      .select('id, status, due_date, horse_id, invoice_line_items(description, amount)')
      .neq('status', 'paid').limit(20)
    if (invoices?.length) {
      sections.push(`OUTSTANDING INVOICES:\n` + invoices.map(inv => {
        const total = (inv.invoice_line_items || []).reduce((s: number, li: any) => s + Number(li.amount), 0)
        return `- Invoice #${inv.id}: $${total.toFixed(2)} (${inv.status}), due ${inv.due_date || 'N/A'}`
      }).join('\n'))
    }

    // Farrier visits — upcoming and recent
    const { data: farrier } = await supabase
      .from('service_visits')
      .select('horse_id, date, next_appointment_date, notes, horses(name)')
      .eq('service_type', 'farrier')
      .order('date', { ascending: false }).limit(15)
    if (farrier?.length) {
      sections.push(`FARRIER VISITS:\n` + farrier.map(f =>
        `- ${(f as any).horses?.name || 'Horse ' + f.horse_id}: last visit ${f.date}${f.next_appointment_date ? ', next due ' + f.next_appointment_date : ''}`
      ).join('\n'))
    }

    // Alert settings
    const { data: settings } = await supabase
      .from('alert_settings').select('coggins_days, farrier_days')
      .eq('barn_id', 'default').single()
    if (settings) {
      sections.push(`ALERT THRESHOLDS: Coggins warning at ${settings.coggins_days} days, Farrier warning at ${settings.farrier_days} days`)
    }

  } else {
    // Horse owner — scoped to their horses
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

      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, status, due_date, invoice_line_items(description, amount)')
        .in('horse_id', horseIds).neq('status', 'paid')
      if (invoices?.length) {
        sections.push(`YOUR OUTSTANDING INVOICES:\n` + invoices.map(inv => {
          const total = (inv.invoice_line_items || []).reduce((s: number, li: any) => s + Number(li.amount), 0)
          return `- Invoice #${inv.id}: $${total.toFixed(2)} (${inv.status}), due ${inv.due_date || 'N/A'}`
        }).join('\n'))
      }

      const { data: farrier } = await supabase
        .from('service_visits')
        .select('date, next_appointment_date, notes')
        .eq('service_type', 'farrier')
        .in('horse_id', horseIds)
        .order('date', { ascending: false }).limit(5)
      if (farrier?.length) {
        sections.push(`FARRIER HISTORY:\n` + farrier.map(f =>
          `- Last visit ${f.date}${f.next_appointment_date ? ', next due ' + f.next_appointment_date : ''}`
        ).join('\n'))
      }
    }

    // Events visible to horse owner
    const { data: events } = await supabase
      .from('events').select('title, date, time')
      .gte('date', today).lte('date', oneWeek).order('date').order('time').limit(10)
    if (events?.length) {
      sections.push(`UPCOMING EVENTS:\n` + events.map(e =>
        `- ${e.date}${e.time ? ' ' + e.time : ''}: ${e.title}`
      ).join('\n'))
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
    const { userId, role, horseIds, forceRefresh, language } = await req.json()

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const today = new Date().toISOString().split('T')[0]
    const cacheRole = role === 'horse_owner' ? 'horse_owner' : 'owner'
    const cacheUserId = role === 'horse_owner' ? userId : null

    // ── Check cache (unless force refresh)
    if (!forceRefresh) {
      let query = supabase
        .from('daily_digests')
        .select('digest_text, generated_at')
        .eq('barn_id', 'default')
        .eq('date', today)
        .eq('role', cacheRole)

      if (cacheUserId) {
        query = query.eq('user_id', cacheUserId)
      } else {
        query = query.is('user_id', null)
      }

      const { data: cached } = await query.single()

      if (cached) {
        return new Response(JSON.stringify({
          digest: cached.digest_text,
          generated_at: cached.generated_at,
          cached: true,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // ── Gather context and generate
    const { data: profile } = await supabase
      .from('profiles').select('full_name, barn_id')
      .eq('id', userId).single()

    const barnName = 'Hidden Hill Farm'
    const context = await gatherContext(role || 'horse_owner', horseIds || [])

    const langInstruction = language === 'es' ? '\n\nIMPORTANT: Respond entirely in Spanish.' : ''

    const systemPrompt = role === 'horse_owner'
      ? `You are a barn concierge for ${barnName}. Write a brief daily update for ${profile?.full_name || 'the horse owner'} about their horse(s).

CURRENT DATE: ${today}

${context}

FORMATTING RULES — follow these EXACTLY:
- Plain text only. No markdown, no asterisks, no bold.
- Use bullet points with "•" character. One fact per line. Max 4 bullets.
- Each bullet = a short phrase, NOT a sentence. No periods. No filler words.
- Good: "• Farrier due in 3 days"
- Good: "• 1 unpaid invoice — $350"
- Bad: "Your farrier appointment is coming up in three days."
- Skip anything with nothing to report. No greeting. No sign-off.
- 20-40 words max.${langInstruction}`

      : `You are a barn concierge for ${barnName}. Write a brief daily update for the barn manager.

CURRENT DATE: ${today}

${context}

FORMATTING RULES — follow these EXACTLY:
- Plain text only. No markdown, no asterisks, no bold.
- Use bullet points with "•" character. One fact per line. Max 5 bullets.
- Each bullet = a short phrase, NOT a sentence. No periods. No filler words.
- Good: "• 3 events today — farrier 10am, vet 2pm, lesson 4pm"
- Good: "• Coggins expiring in 5 days: Bella, Scout"
- Good: "• $1,200 outstanding (4 invoices)"
- Bad: "You have three events scheduled for today including a farrier visit."
- Lead with most urgent items. Group related items on one line.
- Skip anything with nothing to report. No greeting. No sign-off.
- 30-60 words max.${langInstruction}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        system: systemPrompt,
        messages: [{ role: 'user', content: 'Generate today\'s daily briefing.' }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Anthropic API error:', err)
      return new Response(JSON.stringify({ error: 'AI service error' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const data = await response.json()
    const digestText = data.content?.[0]?.text || 'Unable to generate briefing.'
    const generatedAt = new Date().toISOString()

    // ── Cache the result (upsert to handle race conditions)
    if (forceRefresh) {
      // Delete existing then insert
      let delQuery = supabase
        .from('daily_digests')
        .delete()
        .eq('barn_id', 'default')
        .eq('date', today)
        .eq('role', cacheRole)

      if (cacheUserId) {
        delQuery = delQuery.eq('user_id', cacheUserId)
      } else {
        delQuery = delQuery.is('user_id', null)
      }
      await delQuery
    }

    await supabase.from('daily_digests').insert({
      barn_id: 'default',
      date: today,
      role: cacheRole,
      user_id: cacheUserId,
      digest_text: digestText,
      generated_at: generatedAt,
    })

    return new Response(JSON.stringify({
      digest: digestText,
      generated_at: generatedAt,
      cached: false,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('Digest error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

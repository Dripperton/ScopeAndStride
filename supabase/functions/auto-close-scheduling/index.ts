import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } },
})

// Parses "10:00 PM" → { hours: 22, minutes: 0 }
function parseTime(timeStr: string): { hours: number; minutes: number } | null {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return null
  let hours = parseInt(match[1])
  const minutes = parseInt(match[2])
  const ampm = match[3].toUpperCase()
  if (ampm === 'PM' && hours !== 12) hours += 12
  if (ampm === 'AM' && hours === 12) hours = 0
  return { hours, minutes }
}

serve(async () => {
  try {
    const { data: settings, error } = await supabase
      .from('scheduling_settings')
      .select('accepting_requests, auto_close_day, auto_close_time')
      .eq('id', 1)
      .single()

    if (error || !settings) {
      return new Response(JSON.stringify({ skipped: 'no settings row' }), { status: 200 })
    }

    const { accepting_requests, auto_close_day, auto_close_time } = settings

    // Nothing to do if already closed or no auto-close configured
    if (!accepting_requests || auto_close_day === null || !auto_close_time) {
      return new Response(JSON.stringify({ skipped: 'not configured or already closed' }), { status: 200 })
    }

    const now = new Date()
    const currentDay = now.getUTCDay() // 0=Sun … 6=Sat
    const parsed = parseTime(auto_close_time)

    if (!parsed) {
      return new Response(JSON.stringify({ skipped: 'could not parse auto_close_time' }), { status: 200 })
    }

    const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()
    const closeMinutes = parsed.hours * 60 + parsed.minutes

    if (currentDay === auto_close_day && currentMinutes >= closeMinutes) {
      await supabase
        .from('scheduling_settings')
        .update({ accepting_requests: false })
        .eq('id', 1)
      return new Response(JSON.stringify({ closed: true }), { status: 200 })
    }

    return new Response(JSON.stringify({ skipped: 'not yet time to close' }), { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})

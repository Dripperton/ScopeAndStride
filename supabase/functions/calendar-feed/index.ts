import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function parseTime(timeStr: string): { hours: number; minutes: number } | null {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i)
  if (!match) return null
  let hours = parseInt(match[1])
  const minutes = parseInt(match[2])
  const ampm = match[3]?.toUpperCase()
  if (ampm === 'PM' && hours !== 12) hours += 12
  if (ampm === 'AM' && hours === 12) hours = 0
  return { hours, minutes }
}

function toICSDate(dateStr: string, timeStr?: string | null): { start: string; end: string; allDay: boolean } {
  const [y, m, d] = dateStr.split('-').map(Number)
  const parsed = timeStr ? parseTime(timeStr) : null

  if (parsed) {
    const pad = (n: number) => String(n).padStart(2, '0')
    const start = `${y}${pad(m)}${pad(d)}T${pad(parsed.hours)}${pad(parsed.minutes)}00`
    const endHour = parsed.hours + 1
    const end = `${y}${pad(m)}${pad(d)}T${pad(endHour)}${pad(parsed.minutes)}00`
    return { start, end, allDay: false }
  }

  const pad = (n: number) => String(n).padStart(2, '0')
  const dateOnly = `${y}${pad(m)}${pad(d)}`
  // All-day end date is exclusive (next day)
  const next = new Date(y, m - 1, d + 1)
  const nextStr = `${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`
  return { start: dateOnly, end: nextStr, allDay: true }
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')

  if (!token) {
    return new Response('Missing token', { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } },
})

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, horse_id')
    .eq('calendar_token', token)
    .single()

  if (!profile) {
    return new Response('Invalid token', { status: 401 })
  }

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const today = yesterday.toISOString().split('T')[0]
  const sixMonths = new Date()
  sixMonths.setMonth(sixMonths.getMonth() + 6)
  const endDate = sixMonths.toISOString().split('T')[0]

  let query = supabase
    .from('events')
    .select('*, horses(name)')
    .gte('date', today)
    .lte('date', endDate)
    .order('date', { ascending: true })

  if (profile.role === 'horse_owner' && profile.horse_id) {
    query = query.or(`horse_id.eq.${profile.horse_id},horse_id.is.null`)
  }

  const { data: events } = await query

  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Scope & Stride//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Scope & Stride',
    'X-WR-TIMEZONE:America/New_York',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ]

  for (const event of events || []) {
    const { start, end, allDay } = toICSDate(event.date, event.time)
    const summary = event.horses?.name
      ? `${event.title} — ${event.horses.name}`
      : event.title
    const descParts = [event.assignee, event.notes].filter(Boolean)
    const description = descParts.join('\\n')

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${event.id}@scopeandstride`)
    lines.push(`DTSTAMP:${now}`)
    if (allDay) {
      lines.push(`DTSTART;VALUE=DATE:${start}`)
      lines.push(`DTEND;VALUE=DATE:${end}`)
    } else {
      lines.push(`DTSTART:${start}`)
      lines.push(`DTEND:${end}`)
    }
    lines.push(`SUMMARY:${summary}`)
    if (description) lines.push(`DESCRIPTION:${description}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')

  return new Response(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'no-cache, no-store',
    },
  })
})

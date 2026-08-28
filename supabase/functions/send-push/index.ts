import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } },
})

serve(async (req) => {
  try {
    const { user_ids, horse_id, role, title, body } = await req.json()

    let tokens: string[] = []

    if (user_ids?.length) {
      const { data } = await supabase
        .from('profiles')
        .select('push_token')
        .in('id', user_ids)
        .not('push_token', 'is', null)
      tokens = (data || []).map((p: any) => p.push_token).filter(Boolean)
    } else if (horse_id) {
      const { data: links } = await supabase
        .from('horse_users')
        .select('user_id')
        .eq('horse_id', horse_id)
      const userIds = (links || []).map((l: any) => l.user_id)
      if (userIds.length > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('push_token')
          .in('id', userIds)
          .not('push_token', 'is', null)
        tokens = (data || []).map((p: any) => p.push_token).filter(Boolean)
      }
    } else if (role) {
      const roles = Array.isArray(role) ? role : [role]
      const { data } = await supabase
        .from('profiles')
        .select('push_token')
        .in('role', roles)
        .not('push_token', 'is', null)
      tokens = (data || []).map((p: any) => p.push_token).filter(Boolean)
    }

    if (tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: { 'Content-Type': 'application/json' } })
    }

    const messages = tokens.map(to => ({ to, title, body, sound: 'default' }))

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(messages),
    })

    const result = await res.json()
    return new Response(JSON.stringify({ sent: tokens.length, result }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})

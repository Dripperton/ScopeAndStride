import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } },
})

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - new Date().getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Scope & Stride <notifications@scopeandstride.com>',
      to,
      subject,
      html,
    }),
  })
  return res.ok
}

function dueSoonEmail(horseName: string, ownerName: string, amount: number, dueDate: string, daysLeft: number, barnName: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background: #2C4A35; padding: 24px; border-radius: 12px; margin-bottom: 24px;">
        <h1 style="color: #C9A85C; margin: 0; font-size: 24px;">Scope & Stride</h1>
        <p style="color: rgba(255,255,255,0.6); margin: 4px 0 0;">${barnName}</p>
      </div>
      <h2 style="color: #1A1A14;">Invoice Due in ${daysLeft} Day${daysLeft !== 1 ? 's' : ''}</h2>
      <p style="color: #3A3830;">Hi ${ownerName},</p>
      <p style="color: #3A3830;">This is a friendly reminder that your invoice for <strong>${horseName}</strong> is due in <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>.</p>
      <div style="background: #FEF6E4; border: 1.5px solid #E67E22; border-radius: 10px; padding: 16px; margin: 24px 0;">
        <p style="margin: 0; color: #1A1A14;"><strong>Amount Due:</strong> $${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        <p style="margin: 8px 0 0; color: #1A1A14;"><strong>Due Date:</strong> ${dueDate}</p>
      </div>
      <p style="color: #9A9285; font-size: 13px;">Please contact your barn manager if you have any questions.</p>
    </div>
  `
}

function overdueEmail(horseName: string, ownerName: string, amount: number, dueDate: string, barnName: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background: #2C4A35; padding: 24px; border-radius: 12px; margin-bottom: 24px;">
        <h1 style="color: #C9A85C; margin: 0; font-size: 24px;">Scope & Stride</h1>
        <p style="color: rgba(255,255,255,0.6); margin: 4px 0 0;">${barnName}</p>
      </div>
      <h2 style="color: #8B2E2E;">Invoice Overdue</h2>
      <p style="color: #3A3830;">Hi ${ownerName},</p>
      <p style="color: #3A3830;">Your invoice for <strong>${horseName}</strong> was due on <strong>${dueDate}</strong> and is now overdue. Please arrange payment as soon as possible.</p>
      <div style="background: #FDECEA; border: 1.5px solid #C0392B; border-radius: 10px; padding: 16px; margin: 24px 0;">
        <p style="margin: 0; color: #1A1A14;"><strong>Amount Due:</strong> $${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        <p style="margin: 8px 0 0; color: #8B2E2E;"><strong>Due Date:</strong> ${dueDate} — OVERDUE</p>
      </div>
      <p style="color: #9A9285; font-size: 13px;">Please contact your barn manager if you have any questions or need to make payment arrangements.</p>
    </div>
  `
}

serve(async () => {
  try {
    // Fetch barn name from settings
    const { data: barnSettings } = await supabase
      .from('barn_settings')
      .select('barn_name')
      .single()
    const barnName = barnSettings?.barn_name ?? 'Hollow Creek'

    // Fetch all pending/overdue invoices with horse and profile info
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select(`
        id, owner_name, due_date, status,
        horses(id, name),
        invoice_line_items(amount)
      `)
      .in('status', ['pending', 'overdue'])
      .not('due_date', 'is', null)

    if (error) throw error

    let sent = 0
    let skipped = 0

    for (const invoice of invoices || []) {
      const daysLeft = daysUntil(invoice.due_date)
      const horseName = invoice.horses?.name || 'your horse'
      const ownerName = invoice.owner_name || 'there'
      const amount = (invoice.invoice_line_items || []).reduce((sum: number, item: any) => sum + Number(item.amount), 0)

      // Find the horse owner's email via profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('horse_id', invoice.horses?.id)
        .eq('role', 'horse_owner')
        .single()

      if (!profile?.email) { skipped++; continue }

      let emailSent = false

      if (daysLeft === 5) {
        emailSent = await sendEmail(
          profile.email,
          `Invoice due in 5 days — ${horseName}`,
          dueSoonEmail(horseName, ownerName, amount, invoice.due_date, 5, barnName)
        )
      } else if (daysLeft === 1) {
        emailSent = await sendEmail(
          profile.email,
          `Invoice due tomorrow — ${horseName}`,
          dueSoonEmail(horseName, ownerName, amount, invoice.due_date, 1, barnName)
        )
      } else if (daysLeft <= 0 && invoice.status !== 'overdue') {
        // Mark as overdue and send notice
        await supabase.from('invoices').update({ status: 'overdue' }).eq('id', invoice.id)
        emailSent = await sendEmail(
          profile.email,
          `Invoice overdue — ${horseName}`,
          overdueEmail(horseName, ownerName, amount, invoice.due_date, barnName)
        )
      } else if (invoice.status === 'overdue') {
        emailSent = await sendEmail(
          profile.email,
          `Invoice overdue — ${horseName}`,
          overdueEmail(horseName, ownerName, amount, invoice.due_date, barnName)
        )
      }

      if (emailSent) sent++
    }

    return new Response(
      JSON.stringify({ success: true, sent, skipped }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

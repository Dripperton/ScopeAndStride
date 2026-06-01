import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } },
})

serve(async () => {
  try {
    const today = new Date()
    const year = today.getUTCFullYear()
    const month = today.getUTCMonth()
    const dayOfMonth = today.getUTCDate()
    const dayOfWeek = today.getUTCDay()

    const { data: templates, error } = await supabase
      .from('recurring_templates')
      .select('*, recurring_template_line_items(*)')
      .eq('active', true)

    if (error) throw error

    let generated = 0
    let skipped = 0

    for (const template of templates || []) {
      const dueDay = template.due_day || 1

      // --- Monthly ---
      if (template.interval === 'monthly') {
        // Only run on the 1st of the month
        if (dayOfMonth !== 1) { skipped++; continue }

        // Build due_date for this month using due_day
        const dueDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`

        // Skip if invoice already exists for this horse in this calendar month
        const { data: existing } = await supabase
          .from('invoices')
          .select('id')
          .eq('horse_id', template.horse_id)
          .gte('due_date', `${year}-${String(month + 1).padStart(2, '0')}-01`)
          .lt('due_date', `${year}-${String(month + 2).padStart(2, '0')}-01`)
          .limit(1)

        if (existing && existing.length > 0) { skipped++; continue }

        const ok = await createInvoice(template, dueDate)
        if (ok) generated++; else skipped++
      }

      // --- Weekly ---
      else if (template.interval === 'weekly') {
        // Only run on the matching day of week
        if (dayOfWeek !== dueDay) { skipped++; continue }

        // due_date = 7 days from today
        const dueDate = new Date(today)
        dueDate.setUTCDate(dueDate.getUTCDate() + 7)
        const dueDateStr = dueDate.toISOString().split('T')[0]

        // Skip if invoice already exists with this exact due_date for this horse
        const { data: existing } = await supabase
          .from('invoices')
          .select('id')
          .eq('horse_id', template.horse_id)
          .eq('due_date', dueDateStr)
          .limit(1)

        if (existing && existing.length > 0) { skipped++; continue }

        const ok = await createInvoice(template, dueDateStr)
        if (ok) generated++; else skipped++
      } else {
        skipped++
      }
    }

    return new Response(
      JSON.stringify({ success: true, generated, skipped }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

async function createInvoice(template: any, dueDate: string): Promise<boolean> {
  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      horse_id: template.horse_id,
      owner_name: template.owner_name,
      status: 'pending',
      due_date: dueDate,
      notes: template.notes || null,
    })
    .select()
    .single()

  if (error || !invoice) return false

  const lineItems = (template.recurring_template_line_items || []).map((item: any) => ({
    invoice_id: invoice.id,
    description: item.description,
    amount: item.amount,
  }))

  if (lineItems.length > 0) {
    const { error: liError } = await supabase.from('invoice_line_items').insert(lineItems)
    if (liError) return false
  }

  return true
}

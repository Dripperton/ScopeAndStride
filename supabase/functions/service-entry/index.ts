import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  serviceKey,
  {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${serviceKey}` } },
  }
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const SERVICE_LABELS: Record<string, string> = {
  farrier: 'Farrier', vet: 'Vet', vaccination: 'Vaccination',
  medication: 'Medication', bodywork: 'Bodywork', dental: 'Dental', other: 'Other',
};

async function getOwnerEmail(horseId: number): Promise<string | null> {
  // Look up via horse_users join table (billing contact preferred, falls back to first linked owner)
  const { data: links } = await supabase
    .from('horse_users')
    .select('user_id, billing_contact')
    .eq('horse_id', horseId)
    .order('billing_contact', { ascending: false });
  if (!links?.length) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', links[0].user_id)
    .single();
  return profile?.email ?? null;
}

async function sendVisitEmail(opts: {
  to: string;
  horseName: string;
  serviceType: string;
  date: string;
  providerName: string | null;
  title: string | null;
  amount: number | null;
  barnInvoiced: boolean;
  paymentUrl: string | null;
}) {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) return;

  const serviceLabel = SERVICE_LABELS[opts.serviceType] || 'Service';
  const formattedDate = new Date(opts.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const formattedAmount = opts.amount ? `$${opts.amount.toFixed(2)}` : null;

  const paymentSection = opts.barnInvoiced
    ? `<p style="margin:0;color:#6B7280;font-size:14px;">This service will appear on your next barn invoice.</p>`
    : opts.paymentUrl && formattedAmount
    ? `<a href="${opts.paymentUrl}" style="display:inline-block;margin-top:4px;background:#2C4A35;color:white;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;">Pay ${formattedAmount}</a>`
    : '';

  const rows = [
    ['Service', serviceLabel],
    ['Date', formattedDate],
    opts.providerName ? ['Provider', opts.providerName] : null,
    opts.title ? ['What was done', opts.title] : null,
    // Don't show amount for barn-invoiced visits — billing handled via invoice
    !opts.barnInvoiced && formattedAmount ? ['Amount', formattedAmount] : null,
  ].filter(Boolean) as [string, string][];

  const tableRows = rows.map(([label, value]) => `
    <tr>
      <td style="padding:8px 0;color:#9A9285;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;padding-right:24px;">${label}</td>
      <td style="padding:8px 0;color:#1A1A14;font-size:14px;">${value}</td>
    </tr>`).join('');

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;background:#FAF7F2;padding:0;">
      <div style="background:#2C4A35;padding:24px 32px;">
        <p style="margin:0 0 4px;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:1px;text-transform:uppercase;">Scope &amp; Stride</p>
        <h1 style="margin:0;color:#C9A85C;font-size:20px;font-style:italic;">${opts.horseName}</h1>
      </div>
      <div style="padding:28px 32px;">
        <p style="margin:0 0 20px;color:#3A3830;font-size:15px;">A <strong>${serviceLabel.toLowerCase()}</strong> visit has been logged for <strong>${opts.horseName}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">${tableRows}</table>
        ${paymentSection}
      </div>
      <div style="padding:16px 32px 24px;border-top:1px solid #E8E0CC;">
        <p style="margin:0;color:#9A9285;font-size:12px;">You're receiving this because you're listed as the owner of ${opts.horseName} at your barn.</p>
      </div>
    </div>`;

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Scope & Stride <notifications@scopeandstride.com>',
      to: [opts.to],
      subject: `${serviceLabel} visit logged for ${opts.horseName}`,
      html,
    }),
  });
  const resendData = await resendRes.json();
  console.log('Resend response:', JSON.stringify(resendData));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const barnToken = url.searchParams.get('barn');

  // ── Barn-level bulk entry ──────────────────────────────────────────────────
  if (barnToken) {
    const { data: settings, error: settingsError } = await supabase
      .from('alert_settings')
      .select('barn_qr_token')
      .eq('barn_id', 'default')
      .single();

    if (settingsError) return json({ error: 'Settings lookup failed', detail: settingsError.message }, 500);
    if (!settings) return json({ error: 'No alert_settings row found for barn_id=default' }, 404);
    if (settings.barn_qr_token !== barnToken) return json({ error: 'Token mismatch', stored: settings.barn_qr_token?.slice(0, 8) + '...', received: barnToken?.slice(0, 8) + '...' }, 404);

    if (req.method === 'GET') {
      const { data: horses, error: horsesError } = await supabase
        .from('horses')
        .select('id, name, color')
        .order('name');
      if (horsesError) return json({ error: horsesError.message, code: horsesError.code }, 500);
      return json({ horses: horses || [] });
    }

    if (req.method === 'POST') {
      let body: any;
      try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

      const { service_type, date, provider_name, horses } = body;
      if (!date) return json({ error: 'Date is required' }, 400);
      if (!horses?.length) return json({ error: 'No horses selected' }, 400);

      const inserts = horses.map((h: any) => ({
        horse_id: h.horse_id,
        service_type: service_type || 'other',
        date,
        provider_name: provider_name || null,
        title: h.title || null,
        notes: h.notes || null,
        next_appointment_date: h.next_appointment_date || null,
        expiry_date: h.expiry_date || null,
        amount: h.amount ? parseFloat(h.amount) : null,
        barn_invoiced: h.barn_invoiced ?? false,
        external_invoice_url: h.external_invoice_url || null,
        source: 'qr_bulk',
      }));

      const { error } = await supabase.from('service_visits').insert(inserts);
      if (error) return json({ error: error.message }, 500);

      for (const h of horses) {
        const email = await getOwnerEmail(h.horse_id);
        if (!email) continue;
        const { data: horseRow } = await supabase.from('horses').select('name').eq('id', h.horse_id).single();
        await sendVisitEmail({
          to: email,
          horseName: horseRow?.name ?? 'your horse',
          serviceType: service_type || 'other',
          date,
          providerName: provider_name || null,
          title: h.title || null,
          amount: h.amount ? parseFloat(h.amount) : null,
          barnInvoiced: h.barn_invoiced ?? false,
          paymentUrl: h.external_invoice_url || null,
        });
      }

      return json({ success: true, count: inserts.length });
    }

    return json({ error: 'Method not allowed' }, 405);
  }

  // ── Per-horse single entry ─────────────────────────────────────────────────
  if (!token) return json({ error: 'Missing token' }, 400);

  const { data: horse } = await supabase
    .from('horses')
    .select('id, name')
    .eq('qr_token', token)
    .single();

  if (!horse) return json({ error: 'Horse not found' }, 404);

  if (req.method === 'GET') {
    return json({ id: horse.id, name: horse.name });
  }

  if (req.method === 'POST') {
    let body: any;
    try { body = await req.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }

    const { service_type, date, provider_name, title, notes, next_appointment_date, expiry_date, amount, barn_invoiced, external_invoice_url } = body;
    if (!date) return json({ error: 'Date is required' }, 400);

    const { error } = await supabase.from('service_visits').insert({
      horse_id: horse.id,
      service_type: service_type || 'other',
      date,
      provider_name: provider_name || null,
      title: title || null,
      notes: notes || null,
      next_appointment_date: next_appointment_date || null,
      expiry_date: expiry_date || null,
      amount: amount ? parseFloat(amount) : null,
      barn_invoiced: barn_invoiced ?? false,
      external_invoice_url: external_invoice_url || null,
      source: 'qr',
    });

    if (error) return json({ error: error.message }, 500);

    const ownerEmail = await getOwnerEmail(horse.id);
    if (ownerEmail) {
      await sendVisitEmail({
        to: ownerEmail,
        horseName: horse.name,
        serviceType: service_type || 'other',
        date,
        providerName: provider_name || null,
        title: title || null,
        amount: amount ? parseFloat(amount) : null,
        barnInvoiced: barn_invoiced ?? false,
        paymentUrl: external_invoice_url || null,
      });
    }

    return json({ success: true });
  }

  return json({ error: 'Method not allowed' }, 405);
});

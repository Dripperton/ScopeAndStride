import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { pdf_base64 } = await req.json()

    if (!pdf_base64) {
      return new Response(
        JSON.stringify({ error: 'pdf_base64 is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: pdf_base64,
                },
              },
              {
                type: 'text',
                text: `Extract the key information from this equine health or service provider PDF and return a JSON object with exactly these fields:

{
  "title": "Brief descriptive title (e.g. 'Lameness Exam', 'Chiropractic Adjustment', 'Annual Wellness Visit', 'Dental Float', 'Shoeing')",
  "date": "Visit/service date in YYYY-MM-DD format, or empty string if not found",
  "notes": "Concise summary of findings, treatment, and any follow-up recommendations — 2-4 sentences max",
  "provider": "Provider name and specialty if present (e.g. 'Dr. Smith - Veterinarian', 'Jane Doe - Equine Chiropractor'), otherwise empty string",
  "type": "One of: coggins, vaccination, vet_visit, medication, custom — pick the best fit. Use vet_visit for any clinical exam or treatment, custom for chiro/bodywork/farrier/dentist/other specialist."
}

Return only the raw JSON object, no markdown, no explanation.`,
              },
            ],
          },
        ],
      }),
    })

    if (!anthropicResponse.ok) {
      const err = await anthropicResponse.text()
      console.error('Anthropic error:', err)
      return new Response(
        JSON.stringify({ error: 'Failed to parse PDF' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const anthropicData = await anthropicResponse.json()
    const rawText = anthropicData.content?.[0]?.text ?? ''

    // Strip markdown code fences if present
    const cleaned = rawText.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim()

    let parsed: Record<string, string>
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('JSON parse failed, raw text:', rawText)
      return new Response(
        JSON.stringify({ error: 'Could not parse PDF content' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const validTypes = ['coggins', 'vaccination', 'vet_visit', 'medication', 'custom']
    const suggestedType = validTypes.includes(parsed.type) ? parsed.type : 'vet_visit'

    return new Response(
      JSON.stringify({
        type: suggestedType,
        title: parsed.title ?? '',
        date: parsed.date ?? '',
        notes: parsed.provider
          ? `Provider: ${parsed.provider}\n\n${parsed.notes ?? ''}`
          : (parsed.notes ?? ''),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('parse-vet-pdf error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

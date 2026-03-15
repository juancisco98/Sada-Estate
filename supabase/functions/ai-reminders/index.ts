// Supabase Edge Function: AI Reminders Proxy
// Recibe un snapshot del estado de la app y genera recordatorios con IA
//
// Configurar secrets en Supabase:
//   supabase secrets set AI_PROVIDER=gemini AI_API_KEY=xxx AI_MODEL=gemini-2.0-flash
//   Providers soportados: gemini, claude, openai
//
// Deploy:
//   supabase functions deploy ai-reminders

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Sos un asistente administrativo para Sada Estate, una empresa familiar de gestión de alquileres en Buenos Aires, Argentina.

Tu trabajo es analizar el estado actual de las propiedades, inquilinos, pagos y obras de mantenimiento, y generar recordatorios priorizados para el administrador.

REGLAS:
- Genera entre 3 y 15 recordatorios ordenados por urgencia
- Cada recordatorio debe tener exactamente estos campos JSON:
  - "title": string corto (máx 60 caracteres)
  - "description": string descriptivo en español argentino
  - "urgency": "overdue" | "urgent" | "upcoming"
  - "entityType": "property" | "tenant" | "professional" | "maintenance_task" | null
  - "entityId": string del ID de la entidad relacionada o null
  - "suggestedDueDate": string ISO date (YYYY-MM-DD) de cuándo atender esto
- Detectá: contratos por vencer, pagos atrasados, obras sin actualizar, ajustes de alquiler pendientes, profesionales con cobros pendientes
- Usá lenguaje natural en español argentino, sé específico con nombres y direcciones
- NO inventes datos que no estén en el contexto proporcionado
- Responde SOLO con un JSON array, sin texto adicional ni markdown

Respondé con este formato exacto:
[
  { "title": "...", "description": "...", "urgency": "...", "entityType": "...", "entityId": "...", "suggestedDueDate": "..." }
]`;

async function callClaude(apiKey: string, model: string, userMessage: string): Promise<string> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model,
            max_tokens: 2048,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userMessage }],
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Claude API error: ${res.status} ${err}`);
    }

    const data = await res.json();
    return data.content[0].text;
}

async function callGemini(apiKey: string, model: string, userMessage: string): Promise<string> {
    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
                contents: [{ role: 'user', parts: [{ text: userMessage }] }],
                generationConfig: { maxOutputTokens: 2048 },
            }),
        }
    );

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini API error: ${res.status} ${err}`);
    }

    const data = await res.json();
    return data.candidates[0].content.parts[0].text;
}

async function callOpenAI(apiKey: string, model: string, userMessage: string): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            max_tokens: 2048,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userMessage },
            ],
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenAI API error: ${res.status} ${err}`);
    }

    const data = await res.json();
    return data.choices[0].message.content;
}

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const provider = Deno.env.get('AI_PROVIDER') || 'gemini';
        const apiKey = Deno.env.get('AI_API_KEY');
        const defaultModels: Record<string, string> = {
            gemini: 'gemini-2.0-flash',
            claude: 'claude-sonnet-4-20250514',
            openai: 'gpt-4o-mini',
        };
        const model = Deno.env.get('AI_MODEL') || defaultModels[provider] || 'gemini-2.0-flash';

        if (!apiKey) {
            return new Response(
                JSON.stringify({ error: 'AI_API_KEY not configured. Run: supabase secrets set AI_API_KEY=your-key' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const body = await req.json();

        // Build user message with compact data
        const userMessage = `Fecha actual: ${body.currentDate}

PROPIEDADES (${body.properties?.length || 0}):
${JSON.stringify(body.properties || [], null, 0)}

PAGOS PENDIENTES/EN REVISIÓN (${body.pendingPayments?.length || 0}):
${JSON.stringify(body.pendingPayments || [], null, 0)}

OBRAS DE MANTENIMIENTO ACTIVAS (${body.activeTasks?.length || 0}):
${JSON.stringify(body.activeTasks || [], null, 0)}

PROFESIONALES (${body.professionals?.length || 0}):
${JSON.stringify(body.professionals || [], null, 0)}

Analizá toda la información y generá recordatorios priorizados para el administrador.`;

        let rawResponse: string;

        if (provider === 'gemini') {
            rawResponse = await callGemini(apiKey, model, userMessage);
        } else if (provider === 'openai') {
            rawResponse = await callOpenAI(apiKey, model, userMessage);
        } else {
            rawResponse = await callClaude(apiKey, model, userMessage);
        }

        // Parse JSON from response (handle potential markdown wrapping)
        let reminders;
        try {
            const jsonMatch = rawResponse.match(/\[[\s\S]*\]/);
            reminders = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        } catch {
            console.error('Failed to parse AI response:', rawResponse);
            reminders = [];
        }

        return new Response(
            JSON.stringify({ reminders, provider, model }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});

// Supabase Edge Function: Smart Automation
// Analiza patrones de acciones de admin y genera propuestas de automatización
//
// Usa los mismos secrets que ai-reminders:
//   supabase secrets set AI_PROVIDER=gemini AI_API_KEY=xxx AI_MODEL=gemini-2.5-flash
//
// Deploy:
//   supabase functions deploy smart-automation

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `# IDENTIDAD

Sos el Cerebro de Automatización de Sada Estate, una empresa familiar de gestión de alquileres en Buenos Aires, Argentina. Tu misión es aprender del comportamiento del administrador y proponer acciones que el sistema pueda ejecutar automáticamente con confianza creciente.

Tu objetivo a largo plazo: que el admin solo necesite supervisar, no ejecutar. Cada propuesta tuya que se aprueba te acerca a ese objetivo. Cada rechazo te enseña dónde ajustar.

# FRAMEWORK DE RAZONAMIENTO

Seguí estos 5 pasos EN ORDEN para cada análisis:

## Paso 1: ANALIZAR — Detectar patrones en el historial
- ¿Qué acciones repite el admin regularmente?
- ¿Hay patrones temporales? (ej: aprueba pagos entre el 1 y el 5 del mes)
- ¿Hay patrones por inquilino? (ej: un inquilino siempre paga puntual)
- ¿Hay tareas de mantenimiento estancadas sin actualización?
- ¿Hay ajustes de alquiler programados que se acercan?

## Paso 2: COMPARAR — Contrastar con feedback de propuestas previas
- Revisá el HISTORIAL DE FEEDBACK (propuestas anteriores con su resultado)
- Si propuestas similares fueron EJECUTADAS → el admin confía en ese tipo de acción
- Si fueron RECHAZADAS → el admin NO quiere ese tipo de automatización (evitalo)
- Si fueron DESHECHAS (UNDONE) → el admin se arrepintió, reducí la agresividad
- REGLA DURA: Si un tipo de acción fue rechazado 2+ veces en los últimos 30 días, NO lo propongas

## Paso 3: CALIBRAR — Ajustar el confidence score
Usá esta escala base y ajustá según el feedback:

| Situación | Confidence base |
|---|---|
| Inquilino con 6+ meses consecutivos aprobados sin problemas | 0.90 |
| Inquilino con 3-5 meses consecutivos aprobados | 0.70 |
| Pago en REVISION de inquilino nuevo (< 3 meses) | 0.40 (no proponer) |
| Registro de pago mensual para contrato activo | 0.85 |
| Ajuste de alquiler por IPC en mes programado | 0.80 |
| Mantenimiento estancado > 30 días | 0.75 |

Modificadores de feedback:
- Cada propuesta similar EJECUTADA en los últimos 60 días → +0.05 (máx +0.10)
- Cada propuesta similar RECHAZADA en los últimos 60 días → -0.15
- Cada propuesta similar DESHECHA en los últimos 60 días → -0.10
- Tasa de acierto global > 80% → +0.05 a todas las propuestas
- Tasa de acierto global < 50% → -0.10 a todas las propuestas

## Paso 4: PROPONER — Generar acciones concretas
Solo proponé cuando el confidence calibrado sea >= 0.50

ACCIONES DISPONIBLES:
1. PAYMENT_APPROVED — Aprobar pago en REVISION de inquilino confiable
2. PAYMENT_REGISTERED — Pre-crear registro de pago pendiente al inicio del mes
3. RENT_UPDATED — Proponer actualización de alquiler por ajuste IPC
4. REMINDER_COMPLETED — Generar recordatorio sobre mantenimiento o pagos

## Paso 5: EXPLICAR — Justificar cada propuesta
Cada propuesta DEBE incluir en "description" la evidencia concreta:
- MAL: "Aprobar pago de Juan" (sin evidencia)
- BIEN: "Aprobar pago de Juan Pérez — 8 meses consecutivos aprobados, último pago aprobado el 3/2" (con evidencia)

# FORMATO DE RESPUESTA

Cada propuesta debe tener EXACTAMENTE estos campos JSON:
- "actionType": "PAYMENT_APPROVED" | "PAYMENT_REGISTERED" | "RENT_UPDATED" | "REMINDER_COMPLETED"
- "entityTable": string de la tabla afectada
- "entityId": string del ID de la entidad (o null si es nueva)
- "description": string descriptivo en español argentino con evidencia (max 150 chars)
- "confidence": number entre 0.0 y 1.0 (ya calibrado con feedback)
- "actionPayload": objeto con los datos necesarios para ejecutar la acción
- "reasoning": string corto explicando qué patrón detectaste (max 100 chars)

REGLAS FINALES:
- Genera entre 0 y 10 propuestas, solo las que tengan sentido real
- NO inventes datos que no estén en el contexto
- NO propongas acciones sobre entidades que no existen en los datos
- Si no hay suficiente historial para detectar patrones, sé conservador (menos propuestas, menor confidence)
- Responde SOLO con un JSON array, sin texto adicional ni markdown

Respondé con este formato exacto:
[
  { "actionType": "...", "entityTable": "...", "entityId": "...", "description": "...", "confidence": 0.9, "actionPayload": {}, "reasoning": "..." }
]

Si no hay propuestas útiles, responde con un array vacío: []`;

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
            max_tokens: 4096,
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
                generationConfig: { maxOutputTokens: 4096 },
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
            max_tokens: 4096,
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

function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const provider = Deno.env.get('AI_PROVIDER') || 'gemini';
        const apiKey = Deno.env.get('AI_API_KEY');
        const defaultModels: Record<string, string> = {
            gemini: 'gemini-2.5-flash',
            claude: 'claude-sonnet-4-20250514',
            openai: 'gpt-4o-mini',
        };
        const model = Deno.env.get('AI_MODEL') || defaultModels[provider] || 'gemini-2.5-flash';

        if (!apiKey) {
            return new Response(
                JSON.stringify({ error: 'AI_API_KEY not configured' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Get Supabase client for DB operations
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        const body = await req.json();

        // Fetch recent admin action logs (last 90 days)
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const { data: actionLogs } = await supabaseAdmin
            .from('admin_action_logs')
            .select('action_type, entity_table, entity_id, action_payload, context, created_at')
            .gte('created_at', ninetyDaysAgo.toISOString())
            .order('created_at', { ascending: false })
            .limit(500);

        // Fetch active automation rules
        const { data: rules } = await supabaseAdmin
            .from('automation_rules')
            .select('*')
            .eq('enabled', true);

        // Fetch automation history (feedback from previous proposals)
        const { data: feedbackHistory } = await supabaseAdmin
            .from('automation_history')
            .select('action_type, entity_table, entity_id, status, confidence, description, proposed_at, executed_at, undone_at')
            .in('status', ['EXECUTED', 'REJECTED', 'UNDONE'])
            .order('proposed_at', { ascending: false })
            .limit(50);

        // Build compact action log summary for AI
        const logSummary = summarizeActionLogs(actionLogs || []);
        const feedbackSummary = summarizeFeedback(feedbackHistory || []);

        const userMessage = `Fecha actual: ${body.currentDate}

═══ HISTORIAL DE ACCIONES DEL ADMIN (últimos 90 días) ═══
${logSummary}

═══ HISTORIAL DE FEEDBACK (propuestas previas y su resultado) ═══
${feedbackSummary}

═══ REGLAS DE AUTOMATIZACIÓN ACTIVAS ═══
${JSON.stringify(rules || [], null, 0)}

═══ PROPIEDADES (${body.properties?.length || 0}) ═══
${JSON.stringify(body.properties || [], null, 0)}

═══ PAGOS (${body.payments?.length || 0}) ═══
${JSON.stringify(body.payments || [], null, 0)}

═══ INQUILINOS (${body.tenants?.length || 0}) ═══
${JSON.stringify(body.tenants || [], null, 0)}

═══ TAREAS DE MANTENIMIENTO (${body.maintenanceTasks?.length || 0}) ═══
${JSON.stringify(body.maintenanceTasks || [], null, 0)}

═══ PROFESIONALES (${body.professionals?.length || 0}) ═══
${JSON.stringify(body.professionals || [], null, 0)}

═══ RECORDATORIOS PENDIENTES DEL SISTEMA (${body.reminders?.length || 0}) ═══
${JSON.stringify(body.reminders || [], null, 0)}

Seguí el framework de razonamiento de 5 pasos (ANALIZAR → COMPARAR → CALIBRAR → PROPONER → EXPLICAR). Usá el historial de feedback para calibrar tu confianza. Proponé solo acciones con evidencia real.`;

        let rawResponse: string;
        if (provider === 'gemini') {
            rawResponse = await callGemini(apiKey, model, userMessage);
        } else if (provider === 'openai') {
            rawResponse = await callOpenAI(apiKey, model, userMessage);
        } else {
            rawResponse = await callClaude(apiKey, model, userMessage);
        }

        // Parse proposals
        let proposals: any[] = [];
        try {
            const jsonMatch = rawResponse.match(/\[[\s\S]*\]/);
            proposals = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        } catch {
            console.error('Failed to parse AI response:', rawResponse);
            proposals = [];
        }

        // Filter by minimum confidence
        const minConfidence = 0.5;
        proposals = proposals.filter((p: any) => (p.confidence || 0) >= minConfidence);

        // Insert proposals into automation_history
        let proposalsCreated = 0;
        const adminEmails: string[] = [];

        // Get admin emails for notifications
        const { data: admins } = await supabaseAdmin.from('allowed_emails').select('email');
        if (admins) adminEmails.push(...admins.map((a: any) => a.email));

        for (const proposal of proposals) {
            // Find matching rule
            const matchingRule = (rules || []).find((r: any) => {
                if (proposal.actionType === 'PAYMENT_APPROVED' && r.rule_type === 'AUTO_APPROVE_PAYMENT') return true;
                if (proposal.actionType === 'PAYMENT_REGISTERED' && r.rule_type === 'AUTO_REGISTER_PAYMENT') return true;
                if (proposal.actionType === 'RENT_UPDATED' && r.rule_type === 'AUTO_UPDATE_RENT') return true;
                return false;
            });

            const historyId = generateUUID();
            const { error: insertError } = await supabaseAdmin.from('automation_history').insert({
                id: historyId,
                rule_id: matchingRule?.id || null,
                action_type: proposal.actionType,
                entity_table: proposal.entityTable || 'unknown',
                entity_id: proposal.entityId || null,
                status: 'PROPOSED',
                action_payload: proposal.actionPayload || {},
                confidence: proposal.confidence || 0.5,
                description: proposal.description || '',
                proposed_at: new Date().toISOString(),
            });

            if (!insertError) {
                proposalsCreated++;

                // Create notification for each admin
                for (const email of adminEmails) {
                    await supabaseAdmin.from('notifications').insert({
                        id: generateUUID(),
                        recipient_email: email,
                        title: 'Nueva propuesta de automatización',
                        message: proposal.description || `Propuesta: ${proposal.actionType}`,
                        type: 'AUTOMATION_PROPOSED',
                        read: false,
                    });
                }
            }
        }

        return new Response(
            JSON.stringify({ proposalsCreated, totalAnalyzed: proposals.length, provider, model }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error: any) {
        console.error('Smart automation error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});

// Summarize action logs with temporal patterns and metrics
function summarizeActionLogs(logs: any[]): string {
    if (logs.length === 0) return 'Sin historial de acciones. El sistema aún no tiene datos para aprender.';

    const byType: Record<string, number> = {};
    const byDayOfWeek: Record<number, number> = {};
    const byDayOfMonth: Record<number, number> = {};
    const byEntity: Record<string, number> = {};
    const approvalTimes: number[] = [];

    for (const log of logs) {
        byType[log.action_type] = (byType[log.action_type] || 0) + 1;

        const ctx = log.context || {};
        if (ctx.dayOfWeek !== undefined) byDayOfWeek[ctx.dayOfWeek] = (byDayOfWeek[ctx.dayOfWeek] || 0) + 1;
        if (ctx.dayOfMonth !== undefined) byDayOfMonth[ctx.dayOfMonth] = (byDayOfMonth[ctx.dayOfMonth] || 0) + 1;

        // Track per-entity frequency
        if (log.entity_id) {
            const key = `${log.entity_table}:${log.entity_id}`;
            byEntity[key] = (byEntity[key] || 0) + 1;
        }

        // Track approval speed (from action_payload if available)
        if (log.action_type === 'PAYMENT_APPROVED' && log.action_payload?.previousStatus === 'REVISION') {
            const createdAt = new Date(log.created_at);
            const dayOfMonth = createdAt.getDate();
            approvalTimes.push(dayOfMonth);
        }
    }

    // Find peak days
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const peakDays = Object.entries(byDayOfWeek)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([day, count]) => `${dayNames[Number(day)]}: ${count}`)
        .join(', ');

    // Find peak days of month
    const peakDaysOfMonth = Object.entries(byDayOfMonth)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([day, count]) => `día ${day}: ${count}`)
        .join(', ');

    // Most active entities
    const topEntities = Object.entries(byEntity)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([key, count]) => `  ${key}: ${count} acciones`)
        .join('\n');

    // Approval timing pattern
    const avgApprovalDay = approvalTimes.length > 0
        ? (approvalTimes.reduce((a, b) => a + b, 0) / approvalTimes.length).toFixed(1)
        : 'N/A';

    // Last 20 actions
    const recentActions: string[] = [];
    for (const log of logs.slice(0, 20)) {
        const date = new Date(log.created_at).toLocaleDateString('es-AR');
        const payload = log.action_payload || {};
        recentActions.push(`${date}: ${log.action_type} en ${log.entity_table} — ${JSON.stringify(payload).slice(0, 100)}`);
    }

    return `Total: ${logs.length} acciones en 90 días

Por tipo:
${Object.entries(byType).map(([type, count]) => `  ${type}: ${count} veces`).join('\n')}

Patrones temporales:
  Días más activos de la semana: ${peakDays || 'insuficiente data'}
  Días más activos del mes: ${peakDaysOfMonth || 'insuficiente data'}
  Día promedio de aprobación de pagos: ${avgApprovalDay}

Entidades con más actividad:
${topEntities || '  Sin datos suficientes'}

Últimas 20 acciones:
${recentActions.join('\n')}`;
}

// Summarize feedback from previous automation proposals
function summarizeFeedback(history: any[]): string {
    if (history.length === 0) return 'Sin historial de feedback. Es la primera vez que se ejecuta el análisis — sé conservador con las propuestas.';

    const byStatus: Record<string, number> = {};
    const byTypeAndStatus: Record<string, Record<string, number>> = {};
    const recentRejections: string[] = [];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const entry of history) {
        byStatus[entry.status] = (byStatus[entry.status] || 0) + 1;

        if (!byTypeAndStatus[entry.action_type]) byTypeAndStatus[entry.action_type] = {};
        byTypeAndStatus[entry.action_type][entry.status] = (byTypeAndStatus[entry.action_type][entry.status] || 0) + 1;

        // Track recent rejections
        if (entry.status === 'REJECTED' && entry.proposed_at && new Date(entry.proposed_at) > thirtyDaysAgo) {
            recentRejections.push(`${entry.action_type} sobre ${entry.entity_table}${entry.entity_id ? ':' + entry.entity_id : ''}`);
        }
    }

    const total = history.length;
    const executed = byStatus['EXECUTED'] || 0;
    const rejected = byStatus['REJECTED'] || 0;
    const undone = byStatus['UNDONE'] || 0;
    const successRate = total > 0 ? ((executed / total) * 100).toFixed(0) : '0';

    // Per-action-type success rate
    const typeBreakdown = Object.entries(byTypeAndStatus).map(([type, statuses]) => {
        const typeTotal = Object.values(statuses).reduce((a, b) => a + b, 0);
        const typeExecuted = statuses['EXECUTED'] || 0;
        const typeRejected = statuses['REJECTED'] || 0;
        const typeUndone = statuses['UNDONE'] || 0;
        const rate = typeTotal > 0 ? ((typeExecuted / typeTotal) * 100).toFixed(0) : '0';
        return `  ${type}: ${rate}% acierto (${typeExecuted} ejecutadas, ${typeRejected} rechazadas, ${typeUndone} deshechas de ${typeTotal} total)`;
    }).join('\n');

    // Recent rejections warning
    const rejectionWarning = recentRejections.length >= 2
        ? `\n⚠ ATENCIÓN: ${recentRejections.length} rechazos en los últimos 30 días. Tipos rechazados:\n${recentRejections.map(r => `  - ${r}`).join('\n')}\nEvitá proponer acciones similares a las rechazadas.`
        : '';

    return `Total: ${total} propuestas previas
Tasa de acierto global: ${successRate}% (${executed} ejecutadas, ${rejected} rechazadas, ${undone} deshechas)

Por tipo de acción:
${typeBreakdown}
${rejectionWarning}

Últimas 10 propuestas con resultado:
${history.slice(0, 10).map(h => {
    const date = h.proposed_at ? new Date(h.proposed_at).toLocaleDateString('es-AR') : '?';
    return `  ${date}: ${h.action_type} → ${h.status} (confidence: ${h.confidence || '?'}) — ${(h.description || '').slice(0, 80)}`;
}).join('\n')}`;
}

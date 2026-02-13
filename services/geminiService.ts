import { GoogleGenAI, Type } from "@google/genai";
import { VoiceCommandResponse, Property, Professional } from "../types";

// Initialize Gemini Client lazily to prevent crash if key is missing at top level
let aiInstance: any = null;

const getAiClient = () => {
  if (aiInstance) return aiInstance;

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY || '';
  if (!apiKey) {
    console.warn('[Gemini] ⚠️ No API key found. AI features will be disabled.');
    return null;
  }

  console.log(`[Gemini] ✅ Initializing client with key: ${apiKey.substring(0, 10)}...`);
  aiInstance = new GoogleGenAI({ apiKey });
  return aiInstance;
};

const MODEL_FAST = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
console.log(`[Gemini] Using model config: ${MODEL_FAST}`);

// Cache for AI estimations — avoids different results on re-click
const estimationCache = new Map<string, any>();

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Parses natural language voice commands.
 * Now receives Context (Properties & Professionals) AND History.
 */
/**
 * Parses natural language voice commands with full system context.
 */
export const parseVoiceCommand = async (
  transcript: string,
  properties: Property[],
  professionals: Professional[],
  history: ChatMessage[] = [],
  currentView: string = 'MAP',
  selectedItem: any = null
): Promise<VoiceCommandResponse> => {
  try {
    // Minify context
    const contextProps = properties.map(p => ({
      id: p.id,
      addr: p.address,
      tenant: p.tenantName,
      status: p.status
    }));

    // Format history
    const historyText = history.map(h => `${h.role.toUpperCase()}: ${h.content}`).join('\n');

    const systemPrompt = `
    Eres el asistente inteligente de "Sada Estate". Tu objetivo es controlar TODA la aplicación mediante voz.
    
    ESTADO ACTUAL DE LA APP:
    - Vista Actual: ${currentView}
    - Elemento Seleccionado: ${selectedItem ? JSON.stringify(selectedItem) : 'Ninguno'}
    
    CONTEXTO DE DATOS:
    - Propiedades: ${JSON.stringify(contextProps)}
    - Profesionales: ${JSON.stringify(professionals.map(p => ({ id: p.id, name: p.name, job: p.profession })))}
    
    HISTORIAL:
    ${historyText}
    
    COMANDO: "${transcript}"
    
    TU TRABAJO:
    Analiza el comando y mapealo a una de estas INTENCIONES (intent):
    
    1. NAVIGATE: Cambiar de pantalla.
       - targetView: 'MAP', 'OVERVIEW', 'FINANCE', 'PROFESSIONALS', 'ADD_PROPERTY_MODAL', 'ADD_PRO_MODAL'.
    
    2. UPDATE_PROPERTY: Modificar o Crear propiedades.
       - actionType: 'CHANGE_RENT', 'ASSIGN_PROFESSIONAL', 'CHANGE_TENANT', 'CREATE_NOTE', 'FINISH_MAINTENANCE'
       - Para crear nueva: actionType: 'CREATE_NEW', data: { address: ... }
       - Asignar: data: { professionalName: '...', propertyId: '...' }
       - Finalizar obra: data: { propertyId: '...' }
       
    3. SEARCH_MAP: Buscar dirección en el mapa.
       - searchQuery: dirección a buscar.
       
    4. SELECT_ITEM: Seleccionar algo en la lista/mapa.
       - itemType: 'PROPERTY' | 'PROFESSIONAL'
       - propertyId / professionalId: ID encontrado.
       
    5. EXPLAIN_SCREEN: El usuario pregunta ¿Qué hago aquí? o ¿Qué es esto?
       - responseText: Explicación breve de la pantalla actual.
       
    6. REGISTER_EXPENSE: Registrar gasto.
    
    7. GENERAL_QUERY: Consultas generales sobre los datos (ej: "¿Quién debe alquiler?").
    
    REGLAS:
    - Si el usuario se despide ("chau", "adiós", "basta", "listo", "cerrar"), usa intent: "STOP_LISTENING".
    - Si el usuario dice "Agrega una propiedad en X", usa NAVIGATE a 'ADD_PROPERTY_MODAL' y llena 'address' en data si es posible, o usa UPDATE_PROPERTY con actionType 'CREATE_NEW'.
    - Si el usuario dice "Muestrame las finanzas de X", primero SELECT_ITEM X, luego NAVIGATE 'FINANCE'. (Ojo: Devuelve la acción más inmediata, o usa requiresFollowUp si es complejo, pero idealmente intenta resolverlo).
    - Si falta info crítica, usa "requiresFollowUp": true.
    
    SALIDA JSON (MANDATORIO):
    REGLAS DE RESPUESTA:
    - RESPONDE CON MÁXIMO 1 FRASE CORTA (Ej: "Abriendo mapa", "Listo, asignado").
    - SÉ DIRECTO Y AL GRANO. NO SALUDES NI DES EXPLICACIONES LARGAS.
    - Si falta info: "requiresFollowUp": true.
    - Si la acción está completa: "requiresFollowUp": false Y rellena "data"... }
    {
      "intent": "...",
      "responseText": "Lo que dirás al usuario",
      "requiresFollowUp": boolean,
      "data": { ... }
    }
    `;

    const ai = getAiClient();
    if (!ai) {
      throw new Error('Gemini AI not initialized (missing API key)');
    }

    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: systemPrompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0,
      }
    });

    let text = response.text || '{}';
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    return JSON.parse(text) as VoiceCommandResponse;

  } catch (error) {
    console.error("Gemini parse error:", error);
    return {
      intent: 'GENERAL_QUERY',
      responseText: 'Hubo un error al procesar tu solicitud.'
    };
  }
};

export const estimateFinancials = async (address: string, country: string = 'Argentina', rooms?: number, squareMeters?: number) => {
  console.log(`[Gemini] ✨ estimateFinancials called — Address: "${address}", Country: ${country}, Rooms: ${rooms ?? 'N/A'}, m²: ${squareMeters ?? 'N/A'}`);

  // Check cache first
  const cacheKey = `${address}|${country}|${rooms ?? ''}|${squareMeters ?? ''}`;
  if (estimationCache.has(cacheKey)) {
    console.log(`[Gemini] 📦 Returning CACHED result for: ${cacheKey}`);
    return estimationCache.get(cacheKey);
  }

  try {
    const { convertCurrencyLive } = await import('../utils/currency');
    const { getTaxConfig } = await import('../utils/taxConfig');
    const config = getTaxConfig(country);

    let prompt = '';
    const propertyDetails = (rooms || squareMeters)
      ? `\nDatos del inmueble: ${rooms ? `${rooms} ambientes` : 'N/A'}, ${squareMeters ? `${squareMeters} m²` : 'N/A'}.`
      : '';

    if (country === 'USA') {
      prompt = `
      You are a US real estate tax expert.
      Analyze the address: "${address}".${propertyDetails}

      Estimate the following MONTHLY approximate values in USD for 2024/2025:
      1. Property Tax (annual property tax / 12)
      2. HOA (Homeowners Association fee, 0 if single family home)
      3. Insurance (homeowner's insurance / 12)
      4. Suggested Monthly Rent (fair market value considering property size)

      Respond ONLY with this JSON:
      {
        "propertyTax": number,
        "hoa": number,
        "insurance": number,
        "suggestedRent": number
      }
      `;
    } else if (country === 'Uruguay') {
      prompt = `
      You are a Uruguayan real estate tax expert.
      Analyze the address: "${address}".${propertyDetails}

      Estimate the following MONTHLY approximate values in Pesos Uruguayos (UYU) for 2024/2025:
      1. Contribución Inmobiliaria (contribucion)
      2. OSE / Agua (ose)
      3. Impuesto de Primaria (primaria)
      4. Suggested Monthly Rent in USD (suggestedRent) considering property size

      Respond ONLY with this JSON:
      {
        "contribucion": number,
        "ose": number,
        "primaria": number,
        "suggestedRent": number
      }
      `;
    } else {
      // Argentina (default)
      prompt = `
      Actúa como un tasador inmobiliario experto en Argentina.
      Analiza la dirección: "${address}".${propertyDetails}

      Estima los siguientes valores mensuales aproximados para 2024/2025 en Pesos Argentinos (ARS):
      1. ABL (Alumbrado, Barrido y Limpieza)
      2. Rentas / Impuesto Inmobiliario
      3. AySA / Aguas
      4. Alquiler Mensual Sugerido (considerando tamaño del inmueble) en ARS

      Responde SOLO con este JSON:
      {
        "abl": number,
        "rentas": number,
        "water": number,
        "suggestedRent": number
      }
      `;
    }

    console.log(`[Gemini] 📡 Sending request to model "${MODEL_FAST}"...`);

    const ai = getAiClient();
    if (!ai) {
      throw new Error('Gemini AI not initialized (missing API key)');
    }

    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0,
      }
    });

    let text = response.text || '{}';
    console.log(`[Gemini] ✅ Raw AI response:`, text);

    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(text);

    console.log(`[Gemini] 📊 Parsed AI result:`, result);

    // For Argentina, also compute the suggested rent in USD using live rate
    if (country === 'Argentina' && result.suggestedRent) {
      const suggestedRentUsd = await convertCurrencyLive(result.suggestedRent, 'ARS', 'USD');
      result.suggestedRentUsd = Math.round(suggestedRentUsd);
      result.taxCurrency = 'ARS';
    } else if (country === 'Uruguay' && result.contribucion) {
      // Uruguay taxes in UYU, rent already in USD
      result.taxCurrency = 'UYU';
    } else {
      result.taxCurrency = 'USD';
    }

    // Attach the live ARS rate for display
    if (country === 'Argentina') {
      const { fetchLiveArsRate } = await import('../utils/currency');
      result.liveArsRate = await fetchLiveArsRate();
    }

    // Mark as AI-sourced
    result.source = 'ai';
    console.log(`[Gemini] 🎯 Final result (source: AI):`, result);

    // Cache the result
    estimationCache.set(cacheKey, result);

    return result;

  } catch (error: any) {
    console.error(`[Gemini] ❌ ERROR in estimateFinancials:`, error);
    console.error(`[Gemini] ❌ Error message:`, error?.message || 'Unknown error');
    console.error(`[Gemini] ❌ Error status:`, error?.status || error?.statusCode || 'N/A');

    // Fallback values per country — clearly marked as fallback
    console.warn(`[Gemini] ⚠️ Returning FALLBACK hardcoded values (NOT from AI)`);

    if (country === 'USA') {
      return { propertyTax: 250, hoa: 150, insurance: 100, suggestedRent: 2500, taxCurrency: 'USD', source: 'fallback' as const };
    }
    if (country === 'Uruguay') {
      return { contribucion: 3500, ose: 2000, primaria: 1500, suggestedRent: 800, taxCurrency: 'UYU', source: 'fallback' as const };
    }
    return { abl: 15000, rentas: 5000, water: 8000, suggestedRent: 450000, taxCurrency: 'ARS', suggestedRentUsd: 375, liveArsRate: 1200, source: 'fallback' as const };
  }
};
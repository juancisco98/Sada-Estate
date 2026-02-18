
// Fallback rates (units per 1 USD) - Keeps structure but mostly unused now except if we add convert back
export const EXCHANGE_RATES: Record<string, number> = {
    ARS: 1200,
    USD: 1,
    UYU: 42,
};

// --- Live Rate Cache ---
let cachedArsRate: number | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches live ARS/USD official rate from dolarapi.com.
 * Returns the "venta" (sell) price. Falls back to hardcoded rate on error.
 */
export const fetchLiveArsRate = async (): Promise<number> => {
    const now = Date.now();

    // Return cached if still fresh
    if (cachedArsRate && (now - cacheTimestamp) < CACHE_DURATION_MS) {
        return cachedArsRate;
    }

    try {
        const response = await fetch('https://dolarapi.com/v1/dolares/oficial');
        const data = await response.json();
        const rate = data.venta || data.compra || EXCHANGE_RATES.ARS;
        cachedArsRate = rate;
        cacheTimestamp = now;
        console.log(`[Currency] Live ARS rate fetched: ${rate}`);
        return rate;
    } catch (error) {
        console.warn('[Currency] Failed to fetch live rate, using fallback:', EXCHANGE_RATES.ARS);
        return EXCHANGE_RATES.ARS;
    }
};

/**
 * Converts using live rate (async version). Use for AI estimations.
 */
export const convertCurrencyLive = async (
    amount: number,
    fromCurrency: string,
    toCurrency: string
): Promise<number> => {
    if (fromCurrency === toCurrency) return amount;

    // Get live rate for ARS
    const liveArsRate = await fetchLiveArsRate();
    const rates: Record<string, number> = {
        ...EXCHANGE_RATES,
        ARS: liveArsRate
    };

    const fromRate = rates[fromCurrency] || 1;
    const toRate = rates[toCurrency] || 1;

    const amountInUsd = amount / fromRate;
    return amountInUsd * toRate;
};

// Formats a number as a currency string
export const formatCurrency = (amount: number, currency: string): string => {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: currency,
        maximumFractionDigits: 0,
    }).format(amount);
};

// Converts an amount from one currency to another (Simplified/Deprecated as we enforce ARS)
// Keeping it just in case logic references it, but we removed usages.
export const convertCurrency = (amount: number, fromCurrency: string, toCurrency: string): number => {
    if (fromCurrency === toCurrency) return amount;
    // Simple placeholder if ever called unexpectedly
    return amount;
};

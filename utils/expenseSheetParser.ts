import { ParsedExpenseSheet, ParsedExpenseLineItem } from '../types';

const MONTH_NAMES_ES = [
    'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
    'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
];

/**
 * Convierte una celda en número si tiene sentido como monto.
 * Acepta números nativos, strings con $/comas/puntos, etc.
 */
const toNumber = (cell: any): number | null => {
    if (cell === null || cell === undefined || cell === '') return null;
    if (typeof cell === 'number') return isFinite(cell) ? cell : null;
    const cleaned = String(cell).replace(/[^0-9.,\-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
    if (!cleaned) return null;
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
};

const isLikelyYear = (n: number) => Number.isInteger(n) && n >= 1900 && n <= 2100;

/**
 * Parser de hoja de Excel de expensas. No depende de índices fijos.
 *
 * Estrategia:
 *  - Recorre todas las filas.
 *  - En cada fila identifica el primer texto no-vacío (concept) y el último número > 0 (amount).
 *  - Si la fila contiene la palabra "TOTAL", su monto se considera total general (no item).
 *  - Filtra ruido (filas vacías, encabezados sin monto, etc.).
 *  - Detecta el período (mes + año) en las primeras filas.
 */
export const parseExpenseSheet = (rows: any[][]): ParsedExpenseSheet => {
    const items: ParsedExpenseLineItem[] = [];
    let total = 0;
    let totalFromRow = false;
    let period: string | undefined;

    // Detectar período en las primeras 4 filas
    const headerText = rows.slice(0, 4)
        .flat()
        .map(c => String(c ?? ''))
        .join(' ')
        .toUpperCase();
    for (const m of MONTH_NAMES_ES) {
        if (headerText.includes(m)) {
            const yearMatch = headerText.match(/(20\d{2}|19\d{2})/);
            period = yearMatch ? `${m} ${yearMatch[1]}` : m;
            break;
        }
    }

    for (const rawRow of rows) {
        if (!rawRow || rawRow.length === 0) continue;
        const cells = rawRow as any[];

        // Concept = primera celda con texto no-numérico
        let concept = '';
        for (const c of cells) {
            const s = String(c ?? '').trim();
            if (!s) continue;
            // Si es puramente numérico, no sirve como concept
            if (toNumber(s) !== null && !/[a-zA-ZáéíóúñÑ]/.test(s)) continue;
            concept = s;
            break;
        }

        // Detectar fila TOTAL
        const isTotalRow = cells.some(c => /total/i.test(String(c ?? '')));

        // Amount = último número > 0 de la fila
        let amount: number | null = null;
        for (let i = cells.length - 1; i >= 0; i--) {
            const n = toNumber(cells[i]);
            if (n !== null && n > 0) { amount = n; break; }
        }

        if (isTotalRow) {
            if (amount !== null && amount > total) {
                total = amount;
                totalFromRow = true;
            }
            continue;
        }

        // Filtros de ruido
        if (!concept || concept.length < 2) continue;
        if (amount === null || amount <= 0) continue;
        // Si el "monto" parece año y no hay otra señal, descartar
        if (isLikelyYear(amount) && cells.filter(c => toNumber(c) !== null).length <= 1) continue;
        // Concept que contiene mes + año (header) lo descartamos
        if (MONTH_NAMES_ES.some(m => concept.toUpperCase().includes(m)) && /\d{4}/.test(concept)) continue;

        items.push({ concept, amount });
    }

    if (!totalFromRow) {
        total = items.reduce((sum, it) => sum + it.amount, 0);
    }

    return { period, items, total, currency: 'ARS' };
};

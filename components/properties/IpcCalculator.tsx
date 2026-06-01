import React, { useState } from 'react';
import { Calculator, Clock } from 'lucide-react';

interface IpcCalculatorProps {
  // Datos del contrato necesarios para el cálculo (fuente de verdad en el padre).
  monthlyRent: string;
  adjustmentMonths: string;
  contractStart: string;
  // Aplica el nuevo alquiler + avanza la fecha de inicio al próximo ajuste.
  onApply: (newRent: string, newContractStart: string) => void;
}

// Estado interno de la calculadora (la visibilidad la controla el padre al renderizar).
interface IpcState {
  loading: boolean;
  variation: number | null;
  suggestedRent: number | null;
  isEstimated: boolean;
  periodLabel: string;
  manualPct: string;
  error: string | null;
  lastPublishedMonth: string; // "ene 2026" — último mes con datos reales de INDEC
  missingMonths: number; // cuántos meses se extrapolaron
}

const IpcCalculator: React.FC<IpcCalculatorProps> = ({ monthlyRent, adjustmentMonths, contractStart, onApply }) => {
  const [ipcCalc, setIpcCalc] = useState<IpcState>({
    loading: false, variation: null, suggestedRent: null, isEstimated: false,
    periodLabel: '', manualPct: '', error: null, lastPublishedMonth: '', missingMonths: 0,
  });

  const fetchIPCData = async () => {
    const months = Number(adjustmentMonths) || 3;
    const currentRent = Number(String(monthlyRent).replace(/\./g, '')) || 0;
    setIpcCalc(prev => ({ ...prev, loading: true, error: null, variation: null, suggestedRent: null, isEstimated: false, periodLabel: '', lastPublishedMonth: '', missingMonths: 0 }));
    try {
      const toYYYYMM = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      const fmtMonth = (d: Date) => d.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' });

      // Base month: month BEFORE contractStart (reference IPC index)
      const baseDate = contractStart ? new Date(contractStart + 'T00:00:00') : new Date();
      if (contractStart) baseDate.setMonth(baseDate.getMonth() - 1);

      // End month ideal: contractStart + months - 1
      const idealEnd = contractStart ? new Date(contractStart + 'T00:00:00') : new Date();
      if (contractStart) idealEnd.setMonth(idealEnd.getMonth() + months - 1);
      else idealEnd.setMonth(idealEnd.getMonth() - 1);

      // Cap end date to current month (INDEC publishes with ~1-2 months of lag)
      const now = new Date();
      const queryEnd = idealEnd > now ? now : idealEnd;

      // Si el mes base mismo es futuro → INDEC no tiene NADA de este período.
      // Mensaje claro: el contrato todavía no arrancó, el ajuste se calcula cuando
      // INDEC publique los IPC del período (pasando el primer ajuste).
      if (baseDate > now) {
        const adjLabel = contractStart
          ? new Date(new Date(contractStart + 'T00:00:00').setMonth(new Date(contractStart + 'T00:00:00').getMonth() + months))
              .toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
          : '';
        throw new Error(
          `El período de ajuste (${fmtMonth(baseDate)} → ${fmtMonth(idealEnd)}) aún no ocurrió. ` +
          `Volvé a calcular después del ${adjLabel} cuando INDEC publique los IPC de esos meses. ` +
          `Por ahora podés ingresar el % manualmente.`
        );
      }

      const periodLabel = `${fmtMonth(contractStart ? new Date(contractStart + 'T00:00:00') : baseDate)} → ${fmtMonth(idealEnd)}`;

      // Query a wider range to ensure we get enough data points
      // Go back 2 extra months as buffer for INDEC publication delay
      const queryStart = new Date(baseDate);
      queryStart.setMonth(queryStart.getMonth() - 2);

      const res = await fetch(
        `https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26&start_date=${toYYYYMM(queryStart)}&end_date=${toYYYYMM(queryEnd)}&format=json`
      );
      if (!res.ok) throw new Error('Error de red al consultar INDEC');
      const json = await res.json();
      const allData: [string, number][] = (json.data || []).filter(([, v]: [string, number]) => v !== null);
      if (allData.length < 2) throw new Error('Datos insuficientes en INDEC para este período');

      // Find the data point closest to our base month
      const baseStr = toYYYYMM(baseDate);
      let baseIdx = allData.findIndex(([d]) => d >= baseStr);
      if (baseIdx < 0) baseIdx = allData.length - 2; // fallback: use the earliest available

      let points: number[] = allData.slice(baseIdx).map(([, v]) => v);
      if (points.length < 2) {
        // If we can't find enough from the base, use the last available points
        points = allData.slice(-Math.min(allData.length, months + 1)).map(([, v]) => v);
      }
      if (points.length < 2) throw new Error('Datos insuficientes en INDEC para este período');

      // How many total points we need: months + 1 (base + N months)
      const expected = months + 1;
      let isEstimated = false;
      let missingMonths = 0;
      // Track last published month from real INDEC data
      const lastRealDate = allData.length > 0 ? allData[allData.length - 1][0] : '';
      const lastPublishedMonth = lastRealDate
        ? new Date(lastRealDate + 'T12:00:00').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
        : '';

      // Extrapolate missing months using the last known monthly ratio
      if (points.length < expected) {
        isEstimated = true;
        missingMonths = expected - points.length;
        const lastRatio = points[points.length - 1] / points[points.length - 2];
        while (points.length < expected) {
          points.push(points[points.length - 1] * lastRatio);
        }
      }

      const factor = points[points.length - 1] / points[0];
      const variation = parseFloat(((factor - 1) * 100).toFixed(2));
      const suggestedRent = Math.round(currentRent * factor);
      setIpcCalc(prev => ({ ...prev, loading: false, variation, suggestedRent, isEstimated, periodLabel, lastPublishedMonth, missingMonths }));
    } catch (e: any) {
      setIpcCalc(prev => ({ ...prev, loading: false, error: e.message || 'No se pudo conectar con INDEC' }));
    }
  };

  const applyIPCRent = (amount: number) => {
    // Avanzar contractStart al próximo ajuste (contractStart + adjustmentMonths)
    const months = Number(adjustmentMonths) || 3;
    const currentStart = contractStart ? new Date(contractStart + 'T12:00:00') : new Date();
    const targetMonth = currentStart.getMonth() + months;
    const day = currentStart.getDate();
    currentStart.setMonth(targetMonth);
    // Si el día cambió (ej: 31 enero + 1 mes = 3 marzo), corregir al último día del mes objetivo
    if (currentStart.getDate() !== day) {
      currentStart.setDate(0); // último día del mes anterior
    }
    const y = currentStart.getFullYear();
    const m = String(currentStart.getMonth() + 1).padStart(2, '0');
    const d = String(currentStart.getDate()).padStart(2, '0');
    const newStart = `${y}-${m}-${d}`;

    onApply(String(amount), newStart);
  };

  const applyManualPct = () => {
    const pct = parseFloat(ipcCalc.manualPct);
    if (isNaN(pct) || pct <= 0) return;
    const currentRent = Number(String(monthlyRent).replace(/\./g, '')) || 0;
    const newRent = Math.round(currentRent * (1 + pct / 100));
    applyIPCRent(newRent);
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Calculator className="w-3.5 h-3.5" /> Calculadora IPC (INDEC)
        </span>
        {ipcCalc.periodLabel && (
          <span className="text-xs text-slate-400">{ipcCalc.periodLabel}</span>
        )}
      </div>
      {ipcCalc.loading && (
        <p className="text-xs text-slate-500 animate-pulse">Consultando INDEC...</p>
      )}
      {!ipcCalc.loading && ipcCalc.variation === null && !ipcCalc.error && (
        <button
          type="button"
          onClick={fetchIPCData}
          className="w-full text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition-colors"
        >
          Calcular con IPC
        </button>
      )}
      {!ipcCalc.loading && ipcCalc.variation !== null && ipcCalc.suggestedRent !== null && (
        <div className="space-y-2">
          {ipcCalc.isEstimated && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-1">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="text-xs font-semibold text-amber-800">Valor aproximado — faltan {ipcCalc.missingMonths} mes{ipcCalc.missingMonths > 1 ? 'es' : ''} de datos</span>
              </div>
              <p className="text-[11px] text-amber-700 leading-snug">
                Último dato publicado por INDEC: <b>{ipcCalc.lastPublishedMonth || 'no disponible'}</b>.
                {' '}INDEC actualiza ~15 de cada mes. Volvé a calcular cuando se publiquen los datos faltantes para obtener el valor exacto.
              </p>
            </div>
          )}
          <div className="flex justify-between text-xs text-slate-600">
            <span>Variación acumulada IPC:</span>
            <span className="font-bold text-emerald-600">+{ipcCalc.variation}%</span>
          </div>
          <div className="flex justify-between text-xs text-slate-600">
            <span>Alquiler actual:</span>
            <span className="font-semibold">${Number(String(monthlyRent).replace(/\./g, '')).toLocaleString('es-AR')}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-800 font-bold border-t border-slate-200 pt-2">
            <span>Alquiler sugerido:</span>
            <span className="text-indigo-600">${ipcCalc.suggestedRent.toLocaleString('es-AR')}</span>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => applyIPCRent(ipcCalc.suggestedRent!)}
              className="flex-1 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-2 rounded-lg transition-colors"
            >
              Aplicar
            </button>
            <button
              type="button"
              onClick={fetchIPCData}
              className="text-xs text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
            >
              Recalcular
            </button>
          </div>
        </div>
      )}
      {!ipcCalc.loading && ipcCalc.error && (
        <div className="space-y-2">
          <p className="text-xs text-red-600">{ipcCalc.error}. Ingresá el % manualmente:</p>
          <div className="flex gap-2">
            <input
              type="number" min="0" step="0.1" placeholder="Ej: 4.5"
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 outline-hidden focus:ring-2 focus:ring-indigo-400"
              value={ipcCalc.manualPct}
              onChange={e => setIpcCalc(prev => ({ ...prev, manualPct: e.target.value }))}
            />
            <button
              type="button"
              onClick={applyManualPct}
              className="text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition-colors"
            >
              Aplicar %
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default IpcCalculator;

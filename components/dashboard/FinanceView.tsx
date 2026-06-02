import React, { useState, useEffect } from 'react';
import { PropertyStatus, Professional, Property, MaintenanceTask, Building } from '../../types';
import { useDataContext } from '../../context/DataContext';
import {
  TrendingUp,
  TrendingDown,
  Hammer,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  User,
  Loader
} from 'lucide-react';
import FinancialDetailsCard from '../FinancialDetailsCard';
import IncomeBreakdownPanel from '../IncomeBreakdownPanel';
import ExpenseBreakdownModal from '../ExpenseBreakdownModal';
import { formatCurrency } from '../../utils/currency';
import { MONTH_NAMES_SHORT as MONTH_NAMES } from '../../constants';

// --- 2. Finanzas (Finance) ---
interface FinanceViewProps {
  properties?: Property[];
  professionals?: Professional[];
  preSelectedProperty?: Property | null;
  maintenanceTasks?: MaintenanceTask[];
  onClearPreSelection?: () => void;
  buildings?: Building[];
}

export const FinanceView: React.FC<FinanceViewProps> = ({
  properties = [],
  professionals = [],
  preSelectedProperty = null,
  maintenanceTasks = [],
  onClearPreSelection,
  buildings = []
}) => {
  const [selectedFinancialProperty, setSelectedFinancialProperty] = useState<Property | null>(null);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [expandedSection, setExpandedSection] = useState<'ARS' | 'USD' | 'maintenance' | null>(null);
  const [selectedExpenseMonth, setSelectedExpenseMonth] = useState<number | null>(null);

  // Auto-select property if passed from parent.
  // Prop-sync intencional: cuando el padre pasa una nueva prop, el detalle local debe reflejarla.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (preSelectedProperty) setSelectedFinancialProperty(preSelectedProperty); }, [preSelectedProperty]);

  const handleCloseDetail = () => {
    setSelectedFinancialProperty(null);
    if (onClearPreSelection) onClearPreSelection();
  };

  // --- Single currency properties (ARS) ---
  const arsProperties = properties; // All properties are now ARS

  // --- Get actual payments from context ---
  const { payments } = useDataContext();

  // --- Monthly income grids (12 months) based on ACTUAL payments ---
  const arsMonthly = Array.from({ length: 12 }, (_, i) => {
    const monthPayments = payments.filter(
      p => p.month === i + 1 && p.year === selectedYear && p.status === 'APPROVED'
    );
    return monthPayments.reduce((sum, p) => sum + p.amount, 0);
  });

  const arsYearTotal = arsMonthly.reduce((a, b) => a + b, 0);

  // --- Monthly expenses from maintenance tasks ---
  const arsExpensesMonthly = Array.from({ length: 12 }, (_, i) => {
    return maintenanceTasks.reduce((sum, task) => {
      let taskMonthTotal = 0;
      const hasPartials = task.partialExpenses && task.partialExpenses.length > 0;

      if (hasPartials) {
        task.partialExpenses!.forEach(pe => {
          const d = new Date(pe.date);
          if (d.getMonth() === i && d.getFullYear() === selectedYear) {
            taskMonthTotal += pe.amount;
          }
        });
        if (task.status === 'COMPLETED' && task.endDate) {
          const endD = new Date(task.endDate);
          if (endD.getMonth() === i && endD.getFullYear() === selectedYear) {
            const totalPartial = task.partialExpenses!.reduce((s, p) => s + p.amount, 0);
            const remainder = Math.max(0, (task.cost || 0) - totalPartial);
            taskMonthTotal += remainder;
          }
        }
      } else {
        const refDate = new Date(task.endDate || task.startDate);
        if (refDate.getMonth() === i && refDate.getFullYear() === selectedYear) {
          taskMonthTotal += (task.cost || task.estimatedCost || 0);
        }
      }
      return sum + taskMonthTotal;
    }, 0);
  });

  const annualExpensesARS = arsExpensesMonthly.reduce((a, b) => a + b, 0);

  // --- Net balance ---
  const arsYearNet = arsYearTotal - annualExpensesARS;

  // --- Per-property financials (includes partial expenses from in-progress tasks) ---
  const propertyFinancials = properties.map(p => {
    const propTasks = maintenanceTasks.filter(t => t.propertyId === p.id);
    const propExpenses = propTasks.reduce((acc, t) => {
      const hasPartials = t.partialExpenses && t.partialExpenses.length > 0;
      const totalPartial = hasPartials ? t.partialExpenses!.reduce((s, pe) => s + pe.amount, 0) : 0;
      const isCompleted = t.status === 'COMPLETED';
      const finalCost = t.cost || 0;

      if (hasPartials) {
        // Sum all partials + remainder if completed
        const remainder = isCompleted ? Math.max(0, finalCost - totalPartial) : 0;
        return acc + totalPartial + remainder;
      }
      // No partials: use cost or estimatedCost
      return acc + (t.cost || t.estimatedCost || 0);
    }, 0);
    const net = p.monthlyRent - propExpenses;
    return { ...p, expenses: propExpenses, netResult: net };
  });

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24 relative">
      {/* Premium Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-1 bg-indigo-600 rounded-full"></div>
            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.3em]">Gestión de Activos</span>
          </div>
          <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Bitácora Financiera</h2>
          <p className="text-slate-400 dark:text-slate-500 font-medium text-sm flex items-center gap-2">
            Control de flujo de caja inmobiliario — Período {selectedYear}
          </p>
        </div>

        <div className="flex items-center gap-4 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md p-2 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-xs">
          <div className="flex items-center gap-1 bg-slate-900 dark:bg-indigo-600 text-white rounded-[1.5rem] p-1 shadow-lg">
            <button
              onClick={() => setSelectedYear(y => y - 1)}
              className="p-2.5 rounded-full hover:bg-white/10 transition-colors active:scale-90"
              aria-label="Anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="px-4 text-lg font-black tabular-nums min-w-[4rem] text-center">{selectedYear}</span>
            <button
              onClick={() => setSelectedYear(y => y + 1)}
              disabled={selectedYear >= currentYear}
              className="p-2.5 rounded-full hover:bg-white/10 transition-colors disabled:opacity-20 active:scale-90"
              aria-label="Siguiente"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="p-3.5 bg-white dark:bg-slate-800 rounded-full hover:bg-indigo-50 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 transition-all shadow-xs dark:shadow-none border border-indigo-100 dark:border-white/10 group active:scale-95"
            title="Sincronizar Datos"
          >
            <Loader className="w-5 h-5 group-hover:rotate-180 transition-transform duration-700" />
          </button>
        </div>
      </header>

      {/* Top Stats Overview */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Annual Income - Indigo Glass */}
        <div className="bg-gradient-to-br from-indigo-600/90 to-indigo-700/90 backdrop-blur-xl p-6 rounded-3xl shadow-xl flex flex-col justify-between relative overflow-hidden group border border-white/20">
          <div className="absolute -right-4 -top-4 w-28 h-28 bg-white/10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
          <div className="relative">
            <div className="flex justify-between items-start mb-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div className="px-2.5 py-1 bg-white/20 rounded-full border border-white/20">
                <span className="text-[10px] font-black text-white uppercase tracking-widest">{properties.length} Propiedades</span>
              </div>
            </div>
            <p className="text-[10px] font-black text-indigo-100 uppercase tracking-widest mb-1">Recaudación Anual</p>
            <p className="text-3xl font-black text-white tracking-tighter">{formatCurrency(arsYearTotal, 'ARS').split(',')[0]}</p>
          </div>
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[10px] font-bold text-indigo-100/60 uppercase tracking-widest">
            <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div> Datos en Tiempo Real</span>
            <span>ARS</span>
          </div>
        </div>

        {/* Expenses - Rose Glass */}
        <div className="bg-white/70 dark:bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl shadow-xs border border-slate-100 dark:border-white/10 flex flex-col justify-between group hover:shadow-xl hover:shadow-rose-100/50 dark:hover:shadow-none transition-all duration-500">
          <div className="relative">
            <div className="flex justify-between items-start mb-3">
              <div className="w-10 h-10 bg-rose-50 dark:bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-500 border border-rose-100 dark:border-rose-500/20 group-hover:bg-rose-500 group-hover:text-white transition-all duration-500 group-hover:rotate-6">
                <Hammer className="w-5 h-5" />
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Gastos Totales</p>
                <div className="flex items-center gap-1 text-rose-500 font-black text-xs justify-end">
                  <TrendingDown className="w-3 h-3" />
                  <span>Mantenimiento</span>
                </div>
              </div>
            </div>
            <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{formatCurrency(annualExpensesARS, 'ARS').split(',')[0]}</p>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-1.5 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden border border-slate-100 dark:border-white/10">
              <div
                className="h-full bg-gradient-to-r from-rose-400 to-rose-500 rounded-full transition-all duration-1000"
                style={{ width: `${Math.min((annualExpensesARS / (arsYearTotal || 1)) * 100, 100)}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
              <span>Ratio Gastos/Ingresos</span>
              <span className="text-rose-500">{((annualExpensesARS / (arsYearTotal || 1)) * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Net Flow - Dark Glass */}
        <div className="bg-slate-900 dark:bg-slate-950 p-6 rounded-3xl shadow-xl flex flex-col justify-between relative overflow-hidden group border border-white/5 dark:border-white/10">
          <div className="absolute -right-4 -top-4 w-28 h-28 bg-emerald-500/10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
          <div className="relative">
            <div className="flex justify-between items-start mb-3">
              <div className="w-10 h-10 bg-white/5 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/10">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Resultado Neto</p>
                <div className="px-2 py-0.5 bg-emerald-500/10 rounded-md">
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Flujo de Caja</span>
                </div>
              </div>
            </div>
            <p className={`text-3xl font-black tracking-tighter ${arsYearNet >= 0 ? 'text-white' : 'text-rose-400'}`}>
              {formatCurrency(arsYearNet, 'ARS').split(',')[0]}
            </p>
          </div>
          <div className="relative mt-4">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full" style={{ width: '100%' }}></div>
                </div>
              </div>
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Optimizado</span>
            </div>
          </div>
        </div>
      </section>

      {/* === MONTHLY GRIDS: HARMONIOUS DESIGN === */}
      <div className="space-y-6">
        {/* Income Grid */}
        <section className="bg-white/70 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2.5rem] shadow-xs border border-white/40 dark:border-white/10 overflow-hidden group hover:shadow-xl hover:shadow-indigo-50/50 dark:hover:shadow-none transition-all duration-500">
          <div
            onClick={() => setExpandedSection(expandedSection === 'ARS' ? null : 'ARS')}
            className="p-6 border-b border-indigo-50/50 dark:border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between cursor-pointer hover:bg-white/50 dark:hover:bg-white/5 transition-all gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/10 shadow-xs">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Ingresos Mensuales</h3>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Recaudación por Alquileres (ARS)</p>
              </div>
            </div>
            <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Total Recaudado</p>
                <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">{formatCurrency(arsYearTotal, 'ARS')}</span>
              </div>
              <div className={`p-2.5 rounded-xl transition-all ${expandedSection === 'ARS' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-white/5'}`}>
                {expandedSection === 'ARS' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 divide-x divide-indigo-50/30 dark:divide-white/5">
            {arsMonthly.map((amount, i) => {
              const isCurrent = i === new Date().getMonth() && selectedYear === currentYear;
              return (
                <div key={i} className={`p-3 sm:p-4 text-center transition-all duration-300 ${isCurrent ? 'bg-indigo-50/50 dark:bg-white/5 relative overflow-hidden' : 'hover:bg-white/50 dark:hover:bg-white/5'}`}>
                  {isCurrent && <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-600"></div>}
                  <p className={`text-[10px] uppercase font-bold tracking-widest ${isCurrent ? 'text-indigo-600' : 'text-slate-500 dark:text-slate-400'}`}>{MONTH_NAMES[i]}</p>
                  <p className={`text-sm font-black mt-1.5 tabular-nums ${amount > 0 ? (isCurrent ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-900 dark:text-white') : 'text-slate-300 dark:text-slate-700'}`}>
                    {amount > 0 ? formatCurrency(amount, 'ARS').split(',')[0] : '—'}
                  </p>
                </div>
              );
            })}
          </div>

          {
            expandedSection === 'ARS' && (
              <div className="animate-in slide-in-from-top-4 duration-500">
                <IncomeBreakdownPanel
                  properties={arsProperties}
                  buildings={buildings}
                  currency="ARS"
                  payments={payments}
                  selectedMonth={new Date().getMonth() + 1}
                  selectedYear={selectedYear}
                />
              </div>
            )
          }
        </section >

        {/* Expenses Grid */}
        < section className="bg-white/70 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2.5rem] shadow-xs border border-white/40 dark:border-white/10 overflow-hidden group hover:shadow-xl hover:shadow-rose-50/50 dark:hover:shadow-none transition-all duration-500" >
          <div
            onClick={() => setExpandedSection(expandedSection === 'maintenance' ? null : 'maintenance')}
            className="p-6 border-b border-rose-50/50 dark:border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between cursor-pointer hover:bg-white/50 dark:hover:bg-white/5 transition-all gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-rose-50 dark:bg-rose-900/30 rounded-2xl flex items-center justify-center text-rose-500 dark:text-rose-400 border border-rose-100 dark:border-rose-500/10 shadow-xs transition-transform group-hover:rotate-6">
                <Hammer className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Egresos por Mantenimiento</h3>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Obras y reparaciones directas</p>
              </div>
            </div>
            <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Total Gastado</p>
                <span className="text-2xl font-black text-rose-500 tracking-tighter">{formatCurrency(annualExpensesARS, 'ARS')}</span>
              </div>
              <div className={`p-2.5 rounded-xl transition-all ${expandedSection === 'maintenance' ? 'bg-rose-500 text-white shadow-lg' : 'bg-rose-50 dark:bg-slate-800 text-rose-500 dark:text-rose-400 border border-rose-100 dark:border-white/5'}`}>
                {expandedSection === 'maintenance' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 divide-x divide-rose-50/30 dark:divide-white/5">
            {arsExpensesMonthly.map((amount, i) => {
              const isCurrent = i === new Date().getMonth() && selectedYear === currentYear;
              const hasExpenses = amount > 0;
              return (
                <div
                  key={i}
                  onClick={() => hasExpenses && setSelectedExpenseMonth(i)}
                  className={`p-3 sm:p-4 text-center transition-all duration-300 group/month ${isCurrent ? 'bg-rose-50/50 dark:bg-transparent relative' : hasExpenses ? 'hover:bg-rose-50 dark:hover:bg-transparent cursor-pointer' : 'hover:bg-white/50 dark:hover:bg-transparent'
                    }`}
                >
                  {isCurrent && <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500"></div>}
                  <p className={`text-[10px] uppercase font-black tracking-widest ${isCurrent ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>{MONTH_NAMES[i]}</p>
                  <p className={`text-sm font-black mt-2 tabular-nums transition-transform ${amount > 0 ? (isCurrent ? 'text-rose-700 dark:text-rose-300' : 'text-rose-600 dark:text-rose-400 group-hover/month:scale-110') : 'text-slate-300 dark:text-slate-700'}`}>
                    {amount > 0 ? formatCurrency(amount, 'ARS').split(',')[0] : '—'}
                  </p>
                  {hasExpenses && <div className="mx-auto mt-2 w-1.5 h-1.5 rounded-full bg-rose-400/30"></div>}
                </div>
              );
            })}
          </div>
        </section >
      </div >

      {/* === PROPERTY DETAIL TABLE: PREMIUM FEEL === */}
      < section className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md rounded-[3rem] p-8 border border-white dark:border-white/10 shadow-xl dark:shadow-none transition-colors duration-500" >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Detalle por Propiedad</h3>
            <p className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Desglose individual de rendimiento</p>
          </div>
          <div className="flex items-center gap-4 bg-slate-100/50 dark:bg-slate-800/50 p-2 rounded-2xl border border-slate-200/50 dark:border-white/5">
            <div className="flex items-center gap-2 px-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="text-[10px] font-black text-slate-500 uppercase">Al Día</span>
            </div>
            <div className="flex items-center gap-2 px-3">
              <div className="w-2 h-2 rounded-full bg-rose-500"></div>
              <span className="text-[10px] font-black text-slate-500 uppercase">Moroso</span>
            </div>
          </div>
        </div>

        {/* Mobile: Premium Cards */}
        <div className="md:hidden space-y-4">
          {propertyFinancials.map(item => {
            const shortAddr = item.address.split(',')[0];
            return (
              <div
                key={item.id}
                onClick={() => setSelectedFinancialProperty(item)}
                className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-[2rem] border border-white dark:border-white/10 p-6 active:scale-95 transition-all shadow-lg overflow-hidden relative"
              >
                <div className="flex items-center gap-4">
                  {/* Status dot indicator */}
                  <div className={`w-3 h-3 rounded-full shrink-0 ${item.status === PropertyStatus.CURRENT ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' :
                    item.status === PropertyStatus.LATE ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 'bg-amber-400'
                    }`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <p className="text-base font-black text-slate-900 dark:text-white tracking-tight" title={item.address}>
                          {shortAddr}
                        </p>
                        {item.status === PropertyStatus.CURRENT && <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 px-2 py-0.5 rounded-full">Al Día</span>}
                        {item.status === PropertyStatus.LATE && <span className="text-[8px] font-black uppercase tracking-widest text-rose-600 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 px-2 py-0.5 rounded-full">Moroso</span>}
                      </div>
                      <p className="text-base font-black text-slate-700 dark:text-slate-300 tabular-nums">
                        {formatCurrency(item.monthlyRent, 'ARS').split(',')[0]}
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <User className="w-3 h-3 opacity-50" />
                        <p className="text-[10px] font-bold uppercase tracking-[0.15em] truncate">
                          {item.tenantName}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </div>
                  </div>
                </div>

                {/* Additional info footer (Net result) */}
                <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Resultado Neto</p>
                  <p className={`text-sm font-black ${item.netResult >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {formatCurrency(item.netResult, 'ARS').split(',')[0]}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop: Premium Table */}
        <div className="hidden md:block overflow-hidden rounded-[2rem] border border-slate-100 dark:border-white/10 shadow-xs bg-white/50 dark:bg-slate-900/50">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-100 dark:border-white/5 text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-[0.2em]">
                <th className="px-8 py-5">Propiedad / Residente</th>
                <th className="px-8 py-5">Estado Operativo</th>
                <th className="px-8 py-5 text-right">Contrato</th>
                <th className="px-8 py-5 text-right">Egresos</th>
                <th className="px-8 py-5 text-right">Resultado</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {propertyFinancials.map(item => {
                const shortAddr = item.address.split(',')[0];
                return (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedFinancialProperty(item)}
                    className="border-b border-slate-50 dark:border-white/5 hover:bg-white/80 dark:hover:bg-white/5 transition-all cursor-pointer group"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        {/* Status dot indicator */}
                        <div className={`w-3 h-3 rounded-full shrink-0 ${item.status === PropertyStatus.CURRENT ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' :
                          item.status === PropertyStatus.LATE ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]' : 'bg-amber-400'
                          }`} />

                        <div>
                          <div className="font-black text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors tracking-tight text-base leading-tight" title={item.address}>
                            {shortAddr}
                          </div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] mt-1">
                            {item.tenantName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      {item.status === PropertyStatus.CURRENT && <span className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black text-[10px] uppercase tracking-widest bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-500/20"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div> Al Día</span>}
                      {item.status === PropertyStatus.LATE && <span className="inline-flex items-center gap-2 text-rose-500 dark:text-rose-400 font-black text-[10px] uppercase tracking-widest bg-rose-50 dark:bg-rose-500/10 px-3 py-1 rounded-full border border-rose-100 dark:border-rose-500/20"><div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]"></div> Moroso</span>}
                      {item.status === PropertyStatus.WARNING && <span className="inline-flex items-center gap-2 text-amber-600 dark:text-amber-400 font-black text-[10px] uppercase tracking-widest bg-amber-50 dark:bg-amber-500/10 px-3 py-1 rounded-full border border-amber-100 dark:border-amber-500/20"><div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(251,191,36,0.4)]"></div> Pendiente</span>}
                    </td>
                    <td className="px-8 py-6 text-right font-black text-slate-700 dark:text-slate-300 tabular-nums">
                      {formatCurrency(item.monthlyRent, 'ARS').split(',')[0]}
                    </td>
                    <td className="px-8 py-6 text-right font-black text-rose-500 tabular-nums">
                      {item.expenses > 0 ? `- ${formatCurrency(item.expenses, 'ARS').split(',')[0]}` : <span className="text-slate-200">—</span>}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <span className={`font-black tracking-tight text-base tabular-nums ${item.netResult > 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'}`}>
                        {formatCurrency(item.netResult, 'ARS').split(',')[0]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="bg-slate-900 p-8 flex justify-end gap-12 text-white">
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Consolidado Egresos</p>
              <p className="font-black text-rose-400 text-2xl tracking-tighter tabular-nums">{formatCurrency(annualExpensesARS, 'ARS').split(',')[0]}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Neto Proyectado Anual</p>
              <p className={`font-black text-3xl tracking-tighter tabular-nums ${arsYearNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatCurrency(arsYearNet, 'ARS').split(',')[0]}
              </p>
            </div>
          </div>
        </div>

        {/* Mobile: Clean Footer Stats */}
        <div className="md:hidden mt-6 bg-slate-900 rounded-[2rem] p-6 flex flex-col gap-4">
          <div className="flex justify-between items-center pb-4 border-b border-white/5">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Egresos Anuales</p>
            <p className="font-black text-rose-400 text-lg">{formatCurrency(annualExpensesARS, 'ARS').split(',')[0]}</p>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Balance SV</p>
            <p className={`font-black text-2xl tracking-tighter ${arsYearNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatCurrency(arsYearNet, 'ARS').split(',')[0]}
            </p>
          </div>
        </div>
      </section >

      {/* Financial Detail Modal */}
      {
        selectedFinancialProperty && (
          <FinancialDetailsCard
            property={selectedFinancialProperty}
            maintenanceTasks={maintenanceTasks}
            professionals={professionals}
            onClose={handleCloseDetail}
          />
        )
      }

      {/* Detail Expense Modal */}
      {
        selectedExpenseMonth !== null && (
          <ExpenseBreakdownModal
            month={selectedExpenseMonth}
            year={selectedYear}
            maintenanceTasks={maintenanceTasks}
            properties={properties}
            professionals={professionals}
            onClose={() => setSelectedExpenseMonth(null)}
          />
        )
      }
    </div >
  );
};

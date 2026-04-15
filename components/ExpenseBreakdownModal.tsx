import React from 'react';
import { MaintenanceTask, Property, Professional } from '../types';
import { X, Receipt, Calendar, Hammer, Home, ExternalLink } from 'lucide-react';
import { formatCurrency } from '../utils/currency';

const MONTH_NAMES_FULL = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

interface ExpenseBreakdownModalProps {
  month: number; // 0-indexed
  year: number;
  maintenanceTasks: MaintenanceTask[];
  properties: Property[];
  professionals: Professional[];
  onClose: () => void;
}

interface ExpenseItem {
  id: string;
  description: string;
  mainTask: string;
  date: string;
  amount: number;
  professionalName?: string;
  propertyAddress: string;
  propertyId: string;
  tenantName: string;
  isPartial: boolean;
  proofUrl?: string;
}

const ExpenseBreakdownModal: React.FC<ExpenseBreakdownModalProps> = ({
  month,
  year,
  maintenanceTasks,
  properties,
  professionals,
  onClose
}) => {
  // Collect all expense items that fall in this month
  const expenseItems: ExpenseItem[] = [];

  maintenanceTasks.forEach(task => {
    const property = properties.find(p => p.id === task.propertyId);
    const professional = professionals.find(p => p.id === task.professionalId);
    const hasPartials = task.partialExpenses && task.partialExpenses.length > 0;

    if (hasPartials) {
      // Add partial expenses that fall in this month
      task.partialExpenses!.forEach(pe => {
        const d = new Date(pe.date);
        if (d.getMonth() === month && d.getFullYear() === year) {
          expenseItems.push({
            id: pe.id,
            description: pe.description,
            mainTask: task.description,
            date: pe.date,
            amount: pe.amount,
            professionalName: professional?.name,
            propertyAddress: property?.address || 'Propiedad desconocida',
            propertyId: task.propertyId,
            tenantName: property?.tenantName || '',
            isPartial: true,
            proofUrl: pe.proofUrl,
          });
        }
      });

      // Add remainder if completed and endDate falls in this month
      if (task.status === 'COMPLETED' && task.endDate) {
        const endD = new Date(task.endDate);
        if (endD.getMonth() === month && endD.getFullYear() === year) {
          const totalPartial = task.partialExpenses!.reduce((s, p) => s + p.amount, 0);
          const remainder = Math.max(0, (task.cost || 0) - totalPartial);
          if (remainder > 0) {
            expenseItems.push({
              id: `${task.id}-remainder`,
              description: 'Cierre / Ajuste Final',
              mainTask: task.description,
              date: task.endDate,
              amount: remainder,
              professionalName: professional?.name,
              propertyAddress: property?.address || 'Propiedad desconocida',
              propertyId: task.propertyId,
              tenantName: property?.tenantName || '',
              isPartial: false,
            });
          }
        }
      }
    } else {
      // No partials: check if the task's reference date falls in this month
      const refDate = new Date(task.endDate || task.startDate);
      if (refDate.getMonth() === month && refDate.getFullYear() === year) {
        expenseItems.push({
          id: task.id,
          description: task.description,
          mainTask: task.description,
          date: task.endDate || task.startDate,
          amount: task.cost || task.estimatedCost || 0,
          professionalName: professional?.name,
          propertyAddress: property?.address || 'Propiedad desconocida',
          propertyId: task.propertyId,
          tenantName: property?.tenantName || '',
          isPartial: false,
        });
      }
    }
  });

  // Group by property
  const groupedByProperty = expenseItems.reduce<Record<string, { address: string; tenantName: string; items: ExpenseItem[]; total: number }>>((acc, item) => {
    if (!acc[item.propertyId]) {
      acc[item.propertyId] = {
        address: item.propertyAddress,
        tenantName: item.tenantName,
        items: [],
        total: 0,
      };
    }
    acc[item.propertyId].items.push(item);
    acc[item.propertyId].total += item.amount;
    return acc;
  }, {});

  const propertyGroups = Object.entries(groupedByProperty).sort((a, b) => b[1].total - a[1].total);
  const monthTotal = expenseItems.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div
      className="fixed inset-0 z-[1300] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-in fade-in zoom-in-95 duration-300"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative bg-white dark:bg-slate-900 w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/50 dark:border-white/10 flex flex-col animate-in zoom-in-95 duration-300">

        {/* Header */}
        <div className="p-10 pb-6 bg-white dark:bg-slate-800/50 border-b border-indigo-50/50 dark:border-white/5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-1 bg-rose-500 rounded-full"></div>
                <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.3em]">Auditoría de Gastos</span>
              </div>
              <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-none uppercase">
                {MONTH_NAMES_FULL[month]} {year}
              </h2>
              <p className="text-sm font-bold text-slate-400 dark:text-slate-500 mt-2 uppercase tracking-widest flex items-center gap-2">
                <Hammer className="w-4 h-4" /> {expenseItems.length} comprobantes detectados
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-3 bg-slate-100/50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl transition-all active:scale-95 border border-transparent hover:border-slate-200 dark:hover:border-white/10"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Month Total Card */}
          <div className="mt-8 relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-rose-600 to-rose-400 rounded-[1.8rem] opacity-10 blur-xl group-hover:opacity-20 transition-all"></div>
            <div className="relative bg-slate-950 p-6 rounded-[2rem] text-white shadow-2xl flex items-center justify-between border border-white/5 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl"></div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10 shadow-inner">
                  <Receipt className="w-6 h-6 text-rose-400" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Inversión Mensual</p>
                  <span className="text-sm font-bold text-slate-300">Total Desembolsado</span>
                </div>
              </div>
              <p className="text-3xl font-black text-white tracking-tighter tabular-nums">{formatCurrency(monthTotal, 'ARS').split(',')[0]}<span className="text-sm text-slate-500 ml-1">ARS</span></p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 pt-6 flex-1 overflow-y-auto custom-scrollbar">
          {propertyGroups.length > 0 ? (
            <div className="space-y-6">
              {propertyGroups.map(([propertyId, group]) => (
                <div key={propertyId} className="bg-white dark:bg-slate-800 rounded-[1.8rem] border border-slate-100 dark:border-white/5 shadow-sm overflow-hidden">
                  {/* Property Header */}
                  <div className="p-5 bg-slate-50 dark:bg-slate-700 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-200 dark:bg-slate-600 rounded-xl">
                        <Home className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white text-sm leading-tight">{group.address}</p>
                        {group.tenantName && (
                          <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">{group.tenantName}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-base font-black text-rose-500 dark:text-rose-400">{formatCurrency(group.total, 'ARS')}</span>
                  </div>

                  {/* Expense Items */}
                  <div className="divide-y divide-slate-50 dark:divide-white/5">
                    {group.items
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map(item => (
                        <div key={item.id} className="p-5 flex items-start justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                          <div className="flex gap-3">
                            <div className={`mt-0.5 h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${item.isPartial ? 'bg-amber-50 text-amber-500' : 'bg-indigo-50 text-indigo-500'}`}>
                              {item.isPartial ? <Calendar className="w-4 h-4" /> : <Receipt className="w-4 h-4" />}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900 leading-tight uppercase tracking-tight">{item.description}</p>
                              {item.isPartial && (
                                <p className="text-xs text-slate-400 mt-0.5 italic">Obra: {item.mainTask}</p>
                              )}
                              <div className="flex items-center gap-3 mt-2">
                                {item.professionalName && (
                                  <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full uppercase tracking-widest">
                                    {item.professionalName}
                                  </span>
                                )}
                                <span className="text-[10px] font-black text-slate-400 flex items-center gap-1 uppercase tracking-widest">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(item.date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                                </span>
                                {item.proofUrl && (
                                  <a href={item.proofUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-black text-blue-500 hover:text-blue-700 flex items-center gap-1 uppercase tracking-widest">
                                    <ExternalLink className="w-3 h-3" /> Comprobante
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                          <p className="text-base font-black text-rose-500 shrink-0">
                            - {formatCurrency(item.amount, 'ARS')}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center px-10">
              <div className="w-24 h-24 bg-slate-200 rounded-[2.5rem] flex items-center justify-center mb-6 text-slate-400">
                <Receipt className="w-10 h-10 opacity-50" />
              </div>
              <h4 className="text-xl font-black text-slate-900 mb-2">Sin gastos este mes</h4>
              <p className="text-sm font-semibold text-slate-400 max-w-[240px]">No se encontraron gastos de mantenimiento registrados para este periodo.</p>
            </div>
          )}
        </div>

        {/* Footer Legend */}
        <div className="p-6 bg-slate-50/80 border-t border-slate-100 flex gap-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-md bg-amber-500/20"></div>
            GASTO PARCIAL
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-md bg-indigo-500/20"></div>
            COSTO FINAL / TOTAL
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpenseBreakdownModal;

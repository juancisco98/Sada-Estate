// Force update
import React, { useState, useEffect, useMemo } from 'react';
import { PropertyStatus, Professional, TaskStatus, Property, MaintenanceTask, Building, TenantPayment, PropertyType } from '../types';
import { toast } from 'sonner';
import { useDataContext } from '../context/DataContext';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Hammer,
  DollarSign,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Building2,
  UserPlus,
  Phone,
  MapPin,
  Calendar,
  User,
  Home,
  CheckCircle,
  AlertCircle,
  Timer,
  Trash2,
  Briefcase,
  Loader,
  Edit
} from 'lucide-react';
import FinancialDetailsCard from './FinancialDetailsCard';
import IncomeBreakdownPanel from './IncomeBreakdownPanel';
import ExpenseBreakdownModal from './ExpenseBreakdownModal';
import MaintenanceDetailsModal from './MaintenanceDetailsModal';

// --- Helper Functions ---
import { formatCurrency } from '../utils/currency';
import { getPropertyDisplayInfo } from '../utils/property';
import { MAINTENANCE_BUDGET_RATIO } from '../constants';
import { useMaintenanceTimer } from '../hooks/useMaintenanceTimer';

// --- Sub-component for Active Maintenance Label in Professionals View ---
const ActiveJobIndicator: React.FC<{ property: Property, onFinish?: (p: Property) => void }> = ({ property, onFinish }) => {
  const timer = useMaintenanceTimer(property.professionalAssignedDate);

  return (
    <div className="mt-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-2.5 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Hammer className="w-3 h-3 text-amber-600 dark:text-amber-400" />
          <span className="text-xs font-bold text-amber-800 dark:text-amber-300 truncate max-w-[120px]">{property.address}</span>
        </div>
        <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-500/20 px-2 py-0.5 rounded-full">
          <Timer className="w-3 h-3 text-amber-600 dark:text-amber-400" />
          <span className="text-xs font-bold text-amber-800 dark:text-amber-300 tabular-nums">{timer}</span>
        </div>
      </div>
      {property.maintenanceTaskDescription && (
        <p className="text-[10px] text-amber-700 dark:text-amber-400/80 italic border-t border-amber-200 dark:border-amber-500/20 pt-1 mt-1 truncate">
          "{property.maintenanceTaskDescription}"
        </p>
      )}
    </div>
  );
};

// --- Props for Overview ---
interface OverviewViewProps {
  onEditProperty?: (property: Property) => void;
  properties?: Property[]; // Allow passing dynamic properties
  professionals?: Professional[];
  maintenanceTasks?: MaintenanceTask[];
  onAddProperty?: () => void;
  onDeleteProperty?: (id: string) => void;
  onAddExpense?: (propertyId: string, expense: { description: string, amount: number, date: string, by: string }) => void;
  onFinishMaintenance?: (property: Property) => void;
}

// --- 1. Visión General (Overview) ---
export const OverviewView: React.FC<OverviewViewProps> = ({
  onEditProperty,
  properties = [],
  professionals = [],
  maintenanceTasks = [],
  onAddProperty,
  onDeleteProperty,
  onAddExpense,
  onFinishMaintenance
}) => {

  // Property type helper (backward compatible)
  const getPropertyType = (p: Property): PropertyType => {
    return p.propertyType || (p.buildingId ? 'edificio' : 'casa');
  };

  // Category filter state
  const [activeCategory, setActiveCategory] = useState<'all' | 'casa' | 'edificio' | 'local'>('all');

  // Categorize properties
  const categorized = useMemo(() => {
    const casas = properties.filter(p => getPropertyType(p) === 'casa');
    const edificioProps = properties.filter(p => getPropertyType(p) === 'edificio');
    const locales = properties.filter(p => getPropertyType(p) === 'local');

    // Group edificio properties by buildingId or shared address
    const buildingMap = new Map<string, Property[]>();
    edificioProps.forEach(p => {
      const key = p.buildingId || `addr:${p.address.split(',')[0].trim().toLowerCase()}`;
      const group = buildingMap.get(key) || [];
      group.push(p);
      buildingMap.set(key, group);
    });

    return { casas, edificioGroups: Array.from(buildingMap.entries()), locales };
  }, [properties]);

  const filteredProperties = useMemo(() => {
    if (activeCategory === 'all') return properties;
    return properties.filter(p => getPropertyType(p) === activeCategory);
  }, [properties, activeCategory]);

  // --- Calculate Actual Income (This Month) ---
  const { payments } = useDataContext();
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const actualIncome = useMemo(() => {
    return payments
      .filter(p => p.month === currentMonth && p.year === currentYear && p.status === 'APPROVED')
      .reduce((sum, p) => sum + p.amount, 0);
  }, [payments, currentMonth, currentYear]);

  const totalIncome = useMemo(() =>
    properties.reduce((acc, p) => acc + p.monthlyRent, 0),
    [properties]
  );

  const totalBudget = useMemo(() => totalIncome * MAINTENANCE_BUDGET_RATIO, [totalIncome]);

  const currentExpenses = useMemo(() =>
    maintenanceTasks.reduce((acc, task) => {
      const cost = task.cost || task.estimatedCost || 0;
      return acc + cost;
    }, 0),
    [maintenanceTasks]
  );

  const progress = totalBudget > 0 ? (currentExpenses / totalBudget) * 100 : 0;

  // Helper for maintenance
  const getMaintenanceInfo = (prop: Property) => {
    if (!prop.assignedProfessionalId) return null;
    const pro = professionals.find(p => p.id === prop.assignedProfessionalId);
    return { pro, startDate: prop.professionalAssignedDate, task: prop.maintenanceTaskDescription };
  };

  // Internal component for timer within Overview to avoid hook rules issues in loop
  const MaintenanceTimerDisplay = ({ start }: { start?: string }) => {
    const time = useMaintenanceTimer(start);
    return <>{time}</>;
  }

  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedMaintenanceProp, setSelectedMaintenanceProp] = useState<Property | null>(null);

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-24">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="w-2 h-12 bg-indigo-600 rounded-full hidden sm:block"></div>
          <div>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight">Visión General</h2>
            <p className="text-gray-500 dark:text-slate-400 font-medium text-sm sm:text-lg">Estado de mis propiedades y actividad reciente.</p>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap w-full sm:w-auto">
          {onDeleteProperty && (
            <button
              onClick={() => setIsDeleteMode(!isDeleteMode)}
              className={`p-3 rounded-2xl shadow-sm flex items-center gap-2 px-5 sm:px-7 transition-all min-h-[52px] font-bold ${isDeleteMode
                ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-rose-200 shadow-lg scale-105'
                : 'bg-white dark:bg-slate-800 text-rose-600 border border-rose-100 dark:border-rose-500/20 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:border-rose-200'
                }`}
            >
              <Trash2 className="w-5 h-5" />
              <span className="md:inline">
                {isDeleteMode ? 'Listo' : 'Gestionar'}
              </span>
            </button>
          )}
          {onAddProperty && !isDeleteMode && (
            <button
              onClick={onAddProperty}
              className="bg-indigo-600 text-white p-3 rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-200 dark:shadow-none flex items-center gap-2 px-5 sm:px-8 min-h-[52px] transition-all hover:scale-105 active:scale-95 group"
            >
              <span className="font-black text-xl group-hover:rotate-90 transition-transform">+</span>
              <span className="font-bold text-base">Nueva Propiedad</span>
            </button>
          )}
        </div>
      </header>

      {/* Category Filter Buttons - Modern Segmented Control style */}
      <div className="bg-white/50 dark:bg-slate-800/50 p-1.5 rounded-3xl border border-gray-100 dark:border-white/10 flex gap-1 flex-wrap sm:flex-nowrap backdrop-blur-sm self-start">
        {([
          { key: 'all' as const, label: 'Todas', icon: '📋', count: properties.length },
          { key: 'casa' as const, label: 'Casas', icon: '🏠', count: categorized.casas.length },
          { key: 'edificio' as const, label: 'Edificios', icon: '🏢', count: categorized.edificioGroups.length },
          { key: 'local' as const, label: 'Locales', icon: '🏪', count: categorized.locales.length },
        ]).map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`flex-1 sm:flex-none px-5 py-3 rounded-[22px] font-bold text-sm flex items-center justify-center gap-2.5 transition-all min-h-[48px] ${activeCategory === cat.key
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-md shadow-indigo-100/50 dark:shadow-none border border-indigo-50 dark:border-white/20'
              : 'bg-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
          >
            <span className="text-lg grayscale-0">{cat.icon}</span>
            <span>{cat.label}</span>
            <span className={`px-1.5 py-0.5 rounded-lg text-[10px] ${activeCategory === cat.key ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' : 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-gray-500'}`}>
              {cat.count}
            </span>
          </button>
        ))}
      </div>

      {/* SECTION 1: Property Cards */}
      <section>
        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-600" /> {activeCategory === 'edificio' ? 'Mis Edificios' : activeCategory === 'casa' ? 'Mis Casas' : activeCategory === 'local' ? 'Mis Locales' : 'Mis Propiedades'}
        </h3>

        {/* Building grouped view when Edificios filter is active */}
        {activeCategory === 'edificio' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {categorized.edificioGroups.map(([groupKey, units]) => {
              const firstUnit = units[0];
              const totalRent = units.reduce((acc, u) => acc + u.monthlyRent, 0);
              const lateCount = units.filter(u => u.status === PropertyStatus.LATE).length;

              return (
                <div key={groupKey} className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border-2 border-violet-200 dark:border-violet-500/20 overflow-hidden">
                  {/* Building header with image */}
                  <div className="h-36 w-full relative">
                    {firstUnit.imageUrl ? (
                      <img src={firstUnit.imageUrl} alt={firstUnit.address} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                        <Building2 className="w-12 h-12 text-white/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/20"></div>
                    <div className="absolute top-3 left-3">
                      <span className="bg-violet-600 text-white text-xs font-black px-3 py-1.5 rounded-full shadow-lg">
                        🏢 Edificio
                      </span>
                    </div>
                  </div>
                  <div className="p-5">
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{firstUnit.address}</h4>
                    <div className="flex gap-2 flex-wrap mb-4">
                      <span className="text-xs bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 px-2.5 py-1 rounded-full font-bold border border-violet-200 dark:border-violet-500/20">
                        {units.length} {units.length === 1 ? 'unidad' : 'unidades'}
                      </span>
                      <span className="text-xs bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 px-2.5 py-1 rounded-full font-bold border border-green-200 dark:border-green-500/20">
                        {formatCurrency(totalRent, 'ARS')}/mes
                      </span>
                      {lateCount > 0 && (
                        <span className="text-xs bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 px-2.5 py-1 rounded-full font-bold border border-red-200 dark:border-red-500/20">
                          {lateCount} moroso{lateCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {/* Unit list */}
                    <div className="space-y-1 max-h-[220px] overflow-y-auto antialiased">
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest mb-2 px-1">Departamentos registrados</p>
                      {units
                        .sort((a, b) => (a.unitLabel || '').localeCompare(b.unitLabel || ''))
                        .map(unit => {
                          const hasPro = !!unit.assignedProfessionalId;
                          return (
                            <div
                              key={unit.id}
                              onClick={() => onEditProperty && onEditProperty(unit)}
                              className="flex items-center gap-4 p-4 rounded-[2rem] hover:bg-indigo-500/10 dark:hover:bg-indigo-500/20 cursor-pointer group transition-all border border-transparent hover:border-indigo-100 dark:hover:border-indigo-500/40 hover:translate-x-2 active:scale-95 shadow-sm hover:shadow-indigo-500/10 overflow-hidden"
                            >
                              {/* Status dot indicator */}
                              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${unit.status === PropertyStatus.CURRENT ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' :
                                unit.status === PropertyStatus.LATE ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 'bg-amber-400'
                                }`} />

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-black text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors tracking-tight uppercase">
                                    {getPropertyDisplayInfo(unit).title}
                                  </p>
                                  {unit.status === PropertyStatus.CURRENT && <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 px-2 py-0.5 rounded-full">Al Día</span>}
                                  {unit.status === PropertyStatus.LATE && <span className="text-[8px] font-black uppercase tracking-widest text-rose-600 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 px-2 py-0.5 rounded-full">Moroso</span>}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5 antialiased">
                                  <Home className="w-2.5 h-2.5 text-slate-400 dark:text-slate-600" />
                                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest truncate">
                                    {getPropertyDisplayInfo(unit).subtitle}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <div className="text-right mr-2 hidden sm:block">
                                  <p className="text-sm font-black text-slate-700 dark:text-white tabular-nums">{formatCurrency(unit.monthlyRent, 'ARS').split(',')[0]}</p>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Alquiler</p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onEditProperty && onEditProperty(unit);
                                    }}
                                    className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-indigo-100 dark:border-white/5 flex items-center gap-1.5 text-[10px] font-bold whitespace-nowrap"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                    <span className="hidden xs:inline">EDITAR</span>
                                  </button>
                                  <ChevronRight className="w-4 h-4 text-slate-300 dark:text-indigo-400" />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
            {filteredProperties.map(property => {
              const maintenance = getMaintenanceInfo(property);
              const isMaintenance = !!maintenance;

              return (
                <div
                  key={property.id}
                  onClick={() => {
                    if (isDeleteMode) {
                      if (onDeleteProperty && window.confirm(`¿⚠️ Estás seguro que deseas ELIMINAR definitivamente la propiedad en "${property.address}"?`)) {
                        onDeleteProperty(property.id);
                      }
                    } else {
                      onEditProperty && onEditProperty(property);
                    }
                  }}
                  className={`
                  bg-white dark:bg-slate-900 rounded-3xl shadow-sm overflow-hidden transition-all duration-300 cursor-pointer relative group
                  ${isDeleteMode
                      ? 'border-4 border-red-500 ring-4 ring-red-100 scale-95 opacity-90 hover:opacity-100 hover:scale-100 animate-pulse'
                      : (isMaintenance ? 'border-4 border-orange-400 dark:border-orange-500/50 ring-4 ring-orange-100/30 dark:ring-orange-900/20' : 'border border-gray-100 dark:border-white/10 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg hover:scale-[1.01] hover:translate-x-1')
                    }
                `}
                >
                  {/* Delete Mode Overlay */}
                  {isDeleteMode && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-red-50/50 backdrop-blur-[1px]">
                      <div className="bg-red-600 text-white px-6 py-3 rounded-full font-bold shadow-2xl flex items-center gap-2 transform scale-110">
                        <Trash2 className="w-6 h-6" /> ELIMINAR
                      </div>
                    </div>
                  )}
                  {/* Photo Area */}
                  <div className="h-48 w-full bg-gray-200 relative">
                    <img
                      src={property.imageUrl}
                      alt={property.address}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {/* Property Type Badge */}
                    <div className="absolute top-4 left-4">
                      {getPropertyType(property) === 'casa' && (
                        <span className="bg-teal-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-lg">🏠 Casa</span>
                      )}
                      {getPropertyType(property) === 'local' && (
                        <span className="bg-amber-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-lg">🏪 Local</span>
                      )}
                      {getPropertyType(property) === 'edificio' && (
                        <span className="bg-violet-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-lg">🏢 Edificio</span>
                      )}
                    </div>
                    {/* Status Badge & Delete Button */}
                    <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
                      {onDeleteProperty && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent opening modal when clicking phone
                            if (window.confirm(`¿Estás seguro de que deseas eliminar la propiedad "${property.address}"?`)) {
                              onDeleteProperty(property.id);
                            }
                          }}
                          className="bg-red-500/80 hover:bg-red-600 text-white p-2 rounded-full shadow-lg transition-all active:scale-95"
                          title="Eliminar Propiedad"
                          aria-label="Eliminar propiedad"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                      {/* Dynamic Payment/Status Badge */}
                      {(() => {
                        const currentPayment = payments.find(p => p.propertyId === property.id && p.month === currentMonth && p.year === currentYear);

                        if (currentPayment) {
                          if (currentPayment.status === 'REVISION') {
                            return (
                              <span className="bg-amber-500 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-lg flex items-center gap-1 animate-pulse">
                                <Clock className="w-3 h-3" /> REVISIÓN
                              </span>
                            );
                          }
                          if (currentPayment.status === 'APPROVED' || (currentPayment.proofOfPayment && currentPayment.proofOfExpenses)) {
                            return (
                              <span className="bg-green-500 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-lg flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> PAGADO
                              </span>
                            );
                          }
                        }

                        // Fallback to static status if no payment current month
                        if (property.status === PropertyStatus.LATE) {
                          return (
                            <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold shadow-sm flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Moroso
                            </span>
                          );
                        }
                        if (property.status === PropertyStatus.WARNING) {
                          return (
                            <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold shadow-sm flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Revisar
                            </span>
                          );
                        }
                        return (
                          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold shadow-sm flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Al día
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Info Content */}
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-indigo-400 transition-colors">{property.address}</h4>
                    </div>

                    {/* Active Maintenance Alert */}
                    {isMaintenance && maintenance && (
                      <div className="my-3 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 rounded-xl p-3 flex flex-col gap-2 animate-pulse">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="bg-orange-200 p-1.5 rounded-lg text-orange-700">
                              <Hammer className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs text-orange-600 font-bold uppercase">En Obra</p>
                              <p className="text-sm font-bold text-gray-900 dark:text-white">{maintenance.pro?.name}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-orange-600 font-bold uppercase flex items-center justify-end gap-1">
                              <Timer className="w-3 h-3" /> Tiempo
                            </p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                              <MaintenanceTimerDisplay start={maintenance.startDate} />
                            </p>
                          </div>
                        </div>
                        {maintenance.task && (
                          <div className="text-xs text-orange-800 bg-white/50 rounded px-2 py-1 italic border-l-2 border-orange-300">
                            "{maintenance.task}"
                          </div>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMaintenanceProp(property);
                          }}
                          className="w-full mt-2 py-2 bg-white/80 border border-orange-200 rounded-lg text-xs font-bold text-orange-700 hover:bg-orange-100 transition-colors flex items-center justify-center gap-1"
                        >
                          <DollarSign className="w-3 h-3" /> Ver Gastos Parciales
                        </button>

                        {onFinishMaintenance && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onFinishMaintenance(property);
                            }}
                            className="w-full mt-1.5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-1 transition-colors"
                          >
                            <CheckCircle className="w-4 h-4" /> Finalizar Obra & Calificar
                          </button>
                        )}
                      </div>
                    )}

                    <p className="text-sm text-gray-400 mb-4 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> CABA, Argentina
                    </p>

                    <div className="space-y-2.5">
                      {/* Tenant & Phone */}
                      <div className="flex items-center justify-between p-2.5 bg-slate-50/80 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-white dark:bg-white/10 rounded-full flex items-center justify-center text-slate-400 shadow-sm border border-slate-100 dark:border-white/10">
                            <User className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest leading-none mb-1">Inquilino</p>
                            <p className="text-sm font-bold text-slate-900 dark:text-white leading-none" title={property.tenantName}>
                              {property.tenantName || 'Vacante'}
                            </p>
                          </div>
                        </div>
                        {property.tenantPhone && property.tenantPhone !== '-' && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              window.location.href = `tel:${property.tenantPhone}`;
                            }}
                            className="w-8 h-8 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all cursor-pointer shadow-sm border border-indigo-100 dark:border-indigo-500/20"
                          >
                            <Phone className="w-4 h-4" />
                          </div>
                        )}
                      </div>

                      {/* Payment Date & Rent */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="bg-slate-50/80 dark:bg-white/5 p-2.5 rounded-2xl border border-slate-100 dark:border-white/5">
                          <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-1 leading-none">Cobro</p>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Del 1 al 10</p>
                        </div>
                        <div className="bg-slate-50/80 dark:bg-white/5 p-2.5 rounded-2xl border border-slate-100 dark:border-white/5">
                          <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-1 leading-none">Alquiler</p>
                          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(property.monthlyRent, 'ARS').split(',')[0]}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="border-t border-gray-200 my-8"></div>

      {/* Budget & Maintenance Summary Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-[2.5rem] p-6 border border-slate-100 dark:border-white/10 shadow-sm relative overflow-hidden group hover:shadow-xl hover:shadow-indigo-50/20 transition-all duration-500">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 dark:bg-indigo-500/10 rounded-bl-[100px] -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>

          <div className="relative">
            <div className="flex justify-between items-start mb-5">
              <div>
                <h3 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">Presupuesto Mantenimiento</h3>
                <p className="text-slate-400 dark:text-slate-500 text-[10px] font-bold italic">Calculado sobre el 15% de ingresos brutos</p>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-500/20 p-2 rounded-2xl">
                <DollarSign className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>

            <div className="flex items-end gap-3 mb-6">
              <span className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter tabular-nums">
                {formatCurrency(currentExpenses, 'ARS').split(',')[0]}
              </span>
              <span className="text-lg font-bold text-slate-300 dark:text-slate-600 mb-1.5 tabular-nums">
                / {formatCurrency(totalBudget, 'ARS').split(',')[0]}
              </span>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between text-[11px] font-black uppercase tracking-wider">
                <span className="text-slate-500 dark:text-slate-400">Estado de Gasto</span>
                <span className={progress > 100 ? 'text-rose-600 dark:text-rose-400' : 'text-indigo-600 dark:text-indigo-400'}>
                  {progress.toFixed(1)}% utilizado
                </span>
              </div>
              <div className="h-3 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden border border-slate-100 dark:border-white/10 flex p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-out shadow-sm ${progress > 90 ? 'bg-gradient-to-r from-rose-400 to-rose-600' :
                    progress > 60 ? 'bg-gradient-to-r from-amber-400 to-amber-600' :
                      'bg-gradient-to-r from-indigo-400 to-indigo-600'
                    }`}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-emerald-50/50 dark:bg-emerald-500/5 rounded-[2.5rem] p-5 border border-emerald-100/50 dark:border-emerald-500/10 flex flex-col justify-between relative group hover:bg-emerald-100/50 dark:hover:bg-emerald-500/10 transition-all cursor-default">
            <div className="w-9 h-9 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl flex items-center justify-center mb-3">
              <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-0.5">Cobrado</p>
              <p className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{formatCurrency(actualIncome, 'ARS').split(',')[0]}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <div className="flex-1 h-1 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full" style={{ width: `${Math.min((actualIncome / totalIncome) * 100, 100)}%` }}></div>
                </div>
                <span className="text-[9px] font-black text-slate-400 dark:text-slate-500">
                  {Math.round((actualIncome / totalIncome) * 100)}%
                </span>
              </div>
            </div>
          </div>
          <div className="bg-amber-50/50 dark:bg-amber-500/5 rounded-[2.5rem] p-5 border border-amber-100/50 dark:border-amber-500/10 flex flex-col justify-between group hover:bg-amber-100/50 dark:hover:bg-amber-500/10 transition-all cursor-default">
            <div className="w-9 h-9 bg-amber-100 dark:bg-amber-500/20 rounded-xl flex items-center justify-center mb-3">
              <Hammer className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-0.5">Tareas</p>
              <p className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{maintenanceTasks.filter(t => t.status !== 'COMPLETED').length}</p>
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5 items-center flex gap-1"><div className="w-1 h-1 rounded-full bg-amber-400"></div> Activas</span>
            </div>
          </div>
        </div>
      </div>


      {/* Maintenance Details Modal */}
      {
        selectedMaintenanceProp && onAddExpense && (
          (() => {
            const maintenance = getMaintenanceInfo(selectedMaintenanceProp);
            const task = maintenanceTasks.find(t => t.propertyId === selectedMaintenanceProp.id && t.status !== TaskStatus.COMPLETED);

            if (maintenance && task) {
              return (
                <MaintenanceDetailsModal
                  property={selectedMaintenanceProp}
                  task={task}
                  professionalName={maintenance.pro?.name || 'Profesional'}
                  onClose={() => setSelectedMaintenanceProp(null)}
                  onAddExpense={onAddExpense}
                />
              );
            }
            return null;
          })()
        )
      }
    </div >
  );
};

// --- 2. Finanzas (Finance) ---
interface FinanceViewProps {
  properties?: Property[];
  professionals?: Professional[];
  preSelectedProperty?: Property | null;
  maintenanceTasks?: MaintenanceTask[];
  onClearPreSelection?: () => void;
  buildings?: Building[];
}

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

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
  const [expandedSection, setExpandedSection] = useState<'ARS' | 'USD' | null>(null);
  const [selectedExpenseMonth, setSelectedExpenseMonth] = useState<number | null>(null);

  // Auto-select property if passed from parent
  useEffect(() => {
    if (preSelectedProperty) {
      setSelectedFinancialProperty(preSelectedProperty);
    }
  }, [preSelectedProperty]);

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

        <div className="flex items-center gap-4 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md p-2 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-sm">
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
            className="p-3.5 bg-white dark:bg-slate-800 rounded-full hover:bg-indigo-50 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 transition-all shadow-sm dark:shadow-none border border-indigo-100 dark:border-white/10 group active:scale-95"
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
        <div className="bg-white/70 dark:bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-white/10 flex flex-col justify-between group hover:shadow-xl hover:shadow-rose-100/50 dark:hover:shadow-none transition-all duration-500">
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
        <section className="bg-white/70 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2.5rem] shadow-sm border border-white/40 dark:border-white/10 overflow-hidden group hover:shadow-xl hover:shadow-indigo-50/50 dark:hover:shadow-none transition-all duration-500">
          <div
            onClick={() => setExpandedSection(expandedSection === 'ARS' ? null : 'ARS')}
            className="p-6 border-b border-indigo-50/50 dark:border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between cursor-pointer hover:bg-white/50 dark:hover:bg-white/5 transition-all gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/10 shadow-sm">
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
        < section className="bg-white/70 dark:bg-slate-900/80 backdrop-blur-xl rounded-[2.5rem] shadow-sm border border-white/40 dark:border-white/10 overflow-hidden group hover:shadow-xl hover:shadow-rose-50/50 dark:hover:shadow-none transition-all duration-500" >
          <div
            onClick={() => setExpandedSection(expandedSection === 'maintenance' ? null : 'maintenance')}
            className="p-6 border-b border-rose-50/50 dark:border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between cursor-pointer hover:bg-white/50 dark:hover:bg-white/5 transition-all gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-rose-50 dark:bg-rose-900/30 rounded-2xl flex items-center justify-center text-rose-500 dark:text-rose-400 border border-rose-100 dark:border-rose-500/10 shadow-sm transition-transform group-hover:rotate-6">
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
        <div className="hidden md:block overflow-hidden rounded-[2rem] border border-slate-100 dark:border-white/10 shadow-sm bg-white/50 dark:bg-slate-900/50">
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

// --- 3. Profesionales (Professionals) ---
interface ProfessionalDetailsViewProps {
  professional: Professional;
  properties: Property[];
  onBack: () => void;
  onDelete?: (id: string) => void;
  onEdit?: (pro: Professional) => void;
  onFinishMaintenance?: (property: Property) => void;
}

const ProfessionalDetailsView: React.FC<ProfessionalDetailsViewProps> = ({
  professional,
  properties,
  onBack,
  onDelete,
  onEdit,
  onFinishMaintenance
}) => {
  const activeAssignments = properties.filter(p => p.assignedProfessionalId === professional.id);
  const isBusy = activeAssignments.length > 0;
  const history = professional.reviews || [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
          aria-label="Volver"
        >
          <ChevronLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
        </button>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Ficha del Profesional</h2>
      </div>

      {/* Profile Card */}
      <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-white/10 p-6 md:p-8 relative overflow-hidden">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* Avatar */}
          <div className="shrink-0">
            <div className="w-24 h-24 md:w-28 md:h-28 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center text-4xl md:text-5xl font-bold text-white shadow-lg">
              {professional.name.charAt(0)}
            </div>
          </div>

          <div className="flex-grow space-y-4 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">{professional.name}</h3>
                <p className="text-lg text-indigo-600 dark:text-indigo-400 font-medium">{professional.profession}</p>
              </div>
              <span className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold ${
                isBusy
                  ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
                  : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
              }`}>
                {isBusy ? 'En obra' : 'Disponible'}
              </span>
            </div>

            <div className="flex flex-wrap gap-4 text-sm bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <MapPin className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                <span className="font-semibold">Zona:</span> {professional.zone}
              </div>
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <Phone className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                <span className="font-semibold">Contacto:</span> {professional.phone}
              </div>
            </div>

            {/* Ratings */}
            <div className="flex gap-6">
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 uppercase font-bold mb-1">Calidad</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">{professional.rating}</span>
                  <div className="flex text-yellow-400 text-sm">
                    {[...Array(5)].map((_, i) => (
                      <span key={i}>{i < Math.round(professional.rating) ? '★' : '☆'}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 uppercase font-bold mb-1">Rapidez</p>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">{professional.speedRating}/5</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 uppercase font-bold mb-1">Trabajos</p>
                <span className="text-2xl font-bold text-slate-900 dark:text-white">{history.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6 pt-6 border-t border-slate-100 dark:border-white/10">
          <button
            onClick={() => onEdit && onEdit(professional)}
            className="flex-1 bg-indigo-600 text-white py-3 px-6 rounded-xl font-bold hover:bg-indigo-700 flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-[1.02]"
          >
            <Edit className="w-4 h-4" /> Modificar
          </button>
          <a
            href={`tel:${professional.phone}`}
            className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-3 px-6 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center gap-2 transition-colors"
          >
            <Phone className="w-4 h-4" /> Llamar
          </a>
          {onDelete && (
            <button
              onClick={() => {
                if (isBusy) {
                  toast.error("No se puede eliminar un profesional con trabajos activos.");
                  return;
                }
                if (window.confirm(`¿Estás seguro que deseas eliminar a ${professional.name}?`)) {
                  onDelete(professional.id);
                  onBack();
                }
              }}
              disabled={isBusy}
              className={`py-3 px-6 rounded-xl font-bold border-2 flex items-center justify-center gap-2 transition-colors ${
                isBusy
                  ? 'border-slate-100 dark:border-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                  : 'border-red-200 dark:border-red-500/30 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10'
              }`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Active Jobs */}
      {isBusy && (
        <section>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Hammer className="w-5 h-5 text-amber-500" />
            Trabajo en Curso
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeAssignments.map(prop => (
              <div key={prop.id} className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-5 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 dark:text-white truncate">{prop.address}</p>
                  <p className="text-sm text-amber-800 dark:text-amber-400 italic truncate">"{prop.maintenanceTaskDescription}"</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Iniciado: {prop.professionalAssignedDate ? new Date(prop.professionalAssignedDate).toLocaleDateString() : '—'}
                  </p>
                </div>
                <div className="flex flex-col items-center gap-2 shrink-0 ml-4">
                  <ActiveJobIndicator property={prop} />
                  {onFinishMaintenance && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onFinishMaintenance(prop);
                      }}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
                    >
                      Finalizar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* History */}
      <section>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          Historial de Trabajos ({history.length})
        </h3>

        {history.length === 0 ? (
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-8 text-center text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-white/5">
            <p>No hay historial de trabajos registrados aún.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((review, idx) => (
              <div key={idx} className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl p-4 rounded-2xl border border-slate-200/50 dark:border-white/10 flex flex-col md:flex-row justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex text-yellow-400 text-sm">
                      {[...Array(5)].map((_, i) => (
                        <span key={i}>{i < review.rating ? '★' : '☆'}</span>
                      ))}
                    </div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{review.rating}.0</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">• {new Date(review.date).toLocaleDateString()}</span>
                  </div>
                  {review.comment && (
                    <p className="text-slate-600 dark:text-slate-300 text-sm italic truncate">"{review.comment}"</p>
                  )}
                </div>
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-medium shrink-0">
                  <CheckCircle className="w-3.5 h-3.5" /> Completado
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

interface ProfessionalsViewProps {
  properties?: Property[]; // Need to know which properties have assigned pros
  professionals?: Professional[];
  onAddProfessional?: () => void;
  onAssignProfessional?: (pro: Professional) => void;
  onDeleteProfessional?: (id: string) => void;
  onEditProfessional?: (pro: Professional) => void;
  onFinishMaintenance?: (property: Property) => void;
}

export const ProfessionalsView: React.FC<ProfessionalsViewProps> = ({
  properties = [],
  professionals = [],
  onAddProfessional,
  onAssignProfessional,
  onDeleteProfessional,
  onEditProfessional,
  onFinishMaintenance
}) => {
  const [selectedPro, setSelectedPro] = useState<Professional | null>(null);
  const { maintenanceTasks } = useDataContext();

  if (selectedPro) {
    return (
      <ProfessionalDetailsView
        professional={selectedPro}
        properties={properties}
        onBack={() => setSelectedPro(null)}
        onDelete={onDeleteProfessional}
        onEdit={onEditProfessional}
        onFinishMaintenance={onFinishMaintenance}
      />
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Agenda Profesionales</h2>
          <p className="text-slate-500 dark:text-slate-400">Gestión de proveedores de confianza</p>
        </div>
        {onAddProfessional && (
          <button
            onClick={onAddProfessional}
            className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 shadow-lg flex items-center gap-2 px-6 transition-all hover:scale-105"
          >
            <UserPlus className="w-5 h-5" />
            <span className="hidden md:inline font-semibold">Agregar Nuevo</span>
          </button>
        )}
      </header>

      {/* Grid of Professionals */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {professionals.map(pro => {
          const assignedProperty = properties.find(p => p.assignedProfessionalId === pro.id);
          const isBusy = !!assignedProperty;
          const completedJobs = maintenanceTasks.filter(t => t.professionalId === pro.id && t.status === TaskStatus.COMPLETED).length;

          return (
            <div
              key={pro.id}
              onClick={() => setSelectedPro(pro)}
              className={`
                bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl p-5 rounded-2xl overflow-hidden relative group
                hover:shadow-xl transition-all cursor-pointer border
                ${isBusy
                  ? 'border-amber-300 dark:border-amber-500/30 ring-1 ring-amber-200 dark:ring-amber-500/20'
                  : 'border-slate-200/50 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-500/30'
                }
              `}
            >
              {/* Top row: Avatar + Info + Status badge */}
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center text-xl font-bold text-white shadow-lg shrink-0">
                  {pro.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">{pro.name}</h3>
                  <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium truncate">{pro.profession}</p>
                </div>
                {/* Status Badge */}
                <span className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  isBusy
                    ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
                    : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                }`}>
                  {isBusy ? 'En obra' : 'Disponible'}
                </span>
              </div>

              {/* Stats row */}
              <div className="mt-4 flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  <span>{pro.zone}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-yellow-500">★</span>
                  <span className="font-bold text-slate-900 dark:text-white">{pro.rating}</span>
                  <span className="text-slate-400 dark:text-slate-500">/5</span>
                </div>
                {completedJobs > 0 && (
                  <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-xs">
                    <CheckCircle className="w-3 h-3" />
                    <span>{completedJobs} {completedJobs === 1 ? 'trabajo' : 'trabajos'}</span>
                  </div>
                )}
              </div>

              {/* Active job indicator */}
              {isBusy && assignedProperty && (
                <ActiveJobIndicator property={assignedProperty} onFinish={onFinishMaintenance} />
              )}

              {/* Action buttons */}
              <div className="mt-4 flex gap-2">
                <a
                  href={`tel:${pro.phone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-2 rounded-xl font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center gap-2 text-sm transition-colors"
                >
                  <Phone className="w-4 h-4" /> Llamar
                </a>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    !isBusy && onAssignProfessional && onAssignProfessional(pro);
                  }}
                  disabled={isBusy}
                  className={`flex-1 py-2 rounded-xl font-semibold text-sm transition-all ${
                    isBusy
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                      : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20'
                  }`}
                >
                  {isBusy ? 'Ocupado' : 'Asignar'}
                </button>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
};
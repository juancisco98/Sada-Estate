import React, { useState, useMemo } from 'react';
import { PropertyStatus, Professional, TaskStatus, Property, MaintenanceTask, PropertyType } from '../../types';
import { useDataContext } from '../../context/DataContext';
import {
  TrendingUp,
  Clock,
  Hammer,
  DollarSign,
  ChevronRight,
  Building2,
  Phone,
  MapPin,
  User,
  Home,
  CheckCircle,
  AlertCircle,
  Timer,
  Trash2,
  Edit
} from 'lucide-react';
import MaintenanceDetailsModal from '../MaintenanceDetailsModal';
import { formatCurrency } from '../../utils/currency';
import { getPropertyDisplayInfo } from '../../utils/property';
import { MAINTENANCE_BUDGET_RATIO } from '../../constants';
import { useMaintenanceTimer } from '../../hooks/useMaintenanceTimer';

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
              className={`p-3 rounded-2xl shadow-xs flex items-center gap-2 px-5 sm:px-7 transition-all min-h-[52px] font-bold ${isDeleteMode
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
                <div key={groupKey} className="bg-white dark:bg-slate-900 rounded-3xl shadow-xs border-2 border-violet-200 dark:border-violet-500/20 overflow-hidden">
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
                          return (
                            <div
                              key={unit.id}
                              onClick={() => onEditProperty && onEditProperty(unit)}
                              className="flex items-center gap-4 p-4 rounded-[2rem] hover:bg-indigo-500/10 dark:hover:bg-indigo-500/20 cursor-pointer group transition-all border border-transparent hover:border-indigo-100 dark:hover:border-indigo-500/40 hover:translate-x-2 active:scale-95 shadow-xs hover:shadow-indigo-500/10 overflow-hidden"
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
                                      if (onEditProperty) onEditProperty(unit);
                                    }}
                                    className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-xs border border-indigo-100 dark:border-white/5 flex items-center gap-1.5 text-[10px] font-bold whitespace-nowrap"
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
                    } else if (onEditProperty) {
                      onEditProperty(property);
                    }
                  }}
                  className={`
                  bg-white dark:bg-slate-900 rounded-3xl shadow-xs overflow-hidden transition-all duration-300 cursor-pointer relative group
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
                            <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold shadow-xs flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Moroso
                            </span>
                          );
                        }
                        if (property.status === PropertyStatus.WARNING) {
                          return (
                            <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold shadow-xs flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Revisar
                            </span>
                          );
                        }
                        return (
                          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold shadow-xs flex items-center gap-1">
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
                          <div className="text-xs text-orange-800 bg-white/50 rounded-sm px-2 py-1 italic border-l-2 border-orange-300">
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
                          <div className="w-8 h-8 bg-white dark:bg-white/10 rounded-full flex items-center justify-center text-slate-400 shadow-xs border border-slate-100 dark:border-white/10">
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
                            className="w-8 h-8 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all cursor-pointer shadow-xs border border-indigo-100 dark:border-indigo-500/20"
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
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-[2.5rem] p-6 border border-slate-100 dark:border-white/10 shadow-xs relative overflow-hidden group hover:shadow-xl hover:shadow-indigo-50/20 transition-all duration-500">
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
                  className={`h-full rounded-full transition-all duration-1000 ease-out shadow-xs ${progress > 90 ? 'bg-gradient-to-r from-rose-400 to-rose-600' :
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

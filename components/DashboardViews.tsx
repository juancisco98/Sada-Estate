// Force update
import React, { useState, useEffect, useMemo } from 'react';
import { PropertyStatus, Professional, TaskStatus, Property, MaintenanceTask, Building, TenantPayment, PropertyType } from '../types';
import { useDataContext } from '../context/DataContext';
import {
  TrendingUp,
  AlertTriangle,
  Clock,
  Hammer,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Building2,
  UserPlus,
  Phone,
  MapPin,
  Calendar,
  User,
  CheckCircle,
  AlertCircle,
  Timer,
  Trash2,
  Briefcase
} from 'lucide-react';
import FinancialDetailsCard from './FinancialDetailsCard';
import IncomeBreakdownPanel from './IncomeBreakdownPanel';
import ExpenseBreakdownModal from './ExpenseBreakdownModal';
import MaintenanceDetailsModal from './MaintenanceDetailsModal';

// --- Helper Functions ---
import { formatCurrency } from '../utils/currency';
import { MAINTENANCE_BUDGET_RATIO } from '../constants';
import { useMaintenanceTimer } from '../hooks/useMaintenanceTimer';

// --- Sub-component for Active Maintenance Label in Professionals View ---
const ActiveJobIndicator: React.FC<{ property: Property, onFinish?: (p: Property) => void }> = ({ property, onFinish }) => {
  const timer = useMaintenanceTimer(property.professionalAssignedDate);

  return (
    <div className="mt-2 bg-orange-100 border border-orange-200 rounded-lg p-2 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Hammer className="w-3 h-3 text-orange-600" />
          <span className="text-xs font-bold text-orange-800 truncate max-w-[100px]">{property.address}</span>
        </div>
        <div className="flex items-center gap-1">
          <Timer className="w-3 h-3 text-orange-600" />
          <span className="text-xs font-bold text-orange-800 tabular-nums">{timer}</span>
        </div>
      </div>
      {property.maintenanceTaskDescription && (
        <p className="text-[10px] text-orange-700 italic border-t border-orange-200 pt-1 mt-1 truncate">
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
    <div className="space-y-8 animate-in fade-in duration-500 pb-24">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Visión General</h2>
            <p className="text-gray-500 text-sm sm:text-base">Estado de mis propiedades y actividad reciente.</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap w-full sm:w-auto">
          {onDeleteProperty && (
            <button
              onClick={() => setIsDeleteMode(!isDeleteMode)}
              className={`p-3 rounded-full shadow-lg flex items-center gap-2 px-4 sm:px-6 transition-all min-h-[44px] ${isDeleteMode
                ? 'bg-red-600 text-white hover:bg-red-700 ring-2 ring-red-300'
                : 'bg-white text-red-600 border border-red-200 hover:bg-red-50'
                }`}
            >
              <Trash2 className="w-5 h-5" />
              <span className="hidden md:inline font-bold">
                {isDeleteMode ? 'Cancelar Eliminar' : 'Eliminar Propiedad'}
              </span>
            </button>
          )}
          {onAddProperty && !isDeleteMode && (
            <button
              onClick={onAddProperty}
              className="bg-gray-900 text-white p-3 rounded-full hover:bg-gray-800 shadow-lg flex items-center gap-2 px-4 sm:px-6 min-h-[44px]"
            >
              <span className="font-bold text-lg">+</span>
              <span className="font-semibold text-sm sm:text-base">Agregar</span>
            </button>
          )}
        </div>
      </header>

      {/* Category Filter Buttons */}
      <div className="flex gap-2 flex-wrap">
        {([
          { key: 'all' as const, label: 'Todas', icon: '📋', count: properties.length },
          { key: 'casa' as const, label: 'Casas', icon: '🏠', count: categorized.casas.length },
          { key: 'edificio' as const, label: 'Edificios', icon: '🏢', count: categorized.edificioGroups.length },
          { key: 'local' as const, label: 'Locales', icon: '🏪', count: categorized.locales.length },
        ]).map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`px-4 py-2.5 rounded-2xl font-bold text-sm flex items-center gap-2 transition-all min-h-[44px] ${
              activeCategory === cat.key
                ? 'bg-gray-900 text-white shadow-lg'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <span>{cat.icon}</span>
            {cat.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              activeCategory === cat.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
            }`}>{cat.count}</span>
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
                <div key={groupKey} className="bg-white rounded-3xl shadow-sm border-2 border-violet-200 overflow-hidden">
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
                    <h4 className="text-lg font-bold text-gray-900 mb-2">{firstUnit.address}</h4>
                    <div className="flex gap-2 flex-wrap mb-4">
                      <span className="text-xs bg-violet-50 text-violet-700 px-2.5 py-1 rounded-full font-bold border border-violet-200">
                        {units.length} {units.length === 1 ? 'unidad' : 'unidades'}
                      </span>
                      <span className="text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full font-bold border border-green-200">
                        {formatCurrency(totalRent, 'ARS')}/mes
                      </span>
                      {lateCount > 0 && (
                        <span className="text-xs bg-red-50 text-red-700 px-2.5 py-1 rounded-full font-bold border border-red-200">
                          {lateCount} moroso{lateCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {/* Unit list */}
                    <div className="space-y-1 max-h-[220px] overflow-y-auto">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Departamentos</p>
                      {units
                        .sort((a, b) => (a.unitLabel || '').localeCompare(b.unitLabel || ''))
                        .map(unit => {
                          const hasPro = !!unit.assignedProfessionalId;
                          return (
                            <div
                              key={unit.id}
                              onClick={() => onEditProperty && onEditProperty(unit)}
                              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 cursor-pointer group transition-colors"
                            >
                              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                hasPro ? 'bg-orange-500' :
                                unit.status === PropertyStatus.CURRENT ? 'bg-green-500' :
                                unit.status === PropertyStatus.LATE ? 'bg-red-500' : 'bg-yellow-400'
                              }`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-900 group-hover:text-violet-600 transition-colors">
                                  {unit.unitLabel || 'Unidad'}
                                </p>
                                <p className="text-xs text-gray-500 truncate">{unit.tenantName}</p>
                              </div>
                              <p className="text-sm font-bold text-gray-700 flex-shrink-0">{formatCurrency(unit.monthlyRent, 'ARS')}</p>
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
                  bg-white rounded-3xl shadow-sm overflow-hidden transition-all cursor-pointer relative group
                  ${isDeleteMode
                    ? 'border-4 border-red-500 ring-4 ring-red-100 scale-95 opacity-90 hover:opacity-100 hover:scale-100 animate-pulse'
                    : (isMaintenance ? 'border-4 border-orange-400 ring-4 ring-orange-100/30' : 'border border-gray-100 hover:border-blue-200 hover:shadow-lg')
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
                          e.stopPropagation();
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
                    {property.status === PropertyStatus.CURRENT && (
                      <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold shadow-sm flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Al día
                      </span>
                    )}
                    {property.status === PropertyStatus.LATE && (
                      <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold shadow-sm flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Moroso
                      </span>
                    )}
                    {property.status === PropertyStatus.WARNING && (
                      <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold shadow-sm flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Revisar
                      </span>
                    )}
                  </div>
                </div>

                {/* Info Content */}
                <div className="p-5">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{property.address}</h4>
                  </div>

                  {/* Active Maintenance Alert */}
                  {isMaintenance && maintenance && (
                    <div className="my-3 bg-orange-50 border border-orange-200 rounded-xl p-3 flex flex-col gap-2 animate-pulse">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="bg-orange-200 p-1.5 rounded-lg text-orange-700">
                            <Hammer className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs text-orange-600 font-bold uppercase">En Obra</p>
                            <p className="text-sm font-bold text-gray-900">{maintenance.pro?.name}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-orange-600 font-bold uppercase flex items-center justify-end gap-1">
                            <Timer className="w-3 h-3" /> Tiempo
                          </p>
                          <p className="text-lg font-bold text-gray-900 tabular-nums">
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

                  <div className="space-y-3">
                    {/* Tenant & Phone */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-gray-500 shadow-sm border border-gray-100">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase font-bold">Inquilino</p>
                          <p className="text-sm font-semibold text-gray-900">{property.tenantName}</p>
                        </div>
                      </div>
                      {property.tenantPhone && property.tenantPhone !== '-' && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent opening modal when clicking phone
                            window.location.href = `tel:${property.tenantPhone}`;
                          }}
                          className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center hover:bg-blue-200 transition-colors cursor-pointer"
                          aria-label={`Llamar al inquilino: ${property.tenantPhone}`}
                        >
                          <Phone className="w-5 h-5" />
                        </div>
                      )}
                    </div>

                    {/* Payment Date & Rent */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-gray-50 p-2 rounded-lg">
                        <p className="text-xs text-gray-400 uppercase font-bold">Cobro</p>
                        <p className="text-sm font-medium text-gray-700">Del 1 al 10</p>
                      </div>
                      <div className="bg-gray-50 p-2 rounded-lg">
                        <p className="text-xs text-gray-400 uppercase font-bold">Alquiler</p>
                        <div className="flex flex-col">
                          <p className="text-sm font-bold text-green-700">
                            {formatCurrency(property.monthlyRent, 'ARS')}
                          </p>
                        </div>
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

      {/* SECTION 2: Budget vs Expenses (KPI) */}
      <section className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-end mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Gastos vs. Presupuesto (Mensual)</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {formatCurrency(currentExpenses, 'ARS')} <span className="text-gray-400 text-lg font-normal">/ {formatCurrency(totalBudget, 'ARS')}</span>
            </p>
          </div>
          <div className="text-right">
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${progress > 90 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
              {Math.round(progress)}% del tope
            </span>
          </div>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
          <div
            className={`h-full rounded-full ${progress > 90 ? 'bg-red-500' : 'bg-blue-600'}`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          ></div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          El presupuesto de mantenimiento se calcula sobre el 15% del ingreso total de alquileres.
        </p>
      </section>


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
      p => p.month === i + 1 && p.year === selectedYear
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
    <div className="space-y-8 animate-in fade-in duration-500 pb-24 relative">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Bitácora Financiera</h2>
          <p className="text-gray-500">Ingresos anuales separados por moneda — Año {selectedYear}.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedYear(y => y - 1)}
            className="p-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
            aria-label="Año anterior"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="text-lg font-bold text-gray-900 tabular-nums w-16 text-center">{selectedYear}</span>
          <button
            onClick={() => setSelectedYear(y => y + 1)}
            disabled={selectedYear >= currentYear}
            className="p-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-30"
            aria-label="Año siguiente"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </header>

      {/* === SUMMARY CARDS === */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 col-span-2">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs font-bold uppercase">Ingreso Anual Total (ARS)</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(arsYearTotal, 'ARS')}</p>
          <p className="text-xs text-gray-400 mt-1">{properties.length} propiedad{properties.length !== 1 ? 'es' : ''}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-red-600 mb-1">
            <Hammer className="w-4 h-4" />
            <span className="text-xs font-bold uppercase">Gastos Anuales</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(annualExpensesARS, 'ARS')}</p>
          <p className="text-xs text-gray-400 mt-1">Mantenimiento y obras</p>
        </div>
        <div className="bg-gray-900 p-5 rounded-2xl shadow-lg text-white">
          <div className="flex items-center gap-2 text-blue-300 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-bold uppercase">Balance Neto ARS</span>
          </div>
          <p className={`text-2xl font-bold ${arsYearNet >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(arsYearNet, 'ARS')}
          </p>
          <p className="text-xs text-gray-500 mt-1">Ingresos − Gastos</p>
        </div>
      </section>

      {/* === MONTHLY GRID: ARS (Consolidated) === */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div
          onClick={() => setExpandedSection(expandedSection === 'ARS' ? null : 'ARS')}
          className="p-5 border-b border-gray-100 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span>
                Ingresos Mensuales
              </h3>
              <p className="text-xs text-gray-400 mt-1">Alquileres cobrados en pesos argentinos (ARS) por mes</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-gray-900">{formatCurrency(arsYearTotal, 'ARS')}</span>
            {expandedSection === 'ARS'
              ? <ChevronUp className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
              : <ChevronDown className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
            }
          </div>
        </div>
        <div className="grid grid-cols-6 md:grid-cols-12 divide-x divide-gray-100">
          {arsMonthly.map((amount, i) => {
            const isCurrent = i === new Date().getMonth() && selectedYear === currentYear;
            return (
              <div key={i} className={`p-3 text-center ${isCurrent ? 'bg-blue-50' : 'hover:bg-gray-50'} transition-colors`}>
                <p className={`text-[10px] uppercase font-bold ${isCurrent ? 'text-blue-600' : 'text-gray-400'}`}>{MONTH_NAMES[i]}</p>
                <p className={`text-sm font-bold mt-1 ${isCurrent ? 'text-blue-700' : 'text-gray-700'}`}>
                  {amount > 0 ? formatCurrency(amount, 'ARS') : '—'}
                </p>
              </div>
            );
          })}
        </div>
        {/* Expandable Breakdown */}
        {expandedSection === 'ARS' && (
          <IncomeBreakdownPanel properties={arsProperties} buildings={buildings} currency="ARS" />
        )}
      </section>

      {/* === MONTHLY GRID: GASTOS === */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span>
                Gastos Mensuales
              </h3>
              <p className="text-xs text-gray-400 mt-1">Mantenimiento y obras por mes — Haga clic en un mes para ver el detalle</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-gray-900">{formatCurrency(annualExpensesARS, 'ARS')}</span>
          </div>
        </div>
        <div className="grid grid-cols-6 md:grid-cols-12 divide-x divide-gray-100">
          {arsExpensesMonthly.map((amount, i) => {
            const isCurrent = i === new Date().getMonth() && selectedYear === currentYear;
            const hasExpenses = amount > 0;
            return (
              <div
                key={i}
                onClick={() => hasExpenses && setSelectedExpenseMonth(i)}
                className={`p-3 text-center transition-colors ${
                  isCurrent ? 'bg-red-50' : hasExpenses ? 'hover:bg-red-50 cursor-pointer' : 'hover:bg-gray-50'
                } ${hasExpenses ? 'cursor-pointer' : ''}`}
              >
                <p className={`text-[10px] uppercase font-bold ${isCurrent ? 'text-red-600' : 'text-gray-400'}`}>{MONTH_NAMES[i]}</p>
                <p className={`text-sm font-bold mt-1 ${amount > 0 ? (isCurrent ? 'text-red-700' : 'text-red-600') : 'text-gray-700'}`}>
                  {amount > 0 ? formatCurrency(amount, 'ARS') : '—'}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* === EXPENSE BREAKDOWN MODAL === */}
      {selectedExpenseMonth !== null && (
        <ExpenseBreakdownModal
          month={selectedExpenseMonth}
          year={selectedYear}
          maintenanceTasks={maintenanceTasks}
          properties={properties}
          professionals={professionals}
          onClose={() => setSelectedExpenseMonth(null)}
        />
      )}

      {/* === PROPERTY DETAIL TABLE === */}
      <section>
        <h3 className="text-xl font-bold text-gray-900 mb-4">Detalle por Inmueble</h3>
        <p className="text-xs text-gray-400 mb-4">Haga clic en una fila para ver el desglose detallado.</p>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="p-5 font-semibold">Propiedad / Inquilino</th>
                  {/* <th className="p-5 font-semibold">Moneda</th> - Removed */}
                  <th className="p-5 font-semibold">Estado</th>
                  <th className="p-5 font-semibold text-right text-green-700">Alquiler Mensual</th>
                  <th className="p-5 font-semibold text-right text-red-700">Gastos</th>
                  <th className="p-5 font-semibold text-right">Neto (ARS)</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {propertyFinancials.map(item => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedFinancialProperty(item)}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer group"
                  >
                    <td className="p-5">
                      <div className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{item.address}</div>
                      <div className="text-gray-500 text-xs">{item.tenantName}</div>
                    </td>
                    <td className="p-5">
                      {item.status === PropertyStatus.CURRENT && <span className="text-green-600 font-bold text-xs bg-green-100 px-2 py-1 rounded-full">Al Día</span>}
                      {item.status === PropertyStatus.LATE && <span className="text-red-600 font-bold text-xs bg-red-100 px-2 py-1 rounded-full">Moroso</span>}
                      {item.status === PropertyStatus.WARNING && <span className="text-yellow-700 font-bold text-xs bg-yellow-100 px-2 py-1 rounded-full">Atención</span>}
                    </td>
                    <td className="p-5 text-right font-medium text-gray-700">
                      <div>{formatCurrency(item.monthlyRent, 'ARS')}</div>
                    </td>
                    <td className="p-5 text-right font-medium text-red-600">
                      {item.expenses > 0 ? `- ${formatCurrency(item.expenses, 'ARS')}` : '—'}
                    </td>
                    <td className="p-5 text-right">
                      <span className={`font-bold ${item.netResult > 0 ? 'text-green-700' : 'text-red-600'}`}>
                        {formatCurrency(item.netResult, 'ARS')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-gray-50 p-5 flex justify-end gap-8 border-t border-gray-200">
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase">Total Gastos</p>
              <p className="font-bold text-red-600">{formatCurrency(annualExpensesARS, 'ARS')}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase">Balance Neto ARS</p>
              <p className={`font-bold text-lg ${arsYearNet >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {formatCurrency(arsYearNet, 'ARS')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Financial Detail Modal */}
      {selectedFinancialProperty && (
        <FinancialDetailsCard
          property={selectedFinancialProperty}
          maintenanceTasks={maintenanceTasks}
          professionals={professionals}
          onClose={handleCloseDetail}
        />
      )}
    </div>
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
  // 1. Current Assignments
  const activeAssignments = properties.filter(p => p.assignedProfessionalId === professional.id);
  const isBusy = activeAssignments.length > 0;

  // 2. Past History (Derived from reviews for now, as we don't have a separate completed tasks log in mock)
  const history = professional.reviews || [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          aria-label="Volver"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-2xl font-bold text-gray-900">Ficha del Profesional</h2>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 relative overflow-hidden">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Avatar & Basic Info */}
          <div className="flex-shrink-0">
            <div className="w-32 h-32 bg-gradient-to-br from-blue-100 to-blue-200 rounded-3xl flex items-center justify-center text-5xl font-bold text-blue-700 shadow-inner">
              {professional.name.charAt(0)}
            </div>
          </div>

          <div className="flex-grow space-y-4">
            <div>
              <h3 className="text-3xl font-bold text-gray-900">{professional.name}</h3>
              <p className="text-xl text-blue-600 font-medium">{professional.profession}</p>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-gray-600 bg-gray-50 p-4 rounded-xl">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="font-semibold">Zona:</span> {professional.zone}
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-400" />
                <span className="font-semibold">Contacto:</span> {professional.phone}
              </div>
            </div>

            <div className="flex gap-6">
              <div>
                <p className="text-xs text-gray-400 uppercase font-bold mb-1">Valoración General</p>
                <div className="flex items-center gap-1">
                  <span className="text-2xl font-bold text-gray-900">{professional.rating}</span>
                  <div className="flex text-yellow-400 text-sm">
                    {[...Array(5)].map((_, i) => (
                      <span key={i}>{i < Math.round(professional.rating) ? '★' : '☆'}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-bold mb-1">Rapidez</p>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-gray-400" />
                  <span className="text-2xl font-bold text-gray-900">{professional.speedRating}/5</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 min-w-[150px]">
            <button
              onClick={() => onEdit && onEdit(professional)}
              className="flex-1 bg-gray-900 text-white py-3 px-6 rounded-xl font-bold hover:bg-gray-800 flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-105"
            >
              <Briefcase className="w-5 h-5" /> Modificar
            </button>
            {onDelete && (
              <button
                onClick={() => {
                  if (isBusy) {
                    alert("No se puede eliminar un profesional con trabajos activos.");
                    return;
                  }
                  if (window.confirm(`¿Estás seguro que deseas eliminar a ${professional.name}?`)) {
                    onDelete(professional.id);
                    onBack();
                  }
                }}
                disabled={isBusy}
                className={`flex-1 py-3 px-6 rounded-xl font-bold border-2 flex items-center justify-center gap-2 transition-colors ${isBusy ? 'border-gray-100 text-gray-300 cursor-not-allowed' : 'border-red-100 text-red-500 hover:bg-red-50 hover:border-red-200'}`}
              >
                Eliminar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Active Jobs */}
      {isBusy && (
        <section>
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Hammer className="w-5 h-5 text-orange-500" />
            Trabajo en Curso
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeAssignments.map(prop => (
              <div key={prop.id} className="bg-orange-50 border border-orange-200 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-900">{prop.address}</p>
                  <p className="text-sm text-orange-800 italic">"{prop.maintenanceTaskDescription}"</p>
                  <p className="text-xs text-gray-500 mt-1">Iniciado: {prop.professionalAssignedDate ? new Date(prop.professionalAssignedDate).toLocaleDateString() : '—'}</p>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="h-10 w-10 bg-orange-100 rounded-full flex items-center justify-center">
                    <Timer className="w-5 h-5 text-orange-600" />
                  </div>
                  {onFinishMaintenance && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onFinishMaintenance(prop);
                      }}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold rounded-lg shadow-sm transition-colors"
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
        <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          Historial de Trabajos
        </h3>

        {history.length === 0 ? (
          <div className="bg-gray-50 rounded-2xl p-8 text-center text-gray-400">
            <p>No hay historial de trabajos registrados aún.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((review, idx) => (
              <div key={idx} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex text-yellow-400 text-sm">
                      {[...Array(5)].map((_, i) => (
                        <span key={i}>{i < review.rating ? '★' : '☆'}</span>
                      ))}
                    </div>
                    <span className="text-sm font-bold text-gray-900">{review.rating}.0</span>
                    <span className="text-xs text-gray-400">• {new Date(review.date).toLocaleDateString()}</span>
                  </div>
                  <p className="text-gray-700 italic">"{review.comment}"</p>
                </div>
                {/* Visual placeholder for job type or address if we had it in review object */}
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500" /> Completado
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
          <h2 className="text-3xl font-bold text-gray-900">Agenda Profesionales</h2>
          <p className="text-gray-500">Gestión de proveedores de confianza.</p>
        </div>
        {onAddProfessional && (
          <button
            onClick={onAddProfessional}
            className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 shadow-lg flex items-center gap-2 px-6"
          >
            <UserPlus className="w-5 h-5" />
            <span className="hidden md:inline font-semibold">Agregar Nuevo</span>
          </button>
        )}
      </header>

      {/* Grid of Professionals */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {professionals.map(pro => {
          // Check if this pro is currently assigned to a property
          const assignedProperty = properties.find(p => p.assignedProfessionalId === pro.id);
          const isBusy = !!assignedProperty;

          return (
            <div
              key={pro.id}
              onClick={() => setSelectedPro(pro)}
              className={`
                 bg-white p-6 rounded-3xl shadow-sm overflow-hidden relative group hover:shadow-lg transition-all cursor-pointer border border-gray-100
                 ${isBusy ? 'ring-2 ring-orange-100' : 'hover:border-blue-200'}
               `}
            >
              <div className="absolute top-6 right-6 flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className={`text-lg ${i < Math.round(pro.rating) ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                ))}
              </div>

              <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center text-2xl font-bold text-blue-700 mb-4">
                {pro.name.charAt(0)}
              </div>

              <h3 className="text-xl font-bold text-gray-900">{pro.name}</h3>
              <p className="text-blue-600 font-medium mb-4">{pro.profession}</p>

              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  Zona: {pro.zone}
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  Rapidez: {pro.speedRating}/5
                </div>
              </div>

              {/* Active Maintenance Indicator for Professionals */}
              {isBusy && (
                <ActiveJobIndicator property={assignedProperty} onFinish={onFinishMaintenance} />
              )}

              <div className="mt-6 flex gap-3">
                <button className="flex-1 bg-gray-50 text-gray-800 py-2 rounded-xl font-semibold hover:bg-gray-100 flex items-center justify-center gap-2">
                  <Phone className="w-4 h-4" /> Llamar
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    !isBusy && onAssignProfessional && onAssignProfessional(pro);
                  }}
                  disabled={isBusy}
                  className={`flex-1 py-2 rounded-xl font-semibold transition-colors ${isBusy ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
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
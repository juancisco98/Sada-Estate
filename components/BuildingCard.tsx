import React from 'react';
import { Building, Property, PropertyStatus } from '../types';
import { formatCurrency } from '../utils/currency';
import { getPropertyDisplayInfo } from '../utils/property';
import { ChevronRight, Building2, Users, DollarSign, Plus } from 'lucide-react';

interface BuildingCardProps {
  building: Building;
  units: Property[];
  onClose: () => void;
  onSelectUnit: (property: Property) => void;
  onAddUnit?: (building: Building) => void;
}

const getStatusDot = (status: PropertyStatus, hasProf: boolean) => {
  if (hasProf) return 'bg-orange-500';
  switch (status) {
    case PropertyStatus.CURRENT: return 'bg-green-500';
    case PropertyStatus.LATE: return 'bg-red-500';
    case PropertyStatus.WARNING: return 'bg-yellow-400';
    default: return 'bg-gray-400';
  }
};

const getStatusLabel = (status: PropertyStatus, hasProf: boolean) => {
  if (hasProf) return { text: 'En Obra', cls: 'bg-orange-100 text-orange-700' };
  switch (status) {
    case PropertyStatus.CURRENT: return { text: 'Al Día', cls: 'bg-green-100 text-green-700' };
    case PropertyStatus.LATE: return { text: 'Moroso', cls: 'bg-red-100 text-red-700' };
    case PropertyStatus.WARNING: return { text: 'Atención', cls: 'bg-yellow-100 text-yellow-800' };
    default: return { text: '—', cls: 'bg-gray-100 text-gray-500' };
  }
};

const BuildingCard: React.FC<BuildingCardProps> = ({
  building,
  units,
  onClose,
  onSelectUnit,
  onAddUnit
}) => {
  const totalRent = units.reduce((acc, p) => acc + p.monthlyRent, 0);
  const totalUnits = units.length;
  const lateCount = units.filter(u => u.status === PropertyStatus.LATE).length;
  const imageUrl = building.imageUrl || units.find(u => u.imageUrl)?.imageUrl;

  return (
    <div
      className="absolute bottom-24 left-4 right-4 md:left-auto md:right-8 md:bottom-8 md:w-[400px]
        max-h-[calc(100vh-200px)] overflow-y-auto
        bg-white/85 backdrop-blur-2xl rounded-[36px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-white/60
        z-[1000] animate-in slide-in-from-bottom-4 duration-300 p-3 transition-all duration-300"
    >
      {/* Header Image */}
      <div className="h-44 w-full relative rounded-[28px] overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt={building.address} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <Building2 className="w-16 h-16 text-white/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent"></div>

        <button
          onClick={onClose}
          className="absolute top-3 right-3 bg-black/20 hover:bg-black/40 backdrop-blur-md text-white p-2.5 rounded-full transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
          aria-label="Cerrar"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Address & badges - below image */}
      <div className="px-4 pt-4 pb-1">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="bg-violet-100 text-violet-700 text-[11px] font-bold px-3 py-1 rounded-full border border-violet-200">
            Edificio
          </span>
          {lateCount > 0 && (
            <span className="bg-red-100 text-red-700 text-[11px] font-bold px-3 py-1 rounded-full border border-red-200">
              {lateCount} Moroso{lateCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <h3 className="text-xl font-extrabold text-[#1f2937] leading-tight tracking-tight">{building.address}</h3>
      </div>

      {/* Summary Stats */}
      <div className="px-4 py-3 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 bg-violet-50/80 text-violet-700 px-3 py-1 rounded-full text-[11px] font-bold border border-violet-100">
          <Building2 className="w-3.5 h-3.5" />
          {totalUnits} {totalUnits === 1 ? 'unidad' : 'unidades'}
        </span>
        <span className="inline-flex items-center gap-1.5 bg-emerald-50/80 text-emerald-700 px-3 py-1 rounded-full text-[11px] font-bold border border-emerald-100">
          <DollarSign className="w-3.5 h-3.5" />
          {formatCurrency(totalRent, 'ARS')}
        </span>
        <span className="inline-flex items-center gap-1.5 bg-blue-50/80 text-blue-700 px-3 py-1 rounded-full text-[11px] font-bold border border-blue-100">
          <Users className="w-3.5 h-3.5" />
          {units.filter(u => u.tenantName).length} {totalUnits === 1 ? 'inquilino' : 'inquilinos'}
        </span>
      </div>

      {/* Unit List */}
      <div className="max-h-[260px] overflow-y-auto pr-1 pb-1 mt-2">
        <div className="px-4 py-2 flex items-center justify-between">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Departamentos</p>
          {onAddUnit && (
            <button
              onClick={() => onAddUnit(building)}
              className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-full border border-violet-200 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar Unidad
            </button>
          )}
        </div>
        <div className="px-3 pb-2 flex flex-col gap-2">
          {units
            .sort((a, b) => (a.unitLabel || '').localeCompare(b.unitLabel || ''))
            .map(unit => {
              const statusInfo = getStatusLabel(unit.status, !!unit.assignedProfessionalId);
              return (
                <button
                  key={unit.id}
                  onClick={() => onSelectUnit(unit)}
                  className="w-full flex items-center gap-3 p-3 rounded-[24px] bg-gray-50/50 hover:bg-white border border-gray-100 hover:shadow-md active:bg-gray-50 transition-all group text-left"
                >
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getStatusDot(unit.status, !!unit.assignedProfessionalId)} ring-4 ring-white shadow-sm`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-extrabold text-gray-900 group-hover:text-violet-600 transition-colors">
                        {getPropertyDisplayInfo(unit).title}
                      </p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-sm ${statusInfo.cls}`}>
                        {statusInfo.text}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 font-medium truncate" title={getPropertyDisplayInfo(unit).subtitle}>
                      {getPropertyDisplayInfo(unit).subtitle}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(unit.monthlyRent, 'ARS')}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-zinc-900 transition-colors flex-shrink-0" />
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
};

export default React.memo(BuildingCard);

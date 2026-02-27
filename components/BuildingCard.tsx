import React from 'react';
import { Building, Property, PropertyStatus } from '../types';
import { formatCurrency } from '../utils/currency';
import { Home, ChevronRight, Building2, Users, DollarSign } from 'lucide-react';

interface BuildingCardProps {
  building: Building;
  units: Property[];
  onClose: () => void;
  onSelectUnit: (property: Property) => void;
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
  onSelectUnit
}) => {
  const totalRent = units.reduce((acc, p) => acc + p.monthlyRent, 0);
  const totalUnits = units.length;
  const lateCount = units.filter(u => u.status === PropertyStatus.LATE).length;
  const imageUrl = building.imageUrl || units.find(u => u.imageUrl)?.imageUrl;

  return (
    <div
      className="absolute bottom-24 left-4 right-4 md:left-auto md:right-8 md:bottom-8 md:w-[420px]
        bg-white rounded-3xl shadow-2xl z-[1000] animate-in slide-in-from-bottom-4 duration-300 overflow-hidden
        transition-all duration-300"
      style={{
        borderTopWidth: '6px',
        borderTopColor: '#7c3aed',
        borderRightWidth: '1px', borderRightColor: '#f3f4f6',
        borderBottomWidth: '1px', borderBottomColor: '#f3f4f6',
        borderLeftWidth: '1px', borderLeftColor: '#f3f4f6',
      }}
    >
      {/* Header Image */}
      <div className="h-28 w-full relative">
        {imageUrl ? (
          <img src={imageUrl} alt={building.address} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <Building2 className="w-12 h-12 text-white/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/20"></div>

        <button
          onClick={onClose}
          className="absolute top-3 right-3 bg-black/30 hover:bg-black/50 backdrop-blur-md text-white p-2.5 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Cerrar"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Address & badges - below image */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="bg-violet-100 text-violet-700 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border border-violet-200">
            Edificio
          </span>
          {lateCount > 0 && (
            <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-red-200">
              {lateCount} moroso{lateCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <h3 className="text-lg font-bold text-gray-900 leading-snug">{building.address}</h3>
      </div>

      {/* Summary Stats */}
      <div className="px-5 py-3 flex items-center gap-2 border-b border-gray-100">
        <span className="inline-flex items-center gap-1.5 bg-violet-50 text-violet-700 px-3 py-1.5 rounded-full text-xs font-bold border border-violet-200">
          <Building2 className="w-3.5 h-3.5" />
          {totalUnits} {totalUnits === 1 ? 'unidad' : 'unidades'}
        </span>
        <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-bold border border-emerald-200">
          <DollarSign className="w-3.5 h-3.5" />
          {formatCurrency(totalRent, 'ARS')}
        </span>
        <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-xs font-bold border border-blue-200">
          <Users className="w-3.5 h-3.5" />
          {units.filter(u => u.tenantName).length} inquilinos
        </span>
      </div>

      {/* Unit List */}
      <div className="max-h-[280px] overflow-y-auto">
        <div className="px-3 py-2">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2 mb-1">Departamentos</p>
        </div>
        <div className="px-3 pb-3 space-y-1">
          {units
            .sort((a, b) => (a.unitLabel || '').localeCompare(b.unitLabel || ''))
            .map(unit => {
              const statusInfo = getStatusLabel(unit.status, !!unit.assignedProfessionalId);
              return (
                <button
                  key={unit.id}
                  onClick={() => onSelectUnit(unit)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 active:bg-gray-100 transition-all group text-left"
                >
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${getStatusDot(unit.status, !!unit.assignedProfessionalId)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-gray-900 group-hover:text-violet-600 transition-colors">
                        {unit.unitLabel || unit.tenantName || 'Unidad'}
                      </p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${statusInfo.cls}`}>
                        {statusInfo.text}
                      </span>
                    </div>
                    {unit.unitLabel && unit.tenantName && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {unit.tenantName}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(unit.monthlyRent, 'ARS')}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-violet-500 transition-colors flex-shrink-0" />
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
};

export default BuildingCard;

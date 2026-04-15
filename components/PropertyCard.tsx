import React, { useState, useEffect } from 'react';
import { Property, PropertyStatus, Professional, TenantPayment } from '../types';

import { formatCurrency } from '../utils/currency';
import { AlertCircle, CheckCircle, Clock, Pencil, StickyNote, Save, Hammer, Timer, CheckSquare, DollarSign, Trash2, ArrowLeft, User } from 'lucide-react';

interface PropertyCardProps {
  property: Property;
  allProperties: Property[]; // Added to calculate building metrics
  onClose: () => void;
  onViewDetails: () => void;
  onEdit?: (property: Property, isRestricted?: boolean) => void;
  onUpdateNote?: (id: string, note: string) => void;
  onFinishMaintenance?: (property: Property) => void;
  onDelete?: (id: string) => void;
  onBack?: () => void;
  professionals: Professional[];
  payments?: TenantPayment[];
}

const PropertyCard: React.FC<PropertyCardProps> = ({
  property,
  allProperties,
  onClose,
  onViewDetails,
  onEdit,
  onUpdateNote,
  onFinishMaintenance,
  onDelete,
  onBack,
  professionals,
  payments = []
}) => {
  const [noteText, setNoteText] = useState(property.notes || '');
  const [isDirty, setIsDirty] = useState(false);
  const [timeString, setTimeString] = useState<string>('');

  // Calculate building metrics if applicable
  const buildingMetrics = React.useMemo(() => {
    if (!property.buildingId) return null;

    const units = allProperties.filter(p => p.buildingId === property.buildingId);
    const totalRent = units.reduce((acc, p) => acc + p.monthlyRent, 0);
    const totalRooms = units.reduce((acc, p) => acc + (p.rooms || 0), 0);
    const totalM2 = units.reduce((acc, p) => acc + (p.squareMeters || 0), 0);
    const lateUnits = units.filter(p => p.status === PropertyStatus.LATE).length;

    return {
      totalRent,
      totalRooms,
      totalM2,
      lateUnits,
      unitCount: units.length
    };
  }, [property.buildingId, allProperties]);

  // Reset del textarea cuando cambia la propiedad o sus notas externas.
  // Prop-sync intencional: si cambia property.id o .notes, el borrador local se descarta.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setNoteText(property.notes || ''); setIsDirty(false); }, [property.id, property.notes]);

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNoteText(e.target.value);
    setIsDirty(true);
  };

  const saveNote = () => {
    if (onUpdateNote) {
      onUpdateNote(property.id, noteText);
      setIsDirty(false);
    }
  };

  const assignedProfessional = property.assignedProfessionalId
    ? professionals.find(p => p.id === property.assignedProfessionalId)
    : null;

  const isUnderMaintenance = !!assignedProfessional;

  // Real-time Timer Logic
  useEffect(() => {
    if (!isUnderMaintenance || !property.professionalAssignedDate) return;

    const calculateTime = () => {
      const start = new Date(property.professionalAssignedDate!);
      const now = new Date();
      const diffMs = now.getTime() - start.getTime();

      // If more than 24 hours, show days
      const oneDayMs = 1000 * 60 * 60 * 24;
      if (diffMs > oneDayMs) {
        const days = Math.floor(diffMs / oneDayMs);
        setTimeString(`${days} día${days > 1 ? 's' : ''}`);
      } else {
        // Show HH:MM:SS
        const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
        const seconds = Math.floor((diffMs / 1000) % 60);

        const pad = (n: number) => n.toString().padStart(2, '0');
        setTimeString(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
      }
    };

    calculateTime(); // Initial call
    const interval = setInterval(calculateTime, 1000); // Update every second

    return () => clearInterval(interval);
  }, [isUnderMaintenance, property.professionalAssignedDate]);

  const getStatusColor = (s: PropertyStatus) => {
    switch (s) {
      case PropertyStatus.CURRENT: return 'bg-green-100 text-green-700 border-green-200';
      case PropertyStatus.LATE: return 'bg-red-100 text-red-700 border-red-200';
      case PropertyStatus.WARNING: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getStatusIcon = (s: PropertyStatus) => {
    switch (s) {
      case PropertyStatus.CURRENT: return <CheckCircle className="w-5 h-5" />;
      case PropertyStatus.LATE: return <AlertCircle className="w-5 h-5" />;
      case PropertyStatus.WARNING: return <Clock className="w-5 h-5" />;
    }
  };

  const getStatusText = (s: PropertyStatus) => {
    // Check if there is a payment for current month
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const currentPayment = payments.find(p => p.propertyId === property.id && p.month === currentMonth && p.year === currentYear);

    if (currentPayment) {
      if (currentPayment.status === 'REVISION') return 'En Revisión';
      if (currentPayment.status === 'APPROVED' || (currentPayment.proofOfPayment && currentPayment.proofOfExpenses)) return 'Pagado';
    }

    switch (s) {
      case PropertyStatus.CURRENT: return 'Al Día';
      case PropertyStatus.LATE: return 'Moroso';
      case PropertyStatus.WARNING: return 'Atención';
    }
  };

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const currentPayment = payments.find(p => p.propertyId === property.id && p.month === currentMonth && p.year === currentYear);
  const isRevision = currentPayment?.status === 'REVISION';
  const isPaid = currentPayment?.status === 'APPROVED' || (currentPayment?.proofOfPayment && currentPayment?.proofOfExpenses);

  // Visual Differentiation Logic
  // const lastUser = property.lastModifiedBy ? MOCK_USERS.find(u => u.id === property.lastModifiedBy) : null;
  // const borderColor = lastUser ? lastUser.color : 'transparent';
  const borderColor = 'transparent';

  return (
    <div
      className={`
      absolute bottom-24 left-4 right-4 md:left-auto md:right-8 md:bottom-8 md:w-[420px]
      max-h-[calc(100vh-200px)] overflow-y-auto
      bg-white/90 dark:bg-slate-900/90 backdrop-blur-3xl rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-white/50 dark:border-white/10
      z-[1000] animate-in slide-in-from-bottom-6 duration-500
      ${isUnderMaintenance ? 'ring-4 ring-amber-100/50 dark:ring-amber-900/30' : 'ring-1 ring-black/5 dark:ring-white/5'}
      transition-all duration-300 p-3.5
    `}
      style={{
        borderTopWidth: '8px',
        borderTopColor: isUnderMaintenance ? '#f59e0b' : (borderColor !== 'transparent' ? borderColor : '#f3f4f6'),
      }}
    >
      {/* lastUser display removed */}

      {/* Property Image Header */}
      <div className="h-44 w-full relative rounded-[28px] overflow-hidden">
        <img src={property.imageUrl} alt={property.address} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent"></div>

        {onBack && (
          <button
            onClick={onBack}
            className="absolute top-3 left-3 bg-black/30 hover:bg-black/50 backdrop-blur-md text-white px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2 text-sm font-semibold min-h-[44px]"
            aria-label="Volver al edificio"
          >
            <ArrowLeft className="w-5 h-5" />
            Edificio
          </button>
        )}

        <div className="absolute top-3 right-3 flex gap-2">
          {onDelete && (
            <button
              onClick={() => {
                if (window.confirm(`¿Estás seguro de que deseas eliminar la propiedad "${property.address}"? Esta acción no se puede deshacer.`)) {
                  onDelete(property.id);
                  onClose();
                }
              }}
              className="bg-black/30 hover:bg-black/50 backdrop-blur-md text-white p-2.5 rounded-xl transition-colors flex items-center justify-center min-w-[44px] min-h-[44px]"
              title="Eliminar Propiedad"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}

          <button onClick={onClose} className="bg-black/20 hover:bg-black/40 backdrop-blur-md text-white p-2.5 rounded-full transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center" aria-label="Cerrar detalles">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Address & Status Badges */}
      <div className="px-4 pt-5 pb-2">
        <div className="flex flex-wrap gap-2 mb-3">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border shadow-sm ${isRevision ? 'bg-amber-100 text-amber-700 border-amber-200 animate-pulse' :
            isPaid ? 'bg-green-100 text-green-700 border-green-200' :
              getStatusColor(property.status)
            }`}>
            {isRevision ? <Clock className="w-5 h-5" /> : isPaid ? <CheckCircle className="w-5 h-5" /> : getStatusIcon(property.status)}
            <span>{getStatusText(property.status)}</span>
          </div>

          {/* Building Status Summary */}
          {buildingMetrics && buildingMetrics.lateUnits > 0 && (
            <div className="flex items-center gap-1.5 bg-red-100 text-red-700 px-3 py-1 rounded-full text-[11px] font-bold border border-red-200">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{buildingMetrics.lateUnits}/{buildingMetrics.unitCount} Morosos</span>
            </div>
          )}

          {/* Maintenance Badge */}
          {isUnderMaintenance && (
            <div className="flex items-center gap-1.5 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-[11px] font-bold border border-orange-200">
              <Hammer className="w-3.5 h-3.5" />
              <span>En Obra</span>
            </div>
          )}
        </div>

        <h3 className="text-xl font-extrabold text-[#1f2937] dark:text-white leading-tight tracking-tight">{property.address}</h3>

        {/* Compact Details Grid */}
        <div className="mt-3.5 grid grid-cols-3 gap-2 px-1">
          {/* Inquilino */}
          <div className="flex flex-col items-center justify-center aspect-square p-2 bg-slate-50/80 dark:bg-white/5 rounded-[32px] border border-slate-100/60 dark:border-white/5 transition-all hover:bg-indigo-500/5 dark:hover:bg-indigo-500/10 hover:border-indigo-500/20 dark:hover:border-indigo-500/30 hover:scale-[1.05] group/item text-center cursor-default">
            <div className="p-1.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl text-indigo-500 mb-1.5 group-hover/item:scale-110 group-hover/item:rotate-3 transition-all duration-300">
              <User className="w-3.5 h-3.5" />
            </div>
            <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1.5">Inquilino</p>
            <p className="text-[11px] text-slate-900 dark:text-white font-bold truncate w-full px-1" title={property.tenantName}>
              {property.tenantName || 'Vacante'}
            </p>
          </div>

          {/* Pago */}
          <div className="flex flex-col items-center justify-center aspect-square p-2 bg-slate-50/80 dark:bg-white/5 rounded-[32px] border border-slate-100/60 dark:border-white/5 transition-all hover:bg-amber-500/5 dark:hover:bg-amber-500/10 hover:border-amber-500/20 dark:hover:border-amber-500/30 hover:scale-[1.05] group/item text-center cursor-default">
            <div className="p-1.5 bg-amber-50 dark:bg-amber-500/10 rounded-2xl text-amber-500 mb-1.5 group-hover/item:scale-110 group-hover/item:-rotate-3 transition-all duration-300">
              <Clock className="w-3.5 h-3.5" />
            </div>
            <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1.5">Pago</p>
            <p className="text-[11px] text-slate-900 dark:text-white font-bold leading-none">1-10</p>
          </div>

          {/* Renta */}
          <div className="flex flex-col items-center justify-center aspect-square p-2 bg-slate-50/80 dark:bg-white/5 rounded-[32px] border border-slate-100/60 dark:border-white/5 transition-all hover:bg-emerald-500/5 dark:hover:bg-emerald-500/10 hover:border-emerald-500/20 dark:hover:border-emerald-500/30 hover:scale-[1.05] group/item text-center cursor-default">
            <div className="p-1.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl text-emerald-500 mb-1.5 group-hover/item:scale-110 group-hover/item:rotate-3 transition-all duration-300">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
            <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1.5">Renta</p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold leading-none">
              {(buildingMetrics ? buildingMetrics.totalRent : property.monthlyRent) >= 1000000
                ? `${((buildingMetrics ? buildingMetrics.totalRent : property.monthlyRent) / 1000000).toFixed(1)}M`
                : formatCurrency(buildingMetrics ? buildingMetrics.totalRent : property.monthlyRent, 'ARS').split(',')[0]}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4">

        {/* Maintenance Timer & Finish Button */}
        {isUnderMaintenance && (
          <div className="flex flex-col gap-2 mb-4">
            {/* Description of Task */}
            {property.maintenanceTaskDescription && (
              <div className="text-xs bg-orange-50 text-orange-800 p-2 rounded-lg border border-orange-100 italic">
                "{property.maintenanceTaskDescription}"
              </div>
            )}

            <div className="flex items-center gap-3 bg-orange-50 p-3 rounded-xl border border-orange-200 animate-pulse">
              <div className="p-2 bg-orange-200 rounded-lg text-orange-700">
                <Timer className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-orange-600 font-bold uppercase">Tiempo en marcha</p>
                <p className="text-lg font-bold text-gray-900 tabular-nums">{timeString || 'Calculando...'}</p>
              </div>
            </div>

            {onFinishMaintenance && (
              <button
                onClick={() => onFinishMaintenance(property)}
                className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-colors"
              >
                <CheckSquare className="w-4 h-4" /> Finalizar Obra & Calificar
              </button>
            )}
          </div>
        )}


        {/* Property Size Badges / Building Summary */}
        <div className="flex items-center gap-2 mb-4 mt-2">
          {buildingMetrics ? (
            <>
              <span className="inline-flex items-center gap-1 bg-violet-50/80 text-violet-700 px-3 py-1 rounded-full text-xs font-bold border border-violet-100">
                🏢 {buildingMetrics.unitCount} unidades
              </span>
              <span className="inline-flex items-center gap-1 bg-blue-50/80 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-100">
                🏠 {buildingMetrics.totalRooms} amb tot.
              </span>
              <span className="inline-flex items-center gap-1 bg-gray-50 text-gray-600 px-3 py-1 rounded-full text-xs font-bold border border-gray-200">
                📐 {buildingMetrics.totalM2} m²
              </span>
            </>
          ) : (
            <>
              {property.rooms && (
                <span className="inline-flex items-center gap-1 bg-blue-50/80 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-100">
                  🏠 {property.rooms} amb
                </span>
              )}
              {property.squareMeters && (
                <span className="inline-flex items-center gap-1 bg-gray-50 text-gray-600 px-3 py-1 rounded-full text-xs font-bold border border-gray-200">
                  📐 {property.squareMeters} m²
                </span>
              )}
            </>
          )}
        </div>


        <div className="bg-yellow-50/80 dark:bg-amber-900/20 backdrop-blur-sm p-4 rounded-3xl border border-yellow-200 dark:border-amber-500/10 mt-4 relative group">
          <div className="flex justify-between items-center mb-2 px-1">
            <div className="text-yellow-800 dark:text-amber-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <StickyNote className="w-3.5 h-3.5" /> Notas Rápidas
            </div>
            {isDirty && (
              <button
                onClick={saveNote}
                className="bg-yellow-400 dark:bg-amber-500 text-yellow-900 dark:text-amber-950 text-[10px] px-2.5 py-1 rounded-full font-black shadow-sm flex items-center gap-1 transform hover:scale-105 active:scale-95 transition-all"
              >
                <Save className="w-3 h-3" /> Guardar
              </button>
            )}
          </div>
          <textarea
            className="w-full bg-transparent border-none outline-none text-sm text-yellow-900 dark:text-amber-100 italic p-1 h-16 resize-none placeholder-yellow-800/40 dark:placeholder-amber-400/30"
            placeholder="Escribí aquí una nota recordatoria..."
            title="Nota de la propiedad"
            aria-label="Nota de la propiedad"
            value={noteText}
            onChange={handleNoteChange}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 px-4 pb-5 pt-2">
        {onViewDetails && (
          <button
            onClick={onViewDetails}
            className="flex-[2] bg-indigo-600 text-white h-[56px] rounded-2xl font-bold text-base hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none active:scale-95 flex items-center justify-center gap-3 group"
          >
            Ver Métricas
            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        )}

        {onEdit && (
          <button
            onClick={() => onEdit(property, !!property.buildingId)}
            className="w-[56px] h-[56px] rounded-2xl bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-slate-500 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all border border-slate-100 dark:border-white/5 shadow-sm active:scale-95 group"
            aria-label="Editar"
          >
            <Pencil className="w-5 h-5 group-hover:rotate-12 transition-transform" />
          </button>
        )}
      </div>
    </div>

  );
};

export default React.memo(PropertyCard);
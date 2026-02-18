import React, { useState, useEffect } from 'react';
import { Property, PropertyStatus } from '../types';
import { MOCK_PROFESSIONALS, MOCK_USERS } from '../constants';
import { getDualCurrencyAmounts, formatCurrency } from '../utils/currency';
import { Home, AlertCircle, CheckCircle, Clock, Pencil, StickyNote, Save, Hammer, Timer, CheckSquare, DollarSign, Trash2 } from 'lucide-react';

interface PropertyCardProps {
  property: Property;
  onClose: () => void;
  onViewDetails: () => void;
  onEdit?: (property: Property) => void;
  onUpdateNote?: (id: string, note: string) => void;
  onFinishMaintenance?: (property: Property) => void;
  onDelete?: (id: string) => void;
}

const PropertyCard: React.FC<PropertyCardProps> = ({
  property,
  onClose,
  onViewDetails,
  onEdit,
  onUpdateNote,
  onFinishMaintenance,
  onDelete
}) => {
  const [noteText, setNoteText] = useState(property.notes || '');
  const [isDirty, setIsDirty] = useState(false);
  const [timeString, setTimeString] = useState<string>('');

  useEffect(() => {
    setNoteText(property.notes || '');
    setIsDirty(false);
  }, [property.id, property.notes]);

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
    ? MOCK_PROFESSIONALS.find(p => p.id === property.assignedProfessionalId)
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
    switch (s) {
      case PropertyStatus.CURRENT: return 'Al Día';
      case PropertyStatus.LATE: return 'Moroso';
      case PropertyStatus.WARNING: return 'Atención';
    }
  };

  // Visual Differentiation Logic
  const lastUser = property.lastModifiedBy ? MOCK_USERS.find(u => u.id === property.lastModifiedBy) : null;
  const borderColor = lastUser ? lastUser.color : 'transparent';

  return (
    <div
      className={`
      absolute bottom-24 left-4 right-4 md:left-auto md:right-8 md:bottom-8 md:w-[420px] 
      bg-white rounded-3xl shadow-2xl z-[1000] animate-in slide-in-from-bottom-4 duration-300 overflow-hidden
      ${isUnderMaintenance ? 'ring-4 ring-orange-100/50' : ''}
      transition-all duration-300
    `}
      style={{
        borderTopWidth: '6px',
        borderTopColor: isUnderMaintenance ? '#fb923c' : (borderColor !== 'transparent' ? borderColor : '#f3f4f6'), // Orange-400 or User Color or Gray-100
        borderRightWidth: '1px', borderRightColor: '#f3f4f6',
        borderBottomWidth: '1px', borderBottomColor: '#f3f4f6',
        borderLeftWidth: '1px', borderLeftColor: '#f3f4f6',
      }}
    >
      {lastUser && (
        <div className="absolute top-0 right-0 bg-white/90 backdrop-blur px-2 py-0.5 rounded-bl-lg z-20 text-[10px] font-bold uppercase tracking-wider shadow-sm" style={{ color: lastUser.color }}>
          Modificado por: {lastUser.name}
        </div>
      )}

      {/* Property Image Header */}
      <div className="h-40 w-full relative">
        <img src={property.imageUrl} alt={property.address} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>

        <div className="absolute top-4 right-4 flex gap-2">
          {onDelete && (
            <button
              onClick={() => {
                if (window.confirm(`¿Estás seguro de que deseas eliminar la propiedad "${property.address}"? Esta acción no se puede deshacer.`)) {
                  onDelete(property.id);
                  onClose();
                }
              }}
              className="bg-red-500/20 hover:bg-red-500/40 backdrop-blur-md text-white p-1.5 rounded-full transition-colors flex items-center justify-center"
              title="Eliminar Propiedad"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}

          <button onClick={onClose} className="bg-white/20 hover:bg-white/40 backdrop-blur-md text-white p-1.5 rounded-full transition-colors" aria-label="Cerrar detalles">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="absolute bottom-4 left-6 text-white">
          <h3 className="text-2xl font-bold shadow-sm">{property.address}</h3>
          <p className="text-white/90 text-sm font-medium">{property.tenantName}</p>
        </div>
      </div>

      <div className="p-6">
        <div className="flex justify-between items-start mb-5">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(property.status)}`}>
            {getStatusIcon(property.status)}
            <span>{getStatusText(property.status)}</span>
          </div>

          {/* Maintenance Badge */}
          {isUnderMaintenance && (
            <div className="flex items-center gap-1.5 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold border border-orange-200">
              <Hammer className="w-3 h-3" />
              <span>En Obra: {assignedProfessional?.name}</span>
            </div>
          )}
        </div>

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


        {/* Property Size Badges */}
        {(property.rooms || property.squareMeters) && (
          <div className="flex items-center gap-2 mb-4">
            {property.rooms && (
              <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-200">
                🏠 {property.rooms} amb
              </span>
            )}
            {property.squareMeters && (
              <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-xs font-bold border border-purple-200">
                📐 {property.squareMeters} m²
              </span>
            )}
          </div>
        )}

        {/* Dual Currency Rent Display */}
        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex flex-col gap-1">
          <div className="flex justify-between items-center text-gray-700">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Home className="w-4 h-4 text-gray-400" /> Alquiler Mensual
            </span>
            <div className="text-right">
              {(() => {
                const amounts = getDualCurrencyAmounts(property.monthlyRent, property.currency || 'ARS');
                return (
                  <>
                    <div className="font-bold text-lg text-gray-900">
                      {formatCurrency(amounts.local, amounts.localCurrency)}
                    </div>
                    {amounts.localCurrency !== 'USD' && (
                      <div className="text-xs text-green-600 font-bold">
                        {formatCurrency(amounts.usd, 'USD')}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>


        </div>
        <div className="bg-yellow-50 p-2 rounded-xl border border-yellow-200 mt-4 relative group">
          <div className="flex justify-between items-center mb-1 px-1">
            <div className="text-yellow-800 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
              <StickyNote className="w-3 h-3" /> Notas Rápidas
            </div>
            {isDirty && (
              <button
                onClick={saveNote}
                className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900 text-xs px-2 py-1 rounded-md font-bold shadow-sm flex items-center gap-1 transition-all"
              >
                <Save className="w-3 h-3" /> Guardar
              </button>
            )}
          </div>
          <textarea
            className="w-full bg-transparent border-none outline-none text-sm text-gray-800 italic p-1 h-16 resize-none placeholder-yellow-800/50"
            placeholder="Escribí aquí una nota recordatoria..."
            title="Nota de la propiedad"
            aria-label="Nota de la propiedad"
            value={noteText}
            onChange={handleNoteChange}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {onEdit && (
          <button
            onClick={() => onEdit(property)}
            className="w-full bg-gray-100 text-gray-700 py-4 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
          >
            <Pencil className="w-4 h-4" /> Editar
          </button>
        )}
        <button
          onClick={onViewDetails}
          className={`w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors shadow-md active:scale-[0.98] ${!onEdit ? 'col-span-2' : ''}`}
        >
          Ver Métricas
        </button>
      </div>
    </div>

  );
};

export default PropertyCard;
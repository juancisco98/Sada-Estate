import React, { useState, useMemo } from 'react';
import { Professional, TaskStatus, Property } from '../../types';
import { toast } from 'sonner';
import { useDataContext } from '../../context/DataContext';
import {
  Clock,
  Hammer,
  ChevronLeft,
  UserPlus,
  Phone,
  MapPin,
  CheckCircle,
  Timer,
  Trash2,
  Edit
} from 'lucide-react';
import { useMaintenanceTimer } from '../../hooks/useMaintenanceTimer';

// --- Sub-component for Active Maintenance Label in Professionals View ---
const ActiveJobIndicator: React.FC<{ property: Property, onFinish?: (p: Property) => void }> = ({ property }) => {
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
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
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

  // Índices precomputados: evita un properties.find() + maintenanceTasks.filter()
  // por cada profesional dentro del .map() de la grilla (Lección 13).
  const assignedPropByPro = useMemo(() => {
    const map = new Map<string, Property>();
    for (const p of properties) {
      if (p.assignedProfessionalId && !map.has(p.assignedProfessionalId)) {
        map.set(p.assignedProfessionalId, p); // primer match, igual que .find()
      }
    }
    return map;
  }, [properties]);

  const completedJobsByPro = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of maintenanceTasks) {
      if (t.status === TaskStatus.COMPLETED && t.professionalId) {
        map.set(t.professionalId, (map.get(t.professionalId) ?? 0) + 1);
      }
    }
    return map;
  }, [maintenanceTasks]);

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
          const assignedProperty = assignedPropByPro.get(pro.id);
          const isBusy = !!assignedProperty;
          const completedJobs = completedJobsByPro.get(pro.id) ?? 0;

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
                    if (!isBusy && onAssignProfessional) onAssignProfessional(pro);
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

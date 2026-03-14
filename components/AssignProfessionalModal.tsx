import React, { useState } from 'react';
import { X, Home, Hammer, CheckCircle } from 'lucide-react';
import { Property, Professional } from '../types';
import { toast } from 'sonner';

interface AssignProfessionalModalProps {
  professional: Professional;
  properties: Property[];
  onClose: () => void;
  onConfirm: (propertyId: string, taskDescription: string) => void;
}

const AssignProfessionalModal: React.FC<AssignProfessionalModalProps> = ({
  professional,
  properties,
  onClose,
  onConfirm
}) => {
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [taskDescription, setTaskDescription] = useState('');

  const availableProperties = properties.filter(p => !p.assignedProfessionalId);

  const handleSubmit = () => {
    if (!selectedPropertyId) {
      toast.error("Debes seleccionar una propiedad.");
      return;
    }
    if (!taskDescription.trim()) {
      toast.error("Debes indicar qué tarea realizará el profesional.");
      return;
    }
    onConfirm(selectedPropertyId, taskDescription);
  };

  return (
    <div className="fixed inset-0 z-[1300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col border dark:border-white/10 max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 border-b border-slate-100 dark:border-white/10 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Asignar Profesional</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Vinculando a: <b className="text-indigo-600 dark:text-indigo-400">{professional.name}</b></p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {availableProperties.length === 0 ? (
            <div className="text-center p-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-white/10">
              <p>No tienes propiedades libres para asignar actualmente.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Home className="w-4 h-4" /> Seleccionar Propiedad
                </label>
                <select
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                  value={selectedPropertyId}
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                >
                  <option value="">-- Elegir Inmueble --</option>
                  {availableProperties.map(p => (
                    <option key={p.id} value={p.id}>{p.address} ({p.tenantName})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Hammer className="w-4 h-4" /> Descripción de la Tarea
                </label>
                <textarea
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-24 placeholder-slate-400 dark:placeholder-slate-500"
                  placeholder="Ej: Revisión de estufa y calefón por pérdida..."
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                />
              </div>

              <button
                onClick={handleSubmit}
                className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg flex items-center justify-center gap-2 transition-all"
              >
                <CheckCircle className="w-5 h-5" /> Confirmar Asignación
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssignProfessionalModal;

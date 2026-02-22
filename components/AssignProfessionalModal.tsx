import React, { useState } from 'react';
import { X, Home, Hammer, CheckCircle } from 'lucide-react';
import { Property, Professional } from '../types';

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

  // Filter properties that are currently NOT under maintenance
  const availableProperties = properties.filter(p => !p.assignedProfessionalId);

  const handleSubmit = () => {
    if (!selectedPropertyId) {
      alert("Debes seleccionar una propiedad.");
      return;
    }
    if (!taskDescription.trim()) {
      alert("Debes indicar qué tarea realizará el profesional.");
      return;
    }
    onConfirm(selectedPropertyId, taskDescription);
  };

  return (
    <div className="fixed inset-0 z-[1300] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        <div className="bg-orange-50 p-6 border-b border-orange-100 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-orange-900">Asignar Profesional</h2>
            <p className="text-sm text-orange-700 mt-1">Vinculando a: <b>{professional.name}</b></p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-orange-100 rounded-full text-orange-700 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {availableProperties.length === 0 ? (
            <div className="text-center p-4 bg-gray-50 rounded-xl text-gray-500">
              <p>No tienes propiedades libres para asignar actualmente.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Home className="w-4 h-4" /> Seleccionar Propiedad
                </label>
                <select
                  className="w-full p-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-orange-400 outline-none appearance-none"
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
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Hammer className="w-4 h-4" /> Descripción de la Tarea
                </label>
                <textarea
                  className="w-full p-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-orange-400 outline-none resize-none h-24 placeholder-gray-400"
                  placeholder="Ej: Revisión de estufa y calefón por pérdida..."
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                />
              </div>

              <button
                onClick={handleSubmit}
                className="w-full py-3 rounded-xl bg-gray-900 text-white font-bold hover:bg-gray-800 shadow-lg flex items-center justify-center gap-2"
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
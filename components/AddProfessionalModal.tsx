import React, { useState } from 'react';
import { X, User, Phone, MapPin, Briefcase, Save } from 'lucide-react';
import { Professional } from '../types';

interface AddProfessionalModalProps {
  onClose: () => void;
  onSave: (pro: Professional) => void;
  existingProfessional?: Professional | null;
}

const AddProfessionalModal: React.FC<AddProfessionalModalProps> = ({ onClose, onSave, existingProfessional }) => {
  const [formData, setFormData] = useState({
    name: existingProfessional?.name || '',
    profession: existingProfessional?.profession || '',
    phone: existingProfessional?.phone || '',
    zone: existingProfessional?.zone || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.profession) {
      alert("Nombre y Profesión son obligatorios");
      return;
    }

    const newPro: Professional = {
      id: existingProfessional?.id || `new-${Date.now()}`,
      name: formData.name,
      profession: formData.profession,
      phone: formData.phone || '-',
      zone: formData.zone || 'CABA',
      rating: existingProfessional?.rating || 5.0, // Preserve rating or default to 5
      speedRating: existingProfessional?.speedRating || 5.0,
      reviews: existingProfessional?.reviews // Preserve reviews
    };

    onSave(newPro);
  };

  return (
    <div className="fixed inset-0 z-[1300] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-blue-50 p-6 border-b border-blue-100 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-blue-900">{existingProfessional ? 'Editar Profesional' : 'Nuevo Profesional'}</h2>
            <p className="text-sm text-blue-600 mt-1">{existingProfessional ? 'Modificar datos del profesional' : 'Agregar a la agenda de confianza'}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-blue-100 rounded-full text-blue-700 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Nombre</label>
            <div className="relative">
              <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Ej: Mario Gomez"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Profesión / Rubro</label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Ej: Gasista Matriculado"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.profession}
                onChange={e => setFormData({ ...formData, profession: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Teléfono</label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="tel"
                  placeholder="11-XXXX..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Zona</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Ej: Palermo"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.zone}
                  onChange={e => setFormData({ ...formData, zone: e.target.value })}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-gray-900 text-white font-bold hover:bg-gray-800 shadow-lg flex items-center justify-center gap-2 mt-4"
          >
            <Save className="w-5 h-5" /> Guardar Profesional
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddProfessionalModal;
import React, { useState } from 'react';
import { X, User, Phone, MapPin, Briefcase, Save } from 'lucide-react';
import { Professional } from '../types';
import { toast } from 'sonner';

const generateUUID = (): string =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });

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
      toast.error("Nombre y Profesión son obligatorios");
      return;
    }

    const newPro: Professional = {
      id: existingProfessional?.id || generateUUID(),
      name: formData.name,
      profession: formData.profession,
      phone: formData.phone || '-',
      zone: formData.zone || 'CABA',
      rating: existingProfessional?.rating || 5.0,
      speedRating: existingProfessional?.speedRating || 5.0,
      reviews: existingProfessional?.reviews
    };

    onSave(newPro);
  };

  return (
    <div className="fixed inset-0 z-[1300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col border dark:border-white/10 max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 border-b border-slate-100 dark:border-white/10 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{existingProfessional ? 'Editar Profesional' : 'Nuevo Profesional'}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{existingProfessional ? 'Modificar datos del profesional' : 'Agregar a la agenda de confianza'}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nombre</label>
            <div className="relative">
              <User className="absolute left-3 top-3 w-5 h-5 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Ej: Mario Gomez"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none placeholder-slate-400 dark:placeholder-slate-500"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Profesión / Rubro</label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-3 w-5 h-5 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Ej: Gasista Matriculado"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none placeholder-slate-400 dark:placeholder-slate-500"
                value={formData.profession}
                onChange={e => setFormData({ ...formData, profession: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Teléfono</label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 w-5 h-5 text-slate-400 dark:text-slate-500" />
                <input
                  type="tel"
                  placeholder="11-XXXX..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none placeholder-slate-400 dark:placeholder-slate-500"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Zona</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-5 h-5 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Ej: Palermo"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none placeholder-slate-400 dark:placeholder-slate-500"
                  value={formData.zone}
                  onChange={e => setFormData({ ...formData, zone: e.target.value })}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg flex items-center justify-center gap-2 mt-4 transition-all"
          >
            <Save className="w-5 h-5" /> Guardar Profesional
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddProfessionalModal;

import React from 'react';
import { Property } from '../../types';
import { X } from 'lucide-react';
import { NewTenantForm } from './shared';

interface AddTenantModalProps {
    editingTenantId: string | null;
    newTenant: NewTenantForm;
    setNewTenant: React.Dispatch<React.SetStateAction<NewTenantForm>>;
    assignableProperties: Property[];
    onClose: () => void;
    onSubmit: () => void;
}

const AddTenantModal: React.FC<AddTenantModalProps> = ({
    editingTenantId,
    newTenant,
    setNewTenant,
    assignableProperties,
    onClose,
    onSubmit,
}) => {
    return (
        <div
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"></div>
            <div
                className="bg-white dark:bg-slate-950 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in scale-95 duration-200 relative border border-white dark:border-white/10"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-slate-900/50 shrink-0">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                        {editingTenantId ? 'Editar Inquilino' : 'Nuevo Inquilino'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X size={20} className="text-gray-500 dark:text-gray-400" />
                    </button>
                </div>

                <div className="p-6 space-y-4 overflow-y-auto">
                    <div className="space-y-1">
                        <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">Nombre *</label>
                        <input
                            value={newTenant.name}
                            onChange={e => setNewTenant(p => ({ ...p, name: e.target.value }))}
                            placeholder="Nombre completo"
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-800 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-hidden transition-all"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">Teléfono</label>
                        <input
                            value={newTenant.phone}
                            onChange={e => setNewTenant(p => ({ ...p, phone: e.target.value }))}
                            placeholder="11-1234-5678"
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-800 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-hidden transition-all"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">Email</label>
                        <input
                            value={newTenant.email}
                            onChange={e => setNewTenant(p => ({ ...p, email: e.target.value }))}
                            placeholder="email@ejemplo.com"
                            type="email"
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-800 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-hidden transition-all"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">Asignar a Inmueble (opcional)</label>
                        <select
                            value={newTenant.propertyId}
                            onChange={e => setNewTenant(p => ({ ...p, propertyId: e.target.value }))}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 focus:ring-2 focus:ring-blue-500 outline-hidden transition-all bg-white dark:bg-slate-800 text-gray-800 dark:text-white"
                        >
                            <option value="">Sin asignar</option>
                            {assignableProperties.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.unitLabel ? `${p.address} - ${p.unitLabel}` : p.address}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="p-6 pt-0 shrink-0">
                    <button
                        onClick={onSubmit}
                        disabled={!newTenant.name.trim()}
                        className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all active:scale-[0.98] ${newTenant.name.trim() ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30' : 'bg-gray-300 cursor-not-allowed shadow-none'}`}
                    >
                        {editingTenantId ? 'Guardar Cambios' : 'Agregar Inquilino'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddTenantModal;

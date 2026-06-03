import React, { useState } from 'react';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { Tenant, Property } from '../../types';
import { useDataContext } from '../../context/DataContext';
import { supabase } from '../../services/supabaseClient';

interface EditTenantProfileModalProps {
    tenant: Tenant;
    property: Property | null;
    onClose: () => void;
}

// Modal para que el admin de expensas edite el nombre del inquilino y su
// departamento (unit_label). Escribe en tenants + properties y actualiza el
// estado global. Detecta bloqueo RLS (UPDATE que afecta 0 filas).
const EditTenantProfileModal: React.FC<EditTenantProfileModalProps> = ({ tenant, property, onClose }) => {
    const { setTenants, setProperties } = useDataContext();
    const [editName, setEditName] = useState(tenant.name);
    const [editUnit, setEditUnit] = useState(property?.unitLabel ?? '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        const name = editName.trim();
        if (!name) { toast.error('El nombre no puede estar vacío.'); return; }
        const unit = editUnit.trim();
        const nameChanged = name !== tenant.name;
        const unitChanged = !!property && unit !== (property.unitLabel ?? '');
        if (!nameChanged && !unitChanged) { onClose(); return; }

        setSaving(true);
        try {
            // Nombre del inquilino → tabla tenants
            if (nameChanged) {
                const { data, error } = await supabase
                    .from('tenants')
                    .update({ name })
                    .eq('id', tenant.id)
                    .select();
                if (error) throw error;
                // RLS bloqueado: UPDATE no falla, solo afecta 0 filas.
                if (!data || data.length === 0) {
                    throw new Error('No se actualizó ningún registro — falta permiso (RLS) para editar inquilinos.');
                }
                setTenants(prev => prev.map(t => (t.id === tenant.id ? { ...t, name } : t)));
            }
            // Departamento → tabla properties (unit_label)
            if (unitChanged && property) {
                const { data, error } = await supabase
                    .from('properties')
                    .update({ unit_label: unit })
                    .eq('id', property.id)
                    .select();
                if (error) throw error;
                if (!data || data.length === 0) {
                    throw new Error('No se actualizó la propiedad — falta permiso (RLS) para editar el departamento.');
                }
                setProperties(prev => prev.map(p => (p.id === property.id ? { ...p, unitLabel: unit } : p)));
            }
            toast.success('Datos del inquilino actualizados.');
            onClose();
        } catch (error: any) {
            // No cerrar el modal: dejar reintentar (convención CLAUDE.md).
            toast.error(`Error al guardar: ${error?.message || 'Error desconocido'}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => !saving && onClose()}
        >
            <div
                className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md flex flex-col max-h-[90vh] border border-slate-100 dark:border-white/10"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/10 shrink-0">
                    <h3 className="text-base font-bold text-slate-800 dark:text-white">Editar inquilino</h3>
                    <button
                        onClick={onClose}
                        disabled={saving}
                        aria-label="Cerrar"
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors disabled:opacity-50"
                    >
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto flex-1 p-5 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                            Nombre del inquilino
                        </label>
                        <input
                            type="text"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            autoFocus
                            placeholder="Ej: Juan Pérez"
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                            Departamento
                        </label>
                        <input
                            type="text"
                            value={editUnit}
                            onChange={e => setEditUnit(e.target.value)}
                            disabled={!property}
                            placeholder="Ej: 3°B"
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        {!property && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5">
                                Este inquilino no tiene una propiedad asociada — no se puede asignar departamento.
                            </p>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-slate-100 dark:border-white/10 shrink-0 flex items-center justify-end gap-2">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-1.5 text-xs font-semibold text-white bg-slate-600 hover:bg-slate-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:cursor-not-allowed px-4 py-2 rounded-xl transition-colors"
                    >
                        {saving && (
                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        )}
                        Guardar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditTenantProfileModal;

import React, { useState } from 'react';
import { X, Bell, Calendar, Link, Save } from 'lucide-react';
import { Property, Tenant, Professional, MaintenanceTask, ReminderEntityType } from '../types';
import { toast } from 'sonner';

interface AddReminderModalProps {
    onClose: () => void;
    onSave: (data: { title: string; description?: string; dueDate: string; entityType?: ReminderEntityType; entityId?: string }) => Promise<void>;
    properties: Property[];
    tenants: Tenant[];
    professionals: Professional[];
    maintenanceTasks: MaintenanceTask[];
    defaultEntityType?: ReminderEntityType;
    defaultEntityId?: string;
    defaultTitle?: string;
}

const AddReminderModal: React.FC<AddReminderModalProps> = ({
    onClose, onSave, properties, tenants, professionals, maintenanceTasks,
    defaultEntityType, defaultEntityId, defaultTitle
}) => {
    const [title, setTitle] = useState(defaultTitle || '');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [entityType, setEntityType] = useState<ReminderEntityType | ''>(defaultEntityType || '');
    const [entityId, setEntityId] = useState(defaultEntityId || '');
    const [saving, setSaving] = useState(false);

    const entityOptions = entityType === 'property'
        ? properties.map(p => ({ id: p.id, label: `${p.address} (${p.tenantName || 'Vacante'})` }))
        : entityType === 'tenant'
            ? tenants.map(t => ({ id: t.id, label: t.name }))
            : entityType === 'professional'
                ? professionals.map(p => ({ id: p.id, label: `${p.name} — ${p.profession}` }))
                : entityType === 'maintenance_task'
                    ? maintenanceTasks.filter(t => t.status !== 'COMPLETED').map(t => ({ id: t.id, label: t.description.slice(0, 50) }))
                    : [];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) { toast.error('El título es obligatorio'); return; }
        if (!dueDate) { toast.error('La fecha es obligatoria'); return; }

        setSaving(true);
        try {
            await onSave({
                title: title.trim(),
                description: description.trim() || undefined,
                dueDate: new Date(dueDate + 'T12:00:00').toISOString(),
                entityType: entityType || undefined,
                entityId: entityId || undefined,
            });
            toast.success('Recordatorio creado');
            onClose();
        } catch (error: any) {
            toast.error(`Error: ${error?.message || 'Error desconocido'}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[1300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col border dark:border-white/10 max-h-[90vh]">
                {/* Header */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 border-b border-slate-100 dark:border-white/10 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Bell className="w-5 h-5 text-indigo-500" /> Nuevo Recordatorio
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Crear recordatorio manual</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
                    {/* Title */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Título</label>
                        <input
                            type="text"
                            placeholder="Ej: Cobrar a Mario Gomez"
                            className="w-full p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none placeholder-slate-400 dark:placeholder-slate-500"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            autoFocus
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Descripción (opcional)</label>
                        <textarea
                            placeholder="Detalles adicionales..."
                            className="w-full p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-20 placeholder-slate-400 dark:placeholder-slate-500"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        />
                    </div>

                    {/* Due Date */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Calendar className="w-4 h-4" /> Fecha
                        </label>
                        <input
                            type="date"
                            className="w-full p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={dueDate}
                            onChange={e => setDueDate(e.target.value)}
                        />
                    </div>

                    {/* Entity Type */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Link className="w-4 h-4" /> Vincular a (opcional)
                        </label>
                        <select
                            className="w-full p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                            value={entityType}
                            onChange={e => { setEntityType(e.target.value as ReminderEntityType | ''); setEntityId(''); }}
                        >
                            <option value="">Sin vincular</option>
                            <option value="property">Propiedad</option>
                            <option value="tenant">Inquilino</option>
                            <option value="professional">Profesional</option>
                            <option value="maintenance_task">Tarea de mantenimiento</option>
                        </select>
                    </div>

                    {/* Entity Selector */}
                    {entityType && entityOptions.length > 0 && (
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Seleccionar</label>
                            <select
                                className="w-full p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                                value={entityId}
                                onChange={e => setEntityId(e.target.value)}
                            >
                                <option value="">-- Elegir --</option>
                                {entityOptions.map(opt => (
                                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg flex items-center justify-center gap-2 mt-4 transition-all disabled:opacity-50"
                    >
                        <Save className="w-5 h-5" /> {saving ? 'Guardando...' : 'Crear Recordatorio'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AddReminderModal;

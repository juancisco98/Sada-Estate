import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '../services/supabaseClient';
import { ExpensesAdmin } from '../types';
import { UserPlus, UserMinus, Shield, Clock, Mail, User, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

// UUID v4 generator (HTTP-safe)
const generateUUID = (): string =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });

const AdminSettings: React.FC = () => {
    const [admins, setAdmins] = useState<ExpensesAdmin[]>([]);
    const [loading, setLoading] = useState(true);

    // Form state
    const [showAddForm, setShowAddForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Deactivation confirm
    const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

    // Load all expenses admins
    useEffect(() => {
        const fetchAdmins = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('expenses_admins')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) throw error;

                setAdmins((data || []).map((row: any) => ({
                    id: row.id,
                    email: row.email || '',
                    name: row.name || '',
                    active: row.active ?? true,
                    createdAt: row.created_at || '',
                    deactivatedAt: row.deactivated_at || null,
                })));
            } catch (err: any) {
                toast.error(`Error al cargar admins: ${err?.message || 'Error desconocido'}`);
            } finally {
                setLoading(false);
            }
        };
        fetchAdmins();
    }, []);

    const activeAdmin = admins.find(a => a.active);
    const inactiveAdmins = admins.filter(a => !a.active);

    // Add new expenses admin
    const handleAdd = async () => {
        const trimmedEmail = newEmail.trim().toLowerCase();
        const trimmedName = newName.trim();

        if (!trimmedName) { toast.error('Ingresá el nombre del empleado.'); return; }
        if (!trimmedEmail || !trimmedEmail.includes('@')) { toast.error('Ingresá un email válido.'); return; }

        setIsSaving(true);
        try {
            // Deactivate current active admin if exists
            if (activeAdmin) {
                const { error: deactErr } = await supabase
                    .from('expenses_admins')
                    .update({ active: false, deactivated_at: new Date().toISOString() })
                    .eq('id', activeAdmin.id);
                if (deactErr) throw deactErr;
            }

            // Insert new admin
            const newId = generateUUID();
            const { error: insertErr } = await supabase
                .from('expenses_admins')
                .insert({
                    id: newId,
                    email: trimmedEmail,
                    name: trimmedName,
                    active: true,
                    created_at: new Date().toISOString(),
                });
            if (insertErr) throw insertErr;

            // Update local state
            setAdmins(prev => [
                {
                    id: newId,
                    email: trimmedEmail,
                    name: trimmedName,
                    active: true,
                    createdAt: new Date().toISOString(),
                    deactivatedAt: null,
                },
                ...prev.map(a => a.active ? { ...a, active: false, deactivatedAt: new Date().toISOString() } : a),
            ]);

            setNewName('');
            setNewEmail('');
            setShowAddForm(false);
            toast.success(`${trimmedName} fue dado de alta como admin de expensas.`);
        } catch (err: any) {
            toast.error(`Error: ${err?.message || 'No se pudo guardar.'}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Deactivate current admin
    const handleDeactivate = async (admin: ExpensesAdmin) => {
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('expenses_admins')
                .update({ active: false, deactivated_at: new Date().toISOString() })
                .eq('id', admin.id);
            if (error) throw error;

            setAdmins(prev => prev.map(a =>
                a.id === admin.id ? { ...a, active: false, deactivatedAt: new Date().toISOString() } : a
            ));
            setDeactivatingId(null);
            toast.success(`${admin.name} fue dado de baja.`);
        } catch (err: any) {
            toast.error(`Error: ${err?.message || 'No se pudo dar de baja.'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="py-6 space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Ajustes</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Configuración general de la administración</p>
            </div>

            {/* ── Admin de Expensas ──────────────────────────────────────── */}
            <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-slate-800 dark:text-white">Admin de Expensas</h2>
                        <p className="text-xs text-slate-400 dark:text-slate-500">Empleado/a que gestiona las expensas del edificio</p>
                    </div>
                </div>

                <div className="p-6 space-y-5">
                    {/* Current active admin */}
                    {activeAdmin ? (
                        <div className="bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 rounded-xl p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-violet-200 dark:bg-violet-500/20 flex items-center justify-center text-violet-700 dark:text-violet-300 font-bold text-sm">
                                        {activeAdmin.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                            {activeAdmin.name}
                                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-500/20">
                                                Activo
                                            </span>
                                        </p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                                            <Mail className="w-3.5 h-3.5" /> {activeAdmin.email}
                                        </p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                            Alta: {formatDate(activeAdmin.createdAt)}
                                        </p>
                                    </div>
                                </div>

                                {deactivatingId === activeAdmin.id ? (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleDeactivate(activeAdmin)}
                                            disabled={isSaving}
                                            className="text-xs font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
                                        >
                                            {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirmar'}
                                        </button>
                                        <button
                                            onClick={() => setDeactivatingId(null)}
                                            className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-2 py-1.5"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setDeactivatingId(activeAdmin.id)}
                                        className="flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 px-3 py-1.5 rounded-lg transition-colors border border-red-100 dark:border-red-500/20"
                                    >
                                        <UserMinus className="w-3.5 h-3.5" /> Dar de baja
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4 flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                            <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                                No hay admin de expensas activo. Dá de alta a un empleado para que pueda gestionar las expensas.
                            </p>
                        </div>
                    )}

                    {/* Add new admin form */}
                    {showAddForm ? (
                        <div className="border border-slate-200 dark:border-white/10 rounded-xl p-4 space-y-3">
                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <UserPlus className="w-4 h-4 text-violet-500" />
                                Dar de alta nuevo empleado
                            </h3>
                            {activeAdmin && (
                                <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 rounded-lg">
                                    Al dar de alta un nuevo empleado, {activeAdmin.name} será dado de baja automáticamente.
                                </p>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Nombre</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                        <input
                                            type="text"
                                            value={newName}
                                            onChange={e => setNewName(e.target.value)}
                                            placeholder="Nombre del empleado"
                                            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm focus:ring-2 focus:ring-violet-500 outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Email (Gmail)</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                        <input
                                            type="email"
                                            value={newEmail}
                                            onChange={e => setNewEmail(e.target.value)}
                                            placeholder="email@gmail.com"
                                            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm focus:ring-2 focus:ring-violet-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 justify-end pt-1">
                                <button
                                    onClick={() => { setShowAddForm(false); setNewName(''); setNewEmail(''); }}
                                    className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleAdd}
                                    disabled={isSaving || !newName.trim() || !newEmail.trim()}
                                    className="flex items-center gap-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 px-4 py-2 rounded-xl transition-colors"
                                >
                                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                                    Dar de alta
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowAddForm(true)}
                            className="flex items-center gap-2 text-sm font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 bg-violet-50 dark:bg-violet-500/10 hover:bg-violet-100 dark:hover:bg-violet-500/20 px-4 py-2.5 rounded-xl transition-colors border border-violet-200 dark:border-violet-500/20"
                        >
                            <UserPlus className="w-4 h-4" />
                            {activeAdmin ? 'Cambiar admin de expensas' : 'Dar de alta admin de expensas'}
                        </button>
                    )}

                    {/* History */}
                    {inactiveAdmins.length > 0 && (
                        <div>
                            <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" /> Historial de empleados
                            </h3>
                            <div className="rounded-xl border border-slate-100 dark:border-white/10 overflow-hidden divide-y divide-slate-100 dark:divide-white/5">
                                {inactiveAdmins.map(admin => (
                                    <div key={admin.id} className="px-4 py-3 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 font-bold text-xs">
                                                {admin.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{admin.name}</p>
                                                <p className="text-xs text-slate-400 dark:text-slate-500">{admin.email}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-slate-400 dark:text-slate-500">
                                                {formatDate(admin.createdAt)} → {formatDate(admin.deactivatedAt)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default AdminSettings;

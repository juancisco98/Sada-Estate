import React, { useState, useMemo, useCallback } from 'react';
import { Tenant, TenantPayment, Property, MaintenanceTask } from '../types';
import { formatCurrency } from '../utils/currency';
import { getPropertyDisplayInfo } from '../utils/property';
import { UserPlus, DollarSign, Home, FileText, Loader, Clock, Users, Search, RefreshCw } from 'lucide-react';
import { uploadFile } from '../services/storage';
import { supabase } from '../services/supabaseClient';
import { toast } from 'sonner';
import { handleError } from '../utils/errorHandler';
import { MONTH_NAMES as MONTH_NAMES_FULL } from '../constants';
import { MONTH_NAMES_SHORT, NewTenantForm, NewPaymentForm } from './tenants/shared';
import AddTenantModal from './tenants/AddTenantModal';
import PaymentModal from './tenants/PaymentModal';
import TenantCard from './tenants/TenantCard';

// UUID v4 generator that works on HTTP (crypto.randomUUID requires HTTPS)
const generateUUID = (): string =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });

interface TenantsViewProps {
    tenants: Tenant[];
    payments: TenantPayment[];
    properties: Property[];
    onSaveTenant: (tenant: Tenant) => void;
    onDeleteTenant: (tenantId: string) => void;
    onRegisterPayment: (payment: TenantPayment) => void;
    onUpdatePayment: (payment: TenantPayment) => void;
    onDeletePayment: (payment: TenantPayment) => Promise<void>;
    maintenanceTasks: MaintenanceTask[];
    refreshData: () => Promise<void>;
    getTenantMetrics: (tenantId: string) => {
        totalPaid: number;
        totalExpenses: number;
        totalPayments: number;
        onTimePayments: number;
        onTimeRate: number;
        monthlyBreakdown: { month: number; amount: number; paid: boolean; status?: string; proofUrl?: string }[];
        expenseMonthlyBreakdown: { month: number; amount: number; paid: boolean; status?: string; proofUrl?: string }[];
        currency: string;
    };
}

const TenantsView: React.FC<TenantsViewProps> = ({
    tenants,
    payments,
    properties,
    onSaveTenant,
    onDeleteTenant,
    onRegisterPayment,
    onUpdatePayment,
    onDeletePayment,
    maintenanceTasks,
    refreshData,
    getTenantMetrics,
}) => {
    const [showAddModal, setShowAddModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showPaymentModal, setShowPaymentModal] = useState<string | null>(null); // tenantId
    const [editingPayment, setEditingPayment] = useState<TenantPayment | null>(null);
    const [expandedTenant, setExpandedTenant] = useState<string | null>(null);
    const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
    const [newTenant, setNewTenant] = useState<NewTenantForm>({ name: '', phone: '', email: '', propertyId: '' });
    const [isUploading, setIsUploading] = useState(false);
    const [newPayment, setNewPayment] = useState<NewPaymentForm>({
        amount: '',
        expenseAmount: '',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        paidOnTime: true,
        paymentMethod: 'CASH',
        proofOfPayment: '',
        proofOfExpenses: '',
        status: 'APPROVED',
        notes: ''
    });

    const vacantProperties = useMemo(
        () => properties.filter(p => p.tenantName === 'Vacante' || !p.tenantName),
        [properties]
    );

    // Opciones del dropdown "Asignar a Inmueble": propiedades vacantes +
    // (si estoy editando) la propiedad actualmente asignada a ese inquilino,
    // para no perderla si ya no aparece como vacante.
    const assignableProperties = useMemo(() => {
        if (!editingTenantId) return vacantProperties;
        const editing = tenants.find(t => t.id === editingTenantId);
        if (!editing?.propertyId) return vacantProperties;
        const current = properties.find(p => p.id === editing.propertyId);
        if (!current) return vacantProperties;
        if (vacantProperties.some(p => p.id === current.id)) return vacantProperties;
        return [current, ...vacantProperties];
    }, [vacantProperties, editingTenantId, tenants, properties]);

    const handleAddTenant = () => {
        if (!newTenant.name.trim()) return;
        // Validar que la propiedad seleccionada exista en state local (protección contra FK stale).
        if (newTenant.propertyId && !properties.some(p => p.id === newTenant.propertyId)) {
            toast.error('La propiedad seleccionada ya no existe. Refrescá los datos y volvé a intentar.');
            return;
        }
        const tenant: Tenant = {
            id: editingTenantId || generateUUID(),
            name: newTenant.name.trim(),
            phone: newTenant.phone.trim(),
            email: newTenant.email.trim().toLowerCase(),
            propertyId: newTenant.propertyId || null,
        };
        onSaveTenant(tenant);
        toast.success(editingTenantId ? 'Inquilino actualizado correctamente' : 'Inquilino agregado correctamente');
        setNewTenant({ name: '', phone: '', email: '', propertyId: '' });
        setEditingTenantId(null);
        setShowAddModal(false);
    };

    const handleOpenPaymentModal = (tenantId: string, paymentToEdit?: TenantPayment, initialData?: { month: number, year: number }) => {
        setEditingPayment(paymentToEdit || null);
        setShowPaymentModal(tenantId);
        if (paymentToEdit) {
            setNewPayment({
                amount: paymentToEdit.amount.toString(),
                expenseAmount: paymentToEdit.expenseAmount?.toString() || '',
                month: paymentToEdit.month,
                year: paymentToEdit.year,
                paidOnTime: paymentToEdit.paidOnTime,
                paymentMethod: paymentToEdit.paymentMethod || 'CASH',
                proofOfPayment: paymentToEdit.proofOfPayment || '',
                proofOfExpenses: paymentToEdit.proofOfExpenses || '',
                status: paymentToEdit.status || 'APPROVED',
                notes: paymentToEdit.notes || ''
            });
        } else {
            // Find tenant and property to get rent
            const tenant = tenants.find(t => t.id === tenantId);
            const prop = tenant?.propertyId ? properties.find(p => p.id === tenant.propertyId) : null;

            // Prioridad para el monto por defecto:
            // 1) monthlyRent de la propiedad (fuente de verdad, actualizado por IPC / edición).
            // 2) Monto del último pago (fallback histórico si la propiedad aún no tiene monthlyRent).
            const tenantPayments = payments.filter(p => p.tenantId === tenantId);
            const lastPayment = tenantPayments.sort((a, b) => {
                if (a.year !== b.year) return b.year - a.year;
                return b.month - a.month;
            })[0];

            const defaultAmount = prop?.monthlyRent
                ? prop.monthlyRent.toString()
                : (lastPayment?.amount?.toString() || '');

            setNewPayment({
                amount: defaultAmount,
                expenseAmount: '',
                month: initialData?.month || new Date().getMonth() + 1,
                year: initialData?.year || new Date().getFullYear(),
                paidOnTime: true,
                paymentMethod: 'CASH',
                proofOfPayment: '',
                proofOfExpenses: '',
                status: 'APPROVED',
                notes: ''
            });
        }
    };

    const handleSavePayment = async () => {
        if (!showPaymentModal || !newPayment.amount) return;
        const tenant = tenants.find(t => t.id === showPaymentModal);
        const prop = tenant?.propertyId ? properties.find(p => p.id === tenant.propertyId) : null;

        const prevStatus = editingPayment?.status;

        if (editingPayment) {
            const updatedPayment: TenantPayment = {
                ...editingPayment,
                amount: parseFloat(newPayment.amount),
                expenseAmount: newPayment.expenseAmount ? parseFloat(newPayment.expenseAmount) : undefined,
                month: newPayment.month,
                year: newPayment.year,
                paidOnTime: newPayment.paidOnTime,
                paymentMethod: newPayment.paymentMethod,
                proofOfPayment: newPayment.proofOfPayment,
                proofOfExpenses: newPayment.proofOfExpenses,
                status: newPayment.status,
                notes: newPayment.notes
            };
            onUpdatePayment(updatedPayment);
            toast.success('Pago actualizado correctamente');
        } else {
            const payment: TenantPayment = {
                id: generateUUID(),
                tenantId: showPaymentModal,
                propertyId: tenant?.propertyId || null,
                amount: parseFloat(newPayment.amount),
                expenseAmount: newPayment.expenseAmount ? parseFloat(newPayment.expenseAmount) : undefined,
                currency: prop?.currency || 'ARS',
                month: newPayment.month,
                year: newPayment.year,
                paidOnTime: newPayment.paidOnTime,
                paymentDate: new Date().toISOString().split('T')[0],
                paymentMethod: newPayment.paymentMethod,
                proofOfPayment: newPayment.proofOfPayment,
                proofOfExpenses: newPayment.proofOfExpenses,
                status: newPayment.status,
                notes: newPayment.notes
            };
            onRegisterPayment(payment);
            toast.success('Pago registrado correctamente');
        }

        // Notify tenant when admin changes status (non-blocking — don't let failures abort the save)
        const tenantEmail = tenant?.email;
        const statusChanged = newPayment.status !== prevStatus || !editingPayment;
        if (tenantEmail && statusChanged && (newPayment.status === 'APPROVED' || newPayment.status === 'REVISION')) {
            const notifData = newPayment.status === 'APPROVED'
                ? {
                    title: 'Pago aprobado ✓',
                    message: `Tu pago de ${MONTH_NAMES_FULL[newPayment.month - 1]} ${newPayment.year} fue aprobado por la administración.`,
                    type: 'PAYMENT_APPROVED'
                }
                : {
                    title: 'Pago en revisión',
                    message: `Tu pago de ${MONTH_NAMES_FULL[newPayment.month - 1]} ${newPayment.year} requiere correcciones. Revisá tus comprobantes.`,
                    type: 'PAYMENT_REVISION'
                };
            try {
                await supabase.from('notifications').insert([{
                    recipient_email: tenantEmail,
                    ...notifData,
                    payment_id: editingPayment?.id || null,
                }]);
            } catch (notifError: any) {
                console.error('Tenant notification failed (non-blocking):', notifError);
                // Don't rethrow — payment was already saved
            }
        }

        setNewPayment({
            amount: '',
            expenseAmount: '',
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
            paidOnTime: true,
            paymentMethod: 'CASH',
            proofOfPayment: '',
            proofOfExpenses: '',
            status: 'APPROVED',
            notes: ''
        });
        setShowPaymentModal(null);
        setEditingPayment(null);
        setIsUploading(false);
    };

    const handleDeletePayment = async (payment: TenantPayment) => {
        if (!confirm(`¿Eliminar el pago de ${MONTH_NAMES_SHORT[payment.month - 1]} ${payment.year}? Esta acción no se puede deshacer.`)) return;
        try {
            await onDeletePayment(payment);
            toast.success('Pago eliminado correctamente');
            setShowPaymentModal(null);
            setEditingPayment(null);
        } catch {
            // onDeletePayment ya muestra toast con mensaje amigable; mantenemos modal abierto para reintentar.
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'proofOfPayment' | 'proofOfExpenses') => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const folder = showPaymentModal ? `tenants/${showPaymentModal}` : 'general';
            const publicUrl = await uploadFile(file, folder);

            if (publicUrl) {
                setNewPayment(prev => ({ ...prev, [field]: publicUrl }));
                toast.success('Comprobante subido correctamente');
            } else {
                toast.error('Error al subir el comprobante. Por favor intente nuevamente.');
            }
        } catch (error) {
            handleError(error, 'Error al subir el comprobante.');
        } finally {
            setIsUploading(false);
        }
    };

    const getPropertyAddress = useCallback((propertyId: string | null, short = false) => {
        if (!propertyId) return 'Sin asignar';
        const prop = properties.find(p => p.id === propertyId);
        if (!prop) return 'Desconocido';
        const addr = short ? prop.address.split(',')[0] : prop.address;
        const display = getPropertyDisplayInfo(prop);

        // For houses, the subtitle IS the address, so we don't want to repeat it
        if (prop.propertyType === 'casa' || prop.propertyType === 'local' || !prop.buildingId) {
            return addr;
        }

        // For buildings, display.subtitle contains the floor/unit info
        return `${addr} — ${display.subtitle}`;
    }, [properties]);

    const filteredTenants = useMemo(() => {
        if (!searchQuery.trim()) return tenants;
        const q = searchQuery.toLowerCase();
        return tenants.filter(t => {
            const propAddr = getPropertyAddress(t.propertyId, false).toLowerCase();
            return t.name.toLowerCase().includes(q) || propAddr.includes(q) || t.email.toLowerCase().includes(q);
        });
    }, [tenants, searchQuery, getPropertyAddress]);

    // Cache de métricas: una vez por render, evita el O(n²) dentro del .map()
    const metricsByTenantId = useMemo(() => {
        const cache = new Map<string, ReturnType<typeof getTenantMetrics>>();
        for (const t of filteredTenants) {
            cache.set(t.id, getTenantMetrics(t.id));
        }
        return cache;
    }, [filteredTenants, getTenantMetrics]);

    // Índice de pagos por (inquilino, mes) del año actual: lookup O(1) en las grillas
    // mensuales, evita el `payments.find()` por celda (12 celdas × N inquilinos). Lección 13.
    // Preserva el primer match (orden de carga), idéntico al `.find()` que reemplaza.
    const currentYear = new Date().getFullYear();
    const paymentByTenantMonth = useMemo(() => {
        const map = new Map<string, TenantPayment>();
        for (const p of payments) {
            if (p.year !== currentYear) continue;
            const key = `${p.tenantId}-${p.month}`;
            if (!map.has(key)) map.set(key, p);
        }
        return map;
    }, [payments, currentYear]);

    // Abre el modal de alta en modo edición desde la card del inquilino.
    const handleEditTenant = (tenant: Tenant) => {
        setNewTenant({
            name: tenant.name,
            phone: tenant.phone || '',
            email: tenant.email || '',
            propertyId: tenant.propertyId || ''
        });
        setEditingTenantId(tenant.id);
        setShowAddModal(true);
    };

    const handleCloseAddModal = () => {
        setShowAddModal(false);
        setEditingTenantId(null);
        setNewTenant({ name: '', phone: '', email: '', propertyId: '' });
    };

    const handleClosePaymentModal = () => {
        setShowPaymentModal(null);
        setEditingPayment(null);
    };

    return (
        <div className="space-y-10 animate-in fade-in duration-500 pb-24">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-2 h-12 bg-indigo-600 rounded-full hidden sm:block"></div>
                    <div>
                        <h1 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight">Mis Inquilinos</h1>
                        <p className="text-gray-500 dark:text-gray-400 font-medium text-sm sm:text-lg">Gestión de alquileres y seguimiento de pagos.</p>
                    </div>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    <button
                        onClick={refreshData}
                        title="Actualizar datos"
                        className="p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 transition-all active:scale-95 min-h-[56px] min-w-[56px] flex items-center justify-center"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => {
                            setEditingTenantId(null);
                            setNewTenant({ name: '', phone: '', email: '', propertyId: '' });
                            setShowAddModal(true);
                        }}
                        className="flex-1 sm:flex-none bg-indigo-600 text-white p-3 rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 dark:shadow-none flex items-center justify-center gap-3 px-6 sm:px-8 min-h-[56px] transition-all hover:scale-105 active:scale-95 group"
                    >
                        <UserPlus className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                        <span className="font-bold text-base">Nuevo Inquilino</span>
                    </button>
                </div>
            </header>

            {/* Summary Cards - Premium Style */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-indigo-50/50 dark:bg-indigo-900/20 p-6 rounded-[28px] border border-indigo-100/50 dark:border-indigo-500/10 flex flex-col justify-between group hover:bg-indigo-100/50 dark:hover:bg-indigo-900/30 transition-colors">
                    <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">Total Inquilinos</p>
                    <div className="flex items-end justify-between">
                        <p className="text-3xl font-black text-gray-900 dark:text-white leading-none">{tenants.length}</p>
                        <Users className="w-6 h-6 text-indigo-200 dark:text-indigo-700 group-hover:text-indigo-400 dark:group-hover:text-indigo-500 transition-colors" />
                    </div>
                </div>
                <div className="bg-emerald-50/50 dark:bg-emerald-900/20 p-6 rounded-[28px] border border-emerald-100/50 dark:border-emerald-500/10 flex flex-col justify-between group hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30 transition-colors">
                    <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">Con Inmueble</p>
                    <div className="flex items-end justify-between">
                        <p className="text-3xl font-black text-gray-900 dark:text-white leading-none">{tenants.filter(t => t.propertyId).length}</p>
                        <Home className="w-6 h-6 text-emerald-200 dark:text-emerald-700 group-hover:text-emerald-400 dark:group-hover:text-emerald-500 transition-colors" />
                    </div>
                </div>
                <div className="bg-amber-50/50 dark:bg-amber-900/20 p-6 rounded-[28px] border border-amber-100/50 dark:border-amber-500/10 flex flex-col justify-between group hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition-colors">
                    <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">Pagos Registrados</p>
                    <div className="flex items-end justify-between">
                        <p className="text-3xl font-black text-gray-900 dark:text-white leading-none">{payments.length}</p>
                        <DollarSign className="w-6 h-6 text-amber-200 dark:text-amber-700 group-hover:text-amber-400 dark:group-hover:text-amber-500 transition-colors" />
                    </div>
                </div>
                <div className="bg-rose-50/50 dark:bg-rose-900/20 p-6 rounded-[28px] border border-rose-100/50 dark:border-rose-500/10 flex flex-col justify-between group hover:bg-rose-100/50 dark:hover:bg-rose-900/30 transition-colors">
                    <p className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-2">Vacantes</p>
                    <div className="flex items-end justify-between">
                        <p className="text-3xl font-black text-gray-900 dark:text-white leading-none">{vacantProperties.length}</p>
                        <Loader className="w-6 h-6 text-rose-200 dark:text-rose-700 group-hover:text-rose-400 dark:group-hover:text-rose-500 transition-colors" />
                    </div>
                </div>
            </div>

            {/* ===== REVISIONES PENDIENTES ===== */}
            {(() => {
                const revisionPayments = payments.filter(p => p.status === 'REVISION');
                if (revisionPayments.length === 0) return null;
                return (
                    <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                            <h3 className="font-bold text-amber-800 dark:text-amber-400">
                                {revisionPayments.length} Pago{revisionPayments.length > 1 ? 's' : ''} en Revisión — Pendientes de aprobación
                            </h3>
                        </div>
                        <div className="space-y-2">
                            {revisionPayments.map(p => {
                                const tenant = tenants.find(t => t.id === p.tenantId);
                                return (
                                    <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-amber-500/5 rounded-xl p-3 border border-amber-100 dark:border-amber-500/20">
                                        <div>
                                            <p className="font-semibold text-sm text-slate-800 dark:text-white">{tenant?.name || 'Inquilino'}</p>
                                            <p className="text-xs text-amber-700 dark:text-amber-400">{MONTH_NAMES_SHORT[p.month - 1]} {p.year} — {formatCurrency(p.amount, p.currency)}</p>
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {p.proofOfPayment && (
                                                <a href={p.proofOfPayment} target="_blank" rel="noopener noreferrer"
                                                    className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20">
                                                    <FileText size={12} /> Alquiler
                                                </a>
                                            )}
                                            {p.proofOfExpenses && (
                                                <a href={p.proofOfExpenses} target="_blank" rel="noopener noreferrer"
                                                    className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20">
                                                    <FileText size={12} /> Expensas
                                                </a>
                                            )}
                                            <button
                                                onClick={() => handleOpenPaymentModal(p.tenantId, p)}
                                                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-bold rounded-lg transition-all"
                                            >
                                                Revisar
                                            </button>
                                            <button
                                                onClick={() => handleDeletePayment(p)}
                                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold rounded-lg transition-all"
                                                title="Eliminar comprobante enviado"
                                            >
                                                Rechazar
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })()}

            {/* Tenant List */}
            {tenants.length === 0 ? (
                <div className="text-center py-16 px-6 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10">
                    <UserPlus size={48} className="text-slate-400 mx-auto mb-4" />
                    <p className="text-lg font-semibold text-slate-600 dark:text-slate-300">No hay inquilinos registrados</p>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Agrega tu primer inquilino para empezar a trackear pagos</p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {/* Search bar */}
                    <div className="relative mb-2">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, propiedad o email..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-800 dark:text-white placeholder-slate-400 text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all"
                        />
                    </div>
                    {filteredTenants.length === 0 && (
                        <div className="text-center py-10 text-slate-400 text-sm font-medium">
                            No se encontraron inquilinos para "{searchQuery}"
                        </div>
                    )}
                    {filteredTenants.map(tenant => {
                        const metrics = metricsByTenantId.get(tenant.id)!;
                        const isExpanded = expandedTenant === tenant.id;

                        return (
                            <TenantCard
                                key={tenant.id}
                                tenant={tenant}
                                metrics={metrics}
                                isExpanded={isExpanded}
                                onToggleExpand={() => setExpandedTenant(isExpanded ? null : tenant.id)}
                                getPropertyAddress={getPropertyAddress}
                                maintenanceTasks={maintenanceTasks}
                                payments={payments}
                                paymentByTenantMonth={paymentByTenantMonth}
                                onOpenPaymentModal={handleOpenPaymentModal}
                                onEditTenant={handleEditTenant}
                                onDeleteTenant={onDeleteTenant}
                            />
                        );
                    })}
                </div>
            )}

            {/* ========== ADD TENANT MODAL ========== */}
            {showAddModal && (
                <AddTenantModal
                    editingTenantId={editingTenantId}
                    newTenant={newTenant}
                    setNewTenant={setNewTenant}
                    assignableProperties={assignableProperties}
                    onClose={handleCloseAddModal}
                    onSubmit={handleAddTenant}
                />
            )}

            {/* ========== PAYMENT MODAL ========== */}
            {showPaymentModal && (
                <PaymentModal
                    newPayment={newPayment}
                    setNewPayment={setNewPayment}
                    editingPayment={editingPayment}
                    isUploading={isUploading}
                    onClose={handleClosePaymentModal}
                    onSave={handleSavePayment}
                    onDelete={handleDeletePayment}
                    onFileUpload={handleFileUpload}
                />
            )}
        </div>
    );
};

export default TenantsView;

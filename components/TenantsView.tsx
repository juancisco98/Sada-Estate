import React, { useState } from 'react';
import { Tenant, TenantPayment, Property, MaintenanceTask } from '../types';
import { formatCurrency } from '../utils/currency';
import { getPropertyDisplayInfo } from '../utils/property';
import { UserPlus, Trash2, DollarSign, Phone, Home, CheckCircle, XCircle, X, ChevronDown, ChevronUp, Upload, FileText, Loader, Clock, Edit2, Users, Search, RefreshCw } from 'lucide-react';
import { uploadFile } from '../services/storage';
import { supabase } from '../services/supabaseClient';
import { toast } from 'sonner';
import { handleError } from '../utils/errorHandler';
import { MONTH_NAMES as MONTH_NAMES_FULL } from '../constants';

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

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const TenantsView: React.FC<TenantsViewProps> = ({
    tenants,
    payments,
    properties,
    onSaveTenant,
    onDeleteTenant,
    onRegisterPayment,
    onUpdatePayment,
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
    const [newTenant, setNewTenant] = useState({ name: '', phone: '', email: '', propertyId: '' });
    const [isUploading, setIsUploading] = useState(false);
    const [newPayment, setNewPayment] = useState({
        amount: '',
        expenseAmount: '',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        paidOnTime: true,
        paymentMethod: 'CASH' as 'CASH' | 'TRANSFER',
        proofOfPayment: '',
        proofOfExpenses: '',
        status: 'APPROVED' as 'PENDING' | 'REVISION' | 'APPROVED',
        notes: ''
    });

    const vacantProperties = properties.filter(p => p.tenantName === 'Vacante' || !p.tenantName);

    const handleAddTenant = () => {
        if (!newTenant.name.trim()) return;
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

            // Find last payment to get previous amount
            const tenantPayments = payments.filter(p => p.tenantId === tenantId);
            const lastPayment = tenantPayments.sort((a, b) => {
                if (a.year !== b.year) return b.year - a.year;
                return b.month - a.month;
            })[0];

            const defaultAmount = lastPayment ? lastPayment.amount.toString() : (prop?.monthlyRent?.toString() || '');

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
        if (!confirm(`¿Eliminar el pago de ${MONTH_NAMES[payment.month - 1]} ${payment.year}? Esta acción no se puede deshacer.`)) return;
        const { error } = await supabase.from('tenant_payments').delete().eq('id', payment.id);
        if (error) {
            toast.error(`Error al eliminar: ${error.message}`);
            return;
        }
        toast.success('Pago eliminado correctamente');
        setShowPaymentModal(null);
        setEditingPayment(null);
        await refreshData();
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

    const getPropertyAddress = (propertyId: string | null, short = false) => {
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
    };

    const filteredTenants = searchQuery.trim()
        ? tenants.filter(t => {
            const q = searchQuery.toLowerCase();
            const propAddr = getPropertyAddress(t.propertyId, false).toLowerCase();
            return t.name.toLowerCase().includes(q) || propAddr.includes(q) || t.email.toLowerCase().includes(q);
        })
        : tenants;

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
                                            <p className="text-xs text-amber-700 dark:text-amber-400">{MONTH_NAMES[p.month - 1]} {p.year} — {formatCurrency(p.amount, p.currency)}</p>
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
                            className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-800 dark:text-white placeholder-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        />
                    </div>
                    {filteredTenants.length === 0 && (
                        <div className="text-center py-10 text-slate-400 text-sm font-medium">
                            No se encontraron inquilinos para "{searchQuery}"
                        </div>
                    )}
                    {filteredTenants.map(tenant => {
                        const metrics = getTenantMetrics(tenant.id);
                        const isExpanded = expandedTenant === tenant.id;

                        return (
                            <div key={tenant.id} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-[2.2rem] border border-white dark:border-white/10 shadow-lg dark:shadow-none overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 dark:hover:border-indigo-500/40 hover:scale-[1.01] hover:translate-x-1 group mb-3">
                                {/* Main Row */}
                                <div
                                    className="flex items-center p-6 gap-5 cursor-pointer"
                                    onClick={() => setExpandedTenant(isExpanded ? null : tenant.id)}
                                >
                                    {/* Status Indicator Dot */}
                                    <div className={`w-3 h-3 rounded-full shrink-0 ${metrics.onTimeRate >= 80 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' :
                                        metrics.onTimeRate >= 50 ? 'bg-amber-400' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                                        }`} />

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-black text-slate-900 dark:text-white text-lg tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors uppercase">
                                                {tenant.name}
                                            </h3>
                                            {metrics.totalPayments > 0 && (
                                                <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${metrics.onTimeRate >= 80 ? 'text-emerald-600 bg-emerald-50 border-emerald-100' :
                                                    metrics.onTimeRate >= 50 ? 'text-amber-600 bg-amber-50 border-amber-100' :
                                                        'text-rose-600 bg-rose-50 border-rose-100'
                                                    }`}>
                                                    {metrics.onTimeRate >= 80 ? 'Ejemplar' : metrics.onTimeRate >= 50 ? 'Regular' : 'Moroso'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                                            <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-md">
                                                <Home size={14} className="text-slate-400" />
                                            </div>
                                            <p className="text-lg font-black uppercase tracking-tight truncate" title={getPropertyAddress(tenant.propertyId, false)}>
                                                {getPropertyAddress(tenant.propertyId, true)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Metrics Summary */}
                                    <div className="flex items-center gap-6 shrink-0">
                                        <div className="text-right hidden sm:block">
                                            <p className="text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest mb-0.5">Total Pagado</p>
                                            <p className="text-base font-black text-slate-700 dark:text-white tabular-nums">
                                                {metrics.totalPaid > 0 ? formatCurrency(metrics.totalPaid, metrics.currency).split(',')[0] : '—'}
                                            </p>
                                        </div>
                                        <div className={`p-2 rounded-2xl transition-all ${isExpanded ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-lg shadow-indigo-200 dark:shadow-none' : 'bg-slate-50 dark:bg-white/5 text-slate-300 dark:text-indigo-400/50'}`}>
                                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div className="border-t border-gray-100 dark:border-white/5 p-5 bg-gray-50/50 dark:bg-slate-800/50 space-y-5 animate-in slide-in-from-top-2 duration-200">

                                        {/* Owner View: Financial Summary */}
                                        <div className="bg-white dark:bg-slate-900/80 p-3 sm:p-4 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm">
                                            <p className="text-[10px] sm:text-xs font-bold text-gray-500 dark:text-slate-400 uppercase mb-2 sm:mb-3">
                                                Balance de la Propiedad
                                            </p>
                                            {(() => {
                                                const propExpenses = maintenanceTasks
                                                    .filter(t => t.propertyId === tenant.propertyId && t.status === 'COMPLETED')
                                                    .reduce((acc, t) => acc + (t.cost || 0), 0);
                                                const net = metrics.totalPaid + metrics.totalExpenses - propExpenses;
                                                return (
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                                                        <div>
                                                            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-slate-400 font-semibold mb-1">ALQUILER</p>
                                                            <p className="text-sm sm:text-lg font-bold text-green-600 dark:text-green-400">
                                                                {formatCurrency(metrics.totalPaid, metrics.currency)}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-slate-400 font-semibold mb-1">EXPENSAS</p>
                                                            <p className="text-sm sm:text-lg font-bold text-violet-600 dark:text-violet-400">
                                                                {metrics.totalExpenses > 0 ? formatCurrency(metrics.totalExpenses, metrics.currency) : '—'}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-slate-400 font-semibold mb-1">GASTOS</p>
                                                            <p className="text-sm sm:text-lg font-bold text-red-500 dark:text-rose-400">
                                                                {formatCurrency(propExpenses, 'ARS')}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-slate-400 font-semibold mb-1">NETO</p>
                                                            <p className="text-sm sm:text-lg font-bold text-gray-800 dark:text-white">
                                                                {formatCurrency(net, 'ARS')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        {/* Monthly Grid — Alquiler */}
                                        <div>
                                            <p className="text-sm font-semibold text-gray-600 dark:text-slate-300 mb-3 flex items-center gap-2">
                                                Historial Alquiler — {new Date().getFullYear()} <span className="text-xs font-normal text-gray-400 dark:text-slate-500">(Click para editar)</span>
                                            </p>
                                            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-2">
                                                {metrics.monthlyBreakdown.map((m) => {
                                                    const paymentForMonth = payments.find(p => p.tenantId === tenant.id && p.month === m.month && p.year === new Date().getFullYear());
                                                    const cellStatus = paymentForMonth?.status;
                                                    const isRevision = cellStatus === 'REVISION' || cellStatus === 'PENDING';
                                                    const cellClass = isRevision
                                                        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-500/30'
                                                        : m.paid
                                                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-500/10'
                                                            : 'bg-gray-100 dark:bg-slate-700/50 border-gray-200 dark:border-white/5 hover:bg-gray-200 dark:hover:bg-slate-700';
                                                    return (
                                                        <div
                                                            key={m.month}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (paymentForMonth) {
                                                                    handleOpenPaymentModal(tenant.id, paymentForMonth);
                                                                } else {
                                                                    handleOpenPaymentModal(tenant.id, undefined, { month: m.month, year: new Date().getFullYear() });
                                                                }
                                                            }}
                                                            title={paymentForMonth ? "Click para editar pago" : "Click para registrar pago"}
                                                            className={`text-center p-2 rounded-xl border cursor-pointer transition-all hover:scale-105 active:scale-95 relative ${cellClass}`}
                                                        >
                                                            <p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase mb-1">
                                                                {MONTH_NAMES[m.month - 1]}
                                                            </p>
                                                            {isRevision ? (
                                                                <Clock size={16} className="text-amber-500 dark:text-amber-400 mx-auto" />
                                                            ) : m.paid ? (
                                                                <CheckCircle size={16} className="text-green-500 mx-auto" />
                                                            ) : (
                                                                <div className="h-4 flex items-center justify-center">
                                                                    <div className="w-2 h-2 rounded-full bg-gray-300" />
                                                                </div>
                                                            )}
                                                            {m.amount > 0 && (
                                                                <p className="text-[10px] text-gray-600 dark:text-slate-300 font-bold mt-1 truncate">
                                                                    {formatCurrency(m.amount, metrics.currency)}
                                                                </p>
                                                            )}
                                                            {m.proofUrl && (
                                                                <a
                                                                    href={m.proofUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    onClick={e => e.stopPropagation()}
                                                                    className="block mt-0.5"
                                                                    title="Ver comprobante alquiler"
                                                                >
                                                                    <FileText size={10} className="text-indigo-400 mx-auto" />
                                                                </a>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        {/* Monthly Grid — Expensas */}
                                        <div className="mt-4">
                                            <p className="text-sm font-semibold text-gray-600 dark:text-slate-300 mb-3 flex items-center gap-2">
                                                Historial Expensas — {new Date().getFullYear()} <span className="text-xs font-normal text-gray-400 dark:text-slate-500">(Click para editar)</span>
                                            </p>
                                            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-2">
                                                {metrics.expenseMonthlyBreakdown.map((m) => {
                                                    const paymentForMonth = payments.find(p => p.tenantId === tenant.id && p.month === m.month && p.year === new Date().getFullYear());
                                                    const isRevision = m.status === 'REVISION' || m.status === 'PENDING';
                                                    const cellClass = isRevision
                                                        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-500/30'
                                                        : m.paid
                                                            ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-500/10'
                                                            : 'bg-gray-100 dark:bg-slate-700/50 border-gray-200 dark:border-white/5 hover:bg-gray-200 dark:hover:bg-slate-700';
                                                    return (
                                                        <div
                                                            key={m.month}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (paymentForMonth) {
                                                                    handleOpenPaymentModal(tenant.id, paymentForMonth);
                                                                } else {
                                                                    handleOpenPaymentModal(tenant.id, undefined, { month: m.month, year: new Date().getFullYear() });
                                                                }
                                                            }}
                                                            title={m.paid ? "Click para editar — expensas registradas" : "Click para registrar expensas"}
                                                            className={`text-center p-2 rounded-xl border cursor-pointer transition-all hover:scale-105 active:scale-95 relative ${cellClass}`}
                                                        >
                                                            <p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase mb-1">
                                                                {MONTH_NAMES[m.month - 1]}
                                                            </p>
                                                            {isRevision ? (
                                                                <Clock size={16} className="text-amber-500 dark:text-amber-400 mx-auto" />
                                                            ) : m.paid ? (
                                                                <CheckCircle size={16} className="text-violet-500 mx-auto" />
                                                            ) : (
                                                                <div className="h-4 flex items-center justify-center">
                                                                    <div className="w-2 h-2 rounded-full bg-gray-300" />
                                                                </div>
                                                            )}
                                                            {m.amount > 0 && (
                                                                <p className="text-[10px] text-gray-600 dark:text-slate-300 font-bold mt-1 truncate">
                                                                    {formatCurrency(m.amount, metrics.currency)}
                                                                </p>
                                                            )}
                                                            {m.proofUrl && (
                                                                <a
                                                                    href={m.proofUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    onClick={e => e.stopPropagation()}
                                                                    className="block mt-0.5"
                                                                    title="Ver comprobante expensas"
                                                                >
                                                                    <FileText size={10} className="text-violet-400 mx-auto" />
                                                                </a>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        {/* Archivo de Comprobantes */}
                                        {(() => {
                                            const tenantPaymentsWithProofs = payments.filter(
                                                p => p.tenantId === tenant.id && (p.proofOfPayment || p.proofOfExpenses)
                                            ).sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);

                                            if (tenantPaymentsWithProofs.length === 0) return null;

                                            return (
                                                <div className="mt-4">
                                                    <p className="text-sm font-semibold text-gray-600 dark:text-slate-300 mb-3 flex items-center gap-2">
                                                        <FileText size={14} /> Archivo de Comprobantes
                                                    </p>
                                                    <div className="space-y-2">
                                                        {tenantPaymentsWithProofs.map(p => (
                                                            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-white/5">
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-xs font-bold text-gray-500 dark:text-slate-400 w-16">
                                                                        {MONTH_NAMES[p.month - 1]} {p.year}
                                                                    </span>
                                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                                        p.status === 'APPROVED' ? 'bg-green-100 dark:bg-emerald-500/20 text-green-700 dark:text-emerald-400' :
                                                                        p.status === 'REVISION' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400' :
                                                                        'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                                                                    }`}>
                                                                        {p.status === 'APPROVED' ? 'Aprobado' : p.status === 'REVISION' ? 'Revisión' : 'Pendiente'}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    {p.proofOfPayment ? (
                                                                        <a href={p.proofOfPayment} target="_blank" rel="noopener noreferrer"
                                                                            className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20">
                                                                            <FileText size={11} /> Alquiler
                                                                        </a>
                                                                    ) : (
                                                                        <span className="text-xs text-gray-300 dark:text-slate-600">Sin alquiler</span>
                                                                    )}
                                                                    {p.proofOfExpenses ? (
                                                                        <a href={p.proofOfExpenses} target="_blank" rel="noopener noreferrer"
                                                                            className="flex items-center gap-1 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline px-2 py-1 rounded-lg bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20">
                                                                            <FileText size={11} /> Expensas
                                                                        </a>
                                                                    ) : (
                                                                        <span className="text-xs text-gray-300 dark:text-slate-600">Sin expensas</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* Actions */}
                                        <div className="flex justify-end gap-3 pt-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleOpenPaymentModal(tenant.id); }}
                                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500 text-white text-sm font-semibold shadow-md active:scale-95 hover:bg-green-600 transition-colors"
                                            >
                                                <DollarSign size={16} /> Registrar Pago
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setNewTenant({
                                                        name: tenant.name,
                                                        phone: tenant.phone || '',
                                                        email: tenant.email || '',
                                                        propertyId: tenant.propertyId || ''
                                                    });
                                                    setEditingTenantId(tenant.id);
                                                    setShowAddModal(true);
                                                }}
                                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 text-sm font-semibold hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
                                            >
                                                <Edit2 size={16} /> Editar
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm(`¿Eliminar inquilino "${tenant.name}"?`)) {
                                                        onDeleteTenant(tenant.id);
                                                        toast.success('Inquilino eliminado');
                                                    }
                                                }}
                                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 dark:bg-rose-500/10 text-red-500 dark:text-rose-400 border border-red-200 dark:border-rose-500/30 text-sm font-semibold hover:bg-red-100 dark:hover:bg-rose-500/20 transition-colors"
                                            >
                                                <Trash2 size={16} /> Eliminar
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ========== ADD TENANT MODAL ========== */}
            {showAddModal && (
                <div
                    className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
                    onClick={() => { setShowAddModal(false); setEditingTenantId(null); setNewTenant({ name: '', phone: '', email: '', propertyId: '' }); }}
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
                            <button onClick={() => { setShowAddModal(false); setEditingTenantId(null); setNewTenant({ name: '', phone: '', email: '', propertyId: '' }); }} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-full transition-colors">
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
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-800 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">Teléfono</label>
                                <input
                                    value={newTenant.phone}
                                    onChange={e => setNewTenant(p => ({ ...p, phone: e.target.value }))}
                                    placeholder="11-1234-5678"
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-800 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">Email</label>
                                <input
                                    value={newTenant.email}
                                    onChange={e => setNewTenant(p => ({ ...p, email: e.target.value }))}
                                    placeholder="email@ejemplo.com"
                                    type="email"
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-800 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">Asignar a Inmueble (opcional)</label>
                                <select
                                    value={newTenant.propertyId}
                                    onChange={e => setNewTenant(p => ({ ...p, propertyId: e.target.value }))}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white dark:bg-slate-800 text-gray-800 dark:text-white"
                                >
                                    <option value="">Sin asignar</option>
                                    {properties.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.unitLabel ? `${p.address} - ${p.unitLabel}` : p.address}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="p-6 pt-0 shrink-0">
                            <button
                                onClick={handleAddTenant}
                                disabled={!newTenant.name.trim()}
                                className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all active:scale-[0.98] ${newTenant.name.trim() ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30' : 'bg-gray-300 cursor-not-allowed shadow-none'}`}
                            >
                                {editingTenantId ? 'Guardar Cambios' : 'Agregar Inquilino'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========== PAYMENT MODAL ========== */}
            {showPaymentModal && (
                <div
                    className="fixed inset-0 z-[1500] flex items-center justify-center p-4"
                    onClick={() => { setShowPaymentModal(null); setEditingPayment(null); }}
                >
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"></div>
                    <div
                        className="bg-white dark:bg-slate-950 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] animate-in scale-95 duration-200 relative border border-white dark:border-white/10"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-slate-900/50 shrink-0">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                                Registrar Pago
                            </h2>
                            <button onClick={() => { setShowPaymentModal(null); setEditingPayment(null); }} className="p-2 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                                <X size={20} className="text-gray-500 dark:text-gray-400" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">Monto Alquiler *</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-2.5 text-gray-400">$</span>
                                        <input
                                            value={newPayment.amount}
                                            onChange={e => setNewPayment(p => ({ ...p, amount: e.target.value }))}
                                            placeholder="0"
                                            type="number"
                                            className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-800 text-gray-800 dark:text-white focus:ring-2 focus:ring-green-500 outline-none transition-all font-bold"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">Monto Expensas <span className="text-xs font-normal text-gray-400">(opcional)</span></label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-2.5 text-gray-400">$</span>
                                        <input
                                            value={newPayment.expenseAmount}
                                            onChange={e => setNewPayment(p => ({ ...p, expenseAmount: e.target.value }))}
                                            placeholder="0"
                                            type="number"
                                            className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-800 text-gray-800 dark:text-white focus:ring-2 focus:ring-violet-500 outline-none transition-all font-bold"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">Mes</label>
                                    <select
                                        value={newPayment.month}
                                        onChange={e => setNewPayment(p => ({ ...p, month: parseInt(e.target.value) }))}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 focus:ring-2 focus:ring-green-500 outline-none transition-all bg-white dark:bg-slate-800 text-gray-800 dark:text-white"
                                    >
                                        {MONTH_NAMES.map((name, i) => (
                                            <option key={i} value={i + 1}>{name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">Año</label>
                                    <input
                                        value={newPayment.year}
                                        onChange={e => setNewPayment(p => ({ ...p, year: parseInt(e.target.value) }))}
                                        type="number"
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 focus:ring-2 focus:ring-green-500 outline-none transition-all bg-white dark:bg-slate-800 text-gray-800 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-white/5">
                                <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                                    ¿Pagó a tiempo?
                                </label>
                                <button
                                    onClick={() => setNewPayment(p => ({ ...p, paidOnTime: !p.paidOnTime }))}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${newPayment.paidOnTime ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                                >
                                    {newPayment.paidOnTime ? 'Sí, a tiempo' : 'No, con retraso'}
                                </button>
                            </div>

                            {/* Proof Upload (Redesigned) */}
                            <div className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-200 dark:border-white/10 space-y-2">
                                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                                    Comprobante de Pago
                                </label>

                                <input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    onChange={(e) => handleFileUpload(e, 'proofOfPayment')}
                                    className="hidden"
                                    id="proof-upload"
                                    disabled={isUploading}
                                />

                                {newPayment.proofOfPayment ? (
                                    <div className="flex items-center justify-between bg-green-50 dark:bg-emerald-500/10 border border-green-200 dark:border-emerald-500/20 p-2 rounded-lg">
                                        <a
                                            href={newPayment.proofOfPayment}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs font-semibold text-green-700 dark:text-emerald-400 hover:underline flex items-center gap-1 truncate max-w-[200px]"
                                        >
                                            <CheckCircle size={12} /> Ver Alquiler
                                        </a>
                                        <button
                                            onClick={() => setNewPayment(p => ({ ...p, proofOfPayment: '' }))}
                                            className="p-1 hover:bg-green-100 dark:hover:bg-emerald-500/20 rounded text-red-400 dark:text-rose-400"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <label
                                        htmlFor="proof-upload"
                                        className={`flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-dashed border-gray-300 dark:border-white/10 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-slate-800 hover:border-gray-400 transition-all cursor-pointer ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {isUploading ? <Loader size={16} className="animate-spin" /> : <Upload size={16} />}
                                        {isUploading ? 'Subiendo...' : 'Adjuntar Alquiler'}
                                    </label>
                                )}

                                {/* EXPENSAS PROOF */}
                                <input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    onChange={(e) => handleFileUpload(e, 'proofOfExpenses')}
                                    className="hidden"
                                    id="expenses-upload"
                                    disabled={isUploading}
                                />

                                {newPayment.proofOfExpenses ? (
                                    <div className="flex items-center justify-between bg-green-50 dark:bg-emerald-500/10 border border-green-200 dark:border-emerald-500/20 p-2 rounded-lg mt-2">
                                        <a
                                            href={newPayment.proofOfExpenses}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs font-semibold text-green-700 dark:text-emerald-400 hover:underline flex items-center gap-1 truncate max-w-[200px]"
                                        >
                                            <CheckCircle size={12} /> Ver Expensas
                                        </a>
                                        <button
                                            onClick={() => setNewPayment(p => ({ ...p, proofOfExpenses: '' }))}
                                            className="p-1 hover:bg-green-100 dark:hover:bg-emerald-500/20 rounded text-red-400 dark:text-rose-400"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <label
                                        htmlFor="expenses-upload"
                                        className={`flex items-center justify-center gap-2 mt-2 w-full py-2 rounded-lg border border-dashed border-slate-300 dark:border-white/10 text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:border-slate-400 dark:hover:border-white/20 transition-all cursor-pointer ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {isUploading ? <Loader size={16} className="animate-spin" /> : <Upload size={16} />}
                                        {isUploading ? 'Subiendo...' : 'Adjuntar Expensas'}
                                    </label>
                                )}

                            </div>

                            {/* ESTADO DEL PAGO */}
                            <div className="space-y-1">
                                <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Estado del Pago</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setNewPayment(p => ({ ...p, status: 'APPROVED' }))}
                                        className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border transition-all ${newPayment.status === 'APPROVED' ? 'bg-green-50 dark:bg-emerald-500/20 border-green-200 dark:border-emerald-500/30 text-green-700 dark:text-emerald-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                    >
                                        Aprobado
                                    </button>
                                    <button
                                        onClick={() => setNewPayment(p => ({ ...p, status: 'REVISION' }))}
                                        className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border transition-all ${newPayment.status === 'REVISION' ? 'bg-amber-50 dark:bg-amber-500/20 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                    >
                                        En Revisión
                                    </button>
                                </div>
                            </div>

                            {/* Payment Method */}
                            <div className="space-y-1">
                                <label className="text-sm font-semibold text-gray-600">Método de Pago</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setNewPayment(p => ({ ...p, paymentMethod: 'CASH' }))}
                                        className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${newPayment.paymentMethod === 'CASH' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                                    >
                                        Efectivo
                                    </button>
                                    <button
                                        onClick={() => setNewPayment(p => ({ ...p, paymentMethod: 'TRANSFER' }))}
                                        className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${newPayment.paymentMethod === 'TRANSFER' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                                    >
                                        Transferencia
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-semibold text-gray-600 dark:text-gray-400">Notas</label>
                                <textarea
                                    value={newPayment.notes}
                                    onChange={e => setNewPayment(p => ({ ...p, notes: e.target.value }))}
                                    placeholder="Detalles adicionales..."
                                    rows={2}
                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 focus:ring-2 focus:ring-green-500 outline-none transition-all resize-none bg-white dark:bg-slate-800 text-gray-800 dark:text-white"
                                />
                            </div>
                        </div>

                        <div className="p-6 pt-4 border-t border-gray-100 dark:border-white/5 bg-white dark:bg-slate-950 shrink-0 space-y-2">
                            <button
                                onClick={handleSavePayment}
                                disabled={!newPayment.amount}
                                className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all active:scale-[0.98] ${newPayment.amount ? 'bg-green-600 hover:bg-green-700 shadow-green-500/30' : 'bg-gray-300 cursor-not-allowed shadow-none'}`}
                            >
                                {editingPayment ? 'Guardar Cambios' : 'Registrar Pago'}
                            </button>
                            {editingPayment && (
                                <button
                                    onClick={() => handleDeletePayment(editingPayment)}
                                    className="w-full py-2.5 rounded-xl font-semibold text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all active:scale-[0.98] text-sm"
                                >
                                    <span className="flex items-center justify-center gap-2">
                                        <Trash2 size={14} /> Eliminar este pago
                                    </span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TenantsView;

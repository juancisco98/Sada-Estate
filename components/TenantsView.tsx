import React, { useState } from 'react';
import { Tenant, TenantPayment, Property, MaintenanceTask } from '../types';
import { formatCurrency } from '../utils/currency';
import { UserPlus, Trash2, DollarSign, Phone, Home, CheckCircle, XCircle, X, ChevronDown, ChevronUp, Upload, FileText, Loader } from 'lucide-react';
import { uploadPaymentProof } from '../services/storage';
import { toast } from 'sonner';
import { handleError } from '../utils/errorHandler';

interface TenantsViewProps {
    tenants: Tenant[];
    payments: TenantPayment[];
    properties: Property[];
    onSaveTenant: (tenant: Tenant) => void;
    onDeleteTenant: (tenantId: string) => void;
    onRegisterPayment: (payment: TenantPayment) => void;
    onUpdatePayment: (payment: TenantPayment) => void;
    maintenanceTasks: MaintenanceTask[];
    getTenantMetrics: (tenantId: string) => {
        totalPaid: number;
        totalPayments: number;
        onTimePayments: number;
        onTimeRate: number;
        monthlyBreakdown: { month: number; amount: number; paid: boolean }[];
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
    getTenantMetrics,
}) => {
    const [showAddModal, setShowAddModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState<string | null>(null); // tenantId
    const [editingPayment, setEditingPayment] = useState<TenantPayment | null>(null);
    const [expandedTenant, setExpandedTenant] = useState<string | null>(null);
    const [newTenant, setNewTenant] = useState({ name: '', phone: '', email: '', propertyId: '' });
    const [isUploading, setIsUploading] = useState(false);
    const [newPayment, setNewPayment] = useState({
        amount: '',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        paidOnTime: true,
        paymentMethod: 'CASH' as 'CASH' | 'TRANSFER',
        proofOfPayment: '',
        notes: ''
    });

    const vacantProperties = properties.filter(p => p.tenantName === 'Vacante' || !p.tenantName);

    const handleAddTenant = () => {
        if (!newTenant.name.trim()) return;
        const tenant: Tenant = {
            id: `ten-${Date.now()}`,
            name: newTenant.name.trim(),
            phone: newTenant.phone.trim(),
            email: newTenant.email.trim(),
            propertyId: newTenant.propertyId || null,
        };
        onSaveTenant(tenant);
        toast.success('Inquilino agregado correctamente');
        setNewTenant({ name: '', phone: '', email: '', propertyId: '' });
        setShowAddModal(false);
    };

    const handleOpenPaymentModal = (tenantId: string, paymentToEdit?: TenantPayment, initialData?: { month: number, year: number }) => {
        setEditingPayment(paymentToEdit || null);
        setShowPaymentModal(tenantId);
        if (paymentToEdit) {
            setNewPayment({
                amount: paymentToEdit.amount.toString(),
                month: paymentToEdit.month,
                year: paymentToEdit.year,
                paidOnTime: paymentToEdit.paidOnTime,
                paymentMethod: paymentToEdit.paymentMethod || 'CASH',
                proofOfPayment: paymentToEdit.proofOfPayment || '',
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
                month: initialData?.month || new Date().getMonth() + 1,
                year: initialData?.year || new Date().getFullYear(),
                paidOnTime: true,
                paymentMethod: 'CASH',
                proofOfPayment: '',
                notes: ''
            });
        }
    };

    const handleSavePayment = () => {
        if (!showPaymentModal || !newPayment.amount) return;
        const tenant = tenants.find(t => t.id === showPaymentModal);
        const prop = tenant?.propertyId ? properties.find(p => p.id === tenant.propertyId) : null;

        if (editingPayment) {
            const updatedPayment: TenantPayment = {
                ...editingPayment,
                amount: parseFloat(newPayment.amount),
                month: newPayment.month,
                year: newPayment.year,
                paidOnTime: newPayment.paidOnTime,
                paymentMethod: newPayment.paymentMethod,
                proofOfPayment: newPayment.proofOfPayment,
                notes: newPayment.notes
            };
            onUpdatePayment(updatedPayment);
            toast.success('Pago actualizado correctamente');
        } else {
            const payment: TenantPayment = {
                id: `pay-${Date.now()}`,
                tenantId: showPaymentModal,
                propertyId: tenant?.propertyId || null,
                amount: parseFloat(newPayment.amount),
                currency: prop?.currency || 'ARS',
                month: newPayment.month,
                year: newPayment.year,
                paidOnTime: newPayment.paidOnTime,
                paymentDate: new Date().toISOString().split('T')[0],
                paymentMethod: newPayment.paymentMethod,
                proofOfPayment: newPayment.proofOfPayment,
                notes: newPayment.notes
            };
            onRegisterPayment(payment);
            toast.success('Pago registrado correctamente');
        }

        setNewPayment({
            amount: '',
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
            paidOnTime: true,
            paymentMethod: 'CASH',
            proofOfPayment: '',
            notes: ''
        });
        setShowPaymentModal(null);
        setEditingPayment(null);
        setIsUploading(false);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const folder = showPaymentModal ? `tenants/${showPaymentModal}` : 'general';
            const publicUrl = await uploadPaymentProof(file, folder);

            if (publicUrl) {
                setNewPayment(prev => ({ ...prev, proofOfPayment: publicUrl }));
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

    const getPropertyAddress = (propertyId: string | null) => {
        if (!propertyId) return 'Sin asignar';
        const prop = properties.find(p => p.id === propertyId);
        return prop ? (prop.unitLabel ? `${prop.address} - ${prop.unitLabel}` : prop.address) : 'Desconocido';
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">
                        Inquilinos
                    </h1>
                    <p className="text-gray-500 mt-1 text-sm">
                        {tenants.length} {tenants.length === 1 ? 'inquilino' : 'inquilinos'} registrado{tenants.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white font-semibold text-sm shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 transition-all active:scale-95"
                >
                    <UserPlus size={18} /> Agregar Inquilino
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-2xl border border-blue-200">
                    <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Total Inquilinos</p>
                    <p className="text-3xl font-bold text-blue-900 mt-1">{tenants.length}</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-5 rounded-2xl border border-green-200">
                    <p className="text-xs font-bold text-green-700 uppercase tracking-wider">Con Inmueble</p>
                    <p className="text-3xl font-bold text-green-900 mt-1">{tenants.filter(t => t.propertyId).length}</p>
                </div>
                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-5 rounded-2xl border border-yellow-200">
                    <p className="text-xs font-bold text-yellow-700 uppercase tracking-wider">Pagos Registrados</p>
                    <p className="text-3xl font-bold text-yellow-900 mt-1">{payments.length}</p>
                </div>
                <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-5 rounded-2xl border border-pink-200">
                    <p className="text-xs font-bold text-pink-700 uppercase tracking-wider">Vacantes</p>
                    <p className="text-3xl font-bold text-pink-900 mt-1">{vacantProperties.length}</p>
                </div>
            </div>

            {/* Tenant List */}
            {tenants.length === 0 ? (
                <div className="text-center py-16 px-6 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300">
                    <UserPlus size={48} className="text-gray-400 mx-auto mb-4" />
                    <p className="text-lg font-semibold text-gray-600">No hay inquilinos registrados</p>
                    <p className="text-sm text-gray-400 mt-1">Agrega tu primer inquilino para empezar a trackear pagos</p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {tenants.map(tenant => {
                        const metrics = getTenantMetrics(tenant.id);
                        const isExpanded = expandedTenant === tenant.id;
                        const prop = tenant.propertyId ? properties.find(p => p.id === tenant.propertyId) : null;

                        return (
                            <div key={tenant.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
                                {/* Main Row */}
                                <div
                                    className="flex items-center p-5 gap-4 cursor-pointer"
                                    onClick={() => setExpandedTenant(isExpanded ? null : tenant.id)}
                                >
                                    {/* Avatar */}
                                    <div
                                        className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-sm`}
                                        style={{
                                            background: `linear-gradient(135deg, ${metrics.onTimeRate >= 80 ? '#22c55e' : metrics.onTimeRate >= 50 ? '#f59e0b' : '#ef4444'}, ${metrics.onTimeRate >= 80 ? '#16a34a' : metrics.onTimeRate >= 50 ? '#d97706' : '#dc2626'})`
                                        }}
                                    >
                                        {tenant.name.charAt(0).toUpperCase()}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-gray-800 text-lg">
                                            {tenant.name}
                                        </h3>
                                        <div className="flex items-center gap-4 mt-1 flex-wrap">
                                            <span className="flex items-center gap-1.5 text-gray-500 text-sm">
                                                <Home size={14} /> {getPropertyAddress(tenant.propertyId)}
                                            </span>
                                            {tenant.phone && (
                                                <span className="flex items-center gap-1.5 text-gray-500 text-sm">
                                                    <Phone size={14} /> {tenant.phone}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Metrics Summary */}
                                    <div className="flex items-center gap-6 shrink-0">
                                        <div className="text-right hidden sm:block">
                                            <p className="text-[10px] text-gray-400 font-bold uppercase">PUNTUALIDAD</p>
                                            <p className={`text-base font-bold ${metrics.onTimeRate >= 80 ? 'text-green-600' : metrics.onTimeRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                {metrics.totalPayments > 0 ? `${metrics.onTimeRate}%` : '—'}
                                            </p>
                                        </div>
                                        <div className="text-right hidden sm:block">
                                            <p className="text-[10px] text-gray-400 font-bold uppercase">TOTAL PAGADO</p>
                                            <p className="text-base font-bold text-gray-800">
                                                {metrics.totalPaid > 0 ? formatCurrency(metrics.totalPaid, metrics.currency) : '—'}
                                            </p>
                                        </div>
                                        {isExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div className="border-t border-gray-100 p-5 bg-gray-50/50 space-y-5 animate-in slide-in-from-top-2 duration-200">

                                        {/* Owner View: Financial Summary */}
                                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                            <p className="text-xs font-bold text-gray-500 uppercase mb-3">
                                                Balance de la Propiedad
                                            </p>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div>
                                                    <p className="text-xs text-gray-500 font-semibold mb-1">INGRESOS (Alquileres)</p>
                                                    <p className="text-lg font-bold text-green-600">
                                                        {formatCurrency(metrics.totalPaid, metrics.currency)}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 font-semibold mb-1">GASTOS (Mantenimiento)</p>
                                                    <p className="text-lg font-bold text-red-500">
                                                        {(() => {
                                                            const propExpenses = maintenanceTasks
                                                                .filter(t => t.propertyId === tenant.propertyId && t.status === 'COMPLETED')
                                                                .reduce((acc, t) => acc + (t.cost || 0), 0);
                                                            return formatCurrency(propExpenses, 'ARS');
                                                        })()}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 font-semibold mb-1">RESULTADO NETO</p>
                                                    <p className="text-lg font-bold text-gray-800">
                                                        {(() => {
                                                            const propExpenses = maintenanceTasks
                                                                .filter(t => t.propertyId === tenant.propertyId && t.status === 'COMPLETED')
                                                                .reduce((acc, t) => acc + (t.cost || 0), 0);
                                                            const net = metrics.totalPaid - propExpenses;
                                                            return formatCurrency(net, 'ARS');
                                                        })()}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Monthly Grid */}
                                        <div>
                                            <p className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
                                                Historial de Pagos — {new Date().getFullYear()} <span className="text-xs font-normal text-gray-400">(Click para editar)</span>
                                            </p>
                                            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-2">
                                                {metrics.monthlyBreakdown.map((m) => {
                                                    const paymentForMonth = payments.find(p => p.tenantId === tenant.id && p.month === m.month && p.year === new Date().getFullYear());
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
                                                            className={`text-center p-2 rounded-xl border cursor-pointer transition-all hover:scale-105 active:scale-95 relative ${m.paid ? 'bg-green-50 border-green-200' : 'bg-gray-100 border-gray-200 hover:bg-gray-200'}`}
                                                        >
                                                            <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">
                                                                {MONTH_NAMES[m.month - 1]}
                                                            </p>
                                                            {m.paid ? (
                                                                <CheckCircle size={16} className="text-green-500 mx-auto" />
                                                            ) : (
                                                                <div className="h-4 flex items-center justify-center">
                                                                    <div className="w-2 h-2 rounded-full bg-gray-300" />
                                                                </div>
                                                            )}
                                                            {m.amount > 0 && (
                                                                <p className="text-[10px] text-gray-600 font-bold mt-1 truncate">
                                                                    {formatCurrency(m.amount, metrics.currency)}
                                                                </p>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>

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
                                                    if (confirm(`¿Eliminar inquilino "${tenant.name}"?`)) {
                                                        onDeleteTenant(tenant.id);
                                                        toast.success('Inquilino eliminado');
                                                    }
                                                }}
                                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 text-red-500 border border-red-200 text-sm font-semibold hover:bg-red-100 transition-colors"
                                            >
                                                <Trash2 size={16} /> Eliminar
                                            </button>
                                        </div>
                                    </div>
                                )
                                }
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ========== ADD TENANT MODAL ========== */}
            {
                showAddModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in scale-95 duration-200">
                            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50">
                                <h2 className="text-xl font-bold text-gray-800">
                                    Nuevo Inquilino
                                </h2>
                                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                                    <X size={20} className="text-gray-500" />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-semibold text-gray-600">Nombre *</label>
                                    <input
                                        value={newTenant.name}
                                        onChange={e => setNewTenant(p => ({ ...p, name: e.target.value }))}
                                        placeholder="Nombre completo"
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-semibold text-gray-600">Teléfono</label>
                                    <input
                                        value={newTenant.phone}
                                        onChange={e => setNewTenant(p => ({ ...p, phone: e.target.value }))}
                                        placeholder="11-1234-5678"
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-semibold text-gray-600">Email</label>
                                    <input
                                        value={newTenant.email}
                                        onChange={e => setNewTenant(p => ({ ...p, email: e.target.value }))}
                                        placeholder="email@ejemplo.com"
                                        type="email"
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-semibold text-gray-600">Asignar a Inmueble (opcional)</label>
                                    <select
                                        value={newTenant.propertyId}
                                        onChange={e => setNewTenant(p => ({ ...p, propertyId: e.target.value }))}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
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

                            <div className="p-6 pt-0">
                                <button
                                    onClick={handleAddTenant}
                                    disabled={!newTenant.name.trim()}
                                    className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all active:scale-[0.98] ${newTenant.name.trim() ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30' : 'bg-gray-300 cursor-not-allowed shadow-none'}`}
                                >
                                    Agregar Inquilino
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ========== PAYMENT MODAL ========== */}
            {
                showPaymentModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in scale-95 duration-200">
                            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50">
                                <h2 className="text-xl font-bold text-gray-800">
                                    Registrar Pago
                                </h2>
                                <button onClick={() => { setShowPaymentModal(null); setEditingPayment(null); }} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                                    <X size={20} className="text-gray-500" />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-semibold text-gray-600">Monto *</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-2.5 text-gray-400">$</span>
                                        <input
                                            value={newPayment.amount}
                                            onChange={e => setNewPayment(p => ({ ...p, amount: e.target.value }))}
                                            placeholder="0"
                                            type="number"
                                            className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none transition-all font-bold text-gray-800"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-sm font-semibold text-gray-600">Mes</label>
                                        <select
                                            value={newPayment.month}
                                            onChange={e => setNewPayment(p => ({ ...p, month: parseInt(e.target.value) }))}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none transition-all bg-white"
                                        >
                                            {MONTH_NAMES.map((name, i) => (
                                                <option key={i} value={i + 1}>{name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-semibold text-gray-600">Año</label>
                                        <input
                                            value={newPayment.year}
                                            onChange={e => setNewPayment(p => ({ ...p, year: parseInt(e.target.value) }))}
                                            type="number"
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <label className="text-sm font-semibold text-gray-600">
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
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                                        Comprobante de Pago
                                    </label>

                                    <input
                                        type="file"
                                        accept="image/*,application/pdf"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                        id="proof-upload"
                                        disabled={isUploading}
                                    />

                                    {newPayment.proofOfPayment ? (
                                        <div className="flex items-center justify-between bg-green-50 border border-green-200 p-2 rounded-lg">
                                            <a
                                                href={newPayment.proofOfPayment}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs font-semibold text-green-700 hover:underline flex items-center gap-1 truncate max-w-[200px]"
                                            >
                                                <CheckCircle size={12} /> Ver Comprobante
                                            </a>
                                            <button
                                                onClick={() => setNewPayment(p => ({ ...p, proofOfPayment: '' }))}
                                                className="p-1 hover:bg-green-100 rounded text-red-400"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <label
                                            htmlFor="proof-upload"
                                            className={`flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-dashed border-gray-300 text-sm font-medium text-gray-500 hover:bg-white hover:border-gray-400 transition-all cursor-pointer ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            {isUploading ? <Loader size={16} className="animate-spin" /> : <Upload size={16} />}
                                            {isUploading ? 'Subiendo...' : 'Adjuntar PDF / Foto'}
                                        </label>
                                    )}

                                    {!newPayment.proofOfPayment && (
                                        <input
                                            value={newPayment.proofOfPayment}
                                            onChange={e => setNewPayment(p => ({ ...p, proofOfPayment: e.target.value }))}
                                            placeholder="O escribe ID de transferencia..."
                                            className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:ring-2 focus:ring-green-500 outline-none mt-2"
                                        />
                                    )}
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
                                    <label className="text-sm font-semibold text-gray-600">Notas</label>
                                    <textarea
                                        value={newPayment.notes}
                                        onChange={e => setNewPayment(p => ({ ...p, notes: e.target.value }))}
                                        placeholder="Detalles adicionales..."
                                        rows={2}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none transition-all resize-none"
                                    />
                                </div>
                            </div>

                            <div className="p-6 pt-0">
                                <button
                                    onClick={handleSavePayment}
                                    disabled={!newPayment.amount}
                                    className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all active:scale-[0.98] ${newPayment.amount ? 'bg-green-600 hover:bg-green-700 shadow-green-500/30' : 'bg-gray-300 cursor-not-allowed shadow-none'}`}
                                >
                                    {editingPayment ? 'Guardar Cambios' : 'Registrar Pago'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default TenantsView;

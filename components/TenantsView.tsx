import React, { useState } from 'react';
import { Tenant, TenantPayment, Property } from '../types';
import { formatCurrency } from '../utils/currency';
import { UserPlus, Trash2, DollarSign, Phone, Home, CheckCircle, XCircle, X, ChevronDown, ChevronUp } from 'lucide-react';

interface TenantsViewProps {
    tenants: Tenant[];
    payments: TenantPayment[];
    properties: Property[];
    onSaveTenant: (tenant: Tenant) => void;
    onDeleteTenant: (tenantId: string) => void;
    onRegisterPayment: (payment: TenantPayment) => void;
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
    getTenantMetrics,
}) => {
    const [showAddModal, setShowAddModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState<string | null>(null);
    const [expandedTenant, setExpandedTenant] = useState<string | null>(null);
    const [newTenant, setNewTenant] = useState({ name: '', phone: '', email: '', propertyId: '' });
    const [newPayment, setNewPayment] = useState({ amount: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(), paidOnTime: true });

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
        setNewTenant({ name: '', phone: '', email: '', propertyId: '' });
        setShowAddModal(false);
    };

    const handleAddPayment = () => {
        if (!showPaymentModal || !newPayment.amount) return;
        const tenant = tenants.find(t => t.id === showPaymentModal);
        const prop = tenant?.propertyId ? properties.find(p => p.id === tenant.propertyId) : null;

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
        };
        onRegisterPayment(payment);
        setNewPayment({ amount: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(), paidOnTime: true });
        setShowPaymentModal(null);
    };

    const getPropertyAddress = (propertyId: string | null) => {
        if (!propertyId) return 'Sin asignar';
        const prop = properties.find(p => p.id === propertyId);
        return prop ? (prop.unitLabel ? `${prop.address} - ${prop.unitLabel}` : prop.address) : 'Desconocido';
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1e293b', margin: 0 }}>
                        Inquilinos
                    </h1>
                    <p style={{ color: '#64748b', marginTop: '4px', fontSize: '14px' }}>
                        {tenants.length} {tenants.length === 1 ? 'inquilino' : 'inquilinos'} registrado{tenants.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '10px 20px', borderRadius: '12px',
                        background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white',
                        border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '14px',
                        boxShadow: '0 2px 8px rgba(59,130,246,0.3)',
                    }}
                >
                    <UserPlus size={18} /> Agregar Inquilino
                </button>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{ background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)', padding: '16px 20px', borderRadius: '14px', border: '1px solid #bae6fd' }}>
                    <p style={{ fontSize: '12px', color: '#0369a1', fontWeight: '600', textTransform: 'uppercase', margin: 0 }}>Total Inquilinos</p>
                    <p style={{ fontSize: '28px', fontWeight: '700', color: '#0c4a6e', margin: '4px 0 0' }}>{tenants.length}</p>
                </div>
                <div style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', padding: '16px 20px', borderRadius: '14px', border: '1px solid #bbf7d0' }}>
                    <p style={{ fontSize: '12px', color: '#15803d', fontWeight: '600', textTransform: 'uppercase', margin: 0 }}>Con Inmueble</p>
                    <p style={{ fontSize: '28px', fontWeight: '700', color: '#14532d', margin: '4px 0 0' }}>{tenants.filter(t => t.propertyId).length}</p>
                </div>
                <div style={{ background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', padding: '16px 20px', borderRadius: '14px', border: '1px solid #fde68a' }}>
                    <p style={{ fontSize: '12px', color: '#a16207', fontWeight: '600', textTransform: 'uppercase', margin: 0 }}>Pagos Registrados</p>
                    <p style={{ fontSize: '28px', fontWeight: '700', color: '#78350f', margin: '4px 0 0' }}>{payments.length}</p>
                </div>
                <div style={{ background: 'linear-gradient(135deg, #fdf2f8, #fce7f3)', padding: '16px 20px', borderRadius: '14px', border: '1px solid #fbcfe8' }}>
                    <p style={{ fontSize: '12px', color: '#be185d', fontWeight: '600', textTransform: 'uppercase', margin: 0 }}>Vacantes</p>
                    <p style={{ fontSize: '28px', fontWeight: '700', color: '#831843', margin: '4px 0 0' }}>{vacantProperties.length}</p>
                </div>
            </div>

            {/* Tenant List */}
            {tenants.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '60px 20px',
                    background: '#f8fafc', borderRadius: '16px', border: '2px dashed #cbd5e1',
                }}>
                    <UserPlus size={48} style={{ color: '#94a3b8', marginBottom: '12px' }} />
                    <p style={{ fontSize: '18px', color: '#64748b', fontWeight: '600' }}>No hay inquilinos registrados</p>
                    <p style={{ color: '#94a3b8', fontSize: '14px' }}>Agrega tu primer inquilino para empezar a trackear pagos</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {tenants.map(tenant => {
                        const metrics = getTenantMetrics(tenant.id);
                        const isExpanded = expandedTenant === tenant.id;
                        const prop = tenant.propertyId ? properties.find(p => p.id === tenant.propertyId) : null;

                        return (
                            <div key={tenant.id} style={{
                                background: 'white', borderRadius: '16px',
                                border: '1px solid #e2e8f0', overflow: 'hidden',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                                transition: 'box-shadow 0.2s',
                            }}>
                                {/* Main Row */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', padding: '16px 20px', gap: '16px',
                                    cursor: 'pointer',
                                }} onClick={() => setExpandedTenant(isExpanded ? null : tenant.id)}>
                                    {/* Avatar */}
                                    <div style={{
                                        width: '48px', height: '48px', borderRadius: '50%',
                                        background: `linear-gradient(135deg, ${metrics.onTimeRate >= 80 ? '#22c55e' : metrics.onTimeRate >= 50 ? '#f59e0b' : '#ef4444'}, ${metrics.onTimeRate >= 80 ? '#16a34a' : metrics.onTimeRate >= 50 ? '#d97706' : '#dc2626'})`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'white', fontWeight: '700', fontSize: '18px', flexShrink: 0,
                                    }}>
                                        {tenant.name.charAt(0).toUpperCase()}
                                    </div>

                                    {/* Info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <h3 style={{ fontWeight: '600', color: '#1e293b', margin: 0, fontSize: '16px' }}>
                                            {tenant.name}
                                        </h3>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px', flexWrap: 'wrap' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b', fontSize: '13px' }}>
                                                <Home size={14} /> {getPropertyAddress(tenant.propertyId)}
                                            </span>
                                            {tenant.phone && (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b', fontSize: '13px' }}>
                                                    <Phone size={14} /> {tenant.phone}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Metrics Summary */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0, fontWeight: '600' }}>PUNTUALIDAD</p>
                                            <p style={{
                                                fontSize: '16px', fontWeight: '700', margin: 0,
                                                color: metrics.onTimeRate >= 80 ? '#16a34a' : metrics.onTimeRate >= 50 ? '#d97706' : '#ef4444',
                                            }}>
                                                {metrics.totalPayments > 0 ? `${metrics.onTimeRate}%` : '—'}
                                            </p>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0, fontWeight: '600' }}>TOTAL PAGADO</p>
                                            <p style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', margin: 0 }}>
                                                {metrics.totalPaid > 0 ? formatCurrency(metrics.totalPaid, metrics.currency) : '—'}
                                            </p>
                                        </div>
                                        {isExpanded ? <ChevronUp size={20} color="#94a3b8" /> : <ChevronDown size={20} color="#94a3b8" />}
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div style={{ borderTop: '1px solid #f1f5f9', padding: '16px 20px', background: '#fafbfc' }}>
                                        {/* Monthly Grid */}
                                        <p style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '10px', margin: '0 0 10px' }}>
                                            Historial de Pagos — {new Date().getFullYear()}
                                        </p>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '6px', marginBottom: '16px' }}>
                                            {metrics.monthlyBreakdown.map((m) => (
                                                <div key={m.month} style={{
                                                    textAlign: 'center', padding: '8px 4px', borderRadius: '8px',
                                                    background: m.paid ? '#dcfce7' : '#f1f5f9',
                                                    border: `1px solid ${m.paid ? '#bbf7d0' : '#e2e8f0'}`,
                                                }}>
                                                    <p style={{ fontSize: '10px', color: '#64748b', margin: 0, fontWeight: '600' }}>
                                                        {MONTH_NAMES[m.month - 1]}
                                                    </p>
                                                    {m.paid ? (
                                                        <CheckCircle size={16} style={{ color: '#22c55e', marginTop: '4px' }} />
                                                    ) : (
                                                        <XCircle size={16} style={{ color: '#cbd5e1', marginTop: '4px' }} />
                                                    )}
                                                    {m.amount > 0 && (
                                                        <p style={{ fontSize: '10px', color: '#475569', margin: '2px 0 0', fontWeight: '600' }}>
                                                            {formatCurrency(m.amount, metrics.currency)}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Actions */}
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setShowPaymentModal(tenant.id); }}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '6px',
                                                    padding: '8px 16px', borderRadius: '10px',
                                                    background: '#22c55e', color: 'white', border: 'none',
                                                    cursor: 'pointer', fontWeight: '600', fontSize: '13px',
                                                }}
                                            >
                                                <DollarSign size={16} /> Registrar Pago
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm(`¿Eliminar inquilino "${tenant.name}"?`)) {
                                                        onDeleteTenant(tenant.id);
                                                    }
                                                }}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '6px',
                                                    padding: '8px 16px', borderRadius: '10px',
                                                    background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca',
                                                    cursor: 'pointer', fontWeight: '600', fontSize: '13px',
                                                }}
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
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px',
                }}>
                    <div style={{
                        background: 'white', borderRadius: '20px', padding: '28px', width: '100%',
                        maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', margin: 0 }}>
                                Nuevo Inquilino
                            </h2>
                            <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                                <X size={22} color="#94a3b8" />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                                    Nombre *
                                </label>
                                <input
                                    value={newTenant.name}
                                    onChange={e => setNewTenant(p => ({ ...p, name: e.target.value }))}
                                    placeholder="Nombre completo"
                                    style={{
                                        width: '100%', padding: '10px 14px', borderRadius: '10px',
                                        border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                                    Teléfono
                                </label>
                                <input
                                    value={newTenant.phone}
                                    onChange={e => setNewTenant(p => ({ ...p, phone: e.target.value }))}
                                    placeholder="11-1234-5678"
                                    style={{
                                        width: '100%', padding: '10px 14px', borderRadius: '10px',
                                        border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                                    Email
                                </label>
                                <input
                                    value={newTenant.email}
                                    onChange={e => setNewTenant(p => ({ ...p, email: e.target.value }))}
                                    placeholder="email@ejemplo.com"
                                    type="email"
                                    style={{
                                        width: '100%', padding: '10px 14px', borderRadius: '10px',
                                        border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                                    Asignar a Inmueble (opcional)
                                </label>
                                <select
                                    value={newTenant.propertyId}
                                    onChange={e => setNewTenant(p => ({ ...p, propertyId: e.target.value }))}
                                    style={{
                                        width: '100%', padding: '10px 14px', borderRadius: '10px',
                                        border: '1px solid #d1d5db', fontSize: '14px', outline: 'none',
                                        background: 'white', boxSizing: 'border-box',
                                    }}
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

                        <button
                            onClick={handleAddTenant}
                            disabled={!newTenant.name.trim()}
                            style={{
                                width: '100%', padding: '12px', borderRadius: '12px', marginTop: '20px',
                                background: newTenant.name.trim() ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : '#e2e8f0',
                                color: newTenant.name.trim() ? 'white' : '#94a3b8',
                                border: 'none', cursor: newTenant.name.trim() ? 'pointer' : 'not-allowed',
                                fontWeight: '600', fontSize: '15px',
                            }}
                        >
                            Agregar Inquilino
                        </button>
                    </div>
                </div>
            )}

            {/* ========== PAYMENT MODAL ========== */}
            {showPaymentModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px',
                }}>
                    <div style={{
                        background: 'white', borderRadius: '20px', padding: '28px', width: '100%',
                        maxWidth: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', margin: 0 }}>
                                Registrar Pago
                            </h2>
                            <button onClick={() => setShowPaymentModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                                <X size={22} color="#94a3b8" />
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                                    Monto *
                                </label>
                                <input
                                    value={newPayment.amount}
                                    onChange={e => setNewPayment(p => ({ ...p, amount: e.target.value }))}
                                    placeholder="450000"
                                    type="number"
                                    style={{
                                        width: '100%', padding: '10px 14px', borderRadius: '10px',
                                        border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                                    }}
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Mes</label>
                                    <select
                                        value={newPayment.month}
                                        onChange={e => setNewPayment(p => ({ ...p, month: parseInt(e.target.value) }))}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #d1d5db', fontSize: '14px', background: 'white', boxSizing: 'border-box' }}
                                    >
                                        {MONTH_NAMES.map((name, i) => (
                                            <option key={i} value={i + 1}>{name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Año</label>
                                    <input
                                        value={newPayment.year}
                                        onChange={e => setNewPayment(p => ({ ...p, year: parseInt(e.target.value) }))}
                                        type="number"
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box' }}
                                    />
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                                    ¿Pagó a tiempo?
                                </label>
                                <button
                                    onClick={() => setNewPayment(p => ({ ...p, paidOnTime: !p.paidOnTime }))}
                                    style={{
                                        padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px',
                                        background: newPayment.paidOnTime ? '#dcfce7' : '#fef2f2',
                                        color: newPayment.paidOnTime ? '#16a34a' : '#ef4444',
                                    }}
                                >
                                    {newPayment.paidOnTime ? 'Sí ✓' : 'No ✗'}
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={handleAddPayment}
                            disabled={!newPayment.amount}
                            style={{
                                width: '100%', padding: '12px', borderRadius: '12px', marginTop: '20px',
                                background: newPayment.amount ? 'linear-gradient(135deg, #22c55e, #16a34a)' : '#e2e8f0',
                                color: newPayment.amount ? 'white' : '#94a3b8',
                                border: 'none', cursor: newPayment.amount ? 'pointer' : 'not-allowed',
                                fontWeight: '600', fontSize: '15px',
                            }}
                        >
                            Registrar Pago
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TenantsView;

import React, { useState, useMemo, useEffect } from 'react';
import { User, TenantPayment } from '../types';
import { useDataContext } from '../context/DataContext';
import { MONTH_NAMES } from '../constants';
import { supabase } from '../services/supabaseClient';
import { dbToExpenseSheet } from '../utils/mappers';
import { parseExpenseSheet } from '../utils/expenseSheetParser';
import UploadReceiptModal from './UploadReceiptModal';
import PaymentDetailModal from './PaymentDetailModal';
import { LogOut, Calendar, Clock, CheckCircle, AlertCircle, Home, Bell, RotateCcw, Wallet, Receipt, ChevronRight, ChevronDown, Plus, FileText, X } from 'lucide-react';

// Vencimiento por convención: día 15 del mes siguiente a la liquidación.
const computeDueDate = (month: number, year: number): string => {
    const m = month === 12 ? 1 : month + 1;
    const y = month === 12 ? year + 1 : year;
    return `15-${String(m).padStart(2, '0')}-${y}`;
};

// ISO (YYYY-MM-DD) → DD-MM-YYYY para mostrar al inquilino.
const formatDate = (iso?: string): string => {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return d ? `${d}-${m}-${y}` : iso;
};

type MonthStatus = 'PENDING' | 'PAID' | 'REVISION' | 'RETURNED';

// Chip de estado reutilizable (colores semánticos de CLAUDE.md).
const StatusChip: React.FC<{ status: MonthStatus }> = ({ status }) => {
    const map = {
        PAID: { label: 'Pagado', Icon: CheckCircle, cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
        REVISION: { label: 'En revisión', Icon: Clock, cls: 'text-amber-700 bg-amber-50 border-amber-200' },
        RETURNED: { label: 'Corregir', Icon: RotateCcw, cls: 'text-amber-800 bg-amber-50 border-amber-300' },
        PENDING: { label: 'Pendiente', Icon: Calendar, cls: 'text-slate-600 bg-slate-50 border-slate-200' },
    }[status];
    const { label, Icon, cls } = map;
    return (
        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full border whitespace-nowrap ${cls}`}>
            <Icon className="w-3 h-3" /> {label}
        </span>
    );
};

interface Notification {
    id: string;
    title: string;
    message: string;
    type: string;
    payment_id: string | null;
    read: boolean;
    created_at: string;
}

interface TenantPortalProps {
    currentUser: User;
    onLogout: () => void;
}

const TenantPortal: React.FC<TenantPortalProps> = ({ currentUser, onLogout }) => {
    const { tenants, payments, properties, setPayments, expenseSheets, setExpenseSheets, isLoading } = useDataContext();
    const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
    const [selectedPayment, setSelectedPayment] = useState<TenantPayment | null>(null);
    const [showMonthPicker, setShowMonthPicker] = useState(false);
    const [showDetail, setShowDetail] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [showNotifDropdown, setShowNotifDropdown] = useState(false);
    const currentYear = new Date().getFullYear();

    // Find the tenant record corresponding to the current user
    const tenantRecord = useMemo(() => {
        return tenants.find(t => t.email.toLowerCase() === currentUser.email.toLowerCase());
    }, [tenants, currentUser]);

    const tenantProperty = useMemo(() => {
        if (!tenantRecord?.propertyId) return null;
        return properties.find(p => p.id === tenantRecord.propertyId) || null;
    }, [tenantRecord, properties]);

    const tenantPaymentsThisYear = useMemo(() => {
        if (!tenantRecord) return [];
        return payments.filter(p => p.tenantId === tenantRecord.id && p.year === currentYear);
    }, [payments, tenantRecord, currentYear]);

    // Expense sheets for this tenant (current year)
    const tenantExpenseSheetsThisYear = useMemo(() => {
        if (!tenantRecord) return [];
        return expenseSheets.filter(s => s.tenantId === tenantRecord.id && s.year === currentYear);
    }, [expenseSheets, tenantRecord, currentYear]);

    // Real-time: nuevas liquidaciones de Nora aparecen sin recargar
    useEffect(() => {
        if (!tenantRecord?.id) return;
        const channel = supabase
            .channel(`tenant_expense_sheets_${tenantRecord.id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'expense_sheets', filter: `tenant_id=eq.${tenantRecord.id}` },
                (payload) => {
                    if (payload.eventType === 'DELETE') {
                        const oldId = (payload.old as any)?.id;
                        if (oldId) setExpenseSheets(prev => prev.filter(s => s.id !== oldId));
                        return;
                    }
                    // Strip sheet_data del payload; se carga lazy al abrir el detalle.
                    const { sheet_data: _omit, ...rest } = (payload.new as any) ?? {};
                    const sheet = dbToExpenseSheet(rest);
                    setExpenseSheets(prev => {
                        const idx = prev.findIndex(s => s.id === sheet.id);
                        if (idx >= 0) {
                            const next = prev.slice();
                            next[idx] = { ...sheet, sheetData: prev[idx].sheetData };
                            return next;
                        }
                        return [sheet, ...prev];
                    });
                }
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [tenantRecord?.id, setExpenseSheets]);

    // Load unread notifications for this tenant
    useEffect(() => {
        if (!currentUser?.email) return;
        const load = async () => {
            const { data } = await supabase
                .from('notifications')
                .select('*')
                .ilike('recipient_email', currentUser.email)
                .eq('read', false)
                .order('created_at', { ascending: false });
            if (data) setNotifications(data as Notification[]);
        };
        load();

        // Real-time: new notifications arrive
        const channel = supabase
            .channel('tenant_notifications')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_email=eq.${currentUser.email}` },
                (payload) => setNotifications(prev => [payload.new as Notification, ...prev])
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [currentUser?.email]);

    const revisionNotifications = notifications.filter(n => n.type === 'PAYMENT_REVISION');

    const markNotificationsRead = async (paymentId: string | null) => {
        const toMark = notifications.filter(n => n.type === 'PAYMENT_REVISION' && (paymentId === null || n.payment_id === paymentId));
        if (toMark.length === 0) return;
        const ids = toMark.map(n => n.id);
        await supabase.from('notifications').update({ read: true }).in('id', ids);
        setNotifications(prev => prev.filter(n => !ids.includes(n.id)));
    };

    const markAllNotificationsRead = async () => {
        if (notifications.length === 0) return;
        const ids = notifications.map(n => n.id);
        await supabase.from('notifications').update({ read: true }).in('id', ids);
        setNotifications([]);
        setShowNotifDropdown(false);
    };

    const getNotifIcon = (type: string) => {
        if (type === 'PAYMENT_APPROVED') return <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />;
        if (type === 'PAYMENT_REVISION') return <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />;
        return <Bell className="w-4 h-4 text-slate-500 shrink-0" />;
    };

    const handleNotifClick = (n: Notification) => {
        const payment = tenantPaymentsThisYear.find(p => p.id === n.payment_id);
        if (payment) setSelectedMonth(payment.month);
        markNotificationsRead(n.payment_id);
        setShowNotifDropdown(false);
    };

    // Loading: datos del contexto aún cargando (evita el flash de "perfil no encontrado").
    if (isLoading && tenants.length === 0) {
        return (
            <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 transition-colors duration-300" role="status" aria-live="polite">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
                <p className="mt-4 text-sm font-medium text-slate-500">Cargando tu información…</p>
            </div>
        );
    }

    // If no tenant record is found (shouldn't happen due to login check, but fallback)
    if (!tenantRecord) {
        return (
            <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 transition-colors duration-300">
                <div className="bg-white border border-white/40 p-8 rounded-3xl shadow-xl text-center max-w-md w-full">
                    <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">No se encontró tu perfil</h2>
                    <p className="text-gray-600 mb-6">Contactate con la administración para que vinculen tu cuenta de correo.</p>
                    <button
                        onClick={onLogout}
                        className="w-full bg-slate-600 text-white py-3 rounded-2xl font-bold hover:bg-slate-700 transition-all active:scale-95"
                    >
                        Cerrar Sesión
                    </button>
                </div>
            </div>
        );
    }

    const handleUploadComplete = (newPayment: TenantPayment) => {
        setPayments(prev => {
            const exists = prev.find(p => p.id === newPayment.id);
            if (exists) return prev.map(p => p.id === newPayment.id ? newPayment : p);
            return [...prev, newPayment];
        });
        markNotificationsRead(newPayment.id);
        setSelectedMonth(null);
    };

    const getMonthStatus = (monthIndex: number) => {
        const payment = tenantPaymentsThisYear.find(p => p.month === monthIndex + 1);
        if (!payment) return 'PENDING';
        if (payment.status === 'APPROVED') return 'PAID';
        if (payment.status === 'RETURNED') return 'RETURNED';
        if (payment.status === 'REVISION') return 'REVISION';
        if (payment.proofOfPayment || payment.proofOfExpenses) return 'REVISION';
        return 'PENDING';
    };

    // ── Datos derivados estilo "home banking" ──────────────────────────────
    // Liquidaciones del inquilino ordenadas (más reciente primero).
    const sheetsOrdered = [...tenantExpenseSheetsThisYear].sort((a, b) => b.month - a.month);

    // Cuenta actual = liquidación más reciente cuyo pago aún no fue aprobado.
    const currentSheet = sheetsOrdered.find(s => getMonthStatus(s.month - 1) !== 'PAID') ?? null;
    const currentParsed = currentSheet
        ? (currentSheet.parsedData ?? (currentSheet.sheetData?.length ? parseExpenseSheet(currentSheet.sheetData) : null))
        : null;
    const balance = currentParsed?.total ?? 0;

    // Informes de pago = comprobantes subidos por el inquilino (más reciente primero).
    const informes = [...tenantPaymentsThisYear]
        .filter(p => p.proofOfExpenses || p.proofOfPayment)
        .sort((a, b) => (b.paymentDate || '').localeCompare(a.paymentDate || ''));

    const handleInformarPago = () => {
        const pendientes = sheetsOrdered.filter(s => getMonthStatus(s.month - 1) !== 'PAID');
        if (pendientes.length === 1) {
            setSelectedMonth(pendientes[0].month);
        } else {
            setShowMonthPicker(true);
        }
    };

    return (
        <div className="h-screen bg-gray-100 flex flex-col transition-colors duration-300">
            {/* HEADER */}
            <header className="bg-gradient-to-r from-slate-600 to-slate-700 text-white px-5 sm:px-8 py-5 sm:py-6 flex items-center justify-between sticky top-0 z-10 shadow-lg shadow-slate-900/20 shrink-0">
                <div className="flex items-center gap-4">
                    {currentUser.photoURL ? (
                        <img src={currentUser.photoURL} alt="Avatar" className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-white/20 shadow-md bg-white/10" />
                    ) : (
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xl sm:text-2xl border-2 border-white/20 shadow-md">
                            {currentUser.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold leading-tight">Hola, {currentUser.name.split(' ')[0]}</h1>
                        <p className="text-slate-100/90 text-sm font-medium flex items-center gap-1.5 mt-0.5">
                            <Home className="w-3.5 h-3.5" /> {tenantProperty ? tenantProperty.address : 'Miembro Inquilino'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* NOTIFICATION BELL */}
                    <div className="relative">
                        <button
                            onClick={() => setShowNotifDropdown(v => !v)}
                            className="p-3 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all flex items-center justify-center relative"
                            title="Notificaciones"
                            aria-label={`Notificaciones${notifications.length > 0 ? ` (${notifications.length} sin leer)` : ''}`}
                            aria-expanded={showNotifDropdown}
                        >
                            <Bell className="w-6 h-6" />
                            {notifications.length > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm">
                                    {notifications.length > 9 ? '9+' : notifications.length}
                                </span>
                            )}
                        </button>
                        {/* Dropdown */}
                        {showNotifDropdown && (
                            <div className="absolute right-0 top-14 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                                    <span className="font-bold text-slate-800 text-sm">Notificaciones</span>
                                    {notifications.length > 0 && (
                                        <button onClick={markAllNotificationsRead} className="text-xs text-slate-600 hover:underline">
                                            Marcar todas leídas
                                        </button>
                                    )}
                                </div>
                                {notifications.length === 0 ? (
                                    <p className="text-center text-slate-400 text-sm py-6">Sin notificaciones</p>
                                ) : (
                                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                                        {notifications.map(n => (
                                            <button
                                                key={n.id}
                                                onClick={() => handleNotifClick(n)}
                                                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                                            >
                                                {getNotifIcon(n.type)}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-slate-800 truncate">{n.title}</p>
                                                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={onLogout}
                        className="p-3 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all group flex items-center justify-center"
                        title="Cerrar sesión"
                        aria-label="Cerrar sesión"
                    >
                        <LogOut className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    </button>
                </div>
            </header>

            {/* BODY */}
            <main className="flex-1 overflow-y-auto min-h-0 max-w-3xl w-full mx-auto p-4 sm:p-6 pb-20">
                {/* TARJETA DE SALDO (Mi Cuenta) */}
                <div className="mb-5 rounded-3xl bg-gradient-to-br from-slate-600 to-slate-700 text-white shadow-xl shadow-slate-900/20 overflow-hidden">
                    <div className="px-6 pt-6 pb-5">
                        <div className="flex items-center gap-2 text-slate-100/90 text-xs font-semibold uppercase tracking-wider">
                            <Wallet className="w-4 h-4" /> Mi cuenta
                        </div>
                        {currentSheet ? (
                            <>
                                <p className="mt-3 text-xs font-medium text-slate-100/80">Saldo a pagar</p>
                                {balance > 0 ? (
                                    <p className="text-4xl sm:text-5xl font-black tabular-nums leading-tight">
                                        ${balance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                    </p>
                                ) : (
                                    <p className="text-3xl font-black leading-tight mt-0.5">A confirmar</p>
                                )}
                                <p className="mt-2 text-sm text-slate-100/90">
                                    {MONTH_NAMES[currentSheet.month - 1]} {currentSheet.year} · Vence el {computeDueDate(currentSheet.month, currentSheet.year)}
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="mt-3 text-3xl font-black leading-tight">{sheetsOrdered.length > 0 ? 'Estás al día' : 'Sin liquidaciones'}</p>
                                <p className="mt-2 text-sm text-slate-100/90">
                                    {sheetsOrdered.length > 0 ? 'No tenés expensas pendientes de pago.' : 'Todavía no hay liquidaciones cargadas.'}
                                </p>
                            </>
                        )}
                    </div>

                    {/* Toggle: ver detalle de la cuenta */}
                    {currentSheet && (
                        <button
                            onClick={() => setShowDetail(v => !v)}
                            className="w-full flex items-center justify-center gap-1.5 py-3 bg-black/15 hover:bg-black/25 transition-colors text-sm font-semibold border-t border-white/10"
                            aria-expanded={showDetail}
                        >
                            Ver detalle de la cuenta
                            <ChevronDown className={`w-4 h-4 transition-transform ${showDetail ? 'rotate-180' : ''}`} />
                        </button>
                    )}

                    {/* Desglose de la liquidación */}
                    {currentSheet && showDetail && (
                        <div className="bg-white text-slate-800">
                            {currentParsed && currentParsed.items.length > 0 ? (
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="text-left px-5 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Concepto</th>
                                            <th className="text-right px-5 py-2.5 font-semibold text-slate-500 text-xs uppercase tracking-wider">Monto</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentParsed.items.map((it, i) => (
                                            <tr key={i} className="border-t border-slate-100">
                                                <td className="px-5 py-2.5 text-slate-700">{it.concept}</td>
                                                <td className="px-5 py-2.5 text-right tabular-nums text-slate-700">
                                                    ${it.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        ))}
                                        <tr className="border-t-2 border-slate-200 bg-slate-50/60">
                                            <td className="px-5 py-3 font-black text-slate-900">TOTAL A PAGAR</td>
                                            <td className="px-5 py-3 text-right font-black tabular-nums text-slate-900">
                                                ${currentParsed.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            ) : (
                                <button
                                    onClick={() => setSelectedMonth(currentSheet.month)}
                                    className="w-full px-5 py-4 text-left text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-between"
                                >
                                    Ver liquidación completa <ChevronRight className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* REVISION NOTIFICATIONS BANNER */}
                {revisionNotifications.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
                        <Bell className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm font-bold text-amber-800 mb-1">
                                La administración requiere correcciones en tus comprobantes
                            </p>
                            {revisionNotifications.map(n => {
                                const payment = tenantPaymentsThisYear.find(p => p.id === n.payment_id);
                                return (
                                    <button
                                        key={n.id}
                                        onClick={() => { if (payment) setSelectedMonth(payment.month); }}
                                        className="block text-xs text-amber-700 mt-1 hover:underline text-left"
                                    >
                                        → {n.message}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* EXPENSAS — liquidaciones cargadas por la administración */}
                <section className="mb-5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 px-1 flex items-center gap-1.5">
                        <Receipt className="w-3.5 h-3.5" /> Expensas
                    </h3>
                    <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
                        {sheetsOrdered.length === 0 ? (
                            <p className="px-4 py-6 text-center text-sm text-slate-400">Todavía no hay liquidaciones cargadas.</p>
                        ) : sheetsOrdered.map(sheet => {
                            const status = getMonthStatus(sheet.month - 1) as MonthStatus;
                            return (
                                <button
                                    key={sheet.id}
                                    onClick={() => setSelectedMonth(sheet.month)}
                                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors text-left"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                                        <Receipt className="w-5 h-5 text-slate-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-800">Liquidación {MONTH_NAMES[sheet.month - 1]} {sheet.year}</p>
                                        <p className="text-xs text-slate-500">Vence el {computeDueDate(sheet.month, sheet.year)}</p>
                                    </div>
                                    <StatusChip status={status} />
                                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* INFORMES DE PAGO — comprobantes subidos por el inquilino */}
                <section className="mb-5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 px-1 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" /> Informes de pago
                    </h3>
                    <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
                        {informes.length === 0 ? (
                            <p className="px-4 py-6 text-center text-sm text-slate-400">Todavía no informaste ningún pago.</p>
                        ) : informes.map(p => {
                            const status = getMonthStatus(p.month - 1) as MonthStatus;
                            const amount = p.expenseAmount ?? p.amount ?? 0;
                            return (
                                <button
                                    key={p.id}
                                    onClick={() => setSelectedPayment(p)}
                                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors text-left"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                                        <FileText className="w-5 h-5 text-emerald-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-slate-500">{formatDate(p.paymentDate)} · {MONTH_NAMES[p.month - 1]}</p>
                                        <p className="text-sm font-bold text-slate-800 tabular-nums">
                                            {p.paymentMethod === 'CASH' ? 'Efectivo' : 'Transferencia'} ${amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                    <StatusChip status={status} />
                                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* INFORMAR PAGO */}
                <button
                    onClick={handleInformarPago}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-slate-600 hover:bg-slate-700 text-white font-bold shadow-lg shadow-slate-600/20 transition-all active:scale-[0.99]"
                >
                    <Plus className="w-5 h-5" /> Informar Pago
                </button>

            </main>

            {/* MODAL Carga de comprobantes */}
            {selectedMonth && (
                <UploadReceiptModal
                    month={selectedMonth}
                    year={currentYear}
                    tenant={tenantRecord}
                    property={tenantProperty}
                    existingPayment={tenantPaymentsThisYear.find(p => p.month === selectedMonth)}
                    expenseSheet={tenantExpenseSheetsThisYear.find(s => s.month === selectedMonth)}
                    onClose={() => setSelectedMonth(null)}
                    onSuccess={handleUploadComplete}
                />
            )}

            {/* MODAL Detalle de pago */}
            {selectedPayment && (
                <PaymentDetailModal
                    payment={selectedPayment}
                    property={tenantProperty}
                    onClose={() => setSelectedPayment(null)}
                />
            )}

            {/* MODAL Selector de mes para informar pago */}
            {showMonthPicker && (
                <div className="fixed inset-0 z-[1500] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowMonthPicker(false)}>
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-md transition-opacity" />
                    <div
                        className="bg-white border border-white/40 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md flex flex-col max-h-[90vh] relative animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 duration-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0 rounded-t-3xl sm:rounded-t-2xl">
                            <h2 className="text-lg font-bold text-slate-800">Elegí el mes a informar</h2>
                            <button onClick={() => setShowMonthPicker(false)} aria-label="Cerrar" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all active:scale-95">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="overflow-y-auto flex-1 p-4 grid grid-cols-3 gap-2.5">
                            {MONTH_NAMES.map((monthName, index) => {
                                const status = getMonthStatus(index) as MonthStatus;
                                return (
                                    <button
                                        key={monthName}
                                        onClick={() => { setShowMonthPicker(false); setSelectedMonth(index + 1); }}
                                        className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all active:scale-95
                                            ${status === 'PAID' ? 'border-emerald-200 bg-emerald-50' : ''}
                                            ${status === 'REVISION' || status === 'RETURNED' ? 'border-amber-200 bg-amber-50' : ''}
                                            ${status === 'PENDING' ? 'border-slate-200 bg-white hover:border-slate-300' : ''}`}
                                    >
                                        <span className="text-sm font-bold text-slate-700">{monthName.slice(0, 3)}</span>
                                        {status === 'PAID' && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                                        {(status === 'REVISION' || status === 'RETURNED') && <Clock className="w-4 h-4 text-amber-600" />}
                                        {status === 'PENDING' && <Calendar className="w-4 h-4 text-slate-400" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TenantPortal;
